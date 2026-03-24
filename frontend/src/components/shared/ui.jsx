// Shared UI primitives for LSG Deal Sourcing Platform

import React from "react";

// ─── Color palette ────────────────────────────────────────────────────────

export const COLORS = {
  bg: "#0a0e1a",
  surface: "#111827",
  surfaceAlt: "#1a2035",
  border: "#1e2d45",
  borderLight: "#2d3f5a",
  text: "#e2e8f0",
  textMuted: "#94a3b8",
  textDim: "#64748b",
  accent: "#3b82f6",
  accentHover: "#2563eb",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  t1: "#10b981",
  t2: "#3b82f6",
  t3: "#94a3b8",
};

// ─── Tier badge ───────────────────────────────────────────────────────────

export function TierBadge({ tier }) {
  const colorMap = { T1: COLORS.t1, T2: COLORS.t2, T3: COLORS.t3 };
  const color = colorMap[tier] || COLORS.textMuted;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        color: "#fff",
        background: color,
      }}
    >
      {tier}
    </span>
  );
}

// ─── Score bar ────────────────────────────────────────────────────────────

export function ScoreBar({ value, max = 100, color = COLORS.accent }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  return (
    <div
      style={{
        background: COLORS.border,
        borderRadius: 4,
        height: 6,
        width: "100%",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 4,
          transition: "width 0.3s ease",
        }}
      />
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────

export function StatCard({ label, value, sub, accent }) {
  return (
    <div
      style={{
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: "20px 24px",
        flex: 1,
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 12, color: COLORS.textMuted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, color: accent || COLORS.text, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Loading spinner ──────────────────────────────────────────────────────

export function Spinner({ size = 24 }) {
  return (
    <div
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${COLORS.border}`,
        borderTopColor: COLORS.accent,
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}

// ─── Error message ────────────────────────────────────────────────────────

export function ErrorMsg({ message }) {
  return (
    <div
      style={{
        background: "#2d1515",
        border: `1px solid ${COLORS.danger}`,
        borderRadius: 8,
        padding: "12px 16px",
        color: COLORS.danger,
        fontSize: 14,
      }}
    >
      {message}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────

export function Button({ children, onClick, variant = "primary", disabled = false, small = false, style = {} }) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: small ? "6px 12px" : "8px 16px",
    borderRadius: 6,
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: small ? 12 : 14,
    fontWeight: 600,
    transition: "all 0.15s",
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  const variants = {
    primary: { background: COLORS.accent, color: "#fff" },
    secondary: { background: COLORS.surfaceAlt, color: COLORS.text, border: `1px solid ${COLORS.border}` },
    danger: { background: "#7f1d1d", color: COLORS.danger, border: `1px solid ${COLORS.danger}` },
    ghost: { background: "transparent", color: COLORS.textMuted, border: `1px solid ${COLORS.border}` },
  };

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...variants[variant] }}
    >
      {children}
    </button>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────

export function Table({ columns, rows, onRowClick }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: "10px 14px",
                  textAlign: col.align || "left",
                  color: COLORS.textMuted,
                  borderBottom: `1px solid ${COLORS.border}`,
                  fontWeight: 600,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                cursor: onRowClick ? "pointer" : "default",
                borderBottom: `1px solid ${COLORS.border}`,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => { if (onRowClick) e.currentTarget.style.background = COLORS.surfaceAlt; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: "10px 14px",
                    textAlign: col.align || "left",
                    color: COLORS.text,
                    whiteSpace: col.nowrap ? "nowrap" : undefined,
                  }}
                >
                  {col.render ? col.render(row[col.key], row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: "32px", textAlign: "center", color: COLORS.textDim }}
              >
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────

export function Modal({ title, onClose, children, width = 540 }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 28,
          width: "100%",
          maxWidth: width,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ color: COLORS.text, fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 20, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────

export function Select({ value, onChange, options, style = {} }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        color: COLORS.text,
        padding: "6px 10px",
        fontSize: 13,
        cursor: "pointer",
        ...style,
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────

export function Input({ value, onChange, placeholder, type = "text", style = {} }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        color: COLORS.text,
        padding: "6px 10px",
        fontSize: 13,
        outline: "none",
        width: "100%",
        ...style,
      }}
    />
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────

export function Textarea({ value, onChange, placeholder, rows = 3, style = {} }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 6,
        color: COLORS.text,
        padding: "8px 10px",
        fontSize: 13,
        outline: "none",
        width: "100%",
        resize: "vertical",
        ...style,
      }}
    />
  );
}

// ─── CSS keyframes injection ──────────────────────────────────────────────

if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    .fade-in { animation: fadeIn 0.2s ease; }
  `;
  document.head.appendChild(style);
}
