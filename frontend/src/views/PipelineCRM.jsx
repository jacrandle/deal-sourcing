import React, { useState } from "react";
import { useApi } from "../api/useApi.js";
import { getCrmPipeline, updatePipelineEntry, deletePipelineEntry } from "../api/client.js";
import {
  Button, Spinner, ErrorMsg, Modal, Input, Textarea, Select, TierBadge, COLORS,
} from "../components/shared/ui.jsx";

const STAGES = [
  "Outreach Queue",
  "Contacted",
  "NDA Executed",
  "Diligence",
  "LOI Submitted",
];

const STAGE_COLORS = {
  "Outreach Queue": COLORS.textDim,
  Contacted: COLORS.accent,
  "NDA Executed": COLORS.warning,
  Diligence: "#a855f7",
  "LOI Submitted": COLORS.t1,
};

function fmt$(n) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n}`;
}

function PipelineCard({ entry, onEdit, onDelete }) {
  return (
    <div
      style={{
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 14,
        marginBottom: 10,
        cursor: "pointer",
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = COLORS.borderLight)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = COLORS.border)}
      onClick={() => onEdit(entry)}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 600, color: COLORS.text, fontSize: 13, marginBottom: 2 }}>
            {entry.provider_name || entry.canonical_name}
          </div>
          <div style={{ fontSize: 11, color: COLORS.textDim }}>
            {entry.city}, {entry.state}
          </div>
        </div>
        {entry.tier && <TierBadge tier={entry.tier} />}
      </div>

      <div style={{ display: "flex", gap: 16, fontSize: 11, color: COLORS.textMuted }}>
        {entry.composite != null && (
          <span>Score: <strong style={{ color: COLORS.text }}>{Number(entry.composite).toFixed(1)}</strong></span>
        )}
        {entry.ebitda_2022 != null && (
          <span>EBITDA: <strong style={{ color: COLORS.text }}>{fmt$(entry.ebitda_2022)}</strong></span>
        )}
        {entry.owner && (
          <span>Owner: <strong style={{ color: COLORS.text }}>{entry.owner}</strong></span>
        )}
      </div>

      {entry.notes && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: COLORS.textMuted,
            borderTop: `1px solid ${COLORS.border}`,
            paddingTop: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {entry.notes}
        </div>
      )}
    </div>
  );
}

export default function PipelineCRM() {
  const [editEntry, setEditEntry] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refetch } = useApi(() => getCrmPipeline(), []);

  function handleEdit(entry) {
    setEditEntry(entry);
    setEditForm({
      stage: entry.stage || "Outreach Queue",
      owner: entry.owner || "",
      notes: entry.notes || "",
      priority: String(entry.priority || 5),
    });
  }

  async function handleSave() {
    if (!editEntry) return;
    setSaving(true);
    try {
      await updatePipelineEntry(editEntry.id, {
        stage: editForm.stage,
        owner: editForm.owner || undefined,
        notes: editForm.notes || undefined,
        priority: parseInt(editForm.priority) || 5,
        actor: "analyst",
      });
      setEditEntry(null);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editEntry) return;
    if (!confirm(`Remove ${editEntry.provider_name} from pipeline?`)) return;
    setSaving(true);
    try {
      await deletePipelineEntry(editEntry.id);
      setEditEntry(null);
      refetch();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  const pipeline = data?.pipeline || {};
  const totalEntries = STAGES.reduce((n, s) => n + (pipeline[s]?.length || 0), 0);

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: COLORS.text, fontSize: 22, fontWeight: 700 }}>CRM Pipeline</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 14, marginTop: 4 }}>
          {totalEntries} deal{totalEntries !== 1 ? "s" : ""} across {STAGES.length} stages
        </p>
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
            display: "grid",
            gridTemplateColumns: `repeat(${STAGES.length}, minmax(200px, 1fr))`,
            gap: 16,
            overflowX: "auto",
          }}
        >
          {STAGES.map((stage) => {
            const entries = pipeline[stage] || [];
            const color = STAGE_COLORS[stage] || COLORS.textMuted;
            return (
              <div key={stage}>
                {/* Column header */}
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px 8px 0 0",
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderBottom: `2px solid ${color}`,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, color: COLORS.text, fontSize: 13 }}>{stage}</div>
                  <div style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 2 }}>
                    {entries.length} deal{entries.length !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Cards */}
                <div>
                  {entries.length === 0 ? (
                    <div
                      style={{
                        border: `1px dashed ${COLORS.border}`,
                        borderRadius: 8,
                        padding: "24px 16px",
                        textAlign: "center",
                        color: COLORS.textDim,
                        fontSize: 12,
                      }}
                    >
                      No deals
                    </div>
                  ) : (
                    entries.map((entry) => (
                      <PipelineCard
                        key={entry.id}
                        entry={entry}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit modal */}
      {editEntry && (
        <Modal
          title={editEntry.provider_name || editEntry.canonical_name}
          onClose={() => setEditEntry(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>
                Stage
              </label>
              <Select
                value={editForm.stage}
                onChange={(v) => setEditForm((f) => ({ ...f, stage: v }))}
                options={STAGES.map((s) => ({ value: s, label: s }))}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>
                Owner
              </label>
              <Input
                value={editForm.owner}
                onChange={(v) => setEditForm((f) => ({ ...f, owner: v }))}
                placeholder="Analyst name..."
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>
                Priority (1–10)
              </label>
              <Input
                type="number"
                value={editForm.priority}
                onChange={(v) => setEditForm((f) => ({ ...f, priority: v }))}
                style={{ maxWidth: 80 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>
                Notes
              </label>
              <Textarea
                value={editForm.notes}
                onChange={(v) => setEditForm((f) => ({ ...f, notes: v }))}
                placeholder="Deal notes..."
                rows={4}
              />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 8 }}>
              <Button variant="danger" small onClick={handleDelete} disabled={saving}>
                Remove
              </Button>
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" onClick={() => setEditEntry(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
