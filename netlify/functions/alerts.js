const postgres = require("postgres");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  const sql = postgres(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.NEON_DATABASE_URL, { ssl: "require", max: 1 });

  try {
    const method = event.httpMethod;
    const params = event.queryStringParameters || {};

    // GET — unacknowledged alerts with entity name
    if (method === "GET") {
      const rows = await sql`
        SELECT
          a.id,
          a.entity_id,
          a.alert_type,
          a.severity,
          a.description,
          a.detected_at,
          a.acknowledged_at,
          e.canonical_name,
          e.city,
          e.state,
          s.tier,
          s.composite
        FROM alert_events a
        LEFT JOIN entities e USING (entity_id)
        LEFT JOIN entity_scores_current s USING (entity_id)
        WHERE a.acknowledged_at IS NULL
        ORDER BY
          CASE a.severity
            WHEN 'critical' THEN 1
            WHEN 'high'     THEN 2
            WHEN 'medium'   THEN 3
            WHEN 'low'      THEN 4
            ELSE 5
          END,
          a.detected_at DESC
        LIMIT 100
      `;

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(rows),
      };
    }

    // POST — acknowledge an alert
    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { action, id } = body;

      if (action === "acknowledge") {
        if (!id) {
          return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "id required for acknowledge" }),
          };
        }

        const [updated] = await sql`
          UPDATE alert_events
          SET acknowledged_at = now()
          WHERE id = ${id}
          RETURNING *
        `;

        if (!updated) {
          return {
            statusCode: 404,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: "Alert not found" }),
          };
        }

        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify(updated),
        };
      }

      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Unknown action" }),
      };
    }

    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (err) {
    console.error("alerts error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    await sql.end();
  }
};
