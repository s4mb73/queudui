import { useState, useMemo, useEffect, useRef } from "react";
import { fmt, fmtCurrency } from "../utils/format";
import { TicketDetailModal } from "../components/Modals";

const FONT = "Inter, sans-serif";

const STATUSES = ["Unsold", "Listed", "Sold", "Delivered", "Completed"];
const ACTIVE_STATUSES = ["Unsold", "Listed"];
const COMPLETED_STATUSES = ["Sold", "Delivered", "Completed"];

const STATUS_STYLES = {
  Unsold:    { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  Listed:    { bg: "rgba(26,58,110,0.08)", text: "#1a3a6e", dot: "#1a3a6e" },
  Sold:      { bg: "rgba(5,150,105,0.08)", text: "#059669", dot: "#059669" },
  Delivered: { bg: "rgba(249,115,22,0.08)", text: "#f97316", dot: "#f97316" },
  Completed: { bg: "rgba(15,23,42,0.06)", text: "#374151", dot: "#374151" },
};

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(d) {
  if (!d) return "—";
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${parseInt(iso[3])} ${months[parseInt(iso[2])-1]} ${iso[1]}`;
  const wordy = d.match(/(?:\w{3,}\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
  if (wordy) return `${parseInt(wordy[1])} ${wordy[2]} ${wordy[3]}`;
  return d;
}

function fmtTime(t) {
  if (!t) return "";
  const ampm = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const min = ampm[2];
    const period = ampm[3].toLowerCase();
    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    return `${String(h).padStart(2,"0")}:${min}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(t.trim())) return t.trim();
  return "";
}

function getTime(date, time) {
  if (time) return fmtTime(time);
  const bare = (date || "").replace(/\s*[·•]\s*/, " ").trim();
  const embedded = bare.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*$/i);
  return embedded ? fmtTime(embedded[1]) : "";
}

function venueClean(v) {
  return (v || "").replace(/\s*[—–-]\s*.+$/, "").replace(/,.*$/, "").trim();
}

function cleanRestriction(r) {
  if (!r) return r;
  return r
    .replace(/\s*(?:Aisle\s*)?Seated\s*Ticket.*/i, '')
    .replace(/\s*Ticket.*/i, '')
    .replace(/\s*Section\s*\d+.*/i, '')
    .trim();
}

function sectionSummary(sections) {
  if (!sections.length) return "";
  const nums = sections.map(s => parseInt(s)).filter(n => !isNaN(n)).sort((a, b) => a - b);
  if (nums.length > 1) return `Sec ${nums[0]}–${nums[nums.length - 1]}`;
  if (nums.length === 1) return `Sec ${nums[0]}`;
  return sections.slice(0, 2).map(s => `Sec ${s}`).join(" · ") + (sections.length > 2 ? ` +${sections.length - 2}` : "");
}

function cleanEmail(email) {
  if (!email) return "";
  return email.replace(/^".*?"\s*<(.+)>$/, "$1").replace(/^.*<(.+)>$/, "$1").trim();
}

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

  // Active tickets: Unsold + Listed
  // Completed tickets: Sold + Delivered + Completed
  const activeTickets = useMemo(() =>
    tickets.filter(t => ACTIVE_STATUSES.includes(t.status || "Unsold")),
  [tickets]);

  const completedTickets = useMemo(() =>
    tickets.filter(t => COMPLETED_STATUSES.includes(t.status || "Unsold")),
  [tickets]);

  // Apply search + status filter to active section
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

  // Apply search to completed section
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

  // Build event groups for a given ticket list
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

  function getOrderGroups(eventTickets) {
    const orders = {};
    eventTickets.forEach(t => {
      const isStandingSec = t.isStanding || /standing|pitch|floor|general admission/i.test(t.section || "");
      const key = isStandingSec && t.section
        ? (t.orderRef || t.id) + "||" + t.section
        : t.orderRef || t.id;
      if (!orders[key]) {
        orders[key] = { orderRef: t.orderRef || "", accountEmail: t.accountEmail || "", sections: new Set(), rows: new Set(), tickets: [] };
      }
      if (t.section) orders[key].sections.add(t.section);
      if (t.row)     orders[key].rows.add(t.row);
      orders[key].tickets.push(t);
    });
    Object.values(orders).forEach(o => {
      o.sections = [...o.sections].sort((a, b) => (parseInt(a)||0) - (parseInt(b)||0));
      o.rows     = [...o.rows].sort((a, b) => (parseInt(a)||0) - (parseInt(b)||0));
      o.tickets.sort((a, b) => (parseInt(a.seats)||0) - (parseInt(b.seats)||0));
    });
    return orders;
  }

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

  const statusPill = (tix) => {
    const statuses = [...new Set(tix.map(t => t.status || "Unsold"))];
    const s  = statuses.length === 1 ? statuses[0] : "Multiple";
    const st = STATUS_STYLES[s] || STATUS_STYLES.Unsold;
    return (
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: st.bg, color: st.text, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
        <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot }} />{s}
      </div>
    );
  };

  const qtyBox = (n, available) => (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <div style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#f97316", textAlign: "center", minWidth: 28, fontVariantNumeric: "tabular-nums" }}>
        {available ?? n}
      </div>
      {available !== undefined && available !== n && (
        <div style={{ fontSize: 10, color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>/{n}</div>
      )}
    </div>
  );

  const soldBox = (sold) => sold > 0
    ? <div style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#059669", textAlign: "center", minWidth: 28, fontVariantNumeric: "tabular-nums" }}>{sold}</div>
    : <div style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#d1d5db", textAlign: "center", minWidth: 28 }}>0</div>;

  const card = { background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };
  const eventAccent = (cat) => cat === "Sport" ? "#1a3a6e" : "#7c3aed";

  // Shared column header row
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

  // Render a group of event rows (shared between active and completed sections)
  const renderEventGroups = (eventGroups, isCompleted = false) => {
    const keys = Object.keys(eventGroups);
    if (keys.length === 0) return null;

    return keys.map((eKey, gi) => {
      const eventGroup = eventGroups[eKey];
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

      // Completed rows get reduced opacity base, full on hover
      const rowOpacity = isCompleted ? 0.65 : 1;

      return (
        <div key={eKey} style={{ borderBottom: gi < keys.length - 1 ? "0.5px solid #f0f0f3" : "none", opacity: rowOpacity, transition: "opacity 0.15s" }}
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

            <div style={{ fontSize: 12, color: "#6b7280", width: 90, flexShrink: 0 }}>
              {fmtDate(eventGroup.date)}{timeStr ? " · " + timeStr : ""}
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
            .map(([oKey, orderGroup]) => {
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
              <div key={oKey} style={{ borderTop: "0.5px solid #f0f0f3" }}>
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
                    {orderTickets.map((t, ti) => {
                      const isSelected  = !!multiSelected[t.id];
                      const tRestricted = t.restrictions && /restrict|side.?view|limited.?view|partial.?view|obstructed|severely/i.test(t.restrictions);
                      const s      = t.status || "Unsold";
                      const sStyle = STATUS_STYLES[s];
                      const isStandingTicket = t.isStanding || /standing|pitch|floor|general admission/i.test(t.section || "");
                      const seatLabel = isStandingTicket ? (t.section || "Standing") : t.seats ? `Seat ${t.seats}` : "No seat";

                      return (
                        <div key={t.id}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px 8px 80px", borderTop: ti > 0 ? "0.5px solid #f0f0f3" : "none", background: isSelected ? "rgba(26,58,110,0.04)" : tRestricted ? "#fff8f8" : "transparent", cursor: "pointer" }}
                          onClick={() => setSelectedTicket(t)}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(0,0,0,0.02)"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(26,58,110,0.04)" : tRestricted ? "#fff8f8" : "transparent"; }}>

                          <div onClick={e => toggleSelect(t.id, e)}
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
                            <div onClick={() => setOpenStatusMenu(openStatusMenu === t.id ? null : t.id)}
                              style={{ display: "inline-flex", alignItems: "center", gap: 4, background: sStyle.bg, color: sStyle.text, borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                              <div style={{ width: 5, height: 5, borderRadius: "50%", background: sStyle.dot }} />{s} ▾
                            </div>
                            {openStatusMenu === t.id && (
                              <div ref={statusMenuRef} style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "white", border: "0.5px solid #e8e8ec", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 100, minWidth: 140, overflow: "hidden" }}>
                                {STATUSES.map(st => (
                                  <div key={st} onClick={e => updateStatus(t.id, st, e)}
                                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", background: t.status === st ? "#f9f9fb" : "transparent", fontSize: 12, fontWeight: t.status === st ? 600 : 400, color: STATUS_STYLES[st].text }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#f9f9fb"}
                                    onMouseLeave={e => { e.currentTarget.style.background = t.status === st ? "#f9f9fb" : "transparent"; }}>
                                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_STYLES[st].dot }} />{st}
                                    {t.status === st && <span style={{ marginLeft: "auto", fontSize: 10 }}>✓</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                            {!isCompleted && (t.qtyAvailable ?? t.qty) > 0 && !["Sold","Delivered","Completed"].includes(t.status) && (
                              <button onClick={() => openSale(t.id)} style={{ background: "rgba(249,115,22,0.08)", color: "#f97316", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 6, padding: "3px 8px", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>Sell</button>
                            )}
                            <button onClick={() => openEdit(t)} style={{ background: "white", color: "#6b7280", border: "0.5px solid #e8e8ec", borderRadius: 6, padding: "3px 8px", fontSize: 10, cursor: "pointer", fontFamily: FONT }}>Edit</button>
                            <button onClick={() => delTicket(t.id)} style={{ background: "transparent", color: "#d1d5db", border: "none", borderRadius: 6, padding: "3px 6px", fontSize: 12, cursor: "pointer", fontFamily: FONT, lineHeight: 1 }}
                              onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
                              onMouseLeave={e => { e.currentTarget.style.color = "#d1d5db"; }}>✕</button>
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
    });
  };

  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: "#111827", letterSpacing: "-0.03em" }}>Inventory</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
            <span style={{ color: "#f97316", fontWeight: 600 }}>{activeStockCount}</span> active tickets
            {completedStockCount > 0 && (
              <> · <span style={{ color: "#94a3b8" }}>{completedStockCount}</span> completed</>
            )}
          </div>
        </div>
        <button className="action-btn" onClick={() => { setEditingTicket(null); setTf(blankTicket); setShowAddTicket(true); }}>+ Add Ticket</button>
      </div>

      {/* Filter bar */}
      <div style={{ background: "#ffffff", border: "0.5px solid #e8e8ec", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 280 }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search events, order refs, seats…"
            style={{ background: "#f9f9fb", border: "0.5px solid #e8e8ec", padding: "7px 12px 7px 30px", borderRadius: 7, fontFamily: FONT, fontSize: 12, width: "100%", outline: "none", color: "#111827" }} />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af" }}>🔍</span>
        </div>
        {/* Only show active status filters in main bar */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["All", "Unsold", "Listed"].map(s => {
            const st = s !== "All" ? STATUS_STYLES[s] : null;
            const active = filterStatus === s;
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? (st?.dot || "#1a3a6e") : "#e8e8ec"}`, background: active ? (st?.bg || "rgba(26,58,110,0.1)") : "transparent", color: active ? (st?.text || "#1a3a6e") : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
                {st && <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot }} />}{s}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      {numSelected > 0 && (
        <div style={{ background: "#111827", borderRadius: 8, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{numSelected} selected</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={exportSelected} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>⬇ Export CSV</button>
            <button onClick={clearSelection} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>Deselect all</button>
            <button onClick={deleteSelected} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>🗑 Delete {numSelected}</button>
          </div>
        </div>
      )}

      {/* ── ACTIVE STOCK TABLE ── */}
      <div style={{ ...card, overflow: "hidden", marginBottom: 12 }}>
        {/* Section header */}
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

      {/* ── COMPLETED STOCK SECTION ── */}
      {(completedTickets.length > 0 || (searchQ && filteredCompleted.length > 0)) && (
        <div style={{ ...card, overflow: "hidden" }}>
          {/* Collapsible header */}
          <div
            onClick={() => setShowCompleted(v => !v)}
            style={{ padding: "12px 18px", background: "#fafafa", borderBottom: showCompleted ? "1px solid #f0f0f3" : "none", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}
            onMouseEnter={e => e.currentTarget.style.background = "#f4f4f6"}
            onMouseLeave={e => e.currentTarget.style.background = "#fafafa"}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: "-0.1px" }}>Completed Stock</span>
            <span style={{ fontSize: 11, color: "#b0b8c4", marginLeft: 2 }}>
              {Object.keys(buildEventGroups(filteredCompleted)).length} event{Object.keys(buildEventGroups(filteredCompleted)).length !== 1 ? "s" : ""} · {filteredCompleted.length} tickets
            </span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{showCompleted ? "Hide" : "Show"}</span>
              <div style={{ fontSize: 12, color: "#9ca3af", transform: showCompleted ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
            </div>
          </div>

          {showCompleted && (
            <>
              <ColumnHeaders />
              {Object.keys(buildEventGroups(filteredCompleted)).length === 0 ? (
                <div style={{ padding: "32px 18px", textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>No completed tickets{searchQ ? ` matching "${searchQ}"` : ""}</div>
                </div>
              ) : renderEventGroups(buildEventGroups(filteredCompleted), true)}
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