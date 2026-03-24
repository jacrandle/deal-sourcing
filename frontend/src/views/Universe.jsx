import React, { useState, useMemo } from "react";
import { useApi } from "../api/useApi.js";
import { getProviders, addToPipeline } from "../api/client.js";
import {
  Table, TierBadge, ScoreBar, Select, Spinner, ErrorMsg, Button,
  Modal, Input, Textarea, COLORS,
} from "../components/shared/ui.jsx";

const TIER_OPTIONS = [
  { value: "", label: "All Tiers" },
  { value: "T1", label: "T1 Only" },
  { value: "T2", label: "T2 Only" },
  { value: "T3", label: "T3 Only" },
];

const SORT_OPTIONS = [
  { value: "composite", label: "Composite Score" },
  { value: "distress", label: "Distress" },
  { value: "succession", label: "Succession Risk" },
  { value: "moat", label: "Competitive Moat" },
  { value: "stability", label: "Stability" },
  { value: "lsg_fit", label: "LSG Fit" },
  { value: "ebitda_2022", label: "EBITDA" },
  { value: "entity_age_years", label: "Entity Age" },
];

function fmt$(n) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

function scoreColor(v) {
  if (v >= 75) return COLORS.t1;
  if (v >= 50) return COLORS.t2;
  return COLORS.t3;
}

export default function Universe() {
  const [tier, setTier] = useState("");
  const [sortBy, setSortBy] = useState("composite");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [addModal, setAddModal] = useState(null);
  const [addForm, setAddForm] = useState({ owner: "", notes: "", priority: "5" });
  const [addLoading, setAddLoading] = useState(false);

  const { data, loading, error, refetch } = useApi(
    () => getProviders({ tier: tier || undefined, sort_by: sortBy }),
    [tier, sortBy]
  );

  const providers = useMemo(() => {
    if (!Array.isArray(data)) return [];
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (p) =>
        p.canonical_name?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.ccn?.includes(q)
    );
  }, [data, search]);

  const columns = [
    {
      key: "canonical_name",
      label: "Provider",
      render: (v, row) => (
        <div>
          <div style={{ fontWeight: 600, color: COLORS.text }}>{v}</div>
          <div style={{ fontSize: 11, color: COLORS.textDim }}>
            {row.city}, {row.state} · CCN {row.ccn}
          </div>
        </div>
      ),
    },
    {
      key: "tier",
      label: "Tier",
      align: "center",
      render: (v) => <TierBadge tier={v} />,
    },
    {
      key: "composite",
      label: "Composite",
      align: "right",
      render: (v) => (
        <div style={{ minWidth: 80 }}>
          <div style={{ textAlign: "right", fontWeight: 600, color: scoreColor(v), marginBottom: 4 }}>
            {v?.toFixed(1)}
          </div>
          <ScoreBar value={v} color={scoreColor(v)} />
        </div>
      ),
    },
    {
      key: "distress",
      label: "Distress",
      align: "right",
      render: (v) => <span style={{ color: COLORS.textMuted }}>{v?.toFixed(0)}</span>,
    },
    {
      key: "succession",
      label: "Succession",
      align: "right",
      render: (v) => <span style={{ color: COLORS.textMuted }}>{v?.toFixed(0)}</span>,
    },
    {
      key: "ebitda_2022",
      label: "EBITDA",
      align: "right",
      nowrap: true,
      render: (v) => <span style={{ color: COLORS.text }}>{fmt$(v)}</span>,
    },
    {
      key: "medicare_conc",
      label: "Medicare %",
      align: "right",
      render: (v) => (
        <span style={{ color: v > 60 ? COLORS.t1 : COLORS.textMuted }}>
          {v != null ? `${v.toFixed(0)}%` : "—"}
        </span>
      ),
    },
    {
      key: "in_pipeline",
      label: "CRM",
      align: "center",
      render: (v) =>
        v ? (
          <span style={{ fontSize: 11, color: COLORS.accent }}>In Pipeline</span>
        ) : null,
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (_, row) => (
        <Button
          small
          variant="ghost"
          onClick={(e) => {
            e.stopPropagation();
            setAddModal(row);
            setAddForm({ owner: "", notes: "", priority: "5" });
          }}
        >
          + Pipeline
        </Button>
      ),
    },
  ];

  async function handleAddToPipeline() {
    if (!addModal) return;
    setAddLoading(true);
    try {
      await addToPipeline({
        ccn: addModal.ccn,
        entity_id: addModal.entity_id,
        provider_name: addModal.canonical_name,
        city: addModal.city,
        composite: addModal.composite,
        ebitda_2022: addModal.ebitda_2022,
        owner: addForm.owner || undefined,
        notes: addForm.notes || undefined,
        priority: parseInt(addForm.priority) || 5,
      });
      setAddModal(null);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: COLORS.text, fontSize: 22, fontWeight: 700 }}>Provider Universe</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 4 }}>
          {providers.length} providers · sorted by {sortBy}
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <Input
          value={search}
          onChange={setSearch}
          placeholder="Search name, city, CCN..."
          style={{ maxWidth: 260 }}
        />
        <Select value={tier} onChange={setTier} options={TIER_OPTIONS} />
        <Select value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} />
        <Button variant="ghost" small onClick={refetch}>
          Refresh
        </Button>
      </div>

      {loading && !data ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spinner size={32} />
        </div>
      ) : error ? (
        <ErrorMsg message={error} />
      ) : (
        <div
          style={{
            background: COLORS.surface,
            border: `1px solid ${COLORS.border}`,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <Table
            columns={columns}
            rows={providers}
            onRowClick={(row) => setSelected(row)}
          />
        </div>
      )}

      {/* Provider detail modal */}
      {selected && (
        <Modal
          title={selected.canonical_name}
          onClose={() => setSelected(null)}
          width={600}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <TierBadge tier={selected.tier} />
              <span style={{ color: COLORS.textMuted, fontSize: 13 }}>
                {selected.city}, {selected.state} · CCN {selected.ccn}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {[
                { label: "Composite", value: selected.composite?.toFixed(1) },
                { label: "Distress", value: selected.distress?.toFixed(1) },
                { label: "Succession", value: selected.succession?.toFixed(1) },
                { label: "Moat", value: selected.moat?.toFixed(1) },
                { label: "Stability", value: selected.stability?.toFixed(1) },
                { label: "LSG Fit", value: selected.lsg_fit?.toFixed(1) },
                { label: "EBITDA 2022", value: fmt$(selected.ebitda_2022) },
                { label: "Revenue 2022", value: fmt$(selected.revenue_2022) },
                { label: "Medicare %", value: selected.medicare_conc != null ? `${selected.medicare_conc.toFixed(0)}%` : "—" },
                { label: "Labor %", value: selected.labor_pct != null ? `${selected.labor_pct.toFixed(0)}%` : "—" },
                { label: "Margin Trend", value: selected.margin_trend || "—" },
                { label: "Entity Age", value: selected.entity_age_years != null ? `${selected.entity_age_years.toFixed(0)}y` : "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {label}
                  </div>
                  <div style={{ color: COLORS.text, fontWeight: 600 }}>{value ?? "—"}</div>
                </div>
              ))}
            </div>

            {selected.flags?.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: COLORS.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Flags
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {selected.flags.map((f) => (
                    <span
                      key={f}
                      style={{
                        background: "#2d1f00",
                        border: `1px solid ${COLORS.warning}`,
                        color: COLORS.warning,
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontSize: 11,
                      }}
                    >
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
              {!selected.in_pipeline && (
                <Button
                  onClick={() => {
                    setSelected(null);
                    setAddModal(selected);
                    setAddForm({ owner: "", notes: "", priority: "5" });
                  }}
                >
                  Add to Pipeline
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Add to pipeline modal */}
      {addModal && (
        <Modal
          title={`Add to Pipeline — ${addModal.canonical_name}`}
          onClose={() => setAddModal(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>
                Owner
              </label>
              <Input
                value={addForm.owner}
                onChange={(v) => setAddForm((f) => ({ ...f, owner: v }))}
                placeholder="Analyst name..."
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>
                Notes
              </label>
              <Textarea
                value={addForm.notes}
                onChange={(v) => setAddForm((f) => ({ ...f, notes: v }))}
                placeholder="Initial notes..."
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>
                Priority (1–10)
              </label>
              <Input
                type="number"
                value={addForm.priority}
                onChange={(v) => setAddForm((f) => ({ ...f, priority: v }))}
                style={{ maxWidth: 80 }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setAddModal(null)}>
                Cancel
              </Button>
              <Button onClick={handleAddToPipeline} disabled={addLoading}>
                {addLoading ? "Adding..." : "Add to Pipeline"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
