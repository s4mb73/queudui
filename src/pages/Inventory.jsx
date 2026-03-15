import { useState } from "react";
import { fmt, fmtCurrency } from "../utils/format";
import { TicketDetailModal } from "../components/Modals";

const STATUSES = ["Unsold", "Listed", "Sold", "Delivered", "Completed"];
const STATUS_STYLES = {
  Unsold:    { bg: "#f1f5f9", text: "#64748b",  dot: "#94a3b8" },
  Listed:    { bg: "#eff6ff", text: "#1d4ed8",  dot: "#3b82f6" },
  Sold:      { bg: "#f0fdf4", text: "#15803d",  dot: "#22c55e" },
  Delivered: { bg: "#fff7ed", text: "#c2410c",  dot: "#f97316" },
  Completed: { bg: "#f8fafc", text: "#0f172a",  dot: "#0f172a" },
};

export default function Inventory({ tickets, setTickets, sales, setSales, settings, setShowAddTicket, setEditingTicket, setTf, blankTicket, openSale, notify }) {
  const [filterCat, setFilterCat] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [searchQ, setSearchQ] = useState("");
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [multiSelected, setMultiSelected] = useState({});
  const [expandedEvents, setExpandedEvents] = useState({});
  const [expandedOrders, setExpandedOrders] = useState({});
  const [openStatusMenu, setOpenStatusMenu] = useState(null);

  const filteredTickets = tickets.filter(t => {
    if (filterCat !== "All" && t.category !== filterCat) return false;
    if (filterStatus !== "All" && (t.status || "Unsold") !== filterStatus) return false;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      if (!t.event.toLowerCase().includes(q) &&
        !(t.venue || "").toLowerCase().includes(q) &&
        !(t.orderRef || "").toLowerCase().includes(q) &&
        !(t.accountEmail || "").toLowerCase().includes(q) &&
        !(t.section || "").toLowerCase().includes(q) &&
        !(t.seats || "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalStock = tickets.reduce((a, t) => a + (t.qtyAvailable ?? t.qty), 0);
  const numSelected = Object.values(multiSelected).filter(Boolean).length;

  // Level 1: Group by event + date
  const eventGroups = {};
  filteredTickets.forEach(t => {
    const eKey = t.event + "||" + (t.date || "");
    if (!eventGroups[eKey]) eventGroups[eKey] = { event: t.event, date: t.date, time: t.time, venue: t.venue, category: t.category, tickets: [] };
    eventGroups[eKey].tickets.push(t);
  });

  // Level 2: Within each event, group by orderRef
  const getOrderGroups = (eventTickets) => {
    const orders = {};
    eventTickets.forEach(t => {
      const oKey = t.orderRef || t.id;
      if (!orders[oKey]) orders[oKey] = { orderRef: t.orderRef || "", accountEmail: t.accountEmail || "", section: t.section || "", row: t.row || "", tickets: [] };
      orders[oKey].tickets.push(t);
    });
    // Sort tickets within each order by seat number low to high
    Object.values(orders).forEach(o => {
      o.tickets.sort((a, b) => {
        const sa = parseInt(a.seats) || 0;
        const sb = parseInt(b.seats) || 0;
        return sa - sb;
      });
    });
    return orders;
  };

  const toggleSelect = (id, e) => { e.stopPropagation(); setMultiSelected(s => ({ ...s, [id]: !s[id] })); };
  const toggleAllInEvent = (tickets) => {
    const all = tickets.every(t => multiSelected[t.id]);
    const update = {};
    tickets.forEach(t => { update[t.id] = !all; });
    setMultiSelected(s => ({ ...s, ...update }));
  };
  const clearSelection = () => setMultiSelected({});

  const updateStatus = (id, status, e) => {
    e.stopPropagation();
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    setOpenStatusMenu(null);
    notify("Status → " + status);
  };

  const delTicket = (id) => { setTickets(p => p.filter(t => t.id !== id)); setSales(p => p.filter(s => s.ticketId !== id)); notify("Deleted"); };

  const deleteSelected = () => {
    if (!window.confirm(`Delete ${numSelected} ticket${numSelected > 1 ? "s" : ""}?`)) return;
    const ids = Object.keys(multiSelected).filter(id => multiSelected[id]);
    setTickets(p => p.filter(t => !ids.includes(t.id)));
    setSales(p => p.filter(s => !ids.includes(s.ticketId)));
    setMultiSelected({});
    notify(`Deleted ${ids.length} tickets`);
  };

  const exportSelected = () => {
    const ids = Object.keys(multiSelected).filter(id => multiSelected[id]);
    const sel = tickets.filter(t => ids.includes(t.id));
    const rows = [["Event","Date","Venue","Section","Row","Seat","Order Ref","Account","Cost (USD)","Original Amount","Currency","Status","Restrictions"],
      ...sel.map(t => [t.event,t.date,t.venue,t.section,t.row,t.seats,t.orderRef,t.accountEmail,t.costPrice,t.originalAmount,t.originalCurrency,t.status,t.restrictions])];
    const csv = rows.map(r => r.map(c => `"${(c??'').toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = `queud-export-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    notify(`Exported ${sel.length} tickets`);
  };

  const openEdit = (t) => { setEditingTicket(t); setTf({ ...t, costPrice: t.costPrice.toString(), qty: t.qty }); setShowAddTicket(true); };

  const venueClean = (v) => (v || "").replace(/\s*[—–-]\s*.+$/, "").replace(/,.*$/, "").trim();

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const fmtDate = (d) => {
    if (!d) return "—";
    // ISO: 2026-07-03
    const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${parseInt(iso[3])} ${months[parseInt(iso[2])-1]} ${iso[1]}`;
    // "Fri 03 Jul 2026 5:00 pm" or "Fri 3 Jul 2026" or "3 Jul 2026" — extract just the date part
    const wordy = d.match(/(?:\w{3,}\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
    if (wordy) return `${parseInt(wordy[1])} ${wordy[2]} ${wordy[3]}`;
    return d;
  };

  const fmtTime = (t) => {
    if (!t) return "";
    // Convert "5:00 pm" / "5:00 am" to 24hr
    const pm = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (pm) {
      let h = parseInt(pm[1]);
      const min = pm[2];
      const period = pm[3].toLowerCase();
      if (period === "pm" && h !== 12) h += 12;
      if (period === "am" && h === 12) h = 0;
      return `${String(h).padStart(2, "0")}:${min}`;
    }
    // Already 24hr like "17:00"
    if (/^\d{1,2}:\d{2}$/.test(t.trim())) return t.trim();
    return t;
  };

  // Extract time embedded in date string if no separate time field
  const getTime = (date, time) => {
    if (time) return fmtTime(time);
    // Check if time is embedded in date e.g. "Fri 12 Jun 2026 5:00 pm"
    const embedded = (date || "").match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*$/i);
    if (embedded) return fmtTime(embedded[1]);
    return "";
  };

  const statusPill = (tickets) => {
    const statuses = [...new Set(tickets.map(t => t.status || "Unsold"))];
    const s = statuses.length === 1 ? statuses[0] : "Multiple";
    const style = STATUS_STYLES[s] || STATUS_STYLES.Unsold;
    return <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: style.bg, color: style.text, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: style.dot }} />{s}
    </div>;
  };

  const qtyBox = (n, color="#f97316", bg="#fff7ed", border="#fed7aa") => (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color, textAlign: "center", minWidth: 32 }}>{n}</div>
  );

  const soldBox = (sold) => sold > 0
    ? <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#15803d", textAlign: "center", minWidth: 32 }}>{sold}</div>
    : <div style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#94a3b8", textAlign: "center", minWidth: 32 }}>0</div>;

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 26, color: "#111827", lineHeight: 1 }}>Inventory</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{Object.keys(eventGroups).length} events · {totalStock} tickets available</div>
        </div>
        <button className="action-btn" onClick={() => { setEditingTicket(null); setTf(blankTicket); setShowAddTicket(true); }}>+ Add Ticket</button>
      </div>

      {/* Filters */}
      <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 7, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 280 }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search events, order refs, seats…"
            style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", padding: "8px 12px 8px 32px", borderRadius: 7, fontFamily: "Inter, sans-serif", fontSize: 12, width: "100%", outline: "none", color: "#111827" }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, opacity: 0.35 }}>🔍</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["All","Sport","Concert"].map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              style={{ padding: "6px 14px", borderRadius: 7, border: `1.5px solid ${filterCat === c ? "var(--orange)" : "#e2e8f0"}`, background: filterCat === c ? "#fff7ed" : "white", color: filterCat === c ? "var(--orange)" : "var(--muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["All",...STATUSES].map(s => {
            const style = s !== "All" ? STATUS_STYLES[s] : null;
            const active = filterStatus === s;
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding: "6px 12px", borderRadius: 7, border: `1.5px solid ${active ? (style?.dot || "var(--orange)") : "#e2e8f0"}`, background: active ? (style?.bg || "#fff7ed") : "white", color: active ? (style?.text || "var(--orange)") : "var(--muted)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 5 }}>
                {style && <div style={{ width: 6, height: 6, borderRadius: "50%", background: style.dot }} />}{s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Multi-select bar */}
      {numSelected > 0 && (
        <div style={{ background: "var(--navy)", borderRadius: 7, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{numSelected} selected</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={exportSelected} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>⬇ Export CSV</button>
            <button onClick={clearSelection} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Deselect All</button>
            <button onClick={deleteSelected} style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 7, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>🗑 Delete {numSelected}</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "#fafafa" }}>
          <div style={{ width: 15 }} />
          <div style={{ width: 36 }} />
          <div style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8" }}>Event</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", minWidth: 120 }}>Date</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", minWidth: 60 }}>Orders</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", minWidth: 32 }}>Qty</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", minWidth: 32 }}>Sold</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", minWidth: 80, textAlign: "right" }}>Cost</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8", minWidth: 80 }}>Status</div>
          <div style={{ width: 16 }} />
        </div>
        {filteredTickets.length === 0 ? (
          <div style={{ padding: "56px 20px", textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎟️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>No tickets yet</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Import from emails in Settings or add manually</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => { setEditingTicket(null); setTf(blankTicket); setShowAddTicket(true); }}>+ Add Ticket</button>
          </div>
        ) : Object.entries(eventGroups).map(([eKey, eventGroup], gi) => {
          const isEventExpanded = expandedEvents[eKey];
          const eventTickets = eventGroup.tickets;
          const totalQty = eventTickets.length;
          const totalSold = eventTickets.filter(t => t.status === "Sold" || t.status === "Delivered" || t.status === "Completed").length;
          const totalAvail = eventTickets.filter(t => (t.qtyAvailable ?? t.qty) > 0).length;
          const totalCost = eventTickets.reduce((a, t) => a + t.costPrice, 0);
          const orderGroups = getOrderGroups(eventTickets);
          const sections = [...new Set(eventTickets.map(t => t.section).filter(Boolean))];
          const seatSummary = sections.slice(0, 3).map(s => `Sec ${s}`).join(" · ") + (sections.length > 3 ? ` +${sections.length - 3} more` : "");
          const someSelected = eventTickets.some(t => multiSelected[t.id]);
          const allEvSelected = eventTickets.every(t => multiSelected[t.id]);

          return (
            <div key={eKey} style={{ borderBottom: gi < Object.keys(eventGroups).length - 1 ? "1px solid #f1f5f9" : "none" }}>

              {/* EVENT ROW */}
              <div onClick={() => setExpandedEvents(s => ({ ...s, [eKey]: !s[eKey] }))}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", cursor: "pointer", background: someSelected ? "#fff7ed" : "white" }}
                onMouseEnter={e => { if (!someSelected) e.currentTarget.style.background = "#fafafa"; }}
                onMouseLeave={e => { if (!someSelected) e.currentTarget.style.background = someSelected ? "#fff7ed" : "white"; }}>

                <div onClick={e => { e.stopPropagation(); toggleAllInEvent(eventTickets); }}
                  style={{ width: 15, height: 15, borderRadius: 4, border: `2px solid ${allEvSelected ? "var(--orange)" : someSelected ? "var(--orange)" : "#cbd5e1"}`, background: allEvSelected ? "var(--orange)" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {allEvSelected && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
                  {!allEvSelected && someSelected && <span style={{ color: "var(--orange)", fontSize: 9, fontWeight: 700 }}>—</span>}
                </div>

                <div style={{ width: 36, height: 36, borderRadius: 9, background: eventGroup.category === "Sport" ? "#eff6ff" : "#fdf4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                  {eventGroup.category === "Sport" ? "⚽" : "🎵"}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{eventGroup.event}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                    {venueClean(eventGroup.venue)}{seatSummary ? " · " + seatSummary : ""}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "#6b7280", minWidth: 90 }}>{fmtDate(eventGroup.date)}{getTime(eventGroup.date, eventGroup.time) ? " · " + getTime(eventGroup.date, eventGroup.time) : ""}</div>
                <div style={{ fontSize: 11, color: "#6b7280", minWidth: 60 }}>{Object.keys(orderGroups).length} orders</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {qtyBox(totalQty)}
                  {soldBox(totalSold)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", minWidth: 80, textAlign: "right" }}>{fmt(totalCost)}</div>
                <div>{statusPill(eventTickets)}</div>
                <div style={{ fontSize: 14, color: "#6b7280", width: 16 }}>{isEventExpanded ? "⌄" : "›"}</div>
              </div>

              {/* ORDER ROWS */}
              {isEventExpanded && Object.entries(orderGroups).map(([oKey, orderGroup]) => {
                const isOrderExpanded = expandedOrders[eKey + "||" + oKey];
                const orderTickets = orderGroup.tickets;
                const oQty = orderTickets.length;
                const oSold = orderTickets.filter(t => t.status === "Sold" || t.status === "Delivered" || t.status === "Completed").length;
                const oCost = orderTickets.reduce((a, t) => a + t.costPrice, 0);
                const someOrdSelected = orderTickets.some(t => multiSelected[t.id]);
                const allOrdSelected = orderTickets.every(t => multiSelected[t.id]);
                const seatNums = orderTickets.map(t => parseInt(t.seats)).filter(n => !isNaN(n)).sort((a, b) => a - b);
                const seatRange = seatNums.length > 1 ? `Seats ${seatNums[0]}–${seatNums[seatNums.length - 1]}` : seatNums.length === 1 ? `Seat ${seatNums[0]}` : "";
                const seatLabel = [orderGroup.section && `Sec ${orderGroup.section}`, orderGroup.row && `Row ${orderGroup.row}`, seatRange].filter(Boolean).join(" · ");

                return (
                  <div key={oKey} style={{ borderTop: "1px solid #f1f5f9" }}>
                    {/* Order header */}
                    {(() => {
                      const hasRestriction = orderTickets.some(t => t.restrictions && /restrict/i.test(t.restrictions));
                      return (
                    <div onClick={() => setExpandedOrders(s => ({ ...s, [eKey + "||" + oKey]: !s[eKey + "||" + oKey] }))}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 20px 9px 44px", cursor: "pointer", background: someOrdSelected ? "#fff7ed" : hasRestriction ? "#fff5f5" : "#f8fafc", borderLeft: hasRestriction ? "3px solid #fca5a5" : "3px solid transparent" }}
                      onMouseEnter={e => { if (!someOrdSelected) e.currentTarget.style.background = hasRestriction ? "#fff0f0" : "#f1f5f9"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = someOrdSelected ? "#fff7ed" : hasRestriction ? "#fff5f5" : "#f8fafc"; }}>

                      <div onClick={e => { e.stopPropagation(); const u = {}; orderTickets.forEach(t => { u[t.id] = !allOrdSelected; }); setMultiSelected(s => ({ ...s, ...u })); }}
                        style={{ width: 14, height: 14, borderRadius: 4, border: `2px solid ${allOrdSelected ? "var(--orange)" : someOrdSelected ? "var(--orange)" : "#cbd5e1"}`, background: allOrdSelected ? "var(--orange)" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {allOrdSelected && <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>✓</span>}
                        {!allOrdSelected && someOrdSelected && <span style={{ color: "var(--orange)", fontSize: 8, fontWeight: 700 }}>—</span>}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
                          {seatLabel || "Order"}
                          {orderGroup.orderRef && <span style={{ fontSize: 10, color: "#6b7280", fontWeight: 400 }}>#{orderGroup.orderRef}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                          {orderGroup.accountEmail}
                          {(() => {
                            const restriction = orderTickets.find(t => t.restrictions)?.restrictions;
                            if (!restriction) return null;
                            const isRestricted = /restrict/i.test(restriction);
                            return <span style={{ marginLeft: 6, color: isRestricted ? "#dc2626" : "var(--muted)", fontWeight: isRestricted ? 600 : 400 }}>
                              {isRestricted ? "⚠ " : ""}{restriction}
                            </span>;
                          })()}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {qtyBox(oQty)}
                        {soldBox(oSold)}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", minWidth: 80, textAlign: "right" }}>{fmt(oCost)}</div>
                      <div>{statusPill(orderTickets)}</div>
                      <div style={{ fontSize: 13, color: "#6b7280", width: 16 }}>{isOrderExpanded ? "⌄" : "›"}</div>
                    </div>
                      );
                    })()}

                    {/* INDIVIDUAL SEAT ROWS */}
                    {isOrderExpanded && orderTickets.map((t) => {
                      const isSelected = !!multiSelected[t.id];
                      const isRestricted = t.restrictions && /restrict/i.test(t.restrictions);
                      const s = t.status || "Unsold";
                      const sStyle = STATUS_STYLES[s];

                      return (
                        <div key={t.id}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 20px 8px 68px", borderTop: "1px solid #f1f5f9", background: isSelected ? "#fff7ed" : isRestricted ? "#fff5f5" : "#fafafa", cursor: "pointer", borderLeft: isRestricted ? "3px solid #fca5a5" : "3px solid transparent" }}
                          onClick={() => setSelectedTicket(t)}>

                          <div onClick={e => toggleSelect(t.id, e)}
                            style={{ width: 13, height: 13, borderRadius: 3, border: `2px solid ${isSelected ? "var(--orange)" : "#cbd5e1"}`, background: isSelected ? "var(--orange)" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {isSelected && <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>✓</span>}
                          </div>

                          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div style={{ background: "#e2e8f0", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>
                              {t.seats ? `Seat ${t.seats}` : (t.restrictions ? t.restrictions.replace(/Album Pre-Order Pre-Sale\s*-?\s*/i, "").replace(/Ticket$/i, "").trim() : "No seat")}
                            </div>
                            {isRestricted && <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>⚠ {t.restrictions}</span>}
                            {t.restrictions && !isRestricted && <span style={{ fontSize: 10, color: "#6b7280" }}>{t.restrictions}</span>}
                          </div>

                          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", minWidth: 70, textAlign: "right" }}>{fmt(t.costPrice)}</div>

                          {/* Status dropdown */}
                          <div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
                            <div onClick={() => setOpenStatusMenu(openStatusMenu === t.id ? null : t.id)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 5, background: sStyle.bg, color: sStyle.text, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                              <div style={{ width: 6, height: 6, borderRadius: "50%", background: sStyle.dot }} />{s} ▾
                            </div>
                            {openStatusMenu === t.id && (
                              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "white", border: "0.5px solid #e8e8ec", borderRadius: 7, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 100, minWidth: 140, overflow: "hidden" }}>
                                {STATUSES.map(st => (
                                  <div key={st} onClick={e => updateStatus(t.id, st, e)}
                                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", cursor: "pointer", background: t.status === st ? "#f8fafc" : "white", fontWeight: t.status === st ? 700 : 400, fontSize: 12, color: STATUS_STYLES[st].text }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                                    onMouseLeave={e => e.currentTarget.style.background = t.status === st ? "#f8fafc" : "white"}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_STYLES[st].dot }} />{st}
                                    {t.status === st && <span style={{ marginLeft: "auto", fontSize: 10 }}>✓</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                            {(t.qtyAvailable ?? t.qty) > 0 && (
                              <button onClick={() => openSale(t.id)} style={{ background: "#fff7ed", color: "var(--orange)", border: "1px solid #fed7aa", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Sell</button>
                            )}
                            <button onClick={() => openEdit(t)} style={{ background: "white", color: "#64748b", border: "0.5px solid #e5e7eb", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Edit</button>
                            <button onClick={() => delTicket(t.id)} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, padding: "3px 7px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>✕</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {selectedTicket && (
        <TicketDetailModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)}
          onEdit={() => { setSelectedTicket(null); openEdit(selectedTicket); }}
          onSell={() => { setSelectedTicket(null); openSale(selectedTicket.id); }}
          fmt={fmt} fmtCurrency={fmtCurrency} />
      )}
    </div>
  );
}