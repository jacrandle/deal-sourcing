const postgres = require("postgres");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  const params = event.queryStringParameters || {};
  const ccn = params.ccn;

  if (!ccn) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "ccn query param required" }),
    };
  }

  const sql = postgres(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.NEON_DATABASE_URL, { ssl: "require", max: 1 });

  try {
    const [provider] = await sql`
      SELECT
        e.entity_id,
        e.canonical_name,
        e.ccn,
        e.city,
        e.state,
        e.zip,
        e.org_type,
        e.proprietary,
        e.is_chain,
        e.entity_age_years,
        e.npi,
        s.composite,
        s.tier,
        s.distress,
        s.succession,
        s.moat,
        s.stability,
        s.lsg_fit,
        s.flags,
        s.margin_trend,
        s.scored_at,
        f.ebitda_proxy                                              AS ebitda_2022,
        f.total_revenue                                             AS revenue_2022,
        f.medicare_revenue,
        f.total_expenses,
        f.labor_expenses,
        f.gross_margin_pct                                          AS ebitda_margin,
        CASE
          WHEN f.total_expenses > 0
          THEN ROUND((f.labor_expenses / f.total_expenses * 100)::numeric, 1)
          ELSE NULL
        END                                                         AS labor_pct,
        f.medicare_pct                                              AS medicare_conc,
        cp.stage                                                    AS crm_stage,
        cp.id                                                       AS crm_id
      FROM entities e
      JOIN entity_scores_current s USING (entity_id)
      LEFT JOIN LATERAL (
        SELECT *
        FROM hcris_financials
        WHERE entity_id = e.entity_id
        ORDER BY report_year DESC
        LIMIT 1
      ) f ON true
      LEFT JOIN crm_pipeline cp USING (entity_id)
      WHERE e.ccn = ${ccn} AND e.is_active = true
    `;

    if (!provider) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Provider not found" }),
      };
    }

    // Score history for sparkline (last 12)
    const history = await sql`
      SELECT scored_at, composite, tier
      FROM score_history
      WHERE entity_id = ${provider.entity_id}
      ORDER BY scored_at DESC
      LIMIT 12
    `;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ...provider, score_history: history }),
    };
  } catch (err) {
    console.error("provider error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    await sql.end();
  }
};
