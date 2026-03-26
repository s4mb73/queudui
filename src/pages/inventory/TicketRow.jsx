import { useRef } from "react";
import { fmt } from "../../utils/format";
import { FONT, STATUS_STYLES, cleanRestriction } from "./helpers";
import StatusMenu from "./StatusMenu";

export default function TicketRow({
  ticket: t,
  isSelected,
  isCompleted,
  openStatusMenu,
  statusMenuRef,
  onToggleSelect,
  onSetSelectedTicket,
  onSetOpenStatusMenu,
  onUpdateStatus,
  onOpenEdit,
  onDelTicket,
  onOpenSale,
}) {
  const statusTriggerRef = useRef(null);
  const tRestricted = t.restrictions && /restrict|side.?view|limited.?view|partial.?view|obstructed|severely/i.test(t.restrictions);
  const s      = t.status || "Unsold";
  const sStyle = STATUS_STYLES[s];
  const isStandingTicket = t.isStanding || /standing|pitch|floor|general admission/i.test(t.section || "");
  const seatLabel = isStandingTicket ? (t.section || "Standing") : t.seats ? `Seat ${t.seats}` : "No seat";

  return (
    <div
      style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px 8px 80px", background: isSelected ? "rgba(26,58,110,0.04)" : tRestricted ? "#fff8f8" : "transparent", cursor: "pointer" }}
      onClick={() => onSetSelectedTicket(t)}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(26,58,110,0.04)" : tRestricted ? "#fff8f8" : "transparent"; }}>

      <div onClick={e => onToggleSelect(t.id, e)}
        style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${isSelected ? "#1a3a6e" : "#d1d5db"}`, background: isSelected ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {isSelected && <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>✓</span>}
      </div>

      <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 600, color: isCompleted ? "#9ca3af" : "#111827", whiteSpace: "nowrap", minWidth: 68, textAlign: "center" }}>
        {seatLabel}
      </div>

      {tRestricted && (
        <span style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600 }}>⚠ {cleanRestriction(t.restrictions)}</span>
      )}
      {t.restrictions && !tRestricted && (
        <span style={{ background: "#f8fafc", color: "#64748b", border: "0.5px solid #e2e6ea", borderRadius: 5, padding: "2px 7px", fontSize: 11 }}>{cleanRestriction(t.restrictions)}</span>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ fontSize: 12, fontWeight: 500, color: isCompleted ? "#b0b8c4" : "#6b7280", width: 70, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(t.cost)}</div>

      {t.listedOn && (
        <div style={{ fontSize: 10, color: "#1a3a6e", background: "rgba(26,58,110,0.07)", border: "0.5px solid rgba(26,58,110,0.15)", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>
          {t.listedOn}
        </div>
      )}

      {/* Status dropdown */}
      <div style={{ position: "relative", width: 90, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        <div ref={statusTriggerRef} onClick={() => onSetOpenStatusMenu(openStatusMenu === t.id ? null : t.id)}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, background: sStyle.bg, color: sStyle.text, borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: sStyle.dot }} />{s} ▾
        </div>
        {openStatusMenu === t.id && (
          <StatusMenu
            ref={statusMenuRef}
            ticket={t}
            onUpdateStatus={onUpdateStatus}
            triggerRef={statusTriggerRef}
          />
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
        {!isCompleted && (t.qtyAvailable ?? t.qty) > 0 && !["Sold","Delivered","Completed"].includes(t.status) && (
          <button onClick={() => onOpenSale(t.id)} style={{ background: "rgba(249,115,22,0.08)", color: "#f97316", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Sell</button>
        )}
        <button onClick={() => onOpenEdit(t)} style={{ background: "white", color: "#6b7280", border: "0.5px solid #e8e8ec", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontFamily: FONT }}>Edit</button>
        <button onClick={() => onDelTicket(t.id)} style={{ background: "transparent", color: "#d1d5db", border: "none", borderRadius: 6, padding: "3px 6px", fontSize: 12, cursor: "pointer", fontFamily: FONT, lineHeight: 1 }}
          onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#d1d5db"; }}>✕</button>
      </div>
    </div>
  );
}
