import { useState, useEffect, useRef } from "react";

const STATUS = {
  OK: "ok",
  WARN: "warn",
  ERROR: "error",
  UNKNOWN: "unknown",
};

const MOCK_PIPELINE = [
  {
    id: "pos",
    label: "POS System",
    sublabel: "Print source",
    icon: "🖥️",
    status: STATUS.OK,
    detail: "Last print job: 2 min ago",
    tip: "Any POS printing to 'Tabeza POS Printer'",
  },
  {
    id: "printer",
    label: "Tabeza POS Printer",
    sublabel: "Virtual printer",
    icon: "🖨️",
    status: STATUS.OK,
    detail: "Driver active · Port: TabezaCapturePort",
    tip: "Windows virtual printer — redirects jobs to RedMon",
  },
  {
    id: "redmon",
    label: "RedMon",
    sublabel: "Port monitor",
    icon: "🔀",
    status: STATUS.WARN,
    detail: "Port exists · capture.exe path unverified",
    tip: "Pipes raw print data to capture.exe via stdin",
  },
  {
    id: "capture",
    label: "capture.exe",
    sublabel: "Data receiver",
    icon: "📥",
    status: STATUS.WARN,
    detail: "Process not detected in last 5 min",
    tip: "Receives raw ESC/POS data, forwards to service",
  },
  {
    id: "service",
    label: "TabezaConnect Service",
    sublabel: "Core processor",
    icon: "⚙️",
    status: STATUS.ERROR,
    detail: "3 conflicting instances detected",
    tip: "Parses receipts, uploads to cloud, manages Bar ID",
  },
  {
    id: "cloud",
    label: "Cloud Upload",
    sublabel: "Remote storage",
    icon: "☁️",
    status: STATUS.UNKNOWN,
    detail: "Cannot verify — service unstable",
    tip: "Stores parsed receipt data for Tabeza restaurant app",
  },
  {
    id: "restaurant",
    label: "Tabeza Restaurant App",
    sublabel: "End destination",
    icon: "🍽️",
    status: STATUS.UNKNOWN,
    detail: "Awaiting upstream fix",
    tip: "Receives live receipt data for restaurant analytics",
  },
];

const MOCK_LOGS = [
  { time: "14:32:01", level: "error", msg: "Multiple TabezaConnect.exe instances detected (PIDs: 1204, 3380, 5512)" },
  { time: "14:31:58", level: "warn", msg: "capture.exe stdin pipe timeout after 30s" },
  { time: "14:31:45", level: "warn", msg: "RedMon port 'TabezaCapturePort' found but capture.exe path not confirmed in registry" },
  { time: "14:30:12", level: "info", msg: "Print job received by Tabeza POS Printer (job #204)" },
  { time: "14:30:11", level: "info", msg: "POS print request detected" },
  { time: "14:28:00", level: "error", msg: "Cloud upload failed — service not responding" },
  { time: "14:27:55", level: "info", msg: "Bar ID: BAR-001 loaded from config" },
  { time: "14:27:50", level: "info", msg: "TabezaConnect starting..." },
];

const STATUS_META = {
  ok:      { color: "#22c55e", bg: "#052e16", label: "Healthy",  dot: "#4ade80" },
  warn:    { color: "#f59e0b", bg: "#1c1000", label: "Warning",  dot: "#fbbf24" },
  error:   { color: "#ef4444", bg: "#1a0000", label: "Error",    dot: "#f87171" },
  unknown: { color: "#6b7280", bg: "#111827", label: "Unknown",  dot: "#9ca3af" },
};

const LOG_COLORS = {
  error: "#f87171",
  warn:  "#fbbf24",
  info:  "#60a5fa",
};

function PipelineNode({ node, index, total, active, onClick }) {
  const meta = STATUS_META[node.status];
  const isLast = index === total - 1;

  return (
    <div style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
      <button
        onClick={() => onClick(node.id)}
        style={{
          background: active ? meta.bg : "#0f172a",
          border: `1.5px solid ${active ? meta.color : "#1e293b"}`,
          borderRadius: 12,
          padding: "10px 14px",
          cursor: "pointer",
          textAlign: "left",
          width: "100%",
          transition: "all 0.2s",
          position: "relative",
          outline: "none",
          boxShadow: active ? `0 0 0 2px ${meta.color}33` : "none",
        }}
      >
        {/* Status dot */}
        <div style={{
          position: "absolute", top: 8, right: 8,
          width: 8, height: 8, borderRadius: "50%",
          background: meta.dot,
          boxShadow: `0 0 6px ${meta.dot}`,
        }} />

        <div style={{ fontSize: 20, marginBottom: 2 }}>{node.icon}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#e2e8f0", letterSpacing: "0.03em", fontFamily: "monospace" }}>
          {node.label}
        </div>
        <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>{node.sublabel}</div>
        <div style={{
          fontSize: 9.5, marginTop: 6,
          color: meta.color,
          fontFamily: "monospace",
          lineHeight: 1.4,
        }}>
          {node.detail}
        </div>
      </button>

      {!isLast && (
        <div style={{
          flex: "0 0 28px", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="28" height="12" viewBox="0 0 28 12">
            <line x1="0" y1="6" x2="20" y2="6" stroke="#334155" strokeWidth="1.5" strokeDasharray="3,2" />
            <polygon points="20,2 28,6 20,10" fill="#334155" />
          </svg>
        </div>
      )}
    </div>
  );
}

function DetailPanel({ node }) {
  const meta = STATUS_META[node.status];
  return (
    <div style={{
      background: "#0f172a",
      border: `1px solid ${meta.color}44`,
      borderRadius: 12,
      padding: "16px 20px",
      marginTop: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>{node.icon}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", fontFamily: "monospace" }}>{node.label}</div>
          <div style={{ fontSize: 11, color: meta.color, fontWeight: 600 }}>{meta.label}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.7 }}>
        <strong style={{ color: "#cbd5e1" }}>Role: </strong>{node.tip}
      </div>
      <div style={{
        marginTop: 10, fontSize: 11, color: meta.color,
        background: meta.bg, borderRadius: 8, padding: "8px 12px",
        fontFamily: "monospace",
      }}>
        {node.detail}
      </div>
      {node.status === STATUS.ERROR && (
        <div style={{
          marginTop: 10, fontSize: 11, color: "#fbbf24",
          background: "#1c1000", borderRadius: 8, padding: "8px 12px",
        }}>
          💡 Suggested fix: Kill all TabezaConnect.exe processes, then restart a single instance.
        </div>
      )}
      {node.id === "redmon" && (
        <div style={{
          marginTop: 10, fontSize: 11, color: "#fbbf24",
          background: "#1c1000", borderRadius: 8, padding: "8px 12px",
        }}>
          💡 Verify registry key: <code style={{ color: "#f59e0b" }}>HKLM\SYSTEM\...\TabezaCapturePort</code> points to <code style={{ color: "#f59e0b" }}>capture.exe</code>
        </div>
      )}
    </div>
  );
}

export default function TabezaDashboard() {
  const [activeNode, setActiveNode] = useState("service");
  const [logs, setLogs] = useState(MOCK_LOGS);
  const [tab, setTab] = useState("pipeline");
  const logRef = useRef(null);

  const overallStatus = MOCK_PIPELINE.some(n => n.status === STATUS.ERROR)
    ? STATUS.ERROR
    : MOCK_PIPELINE.some(n => n.status === STATUS.WARN)
    ? STATUS.WARN
    : STATUS.OK;

  const overallMeta = STATUS_META[overallStatus];

  const selectedNode = MOCK_PIPELINE.find(n => n.id === activeNode);

  const handleToggle = (id) => setActiveNode(prev => prev === id ? null : id);

  const okCount = MOCK_PIPELINE.filter(n => n.status === STATUS.OK).length;
  const warnCount = MOCK_PIPELINE.filter(n => n.status === STATUS.WARN).length;
  const errCount = MOCK_PIPELINE.filter(n => n.status === STATUS.ERROR).length;
  const unknCount = MOCK_PIPELINE.filter(n => n.status === STATUS.UNKNOWN).length;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#020617",
      color: "#e2e8f0",
      fontFamily: "'IBM Plex Mono', 'Fira Mono', monospace",
      padding: "24px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 10, height: 10, borderRadius: "50%",
              background: overallMeta.dot,
              boxShadow: `0 0 10px ${overallMeta.dot}`,
              animation: overallStatus === STATUS.ERROR ? "pulse 1.2s infinite" : "none",
            }} />
            <span style={{ fontSize: 18, fontWeight: 800, color: "#f8fafc", letterSpacing: "-0.01em" }}>
              TabezaConnect
            </span>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 20,
              background: overallMeta.bg, color: overallMeta.color,
              border: `1px solid ${overallMeta.color}55`,
              fontWeight: 700, letterSpacing: "0.08em",
            }}>
              {overallMeta.label.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
            Diagnostic Dashboard · Bar ID: BAR-001
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {[
            { count: okCount,   color: STATUS_META.ok.color,   label: "Healthy" },
            { count: warnCount, color: STATUS_META.warn.color,  label: "Warning" },
            { count: errCount,  color: STATUS_META.error.color, label: "Error" },
            { count: unknCount, color: STATUS_META.unknown.color,label: "Unknown" },
          ].map(c => (
            <div key={c.label} style={{
              fontSize: 10, padding: "4px 10px", borderRadius: 20,
              background: "#0f172a", color: c.color,
              border: `1px solid ${c.color}44`,
              fontWeight: 700,
            }}>
              {c.count} {c.label}
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {["pipeline", "logs", "actions"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: tab === t ? "#1e293b" : "transparent",
            border: `1px solid ${tab === t ? "#334155" : "transparent"}`,
            borderRadius: 8, padding: "6px 16px",
            color: tab === t ? "#f1f5f9" : "#64748b",
            fontSize: 11, fontWeight: 700, cursor: "pointer",
            letterSpacing: "0.06em", textTransform: "uppercase",
            fontFamily: "inherit",
          }}>
            {t === "pipeline" ? "🔗 Pipeline" : t === "logs" ? "📋 Logs" : "🛠️ Actions"}
          </button>
        ))}
      </div>

      {/* PIPELINE TAB */}
      {tab === "pipeline" && (
        <div>
          {/* Pipeline flow */}
          <div style={{
            background: "#0a1628",
            border: "1px solid #1e293b",
            borderRadius: 14,
            padding: "20px 16px",
            marginBottom: 16,
            overflowX: "auto",
          }}>
            <div style={{ fontSize: 10, color: "#475569", marginBottom: 14, letterSpacing: "0.08em" }}>
              RECEIPT FLOW  ·  CLICK ANY NODE FOR DETAILS
            </div>
            <div style={{ display: "flex", alignItems: "stretch", gap: 0, minWidth: 700 }}>
              {MOCK_PIPELINE.map((node, i) => (
                <PipelineNode
                  key={node.id}
                  node={node}
                  index={i}
                  total={MOCK_PIPELINE.length}
                  active={activeNode === node.id}
                  onClick={handleToggle}
                />
              ))}
            </div>
          </div>

          {/* Detail panel */}
          {selectedNode && <DetailPanel node={selectedNode} />}

          {/* What's wrong summary */}
          <div style={{
            marginTop: 16,
            background: "#1a0000",
            border: "1px solid #ef444444",
            borderRadius: 12,
            padding: "14px 18px",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f87171", marginBottom: 8, letterSpacing: "0.06em" }}>
              ⚠️ ACTIVE ISSUES
            </div>
            {[
              { node: "TabezaConnect Service", issue: "3 conflicting instances running. Receipts cannot be reliably processed." },
              { node: "RedMon → capture.exe", issue: "capture.exe path in registry unverified. Print jobs may not reach the service." },
              { node: "Cloud → Restaurant App", issue: "Cannot confirm delivery to Tabeza restaurant app until upstream is fixed." },
            ].map((item, i) => (
              <div key={i} style={{
                display: "flex", gap: 10, alignItems: "flex-start",
                padding: "6px 0",
                borderTop: i > 0 ? "1px solid #1e293b" : "none",
              }}>
                <span style={{ color: "#ef4444", fontSize: 12, marginTop: 1 }}>✕</span>
                <div>
                  <div style={{ fontSize: 11, color: "#fca5a5", fontWeight: 600 }}>{item.node}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>{item.issue}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOGS TAB */}
      {tab === "logs" && (
        <div style={{
          background: "#040d1a",
          border: "1px solid #1e293b",
          borderRadius: 14,
          padding: 0,
          overflow: "hidden",
        }}>
          <div style={{
            padding: "10px 16px",
            borderBottom: "1px solid #1e293b",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <span style={{ fontSize: 10, color: "#475569", letterSpacing: "0.1em" }}>SYSTEM LOG</span>
            <span style={{
              fontSize: 10, color: "#22c55e",
              animation: "blink 1.4s infinite",
            }}>● LIVE</span>
          </div>
          <div ref={logRef} style={{
            height: 320, overflowY: "auto",
            padding: "10px 16px",
            fontSize: 11,
            lineHeight: 2,
          }}>
            {logs.map((log, i) => (
              <div key={i} style={{ display: "flex", gap: 12 }}>
                <span style={{ color: "#334155", flex: "0 0 70px" }}>{log.time}</span>
                <span style={{
                  flex: "0 0 42px",
                  color: LOG_COLORS[log.level] || "#94a3b8",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  fontSize: 9.5,
                  letterSpacing: "0.1em",
                }}>
                  {log.level}
                </span>
                <span style={{ color: log.level === "error" ? "#fca5a5" : log.level === "warn" ? "#fde68a" : "#94a3b8" }}>
                  {log.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACTIONS TAB */}
      {tab === "actions" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            {
              icon: "🔄",
              title: "Restart Service",
              desc: "Kill all TabezaConnect.exe instances and start a clean single process.",
              color: "#22c55e",
              critical: false,
            },
            {
              icon: "🔍",
              title: "Verify RedMon Config",
              desc: "Check registry to confirm capture.exe path is correctly linked to TabezaCapturePort.",
              color: "#60a5fa",
              critical: false,
            },
            {
              icon: "🖨️",
              title: "Test Print Job",
              desc: "Send a test receipt through the full pipeline and trace where it stops.",
              color: "#a78bfa",
              critical: false,
            },
            {
              icon: "☁️",
              title: "Test Cloud + Restaurant App",
              desc: "Verify receipt data reaches cloud storage and Tabeza restaurant app receives it.",
              color: "#f59e0b",
              critical: false,
            },
            {
              icon: "🗑️",
              title: "Kill Conflicting Processes",
              desc: "Force-terminate all duplicate TabezaConnect processes immediately.",
              color: "#ef4444",
              critical: true,
            },
            {
              icon: "📋",
              title: "Export Diagnostics",
              desc: "Export full log and system state for support review.",
              color: "#94a3b8",
              critical: false,
            },
          ].map((action, i) => (
            <button key={i} style={{
              background: "#0f172a",
              border: `1px solid ${action.critical ? "#ef444466" : "#1e293b"}`,
              borderRadius: 12, padding: "16px 18px",
              textAlign: "left", cursor: "pointer",
              transition: "border-color 0.2s",
              fontFamily: "inherit",
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = action.color + "88"}
              onMouseLeave={e => e.currentTarget.style.borderColor = action.critical ? "#ef444466" : "#1e293b"}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{action.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: action.color, marginBottom: 4 }}>
                {action.title}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.6 }}>{action.desc}</div>
            </button>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 4px; }
      `}</style>
    </div>
  );
}
