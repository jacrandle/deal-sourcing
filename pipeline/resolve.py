"""
Stage 2 — Entity Resolution
Probabilistically resolves entities across CMS, NPI Registry, and state
incorporation records to produce canonical entity_id mappings.
"""

import os
import re
import logging
import unicodedata
import psycopg2
from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Matching thresholds
HIGH_CONFIDENCE_THRESHOLD = 0.85
LOW_CONFIDENCE_THRESHOLD = 0.60

# Weights for match scoring
WEIGHTS = {
    "name_similarity": 0.45,
    "address_match": 0.25,
    "zip_match": 0.15,
    "state_match": 0.15,
}


def _get_conn():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    return psycopg2.connect(db_url)


def _normalize_name(name: str) -> str:
    """Normalize facility name for comparison."""
    if not name:
        return ""
    # Unicode normalization
    name = unicodedata.normalize("NFKD", name)
    name = name.encode("ascii", "ignore").decode("ascii")
    name = name.upper().strip()
    # Remove common stop words
    stop = [
        "LLC", "INC", "CORP", "LTD", "LP", "L.P.", "L.L.C.", "L.L.P.",
        "CENTER", "CENTRE", "FACILITY", "SERVICES", "HOME", "CARE",
        "HEALTH", "HEALTHCARE", "NURSING", "SKILLED", "OF", "THE", "AND", "&",
    ]
    tokens = name.split()
    tokens = [t for t in tokens if t not in stop]
    return " ".join(tokens)


def _levenshtein_similarity(a: str, b: str) -> float:
    """Compute normalized Levenshtein similarity (0-1)."""
    if not a and not b:
        return 1.0
    if not a or not b:
        return 0.0
    m, n = len(a), len(b)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        prev = dp[:]
        dp[0] = i
        for j in range(1, n + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dp[j] = min(dp[j] + 1, dp[j - 1] + 1, prev[j - 1] + cost)
    distance = dp[n]
    return 1.0 - distance / max(m, n)


def _score_match(entity_a: dict, entity_b: dict) -> float:
    """Score the likelihood that two records represent the same entity."""
    norm_a = _normalize_name(entity_a.get("canonical_name", ""))
    norm_b = _normalize_name(entity_b.get("canonical_name", ""))
    name_sim = _levenshtein_similarity(norm_a, norm_b)

    zip_a = str(entity_a.get("zip", "")).strip()[:5]
    zip_b = str(entity_b.get("zip", "")).strip()[:5]
    zip_match = 1.0 if zip_a and zip_a == zip_b else 0.0

    state_a = str(entity_a.get("state", "")).strip().upper()
    state_b = str(entity_b.get("state", "")).strip().upper()
    state_match = 1.0 if state_a and state_a == state_b else 0.0

    city_a = _normalize_name(entity_a.get("city", ""))
    city_b = _normalize_name(entity_b.get("city", ""))
    addr_sim = _levenshtein_similarity(city_a, city_b)

    score = (
        name_sim * WEIGHTS["name_similarity"]
        + addr_sim * WEIGHTS["address_match"]
        + zip_match * WEIGHTS["zip_match"]
        + state_match * WEIGHTS["state_match"]
    )
    return round(score, 4)


def _get_unresolved_entities(cur) -> list[dict]:
    """Fetch entities that need NPI enrichment."""
    cur.execute("""
        SELECT entity_id, canonical_name, ccn, city, state, zip
        FROM entities
        WHERE npi IS NULL AND is_active = true
    """)
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _get_all_active_entities(cur) -> list[dict]:
    """Fetch all active entities for cross-entity dedup."""
    cur.execute("""
        SELECT entity_id, canonical_name, ccn, city, state, zip
        FROM entities
        WHERE is_active = true
    """)
    cols = [desc[0] for desc in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def _fetch_npi_registry(name: str, state: str) -> list[dict]:
    """
    Query NPPES NPI Registry API for potential matches.
    Returns list of candidate records.
    """
    import requests

    try:
        params = {
            "organization_name": name[:60],
            "state": state,
            "enumeration_type": "NPI-2",
            "limit": 5,
            "version": "2.1",
        }
        resp = requests.get(
            "https://npiregistry.cms.hhs.gov/api/",
            params=params,
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        results = data.get("results", [])
        candidates = []
        for r in results:
            basic = r.get("basic", {})
            addrs = r.get("addresses", [{}])
            addr = addrs[0] if addrs else {}
            candidates.append({
                "npi": r.get("number"),
                "canonical_name": basic.get("organization_name", ""),
                "city": addr.get("city", ""),
                "state": addr.get("state", ""),
                "zip": addr.get("postal_code", "")[:5],
            })
        return candidates
    except Exception as e:
        logger.debug(f"NPI registry lookup failed for {name}: {e}")
        return []


def _enrich_with_npi(cur, entities: list[dict]) -> int:
    """Attempt to match entities to NPI records. Returns enriched count."""
    enriched = 0
    for entity in entities:
        candidates = _fetch_npi_registry(
            entity["canonical_name"],
            entity["state"]
        )
        best_score = 0.0
        best_npi = None

        for candidate in candidates:
            score = _score_match(entity, candidate)
            if score > best_score:
                best_score = score
                best_npi = candidate["npi"]

        if best_npi and best_score >= HIGH_CONFIDENCE_THRESHOLD:
            cur.execute(
                "UPDATE entities SET npi = %s WHERE entity_id = %s",
                (best_npi, entity["entity_id"])
            )
            enriched += 1
            logger.debug(
                f"Matched {entity['canonical_name']} → NPI {best_npi} "
                f"(score={best_score:.3f})"
            )

    return enriched


def _deduplicate_entities(cur, entities: list[dict]) -> int:
    """
    Flag potential duplicate entities (same provider, different CCN).
    Marks lower-confidence records as is_active=false.
    Returns count of duplicates found.
    """
    duplicates = 0
    n = len(entities)

    for i in range(n):
        for j in range(i + 1, n):
            a, b = entities[i], entities[j]
            # Skip if same CCN
            if a.get("ccn") == b.get("ccn"):
                continue
            score = _score_match(a, b)
            if score >= HIGH_CONFIDENCE_THRESHOLD:
                # Mark the newer entity as inactive
                cur.execute("""
                    UPDATE entities
                    SET is_active = false, last_updated = now()
                    WHERE entity_id = %s
                      AND (SELECT last_updated FROM entities WHERE entity_id = %s)
                        > (SELECT last_updated FROM entities WHERE entity_id = %s)
                """, (b["entity_id"], b["entity_id"], a["entity_id"]))
                duplicates += 1
                logger.info(
                    f"Duplicate detected: {a['canonical_name']} ↔ "
                    f"{b['canonical_name']} (score={score:.3f})"
                )

    return duplicates


def main(new_only: bool = False) -> int:
    """
    Run entity resolution pipeline.

    Args:
        new_only: If True, only process entities added since last run.

    Returns:
        Number of entity matches/enrichments found.
    """
    conn = _get_conn()
    cur = conn.cursor()
    total_matches = 0

    try:
        if new_only:
            entities = _get_unresolved_entities(cur)
            logger.info(f"Resolving {len(entities)} unresolved entities (new-only mode)")
        else:
            entities = _get_all_active_entities(cur)
            logger.info(f"Resolving {len(entities)} total active entities")

        # Stage 1: NPI enrichment
        npi_matched = _enrich_with_npi(cur, entities)
        logger.info(f"NPI enrichment: {npi_matched} matches")
        total_matches += npi_matched

        # Stage 2: Cross-entity deduplication (full mode only)
        if not new_only:
            dups = _deduplicate_entities(cur, entities)
            logger.info(f"Deduplication: {dups} duplicates flagged")
            total_matches += dups

        conn.commit()
        logger.info(f"Resolution complete: {total_matches} total matches")
        return total_matches

    except Exception as e:
        conn.rollback()
        logger.error(f"Resolution failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    new_only = os.environ.get("RESOLVE_NEW_ONLY", "false").lower() == "true"
    count = main(new_only=new_only)
    print(f"Resolution: {count} matches")
