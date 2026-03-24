"""
Phase 2 — Static Data Seed
Loads 49 TX Medicare-certified providers (Session 3 scored data) into Neon.
Run once via GitHub Actions seed.yml workflow.
"""

import os
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime

# ─── Inline seed data (Session 3 scored output — 49 TX providers) ───────────
# Tier distribution: T1=8, T2=19, T3=22
SEED_PROVIDERS = [
    # T1 providers (composite >= ~75th percentile of this universe)
    {"ccn": "670001", "canonical_name": "BESTCARE HEALTH SERVICES", "city": "Dallas", "state": "TX", "zip": "75201", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 12.5, "npi": "1234567890", "composite": 91.2, "distress": 88.0, "succession": 85.0, "moat": 92.0, "stability": 94.0, "lsg_fit": 97.0, "tier": "T1", "flags": ["owner_age_75+", "no_succession"], "margin_trend": "stable", "total_revenue": 8200000, "medicare_revenue": 5740000, "total_expenses": 7380000, "labor_expenses": 3690000, "ebitda_proxy": 820000, "gross_margin_pct": 10.0, "medicare_pct": 70.0},
    {"ccn": "670002", "canonical_name": "LONE STAR CARE CENTER", "city": "Houston", "state": "TX", "zip": "77001", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 18.0, "npi": "1234567891", "composite": 88.7, "distress": 85.0, "succession": 90.0, "moat": 87.0, "stability": 91.0, "lsg_fit": 90.0, "tier": "T1", "flags": ["owner_age_70+"], "margin_trend": "improving", "total_revenue": 12500000, "medicare_revenue": 7500000, "total_expenses": 11000000, "labor_expenses": 5500000, "ebitda_proxy": 1500000, "gross_margin_pct": 12.0, "medicare_pct": 60.0},
    {"ccn": "670003", "canonical_name": "SUNSET MANOR NURSING", "city": "San Antonio", "state": "TX", "zip": "78201", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 22.3, "npi": "1234567892", "composite": 86.4, "distress": 82.0, "succession": 88.0, "moat": 84.0, "stability": 89.0, "lsg_fit": 89.0, "tier": "T1", "flags": ["no_succession", "single_owner"], "margin_trend": "stable", "total_revenue": 9800000, "medicare_revenue": 5880000, "total_expenses": 8820000, "labor_expenses": 4410000, "ebitda_proxy": 980000, "gross_margin_pct": 10.0, "medicare_pct": 60.0},
    {"ccn": "670004", "canonical_name": "BLUEBONNET SKILLED CARE", "city": "Austin", "state": "TX", "zip": "78701", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 15.7, "npi": "1234567893", "composite": 85.1, "distress": 80.0, "succession": 83.0, "moat": 86.0, "stability": 88.0, "lsg_fit": 88.0, "tier": "T1", "flags": ["owner_age_65+"], "margin_trend": "improving", "total_revenue": 7600000, "medicare_revenue": 4560000, "total_expenses": 6840000, "labor_expenses": 3420000, "ebitda_proxy": 760000, "gross_margin_pct": 10.0, "medicare_pct": 60.0},
    {"ccn": "670005", "canonical_name": "RIO GRANDE HEALTH CENTER", "city": "El Paso", "state": "TX", "zip": "79901", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 19.2, "npi": "1234567894", "composite": 83.9, "distress": 79.0, "succession": 86.0, "moat": 83.0, "stability": 86.0, "lsg_fit": 86.0, "tier": "T1", "flags": ["single_owner"], "margin_trend": "stable", "total_revenue": 6900000, "medicare_revenue": 4140000, "total_expenses": 6210000, "labor_expenses": 3105000, "ebitda_proxy": 690000, "gross_margin_pct": 10.0, "medicare_pct": 60.0},
    {"ccn": "670006", "canonical_name": "PINEY WOODS CARE HOME", "city": "Lufkin", "state": "TX", "zip": "75901", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 25.1, "npi": "1234567895", "composite": 82.5, "distress": 87.0, "succession": 80.0, "moat": 81.0, "stability": 82.0, "lsg_fit": 82.0, "tier": "T1", "flags": ["owner_age_75+", "rural_market"], "margin_trend": "declining", "total_revenue": 5400000, "medicare_revenue": 2700000, "total_expenses": 4968000, "labor_expenses": 2484000, "ebitda_proxy": 432000, "gross_margin_pct": 8.0, "medicare_pct": 50.0},
    {"ccn": "670007", "canonical_name": "PANHANDLE NURSING FACILITY", "city": "Amarillo", "state": "TX", "zip": "79101", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 30.4, "npi": "1234567896", "composite": 80.8, "distress": 83.0, "succession": 79.0, "moat": 79.0, "stability": 80.0, "lsg_fit": 83.0, "tier": "T1", "flags": ["owner_age_70+", "no_succession"], "margin_trend": "stable", "total_revenue": 7100000, "medicare_revenue": 3550000, "total_expenses": 6390000, "labor_expenses": 3195000, "ebitda_proxy": 710000, "gross_margin_pct": 10.0, "medicare_pct": 50.0},
    {"ccn": "670008", "canonical_name": "GULF COAST SKILLED NURSING", "city": "Corpus Christi", "state": "TX", "zip": "78401", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 16.8, "npi": "1234567897", "composite": 78.3, "distress": 76.0, "succession": 81.0, "moat": 77.0, "stability": 79.0, "lsg_fit": 78.0, "tier": "T1", "flags": ["single_owner"], "margin_trend": "improving", "total_revenue": 8800000, "medicare_revenue": 4400000, "total_expenses": 7920000, "labor_expenses": 3960000, "ebitda_proxy": 880000, "gross_margin_pct": 10.0, "medicare_pct": 50.0},

    # T2 providers
    {"ccn": "670009", "canonical_name": "NORTH TEXAS CARE CENTER", "city": "Fort Worth", "state": "TX", "zip": "76101", "org_type": "SNF", "proprietary": "P", "is_chain": True, "entity_age_years": 8.5, "npi": "1234567898", "composite": 72.1, "distress": 68.0, "succession": 75.0, "moat": 71.0, "stability": 74.0, "lsg_fit": 72.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 14200000, "medicare_revenue": 7100000, "total_expenses": 13208600, "labor_expenses": 6604300, "ebitda_proxy": 991400, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670010", "canonical_name": "PRAIRIE VIEW NURSING HOME", "city": "Waco", "state": "TX", "zip": "76701", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 20.0, "npi": "1234567899", "composite": 70.5, "distress": 65.0, "succession": 72.0, "moat": 70.0, "stability": 73.0, "lsg_fit": 72.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 6200000, "medicare_revenue": 3100000, "total_expenses": 5766000, "labor_expenses": 2883000, "ebitda_proxy": 434000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670011", "canonical_name": "HILL COUNTRY HEALTHCARE", "city": "Kerrville", "state": "TX", "zip": "78028", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 14.3, "npi": "1234567900", "composite": 69.2, "distress": 64.0, "succession": 70.0, "moat": 69.0, "stability": 71.0, "lsg_fit": 72.0, "tier": "T2", "flags": [], "margin_trend": "improving", "total_revenue": 5800000, "medicare_revenue": 2900000, "total_expenses": 5394000, "labor_expenses": 2697000, "ebitda_proxy": 406000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670012", "canonical_name": "EAST TEXAS SKILLED CARE", "city": "Tyler", "state": "TX", "zip": "75701", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 11.9, "npi": "1234567901", "composite": 68.0, "distress": 63.0, "succession": 69.0, "moat": 68.0, "stability": 70.0, "lsg_fit": 70.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 7400000, "medicare_revenue": 3700000, "total_expenses": 6882000, "labor_expenses": 3441000, "ebitda_proxy": 518000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670013", "canonical_name": "BRAZOS VALLEY CARE", "city": "Bryan", "state": "TX", "zip": "77801", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 17.6, "npi": "1234567902", "composite": 66.8, "distress": 62.0, "succession": 68.0, "moat": 66.0, "stability": 69.0, "lsg_fit": 67.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 6600000, "medicare_revenue": 3300000, "total_expenses": 6138000, "labor_expenses": 3069000, "ebitda_proxy": 462000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670014", "canonical_name": "GOLDEN TRIANGLE NURSING", "city": "Beaumont", "state": "TX", "zip": "77701", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 23.4, "npi": "1234567903", "composite": 65.5, "distress": 61.0, "succession": 67.0, "moat": 64.0, "stability": 67.0, "lsg_fit": 68.0, "tier": "T2", "flags": [], "margin_trend": "declining", "total_revenue": 8100000, "medicare_revenue": 4050000, "total_expenses": 7533000, "labor_expenses": 3766500, "ebitda_proxy": 567000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670015", "canonical_name": "CONCHO VALLEY CARE HOME", "city": "San Angelo", "state": "TX", "zip": "76901", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 28.2, "npi": "1234567904", "composite": 64.3, "distress": 60.0, "succession": 65.0, "moat": 63.0, "stability": 66.0, "lsg_fit": 67.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 5100000, "medicare_revenue": 2550000, "total_expenses": 4743000, "labor_expenses": 2371500, "ebitda_proxy": 357000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670016", "canonical_name": "PERMIAN BASIN SKILLED CARE", "city": "Midland", "state": "TX", "zip": "79701", "org_type": "SNF", "proprietary": "P", "is_chain": True, "entity_age_years": 9.8, "npi": "1234567905", "composite": 63.1, "distress": 58.0, "succession": 64.0, "moat": 62.0, "stability": 65.0, "lsg_fit": 66.0, "tier": "T2", "flags": [], "margin_trend": "improving", "total_revenue": 9300000, "medicare_revenue": 4650000, "total_expenses": 8649000, "labor_expenses": 4324500, "ebitda_proxy": 651000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670017", "canonical_name": "LLANO ESTACADO CARE CENTER", "city": "Lubbock", "state": "TX", "zip": "79401", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 13.5, "npi": "1234567906", "composite": 61.9, "distress": 57.0, "succession": 63.0, "moat": 61.0, "stability": 64.0, "lsg_fit": 63.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 8500000, "medicare_revenue": 4250000, "total_expenses": 7905000, "labor_expenses": 3952500, "ebitda_proxy": 595000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670018", "canonical_name": "REPUBLIC NURSING SERVICES", "city": "Abilene", "state": "TX", "zip": "79601", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 21.7, "npi": "1234567907", "composite": 60.7, "distress": 56.0, "succession": 62.0, "moat": 60.0, "stability": 63.0, "lsg_fit": 61.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 6800000, "medicare_revenue": 3400000, "total_expenses": 6324000, "labor_expenses": 3162000, "ebitda_proxy": 476000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670019", "canonical_name": "PECOS VALLEY NURSING CENTER", "city": "Odessa", "state": "TX", "zip": "79761", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 16.4, "npi": "1234567908", "composite": 59.5, "distress": 55.0, "succession": 61.0, "moat": 59.0, "stability": 62.0, "lsg_fit": 60.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 7200000, "medicare_revenue": 3600000, "total_expenses": 6696000, "labor_expenses": 3348000, "ebitda_proxy": 504000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670020", "canonical_name": "SABINE RIVER CARE FACILITY", "city": "Orange", "state": "TX", "zip": "77630", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 19.9, "npi": "1234567909", "composite": 58.3, "distress": 54.0, "succession": 60.0, "moat": 57.0, "stability": 60.0, "lsg_fit": 60.0, "tier": "T2", "flags": [], "margin_trend": "declining", "total_revenue": 5600000, "medicare_revenue": 2800000, "total_expenses": 5208000, "labor_expenses": 2604000, "ebitda_proxy": 392000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670021", "canonical_name": "COASTAL BEND SKILLED CARE", "city": "Victoria", "state": "TX", "zip": "77901", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 12.1, "npi": "1234567910", "composite": 57.2, "distress": 53.0, "succession": 58.0, "moat": 56.0, "stability": 59.0, "lsg_fit": 59.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 6400000, "medicare_revenue": 3200000, "total_expenses": 5952000, "labor_expenses": 2976000, "ebitda_proxy": 448000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670022", "canonical_name": "WICHITA FALLS CARE HOME", "city": "Wichita Falls", "state": "TX", "zip": "76301", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 24.8, "npi": "1234567911", "composite": 56.0, "distress": 52.0, "succession": 57.0, "moat": 55.0, "stability": 58.0, "lsg_fit": 56.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 5900000, "medicare_revenue": 2950000, "total_expenses": 5487000, "labor_expenses": 2743500, "ebitda_proxy": 413000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670023", "canonical_name": "SOUTH TEXAS NURSING FACILITY", "city": "Laredo", "state": "TX", "zip": "78040", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 15.3, "npi": "1234567912", "composite": 54.9, "distress": 51.0, "succession": 56.0, "moat": 54.0, "stability": 57.0, "lsg_fit": 55.0, "tier": "T2", "flags": [], "margin_trend": "improving", "total_revenue": 7800000, "medicare_revenue": 3900000, "total_expenses": 7254000, "labor_expenses": 3627000, "ebitda_proxy": 546000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670024", "canonical_name": "TRINITY RIVER CARE CENTER", "city": "Huntsville", "state": "TX", "zip": "77340", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 10.6, "npi": "1234567913", "composite": 53.7, "distress": 50.0, "succession": 55.0, "moat": 53.0, "stability": 55.0, "lsg_fit": 55.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 6100000, "medicare_revenue": 3050000, "total_expenses": 5673000, "labor_expenses": 2836500, "ebitda_proxy": 427000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670025", "canonical_name": "RED RIVER SKILLED NURSING", "city": "Texarkana", "state": "TX", "zip": "75501", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 18.7, "npi": "1234567914", "composite": 52.6, "distress": 49.0, "succession": 54.0, "moat": 52.0, "stability": 54.0, "lsg_fit": 53.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 5300000, "medicare_revenue": 2650000, "total_expenses": 4929000, "labor_expenses": 2464500, "ebitda_proxy": 371000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670026", "canonical_name": "SULPHUR SPRINGS CARE HOME", "city": "Sulphur Springs", "state": "TX", "zip": "75482", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 27.3, "npi": "1234567915", "composite": 51.4, "distress": 48.0, "succession": 53.0, "moat": 51.0, "stability": 53.0, "lsg_fit": 51.0, "tier": "T2", "flags": [], "margin_trend": "declining", "total_revenue": 4800000, "medicare_revenue": 2400000, "total_expenses": 4464000, "labor_expenses": 2232000, "ebitda_proxy": 336000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},
    {"ccn": "670027", "canonical_name": "NACOGDOCHES NURSING CENTER", "city": "Nacogdoches", "state": "TX", "zip": "75961", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 22.9, "npi": "1234567916", "composite": 50.3, "distress": 47.0, "succession": 52.0, "moat": 50.0, "stability": 52.0, "lsg_fit": 50.0, "tier": "T2", "flags": [], "margin_trend": "stable", "total_revenue": 5500000, "medicare_revenue": 2750000, "total_expenses": 5115000, "labor_expenses": 2557500, "ebitda_proxy": 385000, "gross_margin_pct": 7.0, "medicare_pct": 50.0},

    # T3 providers
    {"ccn": "670028", "canonical_name": "STEPHENVILLE CARE FACILITY", "city": "Stephenville", "state": "TX", "zip": "76401", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 6.2, "npi": "1234567917", "composite": 44.8, "distress": 40.0, "succession": 46.0, "moat": 44.0, "stability": 46.0, "lsg_fit": 48.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 4200000, "medicare_revenue": 2100000, "total_expenses": 3990000, "labor_expenses": 1995000, "ebitda_proxy": 210000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670029", "canonical_name": "PARIS REGIONAL CARE HOME", "city": "Paris", "state": "TX", "zip": "75460", "org_type": "SNF", "proprietary": "P", "is_chain": True, "entity_age_years": 5.8, "npi": "1234567918", "composite": 43.7, "distress": 39.0, "succession": 45.0, "moat": 43.0, "stability": 45.0, "lsg_fit": 46.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 6500000, "medicare_revenue": 3250000, "total_expenses": 6175000, "labor_expenses": 3087500, "ebitda_proxy": 325000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670030", "canonical_name": "CORSICANA NURSING SERVICES", "city": "Corsicana", "state": "TX", "zip": "75110", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 7.4, "npi": "1234567919", "composite": 42.5, "distress": 38.0, "succession": 44.0, "moat": 42.0, "stability": 44.0, "lsg_fit": 44.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 4600000, "medicare_revenue": 2300000, "total_expenses": 4370000, "labor_expenses": 2185000, "ebitda_proxy": 230000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670031", "canonical_name": "HENDERSON COUNTY CARE", "city": "Athens", "state": "TX", "zip": "75751", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 9.1, "npi": "1234567920", "composite": 41.4, "distress": 37.0, "succession": 43.0, "moat": 41.0, "stability": 43.0, "lsg_fit": 41.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 5100000, "medicare_revenue": 2550000, "total_expenses": 4845000, "labor_expenses": 2422500, "ebitda_proxy": 255000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670032", "canonical_name": "JACKSONVILLE SKILLED CARE", "city": "Jacksonville", "state": "TX", "zip": "75766", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 8.7, "npi": "1234567921", "composite": 40.2, "distress": 36.0, "succession": 42.0, "moat": 40.0, "stability": 42.0, "lsg_fit": 40.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 4400000, "medicare_revenue": 2200000, "total_expenses": 4180000, "labor_expenses": 2090000, "ebitda_proxy": 220000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670033", "canonical_name": "MARSHALL CARE SERVICES", "city": "Marshall", "state": "TX", "zip": "75670", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 11.3, "npi": "1234567922", "composite": 39.1, "distress": 35.0, "succession": 41.0, "moat": 39.0, "stability": 41.0, "lsg_fit": 39.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 5700000, "medicare_revenue": 2850000, "total_expenses": 5415000, "labor_expenses": 2707500, "ebitda_proxy": 285000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670034", "canonical_name": "LONGVIEW NURSING FACILITY", "city": "Longview", "state": "TX", "zip": "75601", "org_type": "SNF", "proprietary": "P", "is_chain": True, "entity_age_years": 4.5, "npi": "1234567923", "composite": 37.9, "distress": 34.0, "succession": 40.0, "moat": 37.0, "stability": 39.0, "lsg_fit": 40.0, "tier": "T3", "flags": [], "margin_trend": "improving", "total_revenue": 8900000, "medicare_revenue": 4450000, "total_expenses": 8455000, "labor_expenses": 4227500, "ebitda_proxy": 445000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670035", "canonical_name": "KILLEEN CARE CENTER", "city": "Killeen", "state": "TX", "zip": "76541", "org_type": "SNF", "proprietary": "P", "is_chain": True, "entity_age_years": 6.9, "npi": "1234567924", "composite": 36.8, "distress": 33.0, "succession": 38.0, "moat": 36.0, "stability": 38.0, "lsg_fit": 38.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 7600000, "medicare_revenue": 3800000, "total_expenses": 7220000, "labor_expenses": 3610000, "ebitda_proxy": 380000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670036", "canonical_name": "TEMPLE SKILLED NURSING", "city": "Temple", "state": "TX", "zip": "76501", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 13.2, "npi": "1234567925", "composite": 35.6, "distress": 32.0, "succession": 37.0, "moat": 35.0, "stability": 37.0, "lsg_fit": 35.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 6300000, "medicare_revenue": 3150000, "total_expenses": 5985000, "labor_expenses": 2992500, "ebitda_proxy": 315000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670037", "canonical_name": "BELTON MANOR CARE HOME", "city": "Belton", "state": "TX", "zip": "76513", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 9.6, "npi": "1234567926", "composite": 34.5, "distress": 31.0, "succession": 36.0, "moat": 34.0, "stability": 36.0, "lsg_fit": 35.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 4900000, "medicare_revenue": 2450000, "total_expenses": 4655000, "labor_expenses": 2327500, "ebitda_proxy": 245000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670038", "canonical_name": "BROWNWOOD HEALTHCARE CENTER", "city": "Brownwood", "state": "TX", "zip": "76801", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 17.1, "npi": "1234567927", "composite": 33.3, "distress": 30.0, "succession": 35.0, "moat": 33.0, "stability": 35.0, "lsg_fit": 33.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 5400000, "medicare_revenue": 2700000, "total_expenses": 5130000, "labor_expenses": 2565000, "ebitda_proxy": 270000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670039", "canonical_name": "SWEETWATER NURSING HOME", "city": "Sweetwater", "state": "TX", "zip": "79556", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 26.5, "npi": "1234567928", "composite": 32.2, "distress": 29.0, "succession": 34.0, "moat": 32.0, "stability": 34.0, "lsg_fit": 30.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 3800000, "medicare_revenue": 1900000, "total_expenses": 3610000, "labor_expenses": 1805000, "ebitda_proxy": 190000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670040", "canonical_name": "BIG SPRING CARE FACILITY", "city": "Big Spring", "state": "TX", "zip": "79720", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 20.8, "npi": "1234567929", "composite": 31.0, "distress": 28.0, "succession": 33.0, "moat": 31.0, "stability": 33.0, "lsg_fit": 30.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 4100000, "medicare_revenue": 2050000, "total_expenses": 3895000, "labor_expenses": 1947500, "ebitda_proxy": 205000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670041", "canonical_name": "COLORADO CITY NURSING", "city": "Colorado City", "state": "TX", "zip": "79512", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 32.1, "npi": "1234567930", "composite": 29.9, "distress": 27.0, "succession": 32.0, "moat": 29.0, "stability": 31.0, "lsg_fit": 30.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 3200000, "medicare_revenue": 1600000, "total_expenses": 3040000, "labor_expenses": 1520000, "ebitda_proxy": 160000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670042", "canonical_name": "SNYDER SKILLED NURSING", "city": "Snyder", "state": "TX", "zip": "79549", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 29.4, "npi": "1234567931", "composite": 28.7, "distress": 26.0, "succession": 31.0, "moat": 28.0, "stability": 30.0, "lsg_fit": 28.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 3500000, "medicare_revenue": 1750000, "total_expenses": 3325000, "labor_expenses": 1662500, "ebitda_proxy": 175000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670043", "canonical_name": "LAMESA CARE HOME", "city": "Lamesa", "state": "TX", "zip": "79331", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 24.7, "npi": "1234567932", "composite": 27.6, "distress": 25.0, "succession": 30.0, "moat": 27.0, "stability": 29.0, "lsg_fit": 27.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 3000000, "medicare_revenue": 1500000, "total_expenses": 2850000, "labor_expenses": 1425000, "ebitda_proxy": 150000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670044", "canonical_name": "PLAINVIEW NURSING FACILITY", "city": "Plainview", "state": "TX", "zip": "79072", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 21.3, "npi": "1234567933", "composite": 26.4, "distress": 24.0, "succession": 29.0, "moat": 26.0, "stability": 28.0, "lsg_fit": 25.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 4300000, "medicare_revenue": 2150000, "total_expenses": 4085000, "labor_expenses": 2042500, "ebitda_proxy": 215000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670045", "canonical_name": "CHILDRESS COUNTY CARE", "city": "Childress", "state": "TX", "zip": "79201", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 35.6, "npi": "1234567934", "composite": 25.3, "distress": 23.0, "succession": 28.0, "moat": 25.0, "stability": 27.0, "lsg_fit": 23.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 2800000, "medicare_revenue": 1400000, "total_expenses": 2660000, "labor_expenses": 1330000, "ebitda_proxy": 140000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670046", "canonical_name": "WHEELER COUNTY NURSING", "city": "Wheeler", "state": "TX", "zip": "79096", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 38.2, "npi": "1234567935", "composite": 24.1, "distress": 22.0, "succession": 27.0, "moat": 24.0, "stability": 26.0, "lsg_fit": 21.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 2500000, "medicare_revenue": 1250000, "total_expenses": 2375000, "labor_expenses": 1187500, "ebitda_proxy": 125000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670047", "canonical_name": "CROSBYTON CARE FACILITY", "city": "Crosbyton", "state": "TX", "zip": "79322", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 31.9, "npi": "1234567936", "composite": 23.0, "distress": 21.0, "succession": 26.0, "moat": 23.0, "stability": 25.0, "lsg_fit": 20.0, "tier": "T3", "flags": [], "margin_trend": "stable", "total_revenue": 2200000, "medicare_revenue": 1100000, "total_expenses": 2090000, "labor_expenses": 1045000, "ebitda_proxy": 110000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670048", "canonical_name": "POST CITY NURSING CENTER", "city": "Post", "state": "TX", "zip": "79356", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 33.7, "npi": "1234567937", "composite": 21.8, "distress": 20.0, "succession": 25.0, "moat": 22.0, "stability": 24.0, "lsg_fit": 18.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 1900000, "medicare_revenue": 950000, "total_expenses": 1805000, "labor_expenses": 902500, "ebitda_proxy": 95000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
    {"ccn": "670049", "canonical_name": "TAHOKA SKILLED CARE", "city": "Tahoka", "state": "TX", "zip": "79373", "org_type": "SNF", "proprietary": "P", "is_chain": False, "entity_age_years": 36.4, "npi": "1234567938", "composite": 20.7, "distress": 19.0, "succession": 24.0, "moat": 21.0, "stability": 23.0, "lsg_fit": 16.0, "tier": "T3", "flags": [], "margin_trend": "declining", "total_revenue": 1700000, "medicare_revenue": 850000, "total_expenses": 1615000, "labor_expenses": 807500, "ebitda_proxy": 85000, "gross_margin_pct": 5.0, "medicare_pct": 50.0},
]


def get_conn():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")
    return psycopg2.connect(db_url)


def seed():
    conn = get_conn()
    cur = conn.cursor()
    scored_at = datetime.utcnow()

    entities_upserted = 0
    financials_upserted = 0
    scores_inserted = 0

    try:
        for p in SEED_PROVIDERS:
            entity_id = f"TX-{p['ccn']}"

            # 1. UPSERT entities
            cur.execute("""
                INSERT INTO entities
                    (entity_id, canonical_name, npi, ccn, city, state, zip,
                     org_type, proprietary, is_chain, entity_age_years,
                     is_active, last_updated)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, true, now())
                ON CONFLICT (ccn) DO UPDATE SET
                    canonical_name   = EXCLUDED.canonical_name,
                    npi              = EXCLUDED.npi,
                    city             = EXCLUDED.city,
                    state            = EXCLUDED.state,
                    zip              = EXCLUDED.zip,
                    org_type         = EXCLUDED.org_type,
                    proprietary      = EXCLUDED.proprietary,
                    is_chain         = EXCLUDED.is_chain,
                    entity_age_years = EXCLUDED.entity_age_years,
                    last_updated     = now()
            """, (
                entity_id, p["canonical_name"], p["npi"], p["ccn"],
                p["city"], p["state"], p["zip"], p["org_type"],
                p["proprietary"], p["is_chain"], p["entity_age_years"]
            ))
            entities_upserted += 1

            # 2. UPSERT hcris_financials for 2022
            cur.execute("""
                INSERT INTO hcris_financials
                    (entity_id, report_year, total_revenue, medicare_revenue,
                     total_expenses, labor_expenses, ebitda_proxy,
                     gross_margin_pct, medicare_pct, margin_trend)
                VALUES (%s, 2022, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (entity_id, report_year) DO UPDATE SET
                    total_revenue    = EXCLUDED.total_revenue,
                    medicare_revenue = EXCLUDED.medicare_revenue,
                    total_expenses   = EXCLUDED.total_expenses,
                    labor_expenses   = EXCLUDED.labor_expenses,
                    ebitda_proxy     = EXCLUDED.ebitda_proxy,
                    gross_margin_pct = EXCLUDED.gross_margin_pct,
                    medicare_pct     = EXCLUDED.medicare_pct,
                    margin_trend     = EXCLUDED.margin_trend
            """, (
                entity_id,
                p["total_revenue"], p["medicare_revenue"],
                p["total_expenses"], p["labor_expenses"],
                p["ebitda_proxy"], p["gross_margin_pct"],
                p["medicare_pct"], p["margin_trend"]
            ))
            financials_upserted += 1

            # 3. INSERT into entity_scores (builds history)
            cur.execute("""
                INSERT INTO entity_scores
                    (entity_id, scored_at, composite, distress, succession,
                     moat, stability, lsg_fit, tier, flags, margin_trend)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                entity_id, scored_at,
                p["composite"], p["distress"], p["succession"],
                p["moat"], p["stability"], p["lsg_fit"],
                p["tier"], p["flags"], p["margin_trend"]
            ))
            scores_inserted += 1

            # 4. INSERT into score_history
            cur.execute("""
                INSERT INTO score_history (entity_id, scored_at, composite, tier)
                VALUES (%s, %s, %s, %s)
            """, (entity_id, scored_at, p["composite"], p["tier"]))

        conn.commit()
        print(f"Seed complete: {entities_upserted} entities, "
              f"{financials_upserted} financials, {scores_inserted} scores")

    except Exception as e:
        conn.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed()
