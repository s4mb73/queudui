import { useState } from "react";

export function Badge({ children, type = "neutral" }) {
  const styles = {
    profit: { background: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" },
    loss: { background: "#fee2e2", color: "#dc2626", border: "1px solid #fecaca" },
    sport: { background: "#dbeafe", color: "#1d4ed8", border: "1px solid #bfdbfe" },
    concert: { background: "#ede9fe", color: "#7c3aed", border: "1px solid #ddd6fe" },
    available: { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" },
    neutral: { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" },
    warning: { background: "#fefce8", color: "#a16207", border: "1px solid #fef08a" },
  };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", fontSize: 10, letterSpacing: 0.5, fontWeight: 700, padding: "3px 9px", borderRadius: 20, ...styles[type] }}>
      {children}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "white", borderRadius: 16, width: wide ? 640 : 500, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 25px 60px rgba(15,23,42,0.25)" }}>
        <div style={{ padding: "22px 28px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--display)", fontWeight: 900, fontSize: 18, color: "var(--navy)" }}>{title}</div>
          <button onClick={onClose} style={{ background: "#f1f5f9", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer", width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
        </div>
        <div style={{ padding: 28 }}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.3, color: "var(--navy)", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

export function Input({ value, onChange, ...props }) {
  const [focus, setFocus] = useState(false);
  return (
    <input value={value} onChange={e => onChange(e.target.value)}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
      style={{ background: "#f8fafc", border: `2px solid ${focus ? "var(--orange)" : "#e2e8f0"}`, color: "var(--navy)", fontFamily: "var(--body)", fontSize: 13, padding: "10px 14px", width: "100%", borderRadius: 8, outline: "none", transition: "border-color 0.15s", ...props.style }}
      {...props} />
  );
}

export function Select({ value, onChange, children }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ background: "#f8fafc", border: "2px solid #e2e8f0", color: "var(--navy)", fontFamily: "var(--body)", fontSize: 13, padding: "10px 14px", width: "100%", borderRadius: 8, outline: "none", cursor: "pointer" }}>
      {children}
    </select>
  );
}

export function StatCard({ label, value, sub, accent, icon }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "20px 22px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: accent ? `${accent}10` : "transparent", borderRadius: "0 12px 0 80px" }} />
      <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: "var(--muted)", marginBottom: 10, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: "var(--display)", fontWeight: 900, fontSize: 26, color: accent || "var(--navy)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>{sub}</div>}
      {icon && <div style={{ position: "absolute", top: 18, right: 20, fontSize: 20, opacity: 0.2 }}>{icon}</div>}
    </div>
  );
}

export function Sidebar({ view, setView }) {
  const NavItem = ({ id, label, icon }) => (
    <button onClick={() => setView(id)} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 9,
      background: view === id ? "#f97316" : "transparent",
      border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: view === id ? 700 : 500,
      color: view === id ? "white" : "rgba(255,255,255,0.4)", transition: "all 0.15s", textAlign: "left"
    }}
    onMouseEnter={e => { if (view !== id) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = view === id ? "white" : "rgba(255,255,255,0.75)"; }}
    onMouseLeave={e => { if (view !== id) e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = view === id ? "white" : "rgba(255,255,255,0.4)"; }}>
      <span style={{ fontSize: 16 }}>{icon}</span> {label}
    </button>
  );

  return (
    <div style={{ width: 220, background: "#0d1117", display: "flex", flexDirection: "column", padding: "0 12px 24px", flexShrink: 0, borderRight: "1px solid #1a2332" }}>
      <div style={{ padding: "22px 4px 28px", display: "flex", alignItems: "center", justifyContent: "center", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: 16 }}>
        <img src="/logo.png" alt="Queud" style={{ width: 120, height: 120, objectFit: "contain" }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
        <NavItem id="dashboard" label="Dashboard" icon="▦" />
        <NavItem id="inventory" label="Inventory" icon="🎟" />
        <NavItem id="sales" label="Sales" icon="💷" />
        <NavItem id="settings" label="Settings" icon="⚙️" />
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16, fontSize: 10, color: "rgba(255,255,255,0.15)", textAlign: "center", letterSpacing: 1.5 }}>
        QUEUD · BETA
      </div>
    </div>
  );
}