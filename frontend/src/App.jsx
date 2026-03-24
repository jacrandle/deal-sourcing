import React, { useState } from "react";
import CommandCenter from "./views/CommandCenter.jsx";
import Universe from "./views/Universe.jsx";
import PipelineCRM from "./views/PipelineCRM.jsx";
import IntelligenceBrief from "./views/IntelligenceBrief.jsx";
import RunPipeline from "./views/RunPipeline.jsx";
import { COLORS } from "./components/shared/ui.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error: error.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: COLORS.danger, background: "#2d1515", borderRadius: 8, margin: 24 }}>
          <strong>Render error:</strong> {this.state.error}
          <div style={{ marginTop: 12 }}>
            <button onClick={() => this.setState({ error: null })} style={{ color: COLORS.accent, background: "none", border: "none", cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const NAV_ITEMS = [
  { id: "command", label: "Command Center", icon: "⬡" },
  { id: "universe", label: "Universe", icon: "◉" },
  { id: "pipeline", label: "CRM Pipeline", icon: "⟆" },
  { id: "intel", label: "Intelligence", icon: "◈" },
  { id: "run", label: "Run Pipeline", icon: "▶" },
];

export default function App() {
  const [activeView, setActiveView] = useState("command");

  function renderView() {
    switch (activeView) {
      case "command": return <CommandCenter />;
      case "universe": return <Universe />;
      case "pipeline": return <PipelineCRM />;
      case "intel": return <IntelligenceBrief />;
      case "run": return <RunPipeline />;
      default: return <CommandCenter />;
    }
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: COLORS.bg }}>
      {/* Sidebar */}
      <aside
        style={{
          width: 220,
          background: COLORS.surface,
          borderRight: `1px solid ${COLORS.border}`,
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "24px 20px 20px",
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: COLORS.text, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            LSG
          </div>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 2, letterSpacing: "0.06em" }}>
            LYKOS SOVEREIGN GROUP
          </div>
          <div style={{ fontSize: 10, color: COLORS.textDim, marginTop: 1 }}>
            Deal Sourcing Platform
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "12px 0", flex: 1 }}>
          {NAV_ITEMS.map((item) => {
            const active = item.id === activeView;
            return (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 20px",
                  background: active ? COLORS.surfaceAlt : "transparent",
                  border: "none",
                  borderLeft: `2px solid ${active ? COLORS.accent : "transparent"}`,
                  color: active ? COLORS.text : COLORS.textMuted,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = COLORS.surfaceAlt;
                    e.currentTarget.style.color = COLORS.text;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = COLORS.textMuted;
                  }
                }}
              >
                <span style={{ fontSize: 14, opacity: 0.7 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: `1px solid ${COLORS.border}`,
            fontSize: 10,
            color: COLORS.textDim,
          }}
        >
          <div>TX · SNF Universe</div>
          <div style={{ marginTop: 2 }}>Proprietary · LSG 2025</div>
        </div>
      </aside>

      {/* Main content */}
      <main
        style={{
          flex: 1,
          padding: "32px 36px",
          overflowY: "auto",
          maxWidth: "100%",
        }}
      >
        <ErrorBoundary key={activeView}>{renderView()}</ErrorBoundary>
      </main>
    </div>
  );
}
