import React from "react";
import { useApi } from "../api/useApi.js";
import { getStats } from "../api/client.js";
import { StatCard, Spinner, ErrorMsg, Button, COLORS } from "../components/shared/ui.jsx";

const GITHUB_ACTIONS_URL =
  "https://github.com/jacrandle/deal-sourcing/actions/workflows/pipeline.yml";

function fmtDate(d) {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusDot({ status }) {
  const color = {
    success: COLORS.t1,
    error: COLORS.danger,
    running: COLORS.warning,
    queued: COLORS.textMuted,
  }[status] || COLORS.textMuted;

  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        marginRight: 6,
      }}
    />
  );
}

export default function RunPipeline() {
  const { data: stats, loading, error } = useApi(
    () => getStats(),
    [],
    { pollInterval: 30000 }
  );

  if (loading && !stats) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error) return <ErrorMsg message={error} />;

  const lastJob = stats?.last_job;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: COLORS.text, fontSize: 22, fontWeight: 700 }}>Pipeline Control</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 4 }}>
          Pipeline runs via GitHub Actions · scores are written directly to Neon
        </p>
      </div>

      {/* Quick stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard
          label="Last Scored"
          value={stats?.last_scored_at ? fmtDate(stats.last_scored_at).split(",")[0] : "—"}
          sub={stats?.last_scored_at ? fmtDate(stats.last_scored_at) : "No runs yet"}
        />
        <StatCard
          label="Providers Scored"
          value={stats?.universe_count ?? "—"}
          sub="Active in universe"
        />
        <StatCard
          label="T1 Targets"
          value={stats?.t1_count ?? "—"}
          accent={COLORS.t1}
        />
      </div>

      {/* GitHub Actions trigger */}
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 28,
          marginBottom: 24,
        }}
      >
        <h3 style={{ color: COLORS.text, fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Trigger Pipeline Run
        </h3>
        <p style={{ color: COLORS.textMuted, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
          The scoring pipeline runs automatically every Sunday at 2am CST. To trigger a
          manual run, open GitHub Actions and click <strong style={{ color: COLORS.text }}>Run workflow</strong>.
          Choose a mode and optionally override states/years.
        </p>

        <div
          style={{
            background: COLORS.surfaceAlt,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 6,
            padding: 16,
            marginBottom: 20,
            fontFamily: "monospace",
            fontSize: 12,
            color: COLORS.textMuted,
          }}
        >
          <div style={{ color: COLORS.textDim, marginBottom: 4 }}># Pipeline modes</div>
          <div>
            <span style={{ color: COLORS.t1 }}>full</span>
            {" "}&nbsp;→ ingest + resolve + score (full CMS download)
          </div>
          <div>
            <span style={{ color: COLORS.t2 }}>refresh</span>
            {" "}&nbsp;→ resolve new entities + re-score all
          </div>
          <div>
            <span style={{ color: COLORS.t3 }}>new-only</span>
            → resolve new entities only, then score
          </div>
        </div>

        <Button
          onClick={() => window.open(GITHUB_ACTIONS_URL, "_blank")}
          style={{ fontSize: 15, padding: "10px 20px" }}
        >
          ↗ Run Pipeline in GitHub
        </Button>
      </div>

      {/* Schedule info */}
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h3 style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
          Schedule & Configuration
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            fontSize: 13,
          }}
        >
          {[
            { label: "Cron Schedule", value: "Sunday 2:00am CST (0 7 * * 0 UTC)" },
            { label: "Default Mode", value: "refresh" },
            { label: "Default States", value: "TX" },
            { label: "Default Years", value: "2022, 2023" },
            { label: "Tier Method", value: "Percentile-based (T1=top 15%, T2=next 40%, T3=bottom 45%)" },
            { label: "Data Source", value: "CMS HCRIS SNF Cost Reports" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {label}
              </div>
              <div style={{ color: COLORS.text }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Last job status */}
      {lastJob && (
        <div
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: 24,
          }}
        >
          <h3 style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            Last Job
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 16,
              fontSize: 13,
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Status
              </div>
              <div style={{ color: COLORS.text }}>
                <StatusDot status={lastJob.status} />
                {lastJob.status}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Mode
              </div>
              <div style={{ color: COLORS.text }}>{lastJob.mode || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Started
              </div>
              <div style={{ color: COLORS.text }}>{fmtDate(lastJob.started_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Completed
              </div>
              <div style={{ color: COLORS.text }}>{fmtDate(lastJob.completed_at)}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Entities Scored
              </div>
              <div style={{ color: COLORS.text }}>{lastJob.entities_scored ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                T1 / T2 / T3
              </div>
              <div style={{ color: COLORS.text }}>
                <span style={{ color: COLORS.t1 }}>{lastJob.t1_count}</span>
                {" / "}
                <span style={{ color: COLORS.t2 }}>{lastJob.t2_count}</span>
                {" / "}
                <span style={{ color: COLORS.t3 }}>{lastJob.t3_count}</span>
              </div>
            </div>
          </div>

          {lastJob.error_message && (
            <div
              style={{
                marginTop: 16,
                background: "#2d1515",
                border: `1px solid ${COLORS.danger}`,
                borderRadius: 6,
                padding: 12,
                color: COLORS.danger,
                fontSize: 12,
                fontFamily: "monospace",
              }}
            >
              {lastJob.error_message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
