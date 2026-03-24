const postgres = require("postgres");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  const sql = postgres(process.env.NETLIFY_DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL, { ssl: "require", max: 1 });

  try {
    const [universeRow] = await sql`
      SELECT
        COUNT(*)::int                                             AS universe_count,
        COUNT(*) FILTER (WHERE s.tier = 'T1')::int              AS t1_count,
        COUNT(*) FILTER (WHERE s.tier = 'T2')::int              AS t2_count,
        COUNT(*) FILTER (WHERE s.tier = 'T3')::int              AS t3_count,
        ROUND(AVG(s.composite)::numeric, 2)                     AS avg_composite,
        MAX(s.scored_at)                                        AS last_scored_at
      FROM entity_scores_current s
      JOIN entities e USING (entity_id)
      WHERE e.is_active = true
    `;

    const [pipelineRow] = await sql`
      SELECT COUNT(*)::int AS pipeline_count FROM crm_pipeline
    `;

    const [alertsRow] = await sql`
      SELECT COUNT(*)::int AS alerts
      FROM alert_events
      WHERE acknowledged_at IS NULL
    `;

    const [jobRow] = await sql`
      SELECT run_id, status, mode, started_at, completed_at,
             entities_scored, t1_count, t2_count, t3_count, error_message
      FROM jobs
      ORDER BY started_at DESC NULLS LAST
      LIMIT 1
    `.catch(() => [null]);

    const stats = {
      universe_count: universeRow.universe_count,
      t1_count: universeRow.t1_count,
      t2_count: universeRow.t2_count,
      t3_count: universeRow.t3_count,
      avg_composite: universeRow.avg_composite,
      last_scored_at: universeRow.last_scored_at,
      pipeline_count: pipelineRow.pipeline_count,
      alerts: alertsRow.alerts,
      last_job: jobRow || null,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(stats),
    };
  } catch (err) {
    console.error("stats error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    await sql.end();
  }
};
