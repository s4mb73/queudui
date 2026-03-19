// ─────────────────────────────────────────────────────────────────────────────
// src/components/shared.jsx
//
// UI primitives shared between Inventory and Sales pages.
// Import from here — never duplicate these in individual pages.
// ─────────────────────────────────────────────────────────────────────────────

import {
  PLATFORM_COLORS,
  SALE_STATUS_STYLES,
  TICKET_STATUS_STYLES,
  CATEGORY_CONFIG,
  FONT,
  isStandingSection,
  resolveSeatInfo,
} from "../lib/schema";

// ── Platform badge ─────────────────────────────────────────────────────────────
// Usage: <PlatformBadge platform="Tixstock" />
export function PlatformBadge({ platform }) {
  const color = PLATFORM_COLORS[platform] || PLATFORM_COLORS.Default;
  return (
    <span style={{
      background: `${color}14`, color,
      border: `1px solid ${color}28`,
      borderRadius: 20, padding: "2px 8px",
      fontSize: 10, fontWeight: 700,
      letterSpacing: "0.3px", whiteSpace: "nowrap",
      fontFamily: FONT,
    }}>
      {platform}
    </span>
  );
}

// ── Category icon box ──────────────────────────────────────────────────────────
// Usage: <CategoryIcon category="Sport" />
export function CategoryIcon({ category, size = 34 }) {
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.Concert;
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: cfg.bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.44, flexShrink: 0,
    }}>
      {cfg.icon}
    </div>
  );
}

// ── Status dot ─────────────────────────────────────────────────────────────────
// Usage: <StatusDot status="Pending" type="sale" />
export function StatusDot({ status, type = "sale", size = 5 }) {
  const styles = type === "sale" ? SALE_STATUS_STYLES : TICKET_STATUS_STYLES;
  const s = styles[status] || styles[Object.keys(styles)[0]];
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
  );
}

// ── Sale status pill (<select>) ────────────────────────────────────────────────
// Usage: <SaleStatusPill status="Pending" onChange={v => ...} />
export function SaleStatusPill({ status, onChange }) {
  const s = SALE_STATUS_STYLES[status] || SALE_STATUS_STYLES.Pending;
  return (
    <select
      value={status || "Pending"}
      onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
      onClick={e => e.stopPropagation()}
      style={{
        background: s.bg, color: s.text,
        border: `1px solid ${s.border}`,
        borderRadius: 20, padding: "3px 8px",
        fontSize: 11, fontWeight: 700,
        fontFamily: FONT, cursor: "pointer", outline: "none",
      }}
    >
      {Object.keys(SALE_STATUS_STYLES).map(st => (
        <option key={st} value={st}>{st}</option>
      ))}
    </select>
  );
}

// ── Ticket status pill (display only) ─────────────────────────────────────────
// Usage: <TicketStatusPill status="Sold" />
export function TicketStatusPill({ status }) {
  const s = TICKET_STATUS_STYLES[status] || TICKET_STATUS_STYLES.Unsold;
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: s.bg, color: s.text,
      borderRadius: 20, padding: "4px 10px",
      fontSize: 11, fontWeight: 600,
    }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.dot }} />
      {status}
    </div>
  );
}

// ── Seat chips ─────────────────────────────────────────────────────────────────
// Renders section / row / seat as coloured pill chips.
// Used in both Inventory order rows and Sales expanded rows.
//
// Usage (Sales):   <SeatChips sale={s} matchedTickets={[ticket]} />
// Usage (Inventory): <SeatChips section={t.section} row={t.row} seats={t.seats} />
export function SeatChips({ sale, matchedTickets, section: sectionProp, row: rowProp, seats: seatsProp, qtySold }) {
  // Resolve from sale + tickets, OR from direct props
  let section, row, seats;
  if (sale) {
    const resolved = resolveSeatInfo(sale, matchedTickets || []);
    section = resolved.section;
    row     = resolved.row;
    seats   = resolved.seats;
    qtySold = qtySold ?? sale.qtySold;
  } else {
    section = sectionProp || "";
    row     = rowProp     || "";
    seats   = seatsProp   || "";
  }

  const standing = isStandingSection(section);

  // Nothing to show
  if (!section && !row && !seats) {
    if (sale && !matchedTickets?.length) {
      return <span style={{ color: "#9ca3af", fontSize: 11, fontFamily: FONT }}>Ticket removed</span>;
    }
    return null;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      {section && (
        <span style={{
          background: standing ? "#f0fdfa" : "#eef2ff",
          color:      standing ? "#0f766e" : "#1a3a6e",
          border:     `1px solid ${standing ? "#99f6e4" : "#c7d2fe"}`,
          borderRadius: 5, padding: "2px 7px",
          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", fontFamily: FONT,
        }}>
          {standing ? section : `Sec ${section}`}
        </span>
      )}
      {row && (
        <span style={{
          background: "#f0fdf4", color: "#059669",
          border: "1px solid #bbf7d0",
          borderRadius: 5, padding: "2px 7px",
          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", fontFamily: FONT,
        }}>
          Row {row}
        </span>
      )}
      {seats && (
        <span style={{
          background: "#fff7ed", color: "#f97316",
          border: "1px solid #fed7aa",
          borderRadius: 5, padding: "2px 7px",
          fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", fontFamily: FONT,
        }}>
          {seats.includes(",") ? `Seats ${seats}` : `Seat ${seats}`}
        </span>
      )}
      {qtySold > 1 && !seats && (
        <span style={{
          background: "rgba(249,115,22,0.1)", color: "#f97316",
          border: "1px solid rgba(249,115,22,0.2)",
          borderRadius: 5, padding: "2px 7px",
          fontSize: 11, fontWeight: 600, fontFamily: FONT,
        }}>
          {qtySold}×
        </span>
      )}
    </div>
  );
}

// ── Qty box (orange) — used in Inventory ──────────────────────────────────────
// Usage: <QtyBox total={4} available={2} />
export function QtyBox({ total, available }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <div style={{
        background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)",
        borderRadius: 6, padding: "3px 10px",
        fontSize: 12, fontWeight: 700, color: "#f97316",
        textAlign: "center", minWidth: 28, fontVariantNumeric: "tabular-nums",
      }}>
        {available ?? total}
      </div>
      {available !== undefined && available !== total && (
        <div style={{ fontSize: 10, color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>/{total}</div>
      )}
    </div>
  );
}

// ── Sold box (green) — used in Inventory ──────────────────────────────────────
// Usage: <SoldBox sold={2} />
export function SoldBox({ sold }) {
  return sold > 0 ? (
    <div style={{
      background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)",
      borderRadius: 6, padding: "3px 10px",
      fontSize: 12, fontWeight: 700, color: "#059669",
      textAlign: "center", minWidth: 28, fontVariantNumeric: "tabular-nums",
    }}>{sold}</div>
  ) : (
    <div style={{
      background: "#f7f8fa", border: "0.5px solid #e2e6ea",
      borderRadius: 6, padding: "3px 10px",
      fontSize: 12, color: "#d1d5db",
      textAlign: "center", minWidth: 28,
    }}>0</div>
  );
}

// ── Filter pill button ─────────────────────────────────────────────────────────
// Usage: <FilterPill label="Pending" active={true} dot="#f59e0b" ... />
export function FilterPill({ label, active, dotColor, activeBg, activeColor, activeBorder, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 10px", borderRadius: 20,
        border: `1px solid ${active ? (activeBorder || "#1a3a6e") : "#e8e8ec"}`,
        background: active ? (activeBg || "rgba(26,58,110,0.1)") : "transparent",
        color: active ? (activeColor || "#1a3a6e") : "#6b7280",
        fontSize: 11, fontWeight: 600,
        cursor: "pointer", fontFamily: FONT,
        display: "flex", alignItems: "center", gap: 4,
      }}
    >
      {dotColor && active && (
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor }} />
      )}
      {label}
    </button>
  );
}

// ── Page header ────────────────────────────────────────────────────────────────
// Usage: <PageHeader title="Sales" sub="3 events · 12 tickets sold" action={<button>...</button>} />
export function PageHeader({ title, sub, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
      <div>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: "#111827", letterSpacing: "-0.03em" }}>
          {title}
        </div>
        {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>{sub}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

// ── Table card wrapper ─────────────────────────────────────────────────────────
export function TableCard({ children }) {
  return (
    <div style={{
      background: "#ffffff", border: "0.5px solid #e2e6ea",
      borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      overflow: "hidden",
    }}>
      {children}
    </div>
  );
}

// ── Table column header row ────────────────────────────────────────────────────
// Usage: <TableHeaders columns={["Event", "Platform", ...]} gridTemplate="2fr 1fr ..." />
export function TableHeaders({ columns, gridTemplate }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: gridTemplate,
      padding: "9px 18px",
      borderBottom: "1px solid #f0f0f3",
      background: "#fafafa",
    }}>
      {columns.map((h, i) => (
        <div key={i} style={{
          fontSize: 10, fontWeight: 700,
          letterSpacing: "0.08em", textTransform: "uppercase",
          color: "#9ca3af", fontFamily: FONT,
        }}>
          {h}
        </div>
      ))}
    </div>
  );
}

// ── Search input ───────────────────────────────────────────────────────────────
// Usage: <SearchInput value={q} onChange={setQ} placeholder="Search..." />
export function SearchInput({ value, onChange, placeholder = "Search…" }) {
  return (
    <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 280 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          background: "#f9f9fb", border: "0.5px solid #e8e8ec",
          padding: "7px 12px 7px 30px", borderRadius: 7,
          fontFamily: FONT, fontSize: 12,
          width: "100%", outline: "none", color: "#111827",
        }}
      />
      <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af" }}>
        🔍
      </span>
    </div>
  );
}

// ── Filter bar wrapper ─────────────────────────────────────────────────────────
export function FilterBar({ children }) {
  return (
    <div style={{
      background: "#ffffff", border: "0.5px solid #e8e8ec",
      borderRadius: 10, padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 10, flexWrap: "wrap",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      {children}
    </div>
  );
}

// ── Divider (vertical, for filter bars) ───────────────────────────────────────
export function FilterDivider() {
  return <div style={{ width: 1, height: 16, background: "#e8e8ec", flexShrink: 0 }} />;
}

// ── Checkbox ───────────────────────────────────────────────────────────────────
// Usage: <Checkbox checked={true} indeterminate={false} onChange={fn} size={15} />
export function Checkbox({ checked, indeterminate, onChange, size = 15, color = "#1a3a6e" }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onChange?.(!checked); }}
      style={{
        width: size, height: size, borderRadius: Math.floor(size * 0.27),
        border: `1.5px solid ${checked || indeterminate ? color : "#d1d5db"}`,
        background: checked ? color : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0,
      }}
    >
      {checked     && <span style={{ color: "white",  fontSize: size * 0.6,  fontWeight: 700, lineHeight: 1 }}>✓</span>}
      {indeterminate && !checked && <span style={{ color, fontSize: size * 0.6, lineHeight: 1 }}>—</span>}
    </div>
  );
}

// ── Indent line (vertical bar shown on expanded child rows) ───────────────────
export function IndentLine({ color = "#e2e6ea" }) {
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <div style={{ width: 2, height: 22, background: color, borderRadius: 2 }} />
    </div>
  );
}

// ── Chevron ────────────────────────────────────────────────────────────────────
export function Chevron({ expanded, color = "#9ca3af" }) {
  return (
    <div style={{
      fontSize: 12, color, textAlign: "center",
      transform: expanded ? "rotate(90deg)" : "none",
      transition: "transform 0.15s",
    }}>›</div>
  );
}
