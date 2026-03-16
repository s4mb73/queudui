import { useState } from "react";

export function Badge({ children, type = "neutral" }) {
  const styles = {
    profit:    { background: "rgba(5,150,105,0.08)",   color: "#059669", border: "1px solid rgba(5,150,105,0.2)" },
    loss:      { background: "rgba(239,68,68,0.08)",   color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" },
    sport:     { background: "rgba(26,58,110,0.08)",   color: "#1a3a6e", border: "1px solid rgba(26,58,110,0.2)" },
    concert:   { background: "rgba(124,58,237,0.08)",  color: "#7c3aed", border: "1px solid rgba(124,58,237,0.2)" },
    available: { background: "rgba(249,115,22,0.08)",  color: "#f97316", border: "1px solid rgba(249,115,22,0.2)" },
    neutral:   { background: "#f1f5f9",                color: "#64748b", border: "1px solid #e2e6ea" },
    warning:   { background: "rgba(245,158,11,0.08)",  color: "#d97706", border: "1px solid rgba(245,158,11,0.2)" },
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 11, letterSpacing: "0.3px", fontWeight: 700, padding: "4px 10px", borderRadius: 20, ...styles[type] }}>
      {children}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 16, width: wide ? 640 : 500, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(15,23,42,0.15)" }}>
        <div style={{ padding: "20px 26px", borderBottom: "0.5px solid #e2e6ea", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 17, color: "#0f172a", letterSpacing: "-0.3px" }}>{title}</div>
          <button onClick={onClose} style={{ background: "#f7f8fa", border: "1px solid #e2e6ea", color: "#64748b", fontSize: 14, cursor: "pointer", width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>✕</button>
        </div>
        <div style={{ padding: 26 }}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", color: "#374151", marginBottom: 6, textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{ background: focus ? "#ffffff" : "#f7f8fa", border: `1.5px solid ${focus ? "#1a3a6e" : "#e2e6ea"}`, color: "#0f172a", fontFamily: "var(--body)", fontSize: 13, padding: "9px 13px", width: "100%", borderRadius: 8, outline: "none", transition: "all 0.15s", ...props.style }}
      {...props} />
  );
}

export function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: "#f7f8fa", border: "1.5px solid #e2e6ea", color: "#0f172a", fontFamily: "var(--body)", fontSize: 13, padding: "9px 13px", width: "100%", borderRadius: 8, outline: "none", cursor: "pointer", transition: "border-color 0.15s" }}>
      {children}
    </select>
  );
}

export function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, padding: "18px 20px", position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent || "#e2e6ea", borderRadius: "12px 12px 0 0" }} />
      <div style={{ fontSize: 9, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", marginBottom: 10, fontWeight: 700 }}>{label}</div>
      <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: accent || "#0f172a", lineHeight: 1, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>{sub}</div>}
      {icon && <div style={{ position: "absolute", top: 16, right: 18, fontSize: 18, opacity: 0.12 }}>{icon}</div>}
    </div>
  );
}

export function Sidebar({ view, setView }) {
  const NavItem = ({ id, label, icon }) => (
    <button onClick={() => setView(id)} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "9px 12px", borderRadius: 8,
      background: view === id ? "rgba(255,255,255,0.14)" : "transparent",
      border: "none",
      borderLeft: view === id ? "3px solid #f97316" : "3px solid transparent",
      cursor: "pointer", fontFamily: "var(--body)", fontSize: 13,
      fontWeight: view === id ? 600 : 400,
      color: view === id ? "#ffffff" : "rgba(255,255,255,0.45)",
      transition: "all 0.15s", textAlign: "left", letterSpacing: "-0.1px",
      borderRadius: view === id ? "0 8px 8px 0" : "0 8px 8px 0",
    }}
    onMouseEnter={e => { if (view !== id) { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}}
    onMouseLeave={e => { if (view !== id) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}}>
      <span style={{ fontSize: 15, opacity: view === id ? 1 : 0.5 }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div style={{ width: 220, background: "#1a3a6e", display: "flex", flexDirection: "column", paddingBottom: 24, flexShrink: 0 }}>
      <div style={{ padding: "24px 16px 22px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <img src="/logo.png" alt="Queud" style={{ width: 24, height: 24, objectFit: "contain" }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.4px", fontFamily: "var(--body)" }}>Queud</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", fontWeight: 700, textTransform: "uppercase" }}>Beta</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, paddingLeft: 6, paddingRight: 10 }}>
        <NavItem id="dashboard" label="Dashboard" icon="▦" />
        <NavItem id="inventory" label="Inventory" icon="🎟" />
        <NavItem id="sales" label="Sales" icon="💷" />
        <NavItem id="settings" label="Settings" icon="⚙️" />
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14, display: "flex", alignItems: "center", gap: 6, paddingLeft: 16 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.3px" }}>Supabase connected</span>
      </div>
    </div>
  );
}