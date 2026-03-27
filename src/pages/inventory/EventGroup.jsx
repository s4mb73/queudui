import { useState, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { fmt } from "../../utils/format";
import {
  fmtDate, getTime, venueClean, sectionSummary,
  eventAccent, getOrderGroups, qtyBox, soldBox, statusPill,
} from "./helpers";
import OrderGroup from "./OrderGroup";

export default function EventGroup({
  eKey,
  eventGroup,
  isCompleted,
  isLast,
  expandedEvents,
  setExpandedEvents,
  expandedOrders,
  setExpandedOrders,
  multiSelected,
  setMultiSelected,
  openStatusMenu,
  statusMenuRef,
  setOpenStatusMenu,
  updateStatus,
  toggleSelect,
  toggleAllEvent,
  setSelectedTicket,
  openEdit,
  delTicket,
  openSale,
  setTickets,
  notify,
}) {
  const isExpanded   = expandedEvents[eKey];
  const eventTickets = eventGroup.tickets;
  const totalQty     = eventTickets.length;
  const totalAvail   = eventTickets.filter(t => (t.qtyAvailable ?? t.qty) > 0 && !["Sold","Delivered","Completed"].includes(t.status)).length;
  const totalSold    = eventTickets.filter(t => ["Sold","Delivered","Completed"].includes(t.status)).length;
  const totalCost    = eventTickets.reduce((a, t) => a + (t.cost || 0), 0);
  const orderGroups  = getOrderGroups(eventTickets);
  const sections     = [...new Set(eventTickets.map(t => t.section).filter(Boolean))];
  const someSelected = eventTickets.some(t => multiSelected[t.id]);
  const allSelected  = eventTickets.every(t => multiSelected[t.id]);
  const accent       = eventAccent(eventGroup.category);
  const timeStr      = getTime(eventGroup.date, eventGroup.time);

  const [editingDate, setEditingDate] = useState(false);
  const dateInputRef = useRef(null);

  const saveDate = async (newDate) => {
    setEditingDate(false);
    if (!newDate || newDate === eventGroup.date) return;

    const ticketIds = eventTickets.map(t => t.id);
    const eventId = eventTickets[0]?.eventId;

    // Update local ticket state (auto-syncs to Supabase via setTickets)
    setTickets(prev => prev.map(t =>
      ticketIds.includes(t.id) ? { ...t, date: newDate } : t
    ));

    // Also update the events table directly
    if (eventId) {
      const { error } = await supabase
        .from('events')
        .update({ date: newDate })
        .eq('id', eventId);
      if (error) console.error('Event date update error:', error);
    }

    if (notify) notify("Date updated");
  };

  const rowOpacity = isCompleted ? 0.65 : 1;

  return (
    <div style={{ borderBottom: !isLast ? "0.5px solid #f0f0f3" : "none", opacity: rowOpacity, transition: "opacity 0.15s" }}
      onMouseEnter={isCompleted ? e => e.currentTarget.style.opacity = "1" : undefined}
      onMouseLeave={isCompleted ? e => e.currentTarget.style.opacity = "0.65" : undefined}>

      {/* Event row */}
      <div onClick={() => setExpandedEvents(s => ({ ...s, [eKey]: !s[eKey] }))}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", cursor: "pointer", background: someSelected ? "#fffbf7" : isCompleted ? "#f9f9fb" : "white", borderLeft: `3px solid ${isCompleted ? "#e2e6ea" : accent}`, transition: "background 0.1s" }}
        onMouseEnter={e => { if (!someSelected) e.currentTarget.style.background = isCompleted ? "#f4f4f6" : "#fafafa"; }}
        onMouseLeave={e => { e.currentTarget.style.background = someSelected ? "#fffbf7" : isCompleted ? "#f9f9fb" : "white"; }}>

        <div onClick={e => { e.stopPropagation(); toggleAllEvent(eventTickets); }}
          style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${allSelected ? "#1a3a6e" : someSelected ? "#1a3a6e" : "#d1d5db"}`, background: allSelected ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {allSelected  && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
          {!allSelected && someSelected && <span style={{ color: "#1a3a6e", fontSize: 9 }}>—</span>}
        </div>

        <div style={{ width: 34, height: 34, borderRadius: 8, background: eventGroup.category === "Sport" ? "rgba(26,58,110,0.08)" : "rgba(124,58,237,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
          {eventGroup.category === "Sport" ? "⚽" : "🎵"}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: isCompleted ? "#6b7280" : "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{eventGroup.event}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
            {venueClean(eventGroup.venue)}{sections.length > 0 ? " · " + sectionSummary(sections) : ""}
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#6b7280", width: 90, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
          {editingDate ? (
            <input
              ref={dateInputRef}
              type="date"
              defaultValue={eventGroup.date || ""}
              autoFocus
              onClick={e => e.stopPropagation()}
              onBlur={e => saveDate(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.target.blur(); } if (e.key === "Escape") { setEditingDate(false); } }}
              style={{ fontSize: 11, padding: "2px 4px", border: "1px solid #d1d5db", borderRadius: 4, width: 86, outline: "none", fontFamily: "inherit", color: "#111827", background: "white" }}
            />
          ) : (
            <>
              <span>{fmtDate(eventGroup.date)}{timeStr ? " · " + timeStr : ""}</span>
              <span
                onClick={e => { e.stopPropagation(); setEditingDate(true); }}
                title="Edit date"
                style={{ fontSize: 10, color: "#9ca3af", cursor: "pointer", opacity: 0, transition: "opacity 0.15s", lineHeight: 1 }}
                className="date-edit-btn"
              >✎</span>
            </>
          )}
        </div>

        <div style={{ fontSize: 12, color: "#6b7280", width: 60, flexShrink: 0 }}>{Object.keys(orderGroups).length} orders</div>
        <div style={{ width: 60, flexShrink: 0 }}>{qtyBox(totalQty, totalAvail)}</div>
        <div style={{ width: 32, flexShrink: 0 }}>{soldBox(totalSold)}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: isCompleted ? "#9ca3af" : "#111827", width: 80, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totalCost)}</div>
        <div style={{ width: 80, flexShrink: 0 }}>{statusPill(eventTickets)}</div>
        <div style={{ width: 16, flexShrink: 0, fontSize: 12, color: "#9ca3af", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
      </div>

      {/* Order rows */}
      {isExpanded && Object.entries(orderGroups)
        .sort(([, a], [, b]) => {
          const secA = parseInt(a.sections[a.sections.length - 1]) || 0;
          const secB = parseInt(b.sections[b.sections.length - 1]) || 0;
          if (secB !== secA) return secB - secA;
          const rowA = parseInt(a.rows[a.rows.length - 1]) || 0;
          const rowB = parseInt(b.rows[b.rows.length - 1]) || 0;
          if (rowB !== rowA) return rowB - rowA;
          const seatA = parseInt(a.tickets[a.tickets.length - 1]?.seats) || 0;
          const seatB = parseInt(b.tickets[b.tickets.length - 1]?.seats) || 0;
          return seatB - seatA;
        })
        .map(([oKey, orderGroup]) => (
          <OrderGroup
            key={oKey}
            eKey={eKey}
            oKey={oKey}
            orderGroup={orderGroup}
            isCompleted={isCompleted}
            expandedOrders={expandedOrders}
            setExpandedOrders={setExpandedOrders}
            multiSelected={multiSelected}
            setMultiSelected={setMultiSelected}
            openStatusMenu={openStatusMenu}
            statusMenuRef={statusMenuRef}
            setOpenStatusMenu={setOpenStatusMenu}
            updateStatus={updateStatus}
            toggleSelect={toggleSelect}
            setSelectedTicket={setSelectedTicket}
            openEdit={openEdit}
            delTicket={delTicket}
            openSale={openSale}
          />
        ))}
    </div>
  );
}
