import { useState, useMemo, useEffect, useRef } from "react";
import { fmt, fmtCurrency } from "../utils/format";
import { TicketDetailModal } from "../components/Modals";
import {
  FONT, ACTIVE_STATUSES, COMPLETED_STATUSES,
  card,
} from "./inventory/helpers";
import InventoryHeader from "./inventory/InventoryHeader";
import BulkActions from "./inventory/BulkActions";
import EventGroup from "./inventory/EventGroup";

const ColumnHeaders = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 18px", borderBottom: "1px solid #f0f0f3", background: "#fafafa" }}>
    <div style={{ width: 15, flexShrink: 0 }} />
    <div style={{ width: 34, flexShrink: 0 }} />
    <div style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af" }}>Event</div>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", width: 90, flexShrink: 0 }}>Date</div>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", width: 60, flexShrink: 0 }}>Orders</div>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", width: 60, flexShrink: 0 }}>Avail</div>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", width: 32, flexShrink: 0 }}>Sold</div>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", width: 80, flexShrink: 0, textAlign: "right" }}>Cost</div>
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", width: 80, flexShrink: 0 }}>Status</div>
    <div style={{ width: 16, flexShrink: 0 }} />
  </div>
);

export default function Inventory({ tickets, setTickets, sales, setSales, events, settings, setShowAddTicket, setEditingTicket, setTf, blankTicket, openSale, notify }) {
  const [filterStatus, setFilterStatus]     = useState("All");
  const [searchQ, setSearchQ]               = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [multiSelected, setMultiSelected]   = useState({});
  const [expandedEvents, setExpandedEvents] = useState({});
  const [expandedOrders, setExpandedOrders] = useState({});
  const [openStatusMenu, setOpenStatusMenu] = useState(null);
  const [showCompleted, setShowCompleted]   = useState(false);
  const statusMenuRef = useRef(null);

  // Close status menu on outside click
  useEffect(() => {
    if (!openStatusMenu) return;
    function handle(e) {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setOpenStatusMenu(null);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [openStatusMenu]);

  const eventMap = useMemo(() => {
    const m = {};
    (events || []).forEach(e => { m[e.id] = e; });
    return m;
  }, [events]);

  function getCategory(ticket) {
    return eventMap[ticket.eventId]?.category || "Concert";
  }

  const activeTickets = useMemo(() =>
    tickets.filter(t => ACTIVE_STATUSES.includes(t.status || "Unsold")),
  [tickets]);

  const completedTickets = useMemo(() =>
    tickets.filter(t => COMPLETED_STATUSES.includes(t.status || "Unsold")),
  [tickets]);

  const filteredActive = useMemo(() => activeTickets.filter(t => {
    if (filterStatus !== "All" && (t.status || "Unsold") !== filterStatus) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return t.event.toLowerCase().includes(q)
        || (t.venue||"").toLowerCase().includes(q)
        || (t.orderRef||"").toLowerCase().includes(q)
        || (t.accountEmail||"").toLowerCase().includes(q)
        || (t.section||"").toLowerCase().includes(q)
        || (t.seats||"").toLowerCase().includes(q);
    }
    return true;
  }), [activeTickets, filterStatus, searchQ]);

  const filteredCompleted = useMemo(() => completedTickets.filter(t => {
    if (searchQ) {
      const q = searchQ.toLowerCase();
      return t.event.toLowerCase().includes(q)
        || (t.venue||"").toLowerCase().includes(q)
        || (t.orderRef||"").toLowerCase().includes(q)
        || (t.section||"").toLowerCase().includes(q)
        || (t.seats||"").toLowerCase().includes(q);
    }
    return true;
  }), [completedTickets, searchQ]);

  function buildEventGroups(ticketList) {
    const groups = {};
    ticketList.forEach(t => {
      const key = t.event + "||" + (t.date || "");
      if (!groups[key]) groups[key] = {
        event: t.event,
        date: t.date,
        time: t.time,
        venue: t.venue,
        category: getCategory(t),
        tickets: [],
      };
      groups[key].tickets.push(t);
    });
    return groups;
  }

  const activeEventGroups   = useMemo(() => buildEventGroups(filteredActive),   [filteredActive, eventMap]);
  const completedEventGroups = useMemo(() => buildEventGroups(filteredCompleted), [filteredCompleted, eventMap]);

  const activeStockCount    = activeTickets.reduce((a, t) => a + (t.qtyAvailable ?? t.qty), 0);
  const completedStockCount = completedTickets.length;
  const numSelected = Object.values(multiSelected).filter(Boolean).length;

  const toggleSelect   = (id, e) => { e.stopPropagation(); setMultiSelected(s => ({ ...s, [id]: !s[id] })); };
  const toggleAllEvent = (tix) => { const all = tix.every(t => multiSelected[t.id]); const u = {}; tix.forEach(t => { u[t.id] = !all; }); setMultiSelected(s => ({ ...s, ...u })); };
  const clearSelection = () => setMultiSelected({});

  const updateStatus = (id, status, e) => {
    e.stopPropagation();
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    setOpenStatusMenu(null);
    notify("Status → " + status);
  };

  const delTicket = (id) => {
    setTickets(p => p.filter(t => t.id !== id));
    notify("Deleted");
  };

  const deleteSelected = () => {
    if (!window.confirm(`Delete ${numSelected} ticket${numSelected > 1 ? "s" : ""}?`)) return;
    const ids = new Set(Object.keys(multiSelected).filter(id => multiSelected[id]));
    setTickets(p => p.filter(t => !ids.has(t.id)));
    setMultiSelected({});
    notify(`Deleted ${ids.size} tickets`);
  };

  const bulkUpdateStatus = (status) => {
    const ids = new Set(Object.keys(multiSelected).filter(id => multiSelected[id]));
    setTickets(p => p.map(t => ids.has(t.id) ? { ...t, status } : t));
    setMultiSelected({});
    notify(`${ids.size} ticket${ids.size !== 1 ? "s" : ""} → ${status}`);
  };

  const exportSelected = () => {
    const ids = new Set(Object.keys(multiSelected).filter(id => multiSelected[id]));
    const sel = tickets.filter(t => ids.has(t.id));
    const rows = [
      ["Event","Date","Venue","Section","Row","Seat","Order Ref","Account Email","Buying Platform","Cost (GBP)","Cost Per Ticket","Status","Restrictions","Listed On"],
      ...sel.map(t => [
        t.event, t.date, t.venue, t.section, t.row, t.seats,
        t.orderRef, t.accountEmail, t.buyingPlatform,
        t.cost, t.costPerTicket,
        t.status, t.restrictions, t.listedOn,
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${(c??'').toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `queud-inventory-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    notify(`Exported ${sel.length} tickets`);
  };

  const openEdit = (t) => {
    setEditingTicket(t);
    setTf({ ...t, cost: t.cost.toString(), costPerTicket: t.costPerTicket.toString(), qty: t.qty });
    setShowAddTicket(true);
  };

  // Shared props passed down to EventGroup -> OrderGroup -> TicketRow
  const sharedProps = {
    expandedEvents, setExpandedEvents,
    expandedOrders, setExpandedOrders,
    multiSelected, setMultiSelected,
    openStatusMenu, statusMenuRef, setOpenStatusMenu,
    updateStatus, toggleSelect, toggleAllEvent,
    setSelectedTicket, openEdit, delTicket, openSale,
  };

  const renderEventGroups = (eventGroups, isCompleted = false) => {
    const keys = Object.keys(eventGroups);
    if (keys.length === 0) return null;
    return keys.map((eKey, gi) => (
      <EventGroup
        key={eKey}
        eKey={eKey}
        eventGroup={eventGroups[eKey]}
        isCompleted={isCompleted}
        isLast={gi >= keys.length - 1}
        {...sharedProps}
      />
    ));
  };

  return (
    <div className="fade-up">
      <InventoryHeader
        activeStockCount={activeStockCount}
        completedStockCount={completedStockCount}
        searchQ={searchQ}
        setSearchQ={setSearchQ}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        setEditingTicket={setEditingTicket}
        setTf={setTf}
        blankTicket={blankTicket}
        setShowAddTicket={setShowAddTicket}
      />

      <BulkActions
        numSelected={numSelected}
        bulkUpdateStatus={bulkUpdateStatus}
        exportSelected={exportSelected}
        clearSelection={clearSelection}
        deleteSelected={deleteSelected}
      />

      {/* ACTIVE STOCK TABLE */}
      <div style={{ ...card, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ padding: "11px 18px", background: "#ffffff", borderBottom: "1px solid #f0f0f3", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "#111827", letterSpacing: "-0.1px" }}>Active Stock</span>
          <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 2 }}>
            {Object.keys(activeEventGroups).length} event{Object.keys(activeEventGroups).length !== 1 ? "s" : ""} · {activeStockCount} tickets
          </span>
        </div>

        <ColumnHeaders />

        {tickets.length === 0 ? (
          <div style={{ padding: "56px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎟️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>No tickets yet</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "#9ca3af" }}>Import from emails in Settings or add manually</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => { setEditingTicket(null); setTf(blankTicket); setShowAddTicket(true); }}>+ Add Ticket</button>
          </div>
        ) : Object.keys(activeEventGroups).length === 0 ? (
          <div style={{ padding: "48px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>No active tickets{searchQ ? ` matching "${searchQ}"` : ""}</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "#9ca3af" }}>All tickets may be in Completed Stock below</div>
            <button className="ghost-btn" style={{ marginTop: 12 }} onClick={() => { setSearchQ(""); setFilterStatus("All"); }}>Clear filters</button>
          </div>
        ) : renderEventGroups(activeEventGroups, false)}
      </div>

      {/* COMPLETED STOCK SECTION */}
      {(completedTickets.length > 0 || (searchQ && filteredCompleted.length > 0)) && (
        <div style={{ ...card, overflow: "hidden" }}>
          <div
            onClick={() => setShowCompleted(v => !v)}
            style={{ padding: "12px 18px", background: "#fafafa", borderBottom: showCompleted ? "1px solid #f0f0f3" : "none", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f4f4f6"}
            onMouseLeave={e => e.currentTarget.style.background = "#fafafa"}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: "-0.1px" }}>Completed Stock</span>
            <span style={{ fontSize: 11, color: "#b0b8c4", marginLeft: 2 }}>
              {Object.keys(completedEventGroups).length} event{Object.keys(completedEventGroups).length !== 1 ? "s" : ""} · {filteredCompleted.length} tickets
            </span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{showCompleted ? "Hide" : "Show"}</span>
              <div style={{ fontSize: 12, color: "#9ca3af", transform: showCompleted ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
            </div>
          </div>

          {showCompleted && (
            <>
              <ColumnHeaders />
              {Object.keys(completedEventGroups).length === 0 ? (
                <div style={{ padding: "32px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>No completed tickets{searchQ ? ` matching "${searchQ}"` : ""}</div>
                </div>
              ) : renderEventGroups(completedEventGroups, true)}
            </>
          )}
        </div>
      )}

      {selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          event={eventMap[selectedTicket.eventId]}
          onClose={() => setSelectedTicket(null)}
          onEdit={() => { setSelectedTicket(null); openEdit(selectedTicket); }}
          onSell={() => { setSelectedTicket(null); openSale(selectedTicket.id); }}
          fmt={fmt} fmtCurrency={fmtCurrency}
        />
      )}
    </div>
  );
}
