"""
Stage 1 — HCRIS Ingestion
Downloads CMS Medicare cost report data (HCRIS) and loads into Neon.

CMS HCRIS data: https://www.cms.gov/Research-Statistics-Data-and-Systems/
                Downloadable-Public-Use-Files/Cost-Reports/
"""

import os
import io
import logging
import requests
import pandas as pd
import numpy as np
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# CMS HCRIS SNF cost report CSV endpoints (fiscal year → URL pattern)
# Format changes between years; this handles 2019-2023
HCRIS_BASE_URL = "https://www.cms.gov/Research-Statistics-Data-and-Systems/Downloadable-Public-Use-Files/Cost-Reports/Downloads"

# Column mappings from HCRIS worksheet S-3 / G-2 / G-3 (SNF form 2540-10)
HCRIS_COLUMNS = {
    "provider_number": "CCN",
    "total_income": "TOTAL_REVENUES",
    "medicare_revenues": "MEDICARE_REVENUES",
    "total_expenses": "TOTAL_EXPENSES",
    "wage_expense": "LABOR_EXPENSES",
    "net_income": "NET_INCOME",
}


def _get_conn():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not set")
    return psycopg2.connect(db_url)


def _fetch_hcris_for_year(year: int, states: list[str]) -> pd.DataFrame:
    """
    Fetch HCRIS SNF data for a given fiscal year.
    Falls back to synthetic data if CMS download fails (for dev/test).
    """
    url = f"{HCRIS_BASE_URL}/SNF_PROVIDERS_FY{year}.csv"
    logger.info(f"Fetching HCRIS data for FY{year} from CMS...")

    try:
        resp = requests.get(url, timeout=60)
        resp.raise_for_status()
        df = pd.read_csv(io.StringIO(resp.text), dtype=str)
        df.columns = [c.upper().strip() for c in df.columns]

        # Filter to requested states
        if "STATE_CD" in df.columns:
            df = df[df["STATE_CD"].isin(states)]
        elif "PROVIDER_STATE" in df.columns:
            df = df[df["PROVIDER_STATE"].isin(states)]

        logger.info(f"FY{year}: fetched {len(df)} providers for states {states}")
        return df

    except Exception as e:
        logger.warning(f"CMS fetch failed for FY{year}: {e}. Returning empty frame.")
        return pd.DataFrame()


def _parse_numeric(val) -> float | None:
    """Safely parse numeric string to float."""
    try:
        return float(str(val).replace(",", "").strip())
    except (ValueError, TypeError):
        return None


def _compute_ebitda_proxy(total_revenue: float, total_expenses: float) -> float | None:
    if total_revenue is None or total_expenses is None:
        return None
    return total_revenue - total_expenses


def _compute_margin_trend(current_margin: float | None, prior_margin: float | None) -> str:
    if current_margin is None or prior_margin is None:
        return "unknown"
    delta = current_margin - prior_margin
    if delta > 1.5:
        return "improving"
    elif delta < -1.5:
        return "declining"
    return "stable"


def _upsert_financials(cur, records: list[dict]) -> int:
    """Upsert financial records into hcris_financials. Returns count inserted."""
    if not records:
        return 0

    sql = """
        INSERT INTO hcris_financials
            (entity_id, report_year, total_revenue, medicare_revenue,
             total_expenses, labor_expenses, ebitda_proxy,
             gross_margin_pct, medicare_pct, margin_trend)
        VALUES %s
        ON CONFLICT (entity_id, report_year) DO UPDATE SET
            total_revenue    = EXCLUDED.total_revenue,
            medicare_revenue = EXCLUDED.medicare_revenue,
            total_expenses   = EXCLUDED.total_expenses,
            labor_expenses   = EXCLUDED.labor_expenses,
            ebitda_proxy     = EXCLUDED.ebitda_proxy,
            gross_margin_pct = EXCLUDED.gross_margin_pct,
            medicare_pct     = EXCLUDED.medicare_pct,
            margin_trend     = EXCLUDED.margin_trend
    """
    values = [
        (
            r["entity_id"], r["report_year"],
            r["total_revenue"], r["medicare_revenue"],
            r["total_expenses"], r["labor_expenses"],
            r["ebitda_proxy"], r["gross_margin_pct"],
            r["medicare_pct"], r["margin_trend"]
        )
        for r in records
    ]
    execute_values(cur, sql, values)
    return len(values)


def _upsert_entities(cur, entities: list[dict]) -> int:
    """Upsert entity records. Returns count upserted."""
    if not entities:
        return 0

    sql = """
        INSERT INTO entities
            (entity_id, canonical_name, ccn, city, state, zip,
             org_type, is_active, last_updated)
        VALUES %s
        ON CONFLICT (ccn) DO UPDATE SET
            canonical_name = EXCLUDED.canonical_name,
            city           = EXCLUDED.city,
            state          = EXCLUDED.state,
            zip            = EXCLUDED.zip,
            org_type       = EXCLUDED.org_type,
            last_updated   = now()
    """
    values = [
        (
            e["entity_id"], e["canonical_name"], e["ccn"],
            e["city"], e["state"], e["zip"],
            e["org_type"], True, datetime.utcnow()
        )
        for e in entities
    ]
    execute_values(cur, sql, values)
    return len(values)


def main(states: list[str] | None = None, years: list[int] | None = None) -> int:
    """
    Ingest HCRIS data for given states and fiscal years.

    Args:
        states: List of 2-letter state codes (default: ["TX"])
        years:  List of fiscal years (default: [2022, 2023])

    Returns:
        Total records ingested
    """
    if states is None:
        states = ["TX"]
    if years is None:
        years = [2022, 2023]

    conn = _get_conn()
    cur = conn.cursor()
    total_ingested = 0

    try:
        for year in years:
            df = _fetch_hcris_for_year(year, states)
            if df.empty:
                logger.warning(f"No data for FY{year}, skipping")
                continue

            entities = []
            financials = []

            for _, row in df.iterrows():
                ccn = str(row.get("PROVIDER_NUMBER", row.get("CCN", ""))).strip()
                if not ccn:
                    continue

                state = str(row.get("STATE_CD", row.get("PROVIDER_STATE", ""))).strip().upper()
                entity_id = f"{state}-{ccn}"
                name = str(row.get("PROVIDER_NAME", row.get("FAC_NAME", "Unknown"))).strip()

                total_rev = _parse_numeric(row.get("TOTAL_REVENUES") or row.get("TOTAL_INCOME"))
                med_rev = _parse_numeric(row.get("MEDICARE_REVENUES") or row.get("MEDICARE_REVENUE"))
                total_exp = _parse_numeric(row.get("TOTAL_EXPENSES"))
                labor_exp = _parse_numeric(row.get("LABOR_EXPENSES") or row.get("WAGE_EXPENSE"))
                ebitda = _compute_ebitda_proxy(total_rev, total_exp)

                gross_margin_pct = None
                if total_rev and total_rev > 0 and ebitda is not None:
                    gross_margin_pct = round(ebitda / total_rev * 100, 2)

                medicare_pct = None
                if total_rev and total_rev > 0 and med_rev is not None:
                    medicare_pct = round(med_rev / total_rev * 100, 2)

                entities.append({
                    "entity_id": entity_id,
                    "canonical_name": name,
                    "ccn": ccn,
                    "city": str(row.get("CITY", "")).strip(),
                    "state": state,
                    "zip": str(row.get("ZIP_CD", row.get("ZIP", ""))).strip(),
                    "org_type": "SNF",
                })

                financials.append({
                    "entity_id": entity_id,
                    "report_year": year,
                    "total_revenue": total_rev,
                    "medicare_revenue": med_rev,
                    "total_expenses": total_exp,
                    "labor_expenses": labor_exp,
                    "ebitda_proxy": ebitda,
                    "gross_margin_pct": gross_margin_pct,
                    "medicare_pct": medicare_pct,
                    "margin_trend": "unknown",
                })

            _upsert_entities(cur, entities)
            count = _upsert_financials(cur, financials)
            total_ingested += count
            logger.info(f"FY{year}: upserted {count} financial records")

        conn.commit()
        logger.info(f"Ingestion complete: {total_ingested} total records")
        return total_ingested

    except Exception as e:
        conn.rollback()
        logger.error(f"Ingestion failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    states = os.environ.get("PIPELINE_STATES", "TX").split(",")
    years = [int(y) for y in os.environ.get("PIPELINE_YEARS", "2022,2023").split(",")]
    count = main(states=states, years=years)
    print(f"Ingested {count} records")
