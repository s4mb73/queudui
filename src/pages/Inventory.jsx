import { useState } from "react";
import { fmt, fmtCurrency } from "../utils/format";
import { TicketDetailModal } from "../components/Modals";

const STATUSES = ["Unsold", "Listed", "Sold", "Delivered", "Completed"];
const STATUS_STYLES = {
  Unsold:    { bg: "#f1f5f9",                       text: "#64748b",  dot: "#94a3b8" },
  Listed:    { bg: "rgba(26,58,110,0.08)",           text: "#1a3a6e",  dot: "#1a3a6e" },
  Sold:      { bg: "rgba(5,150,105,0.08)",           text: "#059669",  dot: "#059669" },
  Delivered: { bg: "rgba(249,115,22,0.08)",          text: "#f97316",  dot: "#f97316" },
  Completed: { bg: "rgba(15,23,42,0.06)",            text: "#374151",  dot: "#374151" },
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
      if (!t.event.toLowerCase().includes(q) && !(t.venue||"").toLowerCase().includes(q) && !(t.orderRef||"").toLowerCase().includes(q) && !(t.accountEmail||"").toLowerCase().includes(q) && !(t.section||"").toLowerCase().includes(q) && !(t.seats||"").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalStock = tickets.reduce((a, t) => a + (t.qtyAvailable ?? t.qty), 0);
  const numSelected = Object.values(multiSelected).filter(Boolean).length;

  const eventGroups = {};
  filteredTickets.forEach(t => {
    const eKey = t.event + "||" + (t.date || "");
    if (!eventGroups[eKey]) eventGroups[eKey] = { event: t.event, date: t.date, time: t.time, venue: t.venue, category: t.category, tickets: [] };
    eventGroups[eKey].tickets.push(t);
  });

  const getOrderGroups = (eventTickets) => {
    const orders = {};
    eventTickets.forEach(t => {
      const oKey = t.orderRef || t.id;
      if (!orders[oKey]) orders[oKey] = { orderRef: t.orderRef || "", accountEmail: t.accountEmail || "", section: t.section || "", row: t.row || "", tickets: [] };
      orders[oKey].tickets.push(t);
    });
    Object.values(orders).forEach(o => { o.tickets.sort((a, b) => (parseInt(a.seats)||0) - (parseInt(b.seats)||0)); });
    return orders;
  };

  const toggleSelect = (id, e) => { e.stopPropagation(); setMultiSelected(s => ({ ...s, [id]: !s[id] })); };
  const toggleAllInEvent = (tix) => { const all = tix.every(t => multiSelected[t.id]); const u = {}; tix.forEach(t => { u[t.id] = !all; }); setMultiSelected(s => ({ ...s, ...u })); };
  const clearSelection = () => setMultiSelected({});

  const updateStatus = (id, status, e) => { e.stopPropagation(); setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t)); setOpenStatusMenu(null); notify("Status → " + status); };
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
    const rows = [["Event","Date","Venue","Section","Row","Seat","Order Ref","Account","Cost (USD)","Original Amount","Currency","Status","Restrictions"], ...sel.map(t => [t.event,t.date,t.venue,t.section,t.row,t.seats,t.orderRef,t.accountEmail,t.costPrice,t.originalAmount,t.originalCurrency,t.status,t.restrictions])];
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
    const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return `${parseInt(iso[3])} ${months[parseInt(iso[2])-1]} ${iso[1]}`;
    const wordy = d.match(/(?:\w{3,}\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i);
    if (wordy) return `${parseInt(wordy[1])} ${wordy[2]} ${wordy[3]}`;
    return d;
  };

  const fmtTime = (t) => {
    if (!t) return "";
    const pm = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (pm) { let h = parseInt(pm[1]); const min = pm[2]; if (pm[3].toLowerCase() === "pm" && h !== 12) h += 12; if (pm[3].toLowerCase() === "am" && h === 12) h = 0; return `${String(h).padStart(2,"0")}:${min}`; }
    if (/^\d{1,2}:\d{2}$/.test(t.trim())) return t.trim();
    return t;
  };

  const getTime = (date, time) => { if (time) return fmtTime(time); const e = (date || "").match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*$/i); if (e) return fmtTime(e[1]); return ""; };

  const statusPill = (tix) => {
    const statuses = [...new Set(tix.map(t => t.status || "Unsold"))];
    const s = statuses.length === 1 ? statuses[0] : "Multiple";
    const st = STATUS_STYLES[s] || STATUS_STYLES.Unsold;
    return <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: st.bg, color: st.text, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot }} />{s}
    </div>;
  };

  const qtyBox = (n) => (
    <div style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#f97316", textAlign: "center", minWidth: 32, fontVariantNumeric: "tabular-nums" }}>{n}</div>
  );
  const soldBox = (sold) => sold > 0
    ? <div style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#059669", textAlign: "center", minWidth: 32, fontVariantNumeric: "tabular-nums" }}>{sold}</div>
    : <div style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#94a3b8", textAlign: "center", minWidth: 32 }}>0</div>;

  const card = { background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };

  // Accent colour per category
  const eventAccent = (cat) => cat === "Sport" ? "#1a3a6e" : "#7c3aed";

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.5px" }}>Inventory</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{Object.keys(eventGroups).length} events · {totalStock} tickets available</div>
        </div>
        <button className="action-btn" onClick={() => { setEditingTicket(null); setTf(blankTicket); setShowAddTicket(true); }}>+ Add Ticket</button>
      </div>

      {/* Filter bar — tighter pills */}
      <div style={{ background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 280 }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search events, order refs, seats…"
            style={{ background: "#f7f8fa", border: "1px solid #e2e6ea", padding: "6px 12px 6px 30px", borderRadius: 7, fontFamily: "var(--body)", fontSize: 12, width: "100%", outline: "none", color: "#0f172a" }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#94a3b8" }}>🔍</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["All","Sport","Concert"].map(c => (
            <button key={c} onClick={() => setFilterCat(c)}
              style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${filterCat === c ? "#1a3a6e" : "#e2e6ea"}`, background: filterCat === c ? "#1a3a6e" : "transparent", color: filterCat === c ? "#ffffff" : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--body)", transition: "all 0.15s" }}>
              {c}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["All",...STATUSES].map(s => {
            const style = s !== "All" ? STATUS_STYLES[s] : null;
            const active = filterStatus === s;
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? (style?.dot || "#1a3a6e") : "#e2e6ea"}`, background: active ? (style?.bg || "rgba(26,58,110,0.1)") : "transparent", color: active ? (style?.text || "#1a3a6e") : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--body)", display: "flex", alignItems: "center", gap: 4, transition: "all 0.15s" }}>
                {style && <div style={{ width: 5, height: 5, borderRadius: "50%", background: style.dot }} />}{s}
              </button>
            );
          })}
        </div>
      </div>

      {numSelected > 0 && (
        <div style={{ background: "#1a3a6e", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{numSelected} selected</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={exportSelected} style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--body)" }}>⬇ Export CSV</button>
            <button onClick={clearSelection} style={{ background: "rgba(255,255,255,0.12)", color: "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--body)" }}>Deselect All</button>
            <button onClick={deleteSelected} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--body)" }}>🗑 Delete {numSelected}</button>
          </div>
        </div>
      )}

      <div style={{ ...card, overflow: "hidden" }}>
        {/* Table header — no bg fill, just a bottom border */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 18px", borderBottom: "1px solid #e2e6ea" }}>
          <div style={{ width: 15, flexShrink: 0 }} />
          <div style={{ width: 34, flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8" }}>Event</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", width: 90, flexShrink: 0 }}>Date</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", width: 60, flexShrink: 0 }}>Orders</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", width: 32, flexShrink: 0 }}>Qty</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", width: 32, flexShrink: 0 }}>Sold</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", width: 80, flexShrink: 0, textAlign: "right" }}>Cost</div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", width: 80, flexShrink: 0 }}>Status</div>
          <div style={{ width: 16, flexShrink: 0 }} />
        </div>

        {filteredTickets.length === 0 ? (
          <div style={{ padding: "48px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🎟️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>No tickets yet</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "#64748b" }}>Import from emails in Settings or add manually</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => { setEditingTicket(null); setTf(blankTicket); setShowAddTicket(true); }}>+ Add Ticket</button>
          </div>
        ) : Object.entries(eventGroups).map(([eKey, eventGroup], gi) => {
          const isEventExpanded = expandedEvents[eKey];
          const eventTickets = eventGroup.tickets;
          const totalQty = eventTickets.length;
          const totalSold = eventTickets.filter(t => ["Sold","Delivered","Completed"].includes(t.status)).length;
          const totalCost = eventTickets.reduce((a, t) => a + t.costPrice, 0);
          const orderGroups = getOrderGroups(eventTickets);
          const sections = [...new Set(eventTickets.map(t => t.section).filter(Boolean))];
          const seatSummary = sections.slice(0, 3).map(s => `Sec ${s}`).join(" · ") + (sections.length > 3 ? ` +${sections.length - 3} more` : "");
          const someSelected = eventTickets.some(t => multiSelected[t.id]);
          const allEvSelected = eventTickets.every(t => multiSelected[t.id]);
          const accent = eventAccent(eventGroup.category);

          return (
            <div key={eKey} style={{ borderBottom: gi < Object.keys(eventGroups).length - 1 ? "0.5px solid #e2e6ea" : "none" }}>
              {/* Event row — left accent border by category */}
              <div onClick={() => setExpandedEvents(s => ({ ...s, [eKey]: !s[eKey] }))}
                className="hover-row"
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", cursor: "pointer", background: someSelected ? "rgba(249,115,22,0.04)" : "#ffffff", borderLeft: `3px solid ${accent}` }}>

                <div onClick={e => { e.stopPropagation(); toggleAllInEvent(eventTickets); }}
                  style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${allEvSelected ? "#1a3a6e" : someSelected ? "#1a3a6e" : "#d1d9e0"}`, background: allEvSelected ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {allEvSelected && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
                  {!allEvSelected && someSelected && <span style={{ color: "#1a3a6e", fontSize: 9, fontWeight: 700 }}>—</span>}
                </div>

                <div style={{ width: 34, height: 34, borderRadius: 8, background: eventGroup.category === "Sport" ? "rgba(26,58,110,0.08)" : "rgba(124,58,237,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                  {eventGroup.category === "Sport" ? "⚽" : "🎵"}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{eventGroup.event}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{venueClean(eventGroup.venue)}{seatSummary ? " · " + seatSummary : ""}</div>
                </div>

                <div style={{ fontSize: 12, color: "#64748b", width: 90, flexShrink: 0 }}>{fmtDate(eventGroup.date)}{getTime(eventGroup.date, eventGroup.time) ? " · " + getTime(eventGroup.date, eventGroup.time) : ""}</div>
                <div style={{ fontSize: 12, color: "#64748b", width: 60, flexShrink: 0 }}>{Object.keys(orderGroups).length} orders</div>
                <div style={{ display: "flex", gap: 5, alignItems: "center", width: 70, flexShrink: 0 }}>{qtyBox(totalQty)}{soldBox(totalSold)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", width: 80, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(totalCost)}</div>
                <div style={{ width: 80, flexShrink: 0 }}>{statusPill(eventTickets)}</div>
                <div style={{ fontSize: 13, color: "#94a3b8", width: 16, flexShrink: 0 }}>{isEventExpanded ? "⌄" : "›"}</div>
              </div>

              {isEventExpanded && Object.entries(orderGroups).map(([oKey, orderGroup]) => {
                const isOrderExpanded = expandedOrders[eKey + "||" + oKey];
                const orderTickets = orderGroup.tickets;
                const oQty = orderTickets.length;
                const oSold = orderTickets.filter(t => ["Sold","Delivered","Completed"].includes(t.status)).length;
                const oCost = orderTickets.reduce((a, t) => a + t.costPrice, 0);
                const someOrdSelected = orderTickets.some(t => multiSelected[t.id]);
                const allOrdSelected = orderTickets.every(t => multiSelected[t.id]);
                const seatNums = orderTickets.map(t => parseInt(t.seats)).filter(n => !isNaN(n)).sort((a, b) => a - b);
                const seatRange = seatNums.length > 1 ? `Seats ${seatNums[0]}–${seatNums[seatNums.length-1]}` : seatNums.length === 1 ? `Seat ${seatNums[0]}` : "";
                const seatLabel = [orderGroup.section && `Sec ${orderGroup.section}`, orderGroup.row && `Row ${orderGroup.row}`, seatRange].filter(Boolean).join(" · ");
                const hasRestriction = orderTickets.some(t => t.restrictions && /restrict/i.test(t.restrictions));
                const restriction = orderTickets.find(t => t.restrictions)?.restrictions;
                const isRestricted = restriction && /restrict/i.test(restriction);

                return (
                  <div key={oKey} style={{ borderTop: "0.5px solid #edf0f3" }}>
                    {/* ── Order row ── */}
                    <div onClick={() => setExpandedOrders(s => ({ ...s, [eKey+"||"+oKey]: !s[eKey+"||"+oKey] }))}
                      className="hover-row"
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px 10px 52px", cursor: "pointer", background: someOrdSelected ? "rgba(249,115,22,0.03)" : "#f7f8fa", borderLeft: hasRestriction ? "3px solid #fca5a5" : "3px solid transparent" }}>

                      {/* Checkbox */}
                      <div onClick={e => { e.stopPropagation(); const u = {}; orderTickets.forEach(t => { u[t.id] = !allOrdSelected; }); setMultiSelected(s => ({ ...s, ...u })); }}
                        style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${allOrdSelected ? "#1a3a6e" : someOrdSelected ? "#1a3a6e" : "#d1d9e0"}`, background: allOrdSelected ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {allOrdSelected && <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>✓</span>}
                        {!allOrdSelected && someOrdSelected && <span style={{ color: "#1a3a6e", fontSize: 8, fontWeight: 700 }}>—</span>}
                      </div>

                      {/* Seat location chips */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1, minWidth: 0, flexWrap: "wrap" }}>
                        {orderGroup.section && (
                          <span style={{ background: "#eef2ff", color: "#1a3a6e", border: "1px solid #c7d2fe", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>Sec {orderGroup.section}</span>
                        )}
                        {orderGroup.row && (
                          <span style={{ background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>Row {orderGroup.row}</span>
                        )}
                        {seatRange && (
                          <span style={{ background: "#fff7ed", color: "#f97316", border: "1px solid #fed7aa", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{seatRange}</span>
                        )}
                        {orderGroup.orderRef && (
                          <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace", marginLeft: 2 }}>#{orderGroup.orderRef}</span>
                        )}
                        {isRestricted && (
                          <span style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>⚠ {restriction}</span>
                        )}
                      </div>

                      {/* Account email — muted */}
                      <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{orderGroup.accountEmail}</div>

                      <div style={{ display: "flex", gap: 5, alignItems: "center", width: 70, flexShrink: 0 }}>{qtyBox(oQty)}{soldBox(oSold)}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", width: 80, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(oCost)}</div>
                      <div style={{ width: 80, flexShrink: 0 }}>{statusPill(orderTickets)}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8", width: 16, flexShrink: 0 }}>{isOrderExpanded ? "⌄" : "›"}</div>
                    </div>

                    {/* ── Seat rows ── */}
                    {isOrderExpanded && (
                      <div style={{ background: "#f7f8fa", borderTop: "0.5px solid #edf0f3" }}>
                        {orderTickets.map((t, ti) => {
                          const isSelected = !!multiSelected[t.id];
                          const tRestricted = t.restrictions && /restrict/i.test(t.restrictions);
                          const s = t.status || "Unsold";
                          const sStyle = STATUS_STYLES[s];
                          const seatLabel = t.seats ? `Seat ${t.seats}` : (t.restrictions?.replace(/Album Pre-Order Pre-Sale\s*-?\s*/i, "").replace(/Ticket$/i, "").trim() || "No seat");

                          return (
                            <div key={t.id} className="hover-row"
                              style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px 8px 80px", borderTop: ti > 0 ? "0.5px solid #edf0f3" : "none", background: isSelected ? "rgba(26,58,110,0.05)" : tRestricted ? "#fff8f8" : "transparent", cursor: "pointer" }}
                              onClick={() => setSelectedTicket(t)}>

                              {/* Checkbox */}
                              <div onClick={e => toggleSelect(t.id, e)}
                                style={{ width: 13, height: 13, borderRadius: 3, border: `1.5px solid ${isSelected ? "#1a3a6e" : "#d1d9e0"}`, background: isSelected ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {isSelected && <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>✓</span>}
                              </div>

                              {/* Seat number badge */}
                              <div style={{ background: "#ffffff", border: "1px solid #e2e6ea", borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", minWidth: 72, textAlign: "center" }}>
                                {seatLabel}
                              </div>

                              {/* Restriction tag if present */}
                              {tRestricted && (
                                <span style={{ background: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>⚠ {t.restrictions}</span>
                              )}
                              {t.restrictions && !tRestricted && (
                                <span style={{ background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e6ea", borderRadius: 5, padding: "2px 8px", fontSize: 11 }}>{t.restrictions}</span>
                              )}

                              <div style={{ flex: 1 }} />

                              {/* Cost per ticket */}
                              <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", width: 70, flexShrink: 0, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(t.costPrice)}</div>

                              {/* Status pill — clickable */}
                              <div style={{ position: "relative", width: 80, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                <div onClick={() => setOpenStatusMenu(openStatusMenu === t.id ? null : t.id)}
                                  style={{ display: "inline-flex", alignItems: "center", gap: 4, background: sStyle.bg, color: sStyle.text, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: sStyle.dot }} />{s} ▾
                                </div>
                                {openStatusMenu === t.id && (
                                  <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 100, minWidth: 140, overflow: "hidden" }}>
                                    {STATUSES.map(st => (
                                      <div key={st} onClick={e => updateStatus(t.id, st, e)}
                                        style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", background: t.status === st ? "#f7f8fa" : "transparent", fontWeight: t.status === st ? 700 : 400, fontSize: 12, color: STATUS_STYLES[st].text }}
                                        onMouseEnter={e => e.currentTarget.style.background = "#f7f8fa"}
                                        onMouseLeave={e => e.currentTarget.style.background = t.status === st ? "#f7f8fa" : "transparent"}>
                                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_STYLES[st].dot }} />{st}
                                        {t.status === st && <span style={{ marginLeft: "auto", fontSize: 10, color: "#1a3a6e" }}>✓</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Actions */}
                              <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                                {(t.qtyAvailable ?? t.qty) > 0 && (
                                  <button onClick={() => openSale(t.id)} style={{ background: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "var(--body)" }}>Sell</button>
                                )}
                                <button onClick={() => openEdit(t)} style={{ background: "#ffffff", color: "#64748b", border: "1px solid #e2e6ea", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontFamily: "var(--body)" }}>Edit</button>
                                <button onClick={() => delTicket(t.id)} style={{ background: "rgba(239,68,68,0.06)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)", borderRadius: 6, padding: "3px 7px", fontSize: 10, fontWeight: 700, cursor: "pointer", fontFamily: "var(--body)" }}>✕</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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