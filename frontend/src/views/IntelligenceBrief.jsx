import React, { useState } from "react";
import { useApi } from "../api/useApi.js";
import { getProviders, getProvider, getAlerts, acknowledgeAlert } from "../api/client.js";
import {
  Select, Spinner, ErrorMsg, Button, TierBadge, ScoreBar, COLORS,
} from "../components/shared/ui.jsx";

function fmt$(n) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

function Sparkline({ history }) {
  if (!history || history.length < 2) return null;
  const values = [...history].reverse().map((h) => h.composite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 120, H = 32;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  });

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={COLORS.accent}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DimensionRow({ label, value, color }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: COLORS.textMuted }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: color || COLORS.text }}>
          {value?.toFixed(1) ?? "—"}
        </span>
      </div>
      <ScoreBar value={value || 0} color={color || COLORS.accent} />
    </div>
  );
}

function AlertsPanel() {
  const { data: alerts, loading, error, refetch } = useApi(() => getAlerts(), [], { pollInterval: 60000 });
  const [acking, setAcking] = useState(null);

  async function handleAcknowledge(id) {
    setAcking(id);
    try {
      await acknowledgeAlert(id);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setAcking(null);
    }
  }

  if (loading && !alerts) return <Spinner />;
  if (error) return <ErrorMsg message={error} />;

  const items = alerts || [];

  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${COLORS.border}` }}>
        <h3 style={{ color: COLORS.text, fontSize: 15, fontWeight: 600 }}>
          Intelligence Alerts
          {items.length > 0 && (
            <span
              style={{
                marginLeft: 8,
                background: COLORS.warning,
                color: "#000",
                borderRadius: 10,
                padding: "1px 7px",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {items.length}
            </span>
          )}
        </h3>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: COLORS.textDim, fontSize: 13 }}>
          No unacknowledged alerts
        </div>
      ) : (
        <div>
          {items.map((alert) => {
            const severityColor = {
              critical: COLORS.danger,
              high: "#f97316",
              medium: COLORS.warning,
              low: COLORS.textMuted,
            }[alert.severity] || COLORS.textMuted;

            return (
              <div
                key={alert.id}
                style={{
                  padding: "14px 18px",
                  borderBottom: `1px solid ${COLORS.border}`,
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: severityColor,
                    marginTop: 5,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: COLORS.text, fontSize: 13 }}>
                      {alert.canonical_name || "Unknown"}
                    </span>
                    {alert.tier && <TierBadge tier={alert.tier} />}
                    <span style={{ fontSize: 11, color: severityColor, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {alert.severity}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 4 }}>
                    {alert.alert_type}: {alert.description}
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.textDim }}>
                    {new Date(alert.detected_at).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  small
                  variant="ghost"
                  disabled={acking === alert.id}
                  onClick={() => handleAcknowledge(alert.id)}
                >
                  {acking === alert.id ? "..." : "Ack"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function IntelligenceBrief() {
  const [selectedCcn, setSelectedCcn] = useState("");
  const { data: providers } = useApi(() => getProviders({ tier: "T1", limit: 50 }), []);

  const { data: provider, loading, error } = useApi(
    () => (selectedCcn ? getProvider(selectedCcn) : Promise.resolve(null)),
    [selectedCcn]
  );

  const providerOptions = [
    { value: "", label: "Select a T1 provider..." },
    ...(providers || []).map((p) => ({
      value: p.ccn,
      label: `${p.canonical_name} — ${p.city}, ${p.state}`,
    })),
  ];

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: COLORS.text, fontSize: 22, fontWeight: 700 }}>Intelligence Brief</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 4 }}>
          Deep-dive on individual targets · T1 universe
        </p>
      </div>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Left: provider detail */}
        <div style={{ flex: 2, minWidth: 320 }}>
          <div style={{ marginBottom: 16 }}>
            <Select
              value={selectedCcn}
              onChange={setSelectedCcn}
              options={providerOptions}
              style={{ width: "100%", maxWidth: 480 }}
            />
          </div>

          {!selectedCcn && (
            <div
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 8,
                padding: 48,
                textAlign: "center",
                color: COLORS.textDim,
              }}
            >
              Select a T1 provider to view intelligence brief
            </div>
          )}

          {selectedCcn && loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
              <Spinner size={32} />
            </div>
          )}

          {selectedCcn && error && <ErrorMsg message={error} />}

          {provider && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header */}
              <div
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                  <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700 }}>
                    {provider.canonical_name}
                  </h3>
                  <TierBadge tier={provider.tier} />
                </div>
                <div style={{ color: COLORS.textMuted, fontSize: 13 }}>
                  {provider.city}, {provider.state} {provider.zip} · CCN {provider.ccn}
                  {provider.npi && ` · NPI ${provider.npi}`}
                </div>
                {provider.crm_stage && (
                  <div style={{ marginTop: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        background: COLORS.surfaceAlt,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 4,
                        padding: "2px 8px",
                        color: COLORS.accent,
                      }}
                    >
                      In Pipeline: {provider.crm_stage}
                    </span>
                  </div>
                )}
              </div>

              {/* Dimensions */}
              <div
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: 24,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <h4 style={{ color: COLORS.text, fontSize: 15, fontWeight: 600 }}>
                    Scoring Profile
                  </h4>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: COLORS.textMuted }}>Composite</span>
                    <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.accent }}>
                      {provider.composite?.toFixed(1)}
                    </span>
                  </div>
                </div>

                <DimensionRow label="Financial Distress" value={provider.distress} color={COLORS.danger} />
                <DimensionRow label="Succession Risk" value={provider.succession} color={COLORS.warning} />
                <DimensionRow label="Competitive Moat" value={provider.moat} color={COLORS.t2} />
                <DimensionRow label="Operational Stability" value={provider.stability} color={COLORS.t1} />
                <DimensionRow label="LSG Strategic Fit" value={provider.lsg_fit} color={COLORS.accent} />

                {provider.score_history && provider.score_history.length > 1 && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
                    <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8 }}>
                      Score Trend (last {provider.score_history.length} runs)
                    </div>
                    <Sparkline history={provider.score_history} />
                  </div>
                )}
              </div>

              {/* Financials */}
              <div
                style={{
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 8,
                  padding: 24,
                }}
              >
                <h4 style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
                  Financial Snapshot (FY2022)
                </h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  {[
                    { label: "Total Revenue", value: fmt$(provider.revenue_2022) },
                    { label: "EBITDA Proxy", value: fmt$(provider.ebitda_2022) },
                    { label: "Medicare Revenue", value: fmt$(provider.medicare_revenue) },
                    { label: "Total Expenses", value: fmt$(provider.total_expenses) },
                    { label: "Labor Expenses", value: fmt$(provider.labor_expenses) },
                    { label: "EBITDA Margin", value: provider.ebitda_margin != null ? `${Number(provider.ebitda_margin).toFixed(1)}%` : "—" },
                    { label: "Medicare %", value: provider.medicare_conc != null ? `${Number(provider.medicare_conc).toFixed(0)}%` : "—" },
                    { label: "Labor %", value: provider.labor_pct != null ? `${Number(provider.labor_pct).toFixed(0)}%` : "—" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                        {label}
                      </div>
                      <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 14 }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Flags */}
              {provider.flags?.length > 0 && (
                <div
                  style={{
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 8,
                    padding: 24,
                  }}
                >
                  <h4 style={{ color: COLORS.text, fontSize: 15, fontWeight: 600, marginBottom: 12 }}>
                    Acquisition Signals
                  </h4>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {provider.flags.map((f) => (
                      <span
                        key={f}
                        style={{
                          background: "#2d1f00",
                          border: `1px solid ${COLORS.warning}`,
                          color: COLORS.warning,
                          borderRadius: 4,
                          padding: "4px 10px",
                          fontSize: 12,
                          fontWeight: 500,
                        }}
                      >
                        {f.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: alerts */}
        <div style={{ flex: 1, minWidth: 280 }}>
          <AlertsPanel />
        </div>
      </div>
    </div>
  );
}
