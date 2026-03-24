const postgres = require("postgres");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
};

const VALID_STAGES = [
  "Outreach Queue",
  "Contacted",
  "NDA Executed",
  "Diligence",
  "LOI Submitted",
];

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  const sql = postgres(process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.NEON_DATABASE_URL, { ssl: "require", max: 1 });

  try {
    const method = event.httpMethod;
    const params = event.queryStringParameters || {};

    // GET — return full pipeline grouped by stage
    if (method === "GET") {
      const rows = await sql`
        SELECT
          cp.*,
          e.canonical_name,
          e.city,
          e.state,
          s.composite,
          s.tier,
          s.flags
        FROM crm_pipeline cp
        LEFT JOIN entities e USING (entity_id)
        LEFT JOIN entity_scores_current s USING (entity_id)
        ORDER BY cp.priority DESC, cp.added_at ASC
      `;

      // Group by stage preserving order
      const grouped = {};
      for (const stage of VALID_STAGES) {
        grouped[stage] = [];
      }
      for (const row of rows) {
        const stage = row.stage || "Outreach Queue";
        if (!grouped[stage]) grouped[stage] = [];
        grouped[stage].push(row);
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ pipeline: grouped, stages: VALID_STAGES }),
      };
    }

    // POST — add to pipeline
    if (method === "POST") {
      const body = JSON.parse(event.body || "{}");
      const {
        ccn,
        entity_id,
        provider_name,
        city,
        stage = "Outreach Queue",
        owner,
        notes,
        priority = 5,
        composite,
        ebitda_2022,
      } = body;

      if (!provider_name) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "provider_name required" }),
        };
      }

      const [entry] = await sql`
        INSERT INTO crm_pipeline
          (ccn, entity_id, provider_name, city, stage,
           owner, notes, priority, composite, ebitda_2022)
        VALUES (
          ${ccn || null},
          ${entity_id || null},
          ${provider_name},
          ${city || null},
          ${VALID_STAGES.includes(stage) ? stage : "Outreach Queue"},
          ${owner || null},
          ${notes || null},
          ${priority},
          ${composite || null},
          ${ebitda_2022 || null}
        )
        RETURNING *
      `;

      return {
        statusCode: 201,
        headers: CORS_HEADERS,
        body: JSON.stringify(entry),
      };
    }

    // PATCH — update entry
    if (method === "PATCH") {
      const id = params.id;
      if (!id) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "id query param required" }),
        };
      }

      const body = JSON.parse(event.body || "{}");
      const { stage, owner, notes, priority } = body;

      // Fetch current stage for activity log
      const [current] = await sql`
        SELECT stage FROM crm_pipeline WHERE id = ${id}
      `;
      if (!current) {
        return {
          statusCode: 404,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "Entry not found" }),
        };
      }

      const newStage = stage && VALID_STAGES.includes(stage) ? stage : current.stage;
      const stageChanged = newStage !== current.stage;

      const [updated] = await sql`
        UPDATE crm_pipeline SET
          stage      = ${newStage},
          owner      = COALESCE(${owner || null}, owner),
          notes      = COALESCE(${notes || null}, notes),
          priority   = COALESCE(${priority || null}, priority),
          updated_at = now()
        WHERE id = ${id}
        RETURNING *
      `;

      // Log stage change activity
      if (stageChanged) {
        await sql`
          INSERT INTO crm_activities
            (pipeline_id, activity, from_stage, to_stage, actor)
          VALUES (
            ${id},
            'stage_change',
            ${current.stage},
            ${newStage},
            ${body.actor || "system"}
          )
        `;
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify(updated),
      };
    }

    // DELETE — remove entry
    if (method === "DELETE") {
      const id = params.id;
      if (!id) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "id query param required" }),
        };
      }

      await sql`DELETE FROM crm_pipeline WHERE id = ${id}`;

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ deleted: true }),
      };
    }

    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  } catch (err) {
    console.error("crm error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  } finally {
    await sql.end();
  }
};
