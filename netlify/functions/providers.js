const postgres = require("postgres");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const VALID_SORT_COLS = new Set([
  "composite",
  "distress",
  "succession",
  "moat",
  "stability",
  "lsg_fit",
  "ebitda_2022",
  "revenue_2022",
  "entity_age_years",
]);

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  const params = event.queryStringParameters || {};
  const tier = params.tier || null;
  const sortBy = VALID_SORT_COLS.has(params.sort_by) ? params.sort_by : "composite";
  const limit = Math.min(parseInt(params.limit) || 200, 500);

  const sql = postgres(process.env.NETLIFY_DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL, { ssl: "require", max: 1, types: { numeric: { to: 1700, from: [1700, 1231], serialize: x => x, parse: x => parseFloat(x) } } });

  try {
    const rows = await sql`
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
        f.gross_margin_pct                                          AS ebitda_margin,
        CASE
          WHEN f.total_expenses > 0
          THEN ROUND((f.labor_expenses / f.total_expenses * 100)::numeric, 1)
          ELSE NULL
        END                                                         AS labor_pct,
        f.medicare_pct                                              AS medicare_conc,
        CASE WHEN cp.id IS NOT NULL THEN true ELSE false END        AS in_pipeline
      FROM entity_scores_current s
      JOIN entities e USING (entity_id)
      LEFT JOIN LATERAL (
        SELECT *
        FROM hcris_financials
        WHERE entity_id = e.entity_id
        ORDER BY report_year DESC
        LIMIT 1
      ) f ON true
      LEFT JOIN crm_pipeline cp ON cp.entity_id = e.entity_id
      WHERE e.is_active = true
        ${tier ? sql`AND s.tier = ${tier}` : sql``}
      ORDER BY ${sql(sortBy)} DESC NULLS LAST
      LIMIT ${limit}
    `;

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(rows),
    };
  } catch (err) {
    console.error("providers error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    await sql.end();
  }
};
