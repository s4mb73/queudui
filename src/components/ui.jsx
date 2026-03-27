import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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

// ── SVG Icon set ─────────────────────────────────────────────────────────────
export const Icons = {
  dashboard: (color = "currentColor") => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill={color}/>
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill={color}/>
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill={color}/>
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill={color}/>
    </svg>
  ),
  inventory: (color = "currentColor") => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <rect x="1.5" y="3.5" width="13" height="10" rx="1.5" stroke={color} strokeWidth="1.4"/>
      <path d="M5 3.5V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5v1" stroke={color} strokeWidth="1.4"/>
      <path d="M4 8.5h8M4 11.5h5" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  ),
  sales: (color = "currentColor") => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path d="M2 12.5l3.5-4 2.5 2.5L12 4.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10 4.5h2v2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  settings: (color = "currentColor") => (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke={color} strokeWidth="1.4"/>
      <path d="M8 1.5v1.2M8 13.3v1.2M14.5 8h-1.2M2.7 8H1.5M12.6 3.4l-.85.85M4.25 11.75l-.85.85M12.6 12.6l-.85-.85M4.25 4.25l-.85-.85" stroke={color} strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  // KPI card icons (13px)
  kpi_invested: (color = "currentColor") => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.5"/>
      <path d="M8 5.5v2.8l1.8 1.8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  kpi_revenue: (color = "currentColor") => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M2 12l3.5-3.5 2.5 2.5L12 5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  kpi_profit: (color = "currentColor") => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M8 2v12M5 5.5C5 4.1 6.3 3 8 3s3 1.1 3 2.5-1.3 2.3-3 2.5c-1.7.2-3 1.1-3 2.5S6.3 13 8 13s3-1.1 3-2.5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  kpi_roi: (color = "currentColor") => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M2 13l4-8 3 4 3-6 2 3" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  kpi_stock: (color = "currentColor") => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4.5" width="12" height="8.5" rx="1.5" stroke={color} strokeWidth="1.4"/>
      <path d="M5.5 4.5V3.5A1.5 1.5 0 017 2h2a1.5 1.5 0 011.5 1.5v1" stroke={color} strokeWidth="1.4"/>
      <path d="M5 9h6M5 11.5h4" stroke={color} strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  ),
  kpi_sold: (color = "currentColor") => (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path d="M3 8.5l3.5 3.5L13 4.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// KPI card with icon in top-right
export function KpiCard({ label, value, color, sub, iconKey }) {
  const iconFn = Icons[iconKey];
  return (
    <div style={{ background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, padding: "14px 16px", position: "relative", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "12px 12px 0 0" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8" }}>{label}</div>
        {iconFn && (
          <div style={{ width: 24, height: 24, borderRadius: 6, background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {iconFn(color)}
          </div>
        )}
      </div>
      <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 20, color, lineHeight: 1, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

// ── SVG icons for new nav items ──────────────────────────────────────────────
Icons.emails = (color = "currentColor") => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke={color} strokeWidth="1.3"/>
    <path d="M1.5 5l6.5 4 6.5-4" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
Icons.tasks = (color = "currentColor") => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="12" height="12" rx="2" stroke={color} strokeWidth="1.3"/>
    <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
Icons.team = (color = "currentColor") => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
    <circle cx="6" cy="5.5" r="2.5" stroke={color} strokeWidth="1.3"/>
    <path d="M1.5 13.5c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" stroke={color} strokeWidth="1.3" strokeLinecap="round"/>
    <circle cx="11.5" cy="5" r="1.8" stroke={color} strokeWidth="1.1"/>
    <path d="M11.5 9c1.8 0 3.2 1.1 3.2 2.8" stroke={color} strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
);

// ── Sidebar ──────────────────────────────────────────────────────────────────
export function Sidebar({ profile, isAdmin, onSignOut }) {
  const navigate = useNavigate();
  const location = useLocation();
  const navItems = [
    { id: "dashboard", path: "/",          label: "Dashboard", iconFn: Icons.dashboard },
    { id: "inventory", path: "/inventory",  label: "Inventory", iconFn: Icons.inventory },
    { id: "sales",     path: "/sales",      label: "Sales",     iconFn: Icons.sales },
    { id: "emails",    path: "/emails",     label: "Emails",    iconFn: Icons.emails },
    { id: "tasks",     path: "/tasks",      label: "Tasks",     iconFn: Icons.tasks },
    ...(isAdmin ? [{ id: "team", path: "/team", label: "Team", iconFn: Icons.team }] : []),
    ...(isAdmin ? [{ id: "settings", path: "/settings", label: "Settings", iconFn: Icons.settings }] : []),
  ];

  const NavItem = ({ id, path, label, iconFn }) => {
    const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
    const iconColor = active ? "#ffffff" : "rgba(255,255,255,0.45)";
    return (
      <button onClick={() => navigate(path)} style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "9px 12px",
        background: active ? "rgba(255,255,255,0.14)" : "transparent",
        border: "none",
        borderLeft: active ? "3px solid #f97316" : "3px solid transparent",
        borderRadius: "0 8px 8px 0",
        cursor: "pointer", fontFamily: "var(--body)", fontSize: 13,
        fontWeight: active ? 600 : 400,
        color: active ? "#ffffff" : "rgba(255,255,255,0.45)",
        transition: "all 0.15s", textAlign: "left", letterSpacing: "-0.1px",
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "rgba(255,255,255,0.75)"; }}}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}}>
        <span style={{ display: "flex", alignItems: "center", flexShrink: 0, color: iconColor }}>
          {iconFn(iconColor)}
        </span>
        {label}
      </button>
    );
  };

  return (
    <div style={{ width: 220, background: "#0f1729", display: "flex", flexDirection: "column", paddingBottom: 24, flexShrink: 0 }}>
      {/* Logo — no container box, just logo + wordmark */}
      <div style={{ padding: "22px 18px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <img src="/logo.png" alt="Queud" style={{ width: 28, height: 28, objectFit: "contain", flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.5px", fontFamily: "var(--body)", lineHeight: 1 }}>Queud</div>
          <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "1.5px", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>Beta</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, paddingLeft: 6, paddingRight: 10 }}>
        {navItems.map(item => <NavItem key={item.id} {...item} />)}
      </div>

      {/* User info + sign out */}
      {profile && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, paddingLeft: 14, paddingRight: 14, paddingBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
              background: isAdmin ? "rgba(249,115,22,0.9)" : "rgba(255,255,255,0.15)",
              color: "white", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 700,
            }}>
              {(profile.display_name || profile.email || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.85)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {profile.display_name || profile.email}
              </div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: 700 }}>
                {profile.role || "va"}
              </div>
            </div>
          </div>
          {onSignOut && (
            <button onClick={onSignOut} style={{
              width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 500, padding: "6px 0",
              borderRadius: 6, cursor: "pointer", fontFamily: "var(--body)", transition: "all 0.15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}>
              Sign Out
            </button>
          )}
        </div>
      )}

      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 10, display: "flex", alignItems: "center", gap: 6, paddingLeft: 16, paddingBottom: 4 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: "0.3px" }}>Supabase connected</span>
      </div>
    </div>
  );
}