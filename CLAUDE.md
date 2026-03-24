# LSG Deal Sourcing Platform — CLAUDE.md

Lykos Sovereign Group Inc. — Proprietary

## What This Is

A full-stack M&A deal sourcing platform that ingests CMS Medicare cost report data (HCRIS), resolves entities probabilistically across government databases, scores providers on five acquisition dimensions, and surfaces T1/T2/T3 tiered targets through a dashboard with a CRM pipeline.

## Stack

- **Frontend**: React + Vite → deployed on Netlify
- **Database**: PostgreSQL → hosted on Neon (serverless Postgres)
- **Read API**: Netlify Functions (Node.js) → reads from Neon
- **Pipeline**: GitHub Actions → runs Python scoring on schedule
- **Auth**: Netlify Identity (optional, add last)

No Docker. No running server. No SSH.

## Architecture

```
GitHub repo
│
├── /frontend           React app (Vite) → deploys to Netlify on push to main
│
├── /netlify/functions  Netlify Functions (Node.js)
│   ├── stats.js        GET /api/stats
│   ├── providers.js    GET /api/providers
│   ├── provider.js     GET /api/providers/:ccn
│   ├── crm.js          GET/POST/PATCH/DELETE /api/crm/pipeline
│   └── alerts.js       GET /api/alerts
│
├── /pipeline           Python scoring pipeline
│   ├── ingest.py       Stage 1 — HCRIS ingestion from CMS
│   ├── resolve.py      Stage 2 — entity resolution
│   ├── score.py        Stage 3 — 5-dimension scoring
│   └── seed.py         One-time static data seed
│
├── /database
│   └── schema.sql      Neon schema (run once manually)
│
└── .github/workflows
    ├── pipeline.yml    Weekly cron (Sunday 2am CST) + manual trigger
    └── seed.yml        One-time seed workflow
```

## Key Decisions

1. Use `postgres` npm package (not `pg`) in Netlify Functions.
2. Neon connection string must include `?sslmode=require`.
3. Percentile-based tiers only — Top 15% = T1, next 40% = T2, bottom 45% = T3.
4. Session 3 static data is the source of truth for the seed.
5. CRM data persists in Neon, not React state.
6. Dashboard works with zero pipeline runs (seed is sufficient).

## Local Development

```bash
npm install -g netlify-cli
cd frontend && npm install
cd ../netlify/functions && npm install
netlify dev
```

Access the app at http://localhost:8888

## Environment Variables

Set `DATABASE_URL` in:
- Netlify Dashboard → Site → Environment Variables
- GitHub → Settings → Secrets → Actions

Format: `postgresql://user:pass@host/db?sslmode=require`

## CRM Stages (in order)

1. Outreach Queue
2. Contacted
3. NDA Executed
4. Diligence
5. LOI Submitted

## Tier Thresholds

- **T1**: Top 15% composite score
- **T2**: Next 40% (15th–55th percentile)
- **T3**: Bottom 45%
