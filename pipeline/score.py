"""
Stage 3 — Scoring Engine
Scores all active entities on five acquisition dimensions and assigns
percentile-based tiers: Top 15% = T1, next 40% = T2, bottom 45% = T3.
"""

import os
import logging
import numpy as np
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime

from monte_carlo import weighted_composite

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Dimension weights (must sum to 1.0)
WEIGHTS = {
    "distress": 0.30,
    "succession": 0.25,
    "moat": 0.20,
    "stability": 0.15,
    "lsg_fit": 0.10,
}

# Percentile-based tier cutoffs (NEVER use absolute thresholds)
TIER_T1_PCT = 85.0   # Top 15%
TIER_T2_PCT = 45.0   # 45th–85th percentile


def _get_conn():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    return psycopg2.connect(db_url)


def _get_entities(cur, sector: str | None = None) -> list[dict]:
    """Fetch all active entities with latest financials."""
    query = """
        SELECT
            e.entity_id,
            e.canonical_name,
            e.ccn,
            e.city,
            e.state,
            e.org_type,
            e.proprietary,
            e.is_chain,
            e.entity_age_years,
            f.total_revenue,
            f.medicare_revenue,
            f.total_expenses,
            f.labor_expenses,
            f.ebitda_proxy,
            f.gross_margin_pct,
            f.medicare_pct,
            f.margin_trend,
            f.report_year
        FROM entities e
        LEFT JOIN LATERAL (
            SELECT * FROM hcris_financials
            WHERE entity_id = e.entity_id
            ORDER BY report_year DESC
            LIMIT 1
        ) f ON true
        WHERE e.is_active = true
    """
    params = []
    if sector:
        query += " AND e.org_type = %s"
        params.append(sector)

    cur.execute(query, params)
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _score_distress(entity: dict) -> tuple[float, list[str]]:
    """
    Financial distress score (0-100). Higher = more distressed = better target.
    Signals: low/negative margins, declining revenue, high labor costs.
    """
    flags = []
    score = 50.0  # neutral baseline

    margin = entity.get("gross_margin_pct")
    labor_pct = None
    if entity.get("total_expenses") and entity.get("labor_expenses"):
        labor_pct = entity["labor_expenses"] / entity["total_expenses"] * 100

    revenue = entity.get("total_revenue") or 0
    margin_trend = entity.get("margin_trend", "unknown")

    # Margin signals
    if margin is not None:
        if margin < 0:
            score += 30
            flags.append("negative_margin")
        elif margin < 3:
            score += 20
            flags.append("thin_margin")
        elif margin < 6:
            score += 10
        elif margin > 15:
            score -= 10  # too healthy = less distressed

    # Margin trend
    if margin_trend == "declining":
        score += 15
        flags.append("declining_margins")
    elif margin_trend == "improving":
        score -= 10

    # Labor cost pressure
    if labor_pct is not None:
        if labor_pct > 65:
            score += 15
            flags.append("high_labor_cost")
        elif labor_pct > 55:
            score += 8

    # Revenue scale (small = more distress-susceptible)
    if revenue < 3000000:
        score += 10
    elif revenue < 6000000:
        score += 5
    elif revenue > 20000000:
        score -= 5

    return round(min(max(score, 0), 100), 1), flags


def _score_succession(entity: dict) -> tuple[float, list[str]]:
    """
    Succession risk score (0-100). Higher = higher succession risk = better target.
    Signals: entity age, is_chain=False, single/private ownership.
    """
    flags = []
    score = 40.0  # baseline

    age = entity.get("entity_age_years") or 0
    is_chain = entity.get("is_chain", False)
    proprietary = entity.get("proprietary", "")

    # Age signals
    if age >= 30:
        score += 30
        flags.append("owner_age_75+")
    elif age >= 20:
        score += 20
        flags.append("owner_age_70+")
    elif age >= 15:
        score += 12
        flags.append("owner_age_65+")
    elif age >= 10:
        score += 5

    # Independent vs chain
    if not is_chain:
        score += 20
        flags.append("single_owner")
    else:
        score -= 10

    # Proprietary
    if proprietary == "P":
        score += 10
    elif proprietary == "N":
        score -= 15  # Non-profit less likely to sell

    # No succession planning indicator
    if age >= 20 and not is_chain and proprietary == "P":
        flags.append("no_succession")

    return round(min(max(score, 0), 100), 1), flags


def _score_moat(entity: dict) -> tuple[float, list[str]]:
    """
    Competitive moat score (0-100). Higher = stronger moat = more attractive.
    Signals: Medicare concentration (defensible payer mix), rural market.
    """
    flags = []
    score = 50.0

    medicare_pct = entity.get("medicare_pct") or 0
    state = entity.get("state", "")

    # Medicare concentration is a moat in SNF (harder to replicate)
    if medicare_pct >= 65:
        score += 25
        flags.append("high_medicare_conc")
    elif medicare_pct >= 50:
        score += 15
    elif medicare_pct >= 35:
        score += 5
    elif medicare_pct < 20:
        score -= 15

    # Rural market = natural geographic moat
    zip_code = entity.get("zip") or ""
    if len(zip_code) >= 3:
        # Simple rural proxy — small zip prefix populations
        # Real implementation would use RUCC codes
        rural_zips = {"795", "793", "796", "791", "794", "790"}
        if zip_code[:3] in rural_zips:
            score += 15
            flags.append("rural_market")

    # Entity age as proxy for established relationships
    age = entity.get("entity_age_years") or 0
    if age >= 20:
        score += 10
    elif age >= 10:
        score += 5

    return round(min(max(score, 0), 100), 1), flags


def _score_stability(entity: dict) -> tuple[float, list[str]]:
    """
    Operational stability score (0-100). Higher = more stable = more attractive.
    Signals: revenue scale, Medicare as payer (predictable), margin trend.
    """
    flags = []
    score = 50.0

    revenue = entity.get("total_revenue") or 0
    medicare_pct = entity.get("medicare_pct") or 0
    margin_trend = entity.get("margin_trend", "unknown")
    margin = entity.get("gross_margin_pct")

    # Revenue scale
    if revenue >= 10000000:
        score += 20
    elif revenue >= 6000000:
        score += 12
    elif revenue >= 3000000:
        score += 5
    elif revenue < 1500000:
        score -= 15

    # Medicare payer stability
    if medicare_pct >= 50:
        score += 15
    elif medicare_pct >= 30:
        score += 8

    # Margin trend
    if margin_trend == "stable":
        score += 10
    elif margin_trend == "improving":
        score += 20
    elif margin_trend == "declining":
        score -= 15

    # Positive margin = operational stability
    if margin is not None and margin > 0:
        score += 5
    elif margin is not None and margin < 0:
        score -= 20

    return round(min(max(score, 0), 100), 1), flags


def _score_lsg_fit(entity: dict) -> tuple[float, list[str]]:
    """
    LSG strategic fit score (0-100). Higher = better fit for LSG platform.
    Signals: TX focus, proprietary SNF, revenue in sweet spot, not chain.
    """
    flags = []
    score = 50.0

    state = entity.get("state", "")
    org_type = entity.get("org_type", "")
    proprietary = entity.get("proprietary", "")
    is_chain = entity.get("is_chain", False)
    revenue = entity.get("total_revenue") or 0
    ebitda = entity.get("ebitda_proxy") or 0

    # State preference
    if state == "TX":
        score += 15
    elif state in ("OK", "NM", "AR", "LA"):
        score += 8

    # Org type preference
    if org_type == "SNF":
        score += 10

    # Proprietary preference
    if proprietary == "P":
        score += 10
    elif proprietary == "N":
        score -= 20  # Non-profit rarely sells

    # Revenue sweet spot for LSG ($3M-$15M)
    if 3000000 <= revenue <= 15000000:
        score += 15
    elif revenue > 15000000:
        score -= 5  # Too large

    # EBITDA proxy positive = viable deal
    if ebitda > 0:
        score += 5
    elif ebitda < 0:
        score -= 10

    # Independent preferred
    if not is_chain:
        score += 10

    return round(min(max(score, 0), 100), 1), flags


def _assign_tier(scores: list[float], percentiles: dict) -> list[str]:
    """
    Assign T1/T2/T3 based on percentile thresholds.
    - T1: score >= 85th percentile
    - T2: score >= 45th percentile
    - T3: below 45th percentile
    """
    t1_cutoff = percentiles["p85"]
    t2_cutoff = percentiles["p45"]

    tiers = []
    for s in scores:
        if s >= t1_cutoff:
            tiers.append("T1")
        elif s >= t2_cutoff:
            tiers.append("T2")
        else:
            tiers.append("T3")
    return tiers


def main(sector: str | None = None) -> dict:
    """
    Score all active entities and write results to Neon.

    Args:
        sector: Optional org_type filter (e.g. "SNF")

    Returns:
        Dict with scored, t1, t2, t3 counts.
    """
    conn = _get_conn()
    cur = conn.cursor()
    scored_at = datetime.utcnow()

    try:
        entities = _get_entities(cur, sector=sector)
        if not entities:
            logger.warning("No entities to score")
            return {"scored": 0, "t1": 0, "t2": 0, "t3": 0}

        logger.info(f"Scoring {len(entities)} entities...")

        results = []
        for entity in entities:
            distress_score, distress_flags = _score_distress(entity)
            succession_score, succession_flags = _score_succession(entity)
            moat_score, moat_flags = _score_moat(entity)
            stability_score, stability_flags = _score_stability(entity)
            lsg_fit_score, lsg_fit_flags = _score_lsg_fit(entity)

            composite = weighted_composite(
                distress=distress_score,
                succession=succession_score,
                moat=moat_score,
                stability=stability_score,
                lsg_fit=lsg_fit_score,
                weights=WEIGHTS,
            )

            all_flags = (
                distress_flags + succession_flags
                + moat_flags + stability_flags + lsg_fit_flags
            )

            results.append({
                "entity_id": entity["entity_id"],
                "composite": round(composite, 2),
                "distress": distress_score,
                "succession": succession_score,
                "moat": moat_score,
                "stability": stability_score,
                "lsg_fit": lsg_fit_score,
                "flags": list(set(all_flags)),
                "margin_trend": entity.get("margin_trend", "unknown"),
            })

        # Percentile-based tier assignment
        composites = [r["composite"] for r in results]
        percentiles = {
            "p85": np.percentile(composites, TIER_T1_PCT),
            "p45": np.percentile(composites, TIER_T2_PCT),
        }
        logger.info(
            f"Tier cutoffs — T1 >= {percentiles['p85']:.1f}, "
            f"T2 >= {percentiles['p45']:.1f}"
        )

        tiers = _assign_tier(composites, percentiles)
        for r, tier in zip(results, tiers):
            r["tier"] = tier

        # Write to entity_scores
        score_values = [
            (
                r["entity_id"], scored_at,
                r["composite"], r["distress"], r["succession"],
                r["moat"], r["stability"], r["lsg_fit"],
                r["tier"], r["flags"], r["margin_trend"]
            )
            for r in results
        ]
        execute_values(cur, """
            INSERT INTO entity_scores
                (entity_id, scored_at, composite, distress, succession,
                 moat, stability, lsg_fit, tier, flags, margin_trend)
            VALUES %s
        """, score_values)

        # Write to score_history
        history_values = [
            (r["entity_id"], scored_at, r["composite"], r["tier"])
            for r in results
        ]
        execute_values(cur, """
            INSERT INTO score_history (entity_id, scored_at, composite, tier)
            VALUES %s
        """, history_values)

        conn.commit()

        t1 = sum(1 for r in results if r["tier"] == "T1")
        t2 = sum(1 for r in results if r["tier"] == "T2")
        t3 = sum(1 for r in results if r["tier"] == "T3")

        logger.info(
            f"Scoring complete: {len(results)} scored — "
            f"T1={t1}, T2={t2}, T3={t3}"
        )
        return {"scored": len(results), "t1": t1, "t2": t2, "t3": t3}

    except Exception as e:
        conn.rollback()
        logger.error(f"Scoring failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    sector = os.environ.get("PIPELINE_SECTOR")
    result = main(sector=sector)
    print(result)
