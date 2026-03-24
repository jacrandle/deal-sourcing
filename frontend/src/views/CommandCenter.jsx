import React from "react";
import { useApi } from "../api/useApi.js";
import { getStats } from "../api/client.js";
import { StatCard, ScoreBar, Spinner, ErrorMsg, TierBadge, COLORS } from "../components/shared/ui.jsx";

function fmt(n) {
  if (n === null || n === undefined) return "—";
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return String(n);
}

function fmtDate(d) {
  if (!d) return "Never";
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommandCenter() {
  const { data: stats, loading, error, refetch } = useApi(
    () => getStats(),
    [],
    { pollInterval: 30000 }
  );

  if (loading && !stats) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
        <Spinner size={32} />
      </div>
    );
  }

  if (error) return <ErrorMsg message={error} />;
  if (!stats) return null;

  const t1Pct = stats.universe_count ? ((stats.t1_count / stats.universe_count) * 100).toFixed(0) : 0;
  const t2Pct = stats.universe_count ? ((stats.t2_count / stats.universe_count) * 100).toFixed(0) : 0;
  const t3Pct = stats.universe_count ? ((stats.t3_count / stats.universe_count) * 100).toFixed(0) : 0;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: COLORS.text, fontSize: 22, fontWeight: 700 }}>Command Center</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 4 }}>
          LSG deal sourcing overview — TX Medicare-certified SNF universe
        </p>
      </div>

      {/* Top stats */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard
          label="Universe"
          value={stats.universe_count}
          sub="Active providers scored"
          accent={COLORS.text}
        />
        <StatCard
          label="T1 Targets"
          value={stats.t1_count}
          sub={`Top ${t1Pct}% composite`}
          accent={COLORS.t1}
        />
        <StatCard
          label="T2 Targets"
          value={stats.t2_count}
          sub={`Next ${t2Pct}%`}
          accent={COLORS.t2}
        />
        <StatCard
          label="T3 Targets"
          value={stats.t3_count}
          sub={`Bottom ${t3Pct}%`}
          accent={COLORS.t3}
        />
        <StatCard
          label="In Pipeline"
          value={stats.pipeline_count}
          sub="Active CRM entries"
          accent={COLORS.accent}
        />
        <StatCard
          label="Alerts"
          value={stats.alerts}
          sub="Unacknowledged"
          accent={stats.alerts > 0 ? COLORS.warning : COLORS.textMuted}
        />
      </div>

      {/* Tier distribution */}
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h3 style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginBottom: 20 }}>
          Tier Distribution
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            { tier: "T1", count: stats.t1_count, pct: t1Pct, color: COLORS.t1, desc: "Immediate acquisition targets" },
            { tier: "T2", count: stats.t2_count, pct: t2Pct, color: COLORS.t2, desc: "Qualified pipeline candidates" },
            { tier: "T3", count: stats.t3_count, pct: t3Pct, color: COLORS.t3, desc: "Monitor & watch list" },
          ].map(({ tier, count, pct, color, desc }) => (
            <div key={tier}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <TierBadge tier={tier} />
                  <span style={{ color: COLORS.textMuted, fontSize: 13 }}>{desc}</span>
                </div>
                <span style={{ color: COLORS.text, fontSize: 13, fontWeight: 600 }}>
                  {count} <span style={{ color: COLORS.textDim, fontWeight: 400 }}>({pct}%)</span>
                </span>
              </div>
              <ScoreBar value={Number(pct)} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* Average composite + last run */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: 24,
            flex: 1,
            minWidth: 240,
          }}
        >
          <h3 style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            Average Composite Score
          </h3>
          <div style={{ fontSize: 48, fontWeight: 700, color: COLORS.accent }}>
            {stats.avg_composite ? Number(stats.avg_composite).toFixed(1) : "—"}
          </div>
          <div style={{ marginTop: 12 }}>
            <ScoreBar value={stats.avg_composite || 0} color={COLORS.accent} />
          </div>
          <p style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 8 }}>
            Weighted composite: distress 30% · succession 25% · moat 20% · stability 15% · fit 10%
          </p>
        </div>

        <div
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            padding: 24,
            flex: 1,
            minWidth: 240,
          }}
        >
          <h3 style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
            Pipeline Status
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Last Scored</span>
              <span style={{ color: COLORS.text, fontSize: 13 }}>{fmtDate(stats.last_scored_at)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.textMuted, fontSize: 13 }}>CRM Entries</span>
              <span style={{ color: COLORS.text, fontSize: 13 }}>{stats.pipeline_count}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Open Alerts</span>
              <span style={{ color: stats.alerts > 0 ? COLORS.warning : COLORS.text, fontSize: 13 }}>
                {stats.alerts}
              </span>
            </div>
            {stats.last_job && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: COLORS.textMuted, fontSize: 13 }}>Last Job</span>
                <span
                  style={{
                    color:
                      stats.last_job.status === "success"
                        ? COLORS.success
                        : stats.last_job.status === "error"
                        ? COLORS.danger
                        : COLORS.warning,
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {stats.last_job.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
