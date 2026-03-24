-- LSG Deal Sourcing Platform — Neon Schema
-- Run once via Neon console or psql

-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─────────────────────────────────────────────
-- entities
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entities (
    entity_id           TEXT PRIMARY KEY,
    canonical_name      TEXT,
    npi                 TEXT,
    ccn                 TEXT UNIQUE,
    city                TEXT,
    state               TEXT,
    zip                 TEXT,
    org_type            TEXT,
    proprietary         CHAR(1),
    is_chain            BOOLEAN,
    entity_age_years    NUMERIC,
    entity_formed_date  TEXT,
    incorp_date         TEXT,
    is_active           BOOLEAN DEFAULT true,
    last_updated        TIMESTAMP DEFAULT now()
);

-- ─────────────────────────────────────────────
-- hcris_financials
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS hcris_financials (
    id                  SERIAL PRIMARY KEY,
    entity_id           TEXT REFERENCES entities(entity_id),
    report_year         INT,
    total_revenue       NUMERIC,
    medicare_revenue    NUMERIC,
    total_expenses      NUMERIC,
    labor_expenses      NUMERIC,
    ebitda_proxy        NUMERIC,
    gross_margin_pct    NUMERIC,
    medicare_pct        NUMERIC,
    margin_trend        TEXT,
    UNIQUE (entity_id, report_year)
);

-- ─────────────────────────────────────────────
-- entity_scores
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_scores (
    id              SERIAL PRIMARY KEY,
    entity_id       TEXT REFERENCES entities(entity_id),
    scored_at       TIMESTAMP DEFAULT now(),
    composite       NUMERIC,
    distress        NUMERIC,
    succession      NUMERIC,
    moat            NUMERIC,
    stability       NUMERIC,
    lsg_fit         NUMERIC,
    tier            TEXT,
    flags           TEXT[],
    margin_trend    TEXT
);

-- ─────────────────────────────────────────────
-- entity_scores_current (view — latest score per entity)
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW entity_scores_current AS
SELECT DISTINCT ON (entity_id) *
FROM entity_scores
ORDER BY entity_id, scored_at DESC;

-- ─────────────────────────────────────────────
-- crm_pipeline
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_pipeline (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    ccn             TEXT,
    entity_id       TEXT REFERENCES entities(entity_id),
    provider_name   TEXT,
    city            TEXT,
    stage           TEXT DEFAULT 'Outreach Queue',
    owner           TEXT,
    notes           TEXT,
    priority        INT DEFAULT 5,
    composite       NUMERIC,
    ebitda_2022     NUMERIC,
    added_at        TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);

-- ─────────────────────────────────────────────
-- crm_activities
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_activities (
    id              SERIAL PRIMARY KEY,
    pipeline_id     TEXT REFERENCES crm_pipeline(id) ON DELETE CASCADE,
    activity        TEXT,
    from_stage      TEXT,
    to_stage        TEXT,
    body            TEXT,
    actor           TEXT,
    created_at      TIMESTAMP DEFAULT now()
);

-- ─────────────────────────────────────────────
-- alert_events
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_events (
    id              SERIAL PRIMARY KEY,
    entity_id       TEXT REFERENCES entities(entity_id),
    alert_type      TEXT,
    severity        TEXT DEFAULT 'medium',
    description     TEXT,
    detected_at     TIMESTAMP DEFAULT now(),
    acknowledged_at TIMESTAMP
);

-- ─────────────────────────────────────────────
-- score_history
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS score_history (
    id          SERIAL PRIMARY KEY,
    entity_id   TEXT REFERENCES entities(entity_id),
    scored_at   TIMESTAMP DEFAULT now(),
    composite   NUMERIC,
    tier        TEXT
);

-- ─────────────────────────────────────────────
-- jobs
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
    run_id          TEXT PRIMARY KEY,
    status          TEXT DEFAULT 'queued',
    mode            TEXT,
    states          TEXT[],
    started_at      TIMESTAMP,
    completed_at    TIMESTAMP,
    entities_scored INT DEFAULT 0,
    t1_count        INT DEFAULT 0,
    t2_count        INT DEFAULT 0,
    t3_count        INT DEFAULT 0,
    error_message   TEXT
);

-- ─────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_entity_scores_entity_scored
    ON entity_scores(entity_id, scored_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_pipeline_stage
    ON crm_pipeline(stage);

CREATE INDEX IF NOT EXISTS idx_hcris_financials_entity_year
    ON hcris_financials(entity_id, report_year DESC);
