import { fmt } from "../../utils/format";
import { cleanRestriction, cleanEmail, qtyBox, soldBox, statusPill } from "./helpers";
import TicketRow from "./TicketRow";

export default function OrderGroup({
  eKey,
  oKey,
  orderGroup,
  isCompleted,
  expandedOrders,
  setExpandedOrders,
  multiSelected,
  setMultiSelected,
  openStatusMenu,
  statusMenuRef,
  setOpenStatusMenu,
  updateStatus,
  toggleSelect,
  setSelectedTicket,
  openEdit,
  delTicket,
  openSale,
}) {
  const isOrderExpanded = expandedOrders[eKey + "||" + oKey];
  const orderTickets    = orderGroup.tickets;
  const oQty   = orderTickets.length;
  const oAvail = orderTickets.filter(t => (t.qtyAvailable ?? t.qty) > 0 && !["Sold","Delivered","Completed"].includes(t.status)).length;
  const oSold  = orderTickets.filter(t => ["Sold","Delivered","Completed"].includes(t.status)).length;
  const oCost  = orderTickets.reduce((a, t) => a + (t.cost || 0), 0);
  const someOrd = orderTickets.some(t => multiSelected[t.id]);
  const allOrd  = orderTickets.every(t => multiSelected[t.id]);

  const seatNums = orderTickets.map(t => parseInt(t.seats)).filter(n => !isNaN(n)).sort((a, b) => a - b);
  const seatRange = seatNums.length > 1
    ? `Seats ${seatNums[0]}–${seatNums[seatNums.length-1]}`
    : seatNums.length === 1 ? `Seat ${seatNums[0]}` : "";

  const restriction  = orderTickets.find(t => t.restrictions)?.restrictions;
  const isStandingOrder = orderTickets.some(t => t.isStanding || /standing|pitch|floor|general admission/i.test(t.section || ""));
  const isRestricted = !isStandingOrder && restriction && /restrict|side.?view|limited.?view|partial.?view|obstructed|severely/i.test(restriction);
  const hasRestriction = !isStandingOrder && !!restriction;
  const maskedEmail = cleanEmail(orderGroup.accountEmail);

  return (
    <div style={{ borderTop: "0.5px solid #f0f0f3" }}>
      <div onClick={() => setExpandedOrders(s => ({ ...s, [eKey+"||"+oKey]: !s[eKey+"||"+oKey] }))}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 18px 9px 52px", cursor: "pointer", background: someOrd ? "#fffbf7" : isCompleted ? "#f4f4f6" : "#f9f9fb", borderLeft: isRestricted ? "3px solid #fca5a5" : "3px solid transparent", transition: "background 0.1s" }}
        onMouseEnter={e => { if (!someOrd) e.currentTarget.style.background = isCompleted ? "#efefef" : "#f4f4f6"; }}
        onMouseLeave={e => { e.currentTarget.style.background = someOrd ? "#fffbf7" : isCompleted ? "#f4f4f6" : "#f9f9fb"; }}>

        <div onClick={e => { e.stopPropagation(); const u = {}; orderTickets.forEach(t => { u[t.id] = !allOrd; }); setMultiSelected(s => ({ ...s, ...u })); }}
          style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${allOrd ? "#1a3a6e" : someOrd ? "#1a3a6e" : "#d1d5db"}`, background: allOrd ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {allOrd  && <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>✓</span>}
          {!allOrd && someOrd && <span style={{ color: "#1a3a6e", fontSize: 8 }}>—</span>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
          {orderGroup.sections.map(sec => {
            const isStandingSec = /standing|pitch|floor|general admission|ga\b/i.test(sec);
            return (
              <span key={sec} style={{ background: isStandingSec ? "#f0fdfa" : "#eef2ff", color: isStandingSec ? "#0f766e" : "#1a3a6e", border: `1px solid ${isStandingSec ? "#99f6e4" : "#c7d2fe"}`, borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                {isStandingSec ? sec : `Sec ${sec}`}
              </span>
            );
          })}
          {orderGroup.rows.map(row => (
            <span key={row} style={{ background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>Row {row}</span>
          ))}
          {seatRange && (
            <span style={{ background: "#fff7ed", color: "#f97316", border: "1px solid #fed7aa", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{seatRange}</span>
          )}
          {orderGroup.orderRef && (
            <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>#{orderGroup.orderRef}</span>
          )}
          {isRestricted && (
            <span style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600 }}>⚠ {cleanRestriction(restriction)}</span>
          )}
          {hasRestriction && !isRestricted && (
            <span style={{ background: "#f8fafc", color: "#64748b", border: "0.5px solid #e2e6ea", borderRadius: 5, padding: "2px 7px", fontSize: 11 }}>{cleanRestriction(restriction)}</span>
          )}
        </div>

        <div style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{maskedEmail}</div>
        <div style={{ width: 60, flexShrink: 0 }}>{qtyBox(oQty, oAvail)}</div>
        <div style={{ width: 32, flexShrink: 0 }}>{soldBox(oSold)}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: isCompleted ? "#9ca3af" : "#111827", width: 80, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(oCost)}</div>
        <div style={{ width: 80, flexShrink: 0 }}>{statusPill(orderTickets)}</div>
        <div style={{ width: 16, flexShrink: 0, fontSize: 12, color: "#9ca3af", transform: isOrderExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
      </div>

      {/* Seat rows */}
      {isOrderExpanded && (
        <div style={{ background: isCompleted ? "#f0f0f2" : "#f7f8fa", borderTop: "0.5px solid #f0f0f3" }}>
          {orderTickets.map((t, ti) => (
            <div key={t.id} style={{ borderTop: ti > 0 ? "0.5px solid #f0f0f3" : "none" }}>
              <TicketRow
                ticket={t}
                isSelected={!!multiSelected[t.id]}
                isCompleted={isCompleted}
                openStatusMenu={openStatusMenu}
                statusMenuRef={statusMenuRef}
                onToggleSelect={toggleSelect}
                onSetSelectedTicket={setSelectedTicket}
                onSetOpenStatusMenu={setOpenStatusMenu}
                onUpdateStatus={updateStatus}
                onOpenEdit={openEdit}
                onDelTicket={delTicket}
                onOpenSale={openSale}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
