// src/pages/Sales.jsx
import { useState, useMemo, useEffect, useRef } from "react";
import { KpiCard } from "../components/ui";
import { fmt, fmtPct } from "../utils/format";
import {
  SALE_STATUSES,
  SALE_STATUS_STYLES,
  PLATFORM_COLORS,
  categoryAccent,
  FONT,
} from "../lib/schema";
import {
  PlatformBadge,
  PageHeader,
  TableCard,
  FilterBar,
  FilterDivider,
  SearchInput,
  Checkbox,
} from "../components/shared";
import MatchSaleModal from "../components/modals/MatchSaleModal";

const COL = {
  checkbox: 15,
  icon:     34,
  date:     90,
  platform: 90,
  qty:      50,
  revenue:  90,
  cost:     90,
  profit:   100,
  status:   90,
  chevron:  16,
};

const ROW = { display: "flex", alignItems: "center", gap: 12, padding: "0 18px" };

// ── Sale detail panel ─────────────────────────────────────────────────────────
function SaleDetailPanel({ sale, tickets, eventMap, updateSaleStatus, updateSale, onClose }) {
  const matchedTickets = (sale.ticketIds || [])
    .map(id => tickets.find(t => t.id === id))
    .filter(Boolean);

  const firstTicket = matchedTickets[0];
  const ev = eventMap[sale.eventId] || {};

  const costTotal       = matchedTickets.reduce((a, t) => a + (t.cost || 0), 0);
  const costPerTicket   = matchedTickets.length > 0 ? costTotal / matchedTickets.length : 0;
  const profit          = (sale.salePrice || 0) - costTotal;
  const profitPerTicket = sale.qtySold > 0 ? profit / sale.qtySold : 0;

  const [email, setEmail] = useState(sale.customerEmail || "");
  const [phone, setPhone] = useState(sale.customerPhone || "");

  const saveField = (field, value) => {
    if (updateSale) updateSale(sale.id, { [field]: value });
  };

  const inputStyle = {
    fontSize: 12, fontWeight: 600, color: "#111827", fontFamily: FONT,
    textAlign: "right", border: "none", background: "transparent",
    outline: "none", width: "100%", padding: "2px 0",
    borderBottom: "1.5px solid transparent", transition: "border-color 0.15s",
  };

  const Row = ({ label, value, accent }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "0.5px solid #f0f0f3" }}>
      <span style={{ fontSize: 12, color: "#6b7280", fontFamily: FONT, minWidth: 160 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: accent || "#111827", fontFamily: FONT, textAlign: "right" }}>{value || "—"}</span>
    </div>
  );

  const st = SALE_STATUS_STYLES[sale.saleStatus] || SALE_STATUS_STYLES.Sold;

  return (
    <div style={{ background: "#f7f8fa", borderTop: "1px solid #e2e6ea", padding: "16px 24px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

        {/* ── Ticket / Purchase info ── */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10, fontFamily: FONT }}>Purchase Details</div>
          <Row label="Buying Platform"    value={firstTicket?.buyingPlatform || "Ticketmaster"} />
          <Row label="Event"              value={ev.name || firstTicket?.event} />
          <Row label="Venue"              value={ev.venue || firstTicket?.venue} />
          <Row label="Date of Event"      value={ev.date  || firstTicket?.date} />
          <Row label="Section"            value={firstTicket?.section} />
          <Row label="Row"                value={firstTicket?.row} />
          <Row label="Seats"              value={matchedTickets.map(t => t.seats).filter(Boolean).join(", ")} />
          <Row label="Quantity"           value={String(sale.qtySold)} />
          <Row label="Account Email"      value={firstTicket?.accountEmail} />
          <Row label="Order Reference"    value={firstTicket?.orderRef} />
          <Row label="Restrictions"       value={firstTicket?.restrictions} />
          <Row label="Is Standing"        value={firstTicket?.isStanding ? "Yes" : "No"} />
        </div>

        {/* ── Financial info ── */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10, fontFamily: FONT }}>Financials</div>
          <Row label="Cost"                  value={costTotal > 0 ? fmt(costTotal) : "—"} />
          <Row label="Cost Per Ticket"       value={costPerTicket > 0 ? fmt(costPerTicket) : "—"} />
          <Row label="Sold Price"            value={fmt(sale.salePrice)} />
          <Row label="Sold Price Per Ticket" value={fmt(sale.salePriceEach || (sale.salePrice / sale.qtySold))} />
          <Row label="Profit"                value={costTotal > 0 ? `${profit >= 0 ? "+" : ""}${fmt(profit)}` : "—"} accent={costTotal > 0 ? (profit >= 0 ? "#059669" : "#ef4444") : undefined} />
          <Row label="Profit Per Ticket"     value={costTotal > 0 ? `${profitPerTicket >= 0 ? "+" : ""}${fmt(profitPerTicket)}` : "—"} accent={costTotal > 0 ? (profitPerTicket >= 0 ? "#059669" : "#ef4444") : undefined} />
          <Row label="Selling Platform"      value={sale.sellingPlatform} />
          <Row label="Sale Order Number"     value={sale.orderId} />
        </div>

        {/* ── Delivery / Customer info ── */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9ca3af", marginBottom: 10, fontFamily: FONT }}>Delivery & Status</div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #f0f0f3", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontFamily: FONT, minWidth: 160, flexShrink: 0 }}>Customer Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onBlur={e => saveField("customerEmail", e.target.value)}
              placeholder="Enter Customer Email"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderBottomColor = "#1a3a6e"; }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "0.5px solid #f0f0f3", gap: 12 }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontFamily: FONT, minWidth: 160, flexShrink: 0 }}>Customer Phone</span>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              onBlur={e => saveField("customerPhone", e.target.value)}
              placeholder="Enter Customer Phone Number"
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderBottomColor = "#1a3a6e"; }}
            />
          </div>

          <div style={{ padding: "8px 0", borderBottom: "0.5px solid #f0f0f3", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#6b7280", fontFamily: FONT, minWidth: 160 }}>Status</span>
            <div style={{ display: "flex", gap: 6 }}>
              {SALE_STATUSES.map(s => {
                const sStyle = SALE_STATUS_STYLES[s];
                const active = (sale.saleStatus || "Sold") === s;
                return (
                  <button key={s} onClick={() => updateSaleStatus(sale.id, s)}
                    style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${active ? sStyle.dot : "#e2e6ea"}`, background: active ? sStyle.bg : "transparent", color: active ? sStyle.text : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
                    {active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: sStyle.dot }} />}
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {sale.notes && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontFamily: FONT }}>Notes</div>
              <div style={{ fontSize: 12, color: "#374151", fontFamily: FONT }}>{sale.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Unmatched Sale Card ───────────────────────────────────────────────────────
function UnmatchedSaleCard({ sale, tickets, eventMap, onMatch }) {
  function saleEventName(s) { return eventMap[s.eventId]?.name || s.eventName || "Unknown Event"; }

  return (
    <div style={{
      background: "#fffbeb",
      border: "1px solid #fcd34d",
      borderLeft: "4px solid #f59e0b",
      borderRadius: 10,
      padding: "14px 16px",
      display: "flex",
      alignItems: "center",
      gap: 14,
    }}>
      <div style={{ fontSize: 22, flexShrink: 0 }}>⚠️</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {saleEventName(sale)}
        </div>
        <div style={{ fontSize: 11, color: "#a16207", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "monospace", background: "rgba(245,158,11,0.15)", borderRadius: 4, padding: "1px 5px" }}>{sale.sellingPlatform}</span>
          {sale.qtySold && <span>{sale.qtySold}× tickets</span>}
          {sale.salePrice > 0 && <span style={{ fontWeight: 600 }}>{fmt(sale.salePrice)}</span>}
          {sale.date && <span>{sale.date}</span>}
          {sale.section && <span>Sec {sale.section}</span>}
          {sale.orderId && <span>Order #{sale.orderId}</span>}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: "right" }}>
        <div style={{ fontSize: 11, color: "#b45309", background: "rgba(245,158,11,0.1)", border: "1px solid #fcd34d", borderRadius: 6, padding: "3px 8px", marginBottom: 8, fontWeight: 600 }}>
          No inventory linked
        </div>
        <button
          onClick={() => onMatch(sale)}
          style={{
            background: "#f59e0b", color: "white",
            border: "none", borderRadius: 7,
            padding: "7px 14px", fontSize: 12, fontWeight: 700,
            cursor: "pointer", fontFamily: FONT,
            display: "flex", alignItems: "center", gap: 5,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.background = "#d97706"}
          onMouseLeave={e => e.currentTarget.style.background = "#f59e0b"}>
          🔗 Match to Inventory
        </button>
      </div>
    </div>
  );
}

export default function Sales({ tickets, sales, setSales, updateSale, linkTicketsToSale, events, setShowAddSale, notify }) {
  const [expandedEvents, setExpandedEvents]   = useState({});
  const [expandedSales, setExpandedSales]     = useState({});
  const [filterStatus, setFilterStatus]       = useState("All");
  const [filterPlatform, setFilterPlatform]   = useState("All");
  const [searchQ, setSearchQ]                 = useState("");
  const [selected, setSelected]               = useState(new Set());
  const [matchingSale, setMatchingSale]       = useState(null);
  const [actionSectionCollapsed, setActionSectionCollapsed] = useState(false);
  const notifyFiredRef = useRef(false);

  const eventMap = useMemo(() => {
    const m = {};
    (events || []).forEach(e => { m[e.id] = e; });
    return m;
  }, [events]);

  function saleEventName(s) { return eventMap[s.eventId]?.name || s.eventName || "Unknown Event"; }
  function saleCategory(s)  { return eventMap[s.eventId]?.category || "Concert"; }
  function saleVenue(s)     { return eventMap[s.eventId]?.venue || ""; }

  const unmatchedSales = useMemo(() =>
    sales.filter(s => !s.ticketIds || s.ticketIds.length === 0), [sales]
  );

  const matchedSales = useMemo(() =>
    sales.filter(s => s.ticketIds && s.ticketIds.length > 0), [sales]
  );

  useEffect(() => {
    if (notifyFiredRef.current) return;
    if (unmatchedSales.length > 0) {
      notify?.(`⚠️ ${unmatchedSales.length} sale${unmatchedSales.length !== 1 ? "s" : ""} need${unmatchedSales.length === 1 ? "s" : ""} matching`);
      notifyFiredRef.current = true;
    }
  }, [unmatchedSales.length]);

  const handleLink = async (saleId, ticketIds) => {
    setMatchingSale(null);
    if (linkTicketsToSale) await linkTicketsToSale(saleId, ticketIds);
    else setSales(prev => prev.map(s => s.id === saleId ? { ...s, ticketIds } : s));
    notify?.(`✅ Sale linked to ${ticketIds.length} ticket${ticketIds.length !== 1 ? "s" : ""}`);
  };

  const handleCreateAndLink = (saleId, newTicket) => {
    if (typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("queud:createAndLink", { detail: { saleId, newTicket } }));
    notify?.("✅ Ticket created and linked");
  };

  // ── KPIs — only from matched sales ────────────────────────────────────────
  const totalRevenue = matchedSales.reduce((a, s) => a + (s.salePrice || 0), 0);
  const totalCost    = matchedSales.reduce((a, s) => {
    const linked = (s.ticketIds || []).map(id => tickets.find(t => t.id === id)).filter(Boolean);
    return a + linked.reduce((b, t) => b + (t.cost || 0), 0);
  }, 0);
  const totalProfit  = totalRevenue - totalCost;
  const totalROI     = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  const totalQty     = matchedSales.reduce((a, s) => a + s.qtySold, 0);

  // ── Filtered event groups — only matched sales ─────────────────────────────
  const eventGroups = useMemo(() => {
    const filtered = matchedSales.filter(s => {
      if (filterStatus !== "All" && (s.saleStatus || "Sold") !== filterStatus) return false;
      if (filterPlatform !== "All" && s.sellingPlatform !== filterPlatform) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        return saleEventName(s).toLowerCase().includes(q)
          || (s.sellingPlatform || "").toLowerCase().includes(q)
          || (s.notes           || "").toLowerCase().includes(q)
          || (s.section         || "").toLowerCase().includes(q)
          || (s.orderId         || "").toLowerCase().includes(q);
      }
      return true;
    });

    const groups = {};
    filtered.forEach(s => {
      const evName = saleEventName(s);
      const evDate = eventMap[s.eventId]?.date || s.date || "";
      const key    = (s.eventId || evName) + "||" + evDate;
      if (!groups[key]) groups[key] = {
        eventId: s.eventId || "", eventName: evName,
        category: saleCategory(s), venue: saleVenue(s),
        date: evDate, sales: [], revenue: 0, cost: 0,
      };
      groups[key].sales.push(s);
      groups[key].revenue += s.salePrice || 0;
      const linked = (s.ticketIds || []).map(id => tickets.find(t => t.id === id)).filter(Boolean);
      groups[key].cost += linked.reduce((a, t) => a + (t.cost || 0), 0);
    });

    return Object.values(groups).sort((a, b) => b.revenue - a.revenue);
  }, [matchedSales, tickets, filterStatus, filterPlatform, searchQ, eventMap]);

  const allPlatforms = [...new Set(sales.map(s => s.sellingPlatform).filter(Boolean))];

  const updateSaleStatus = (saleId, v) => {
    if (updateSale) updateSale(saleId, { saleStatus: v });
    else setSales(prev => prev.map(s => s.id === saleId ? { ...s, saleStatus: v } : s));
    notify?.("Status → " + v);
  };

  const deleteSale = (saleId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this sale record?")) return;
    setSales(prev => prev.filter(s => s.id !== saleId));
    setSelected(prev => { const n = new Set(prev); n.delete(saleId); return n; });
    notify?.("Sale deleted");
  };

  const toggleSelect    = (id, e) => { e.stopPropagation(); setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const toggleSelectAll = () => { const all = matchedSales.map(s => s.id); setSelected(selected.size === all.length ? new Set() : new Set(all)); };
  const massDelete = () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} sale${selected.size !== 1 ? "s" : ""}?`)) return;
    setSales(prev => prev.filter(s => !selected.has(s.id)));
    notify?.(`Deleted ${selected.size} sales`);
    setSelected(new Set());
  };

  const toggleSaleExpanded = (saleId, e) => {
    e.stopPropagation();
    setExpandedSales(prev => ({ ...prev, [saleId]: !prev[saleId] }));
  };

  const kpis = [
    { label: "Total Revenue", value: fmt(totalRevenue), color: "#f97316", iconKey: "kpi_revenue", sub: `${totalQty} ticket${totalQty !== 1 ? "s" : ""} sold` },
    { label: "Total Cost",    value: fmt(totalCost),    color: "#ef4444", iconKey: "kpi_invested" },
    { label: "Net Profit",    value: fmt(totalProfit),  color: totalProfit >= 0 ? "#059669" : "#ef4444", iconKey: "kpi_profit" },
    { label: "ROI",           value: fmtPct(totalROI),  color: totalROI  >= 0 ? "#059669" : "#ef4444", iconKey: "kpi_roi" },
    { label: "Avg per Sale",  value: matchedSales.length > 0 ? fmt(totalProfit / matchedSales.length) : "—", color: "#1a3a6e", iconKey: "kpi_sold", sub: `${matchedSales.length} matched · ${unmatchedSales.length} pending` },
  ];

  return (
    <div className="fade-up">
      <PageHeader
        title="Sales"
        sub={`${eventGroups.length} event${eventGroups.length !== 1 ? "s" : ""} · ${totalQty} ticket${totalQty !== 1 ? "s" : ""} sold`}
        action={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selected.size > 0 && (
              <button onClick={massDelete} style={{ background: "#111827", color: "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                🗑 Delete {selected.size}
              </button>
            )}
            <button className="action-btn" onClick={() => setShowAddSale(true)}>+ Record Sale</button>
          </div>
        }
      />

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* ── ACTION REQUIRED SECTION ── */}
      {unmatchedSales.length > 0 && (
        <div style={{
          background: "#ffffff",
          border: "1px solid #fcd34d",
          borderRadius: 12,
          marginBottom: 16,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(245,158,11,0.1)",
        }}>
          {/* Section header */}
          <div
            onClick={() => setActionSectionCollapsed(v => !v)}
            style={{
              padding: "12px 18px",
              background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
              borderBottom: actionSectionCollapsed ? "none" : "1px solid #fcd34d",
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer", userSelect: "none",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
                  Action Required
                </span>
                <span style={{ fontSize: 12, color: "#a16207", marginLeft: 8 }}>
                  {unmatchedSales.length} sale{unmatchedSales.length !== 1 ? "s" : ""} need{unmatchedSales.length === 1 ? "s" : ""} to be matched to inventory
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ background: "#f59e0b", color: "white", borderRadius: 12, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                {unmatchedSales.length}
              </div>
              <div style={{ fontSize: 12, color: "#a16207", transform: actionSectionCollapsed ? "none" : "rotate(90deg)", transition: "transform 0.15s" }}>›</div>
            </div>
          </div>

          {!actionSectionCollapsed && (
            <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0, fontFamily: FONT }}>
                These sales were imported or recorded but not yet linked to inventory tickets. 
                Cost and profit figures will be inaccurate until matched.
              </p>
              {unmatchedSales.map(sale => (
                <UnmatchedSaleCard
                  key={sale.id}
                  sale={sale}
                  tickets={tickets}
                  eventMap={eventMap}
                  onMatch={setMatchingSale}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <FilterBar>
        <SearchInput value={searchQ} onChange={setSearchQ} placeholder="Search events, platforms, sections…" />
        <div onClick={toggleSelectAll} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px 10px", borderRadius: 20, border: `1px solid ${selected.size > 0 ? "rgba(26,58,110,0.3)" : "#e8e8ec"}`, background: selected.size > 0 ? "rgba(26,58,110,0.06)" : "transparent" }}>
          <Checkbox checked={selected.size === matchedSales.length && matchedSales.length > 0} indeterminate={selected.size > 0 && selected.size < matchedSales.length} size={12} />
          <span style={{ fontSize: 11, color: selected.size > 0 ? "#1a3a6e" : "#6b7280", fontWeight: 600, fontFamily: FONT }}>
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </span>
        </div>
        <FilterDivider />
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["All", ...SALE_STATUSES].map(s => {
            const st = s !== "All" ? SALE_STATUS_STYLES[s] : null;
            const active = filterStatus === s;
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? (st?.dot || "#1a3a6e") : "#e8e8ec"}`, background: active ? (st?.bg || "rgba(26,58,110,0.1)") : "transparent", color: active ? (st?.text || "#1a3a6e") : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
                {st && active && <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot }} />}{s}
              </button>
            );
          })}
        </div>
        {allPlatforms.length > 0 && (
          <>
            <FilterDivider />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {["All", ...allPlatforms].map(p => {
                const active = filterPlatform === p;
                const color  = PLATFORM_COLORS[p] || PLATFORM_COLORS.Default;
                return (
                  <button key={p} onClick={() => setFilterPlatform(p)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? color : "#e8e8ec"}`, background: active ? `${color}14` : "transparent", color: active ? color : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    {p}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </FilterBar>

      {/* ── MATCHED SALES TABLE ── */}
      <TableCard>
        {/* Section label + Headers */}
        <div style={{ padding: "10px 18px 0", borderBottom: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, paddingBottom: 10, borderBottom: "1px solid #f0f0f3" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Completed Sales</span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              {matchedSales.length} transaction{matchedSales.length !== 1 ? "s" : ""} · inventory linked
            </span>
          </div>
        </div>

        {/* Column headers */}
        <div style={{ ...ROW, padding: "9px 18px", borderBottom: "1px solid #f0f0f3", background: "#fafafa" }}>
          <div style={{ width: COL.checkbox, flexShrink: 0 }} />
          <div style={{ width: COL.icon,     flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", fontFamily: FONT }}>Event</div>
          <div style={{ width: COL.date,     flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", fontFamily: FONT }}>Date</div>
          <div style={{ width: COL.platform, flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", fontFamily: FONT }}>Platform</div>
          <div style={{ width: COL.qty,      flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", fontFamily: FONT }}>Qty</div>
          <div style={{ width: COL.revenue,  flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", fontFamily: FONT, textAlign: "right" }}>Revenue</div>
          <div style={{ width: COL.cost,     flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", fontFamily: FONT, textAlign: "right" }}>Cost</div>
          <div style={{ width: COL.profit,   flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", fontFamily: FONT, textAlign: "right" }}>Profit</div>
          <div style={{ width: COL.status,   flexShrink: 0, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af", fontFamily: FONT }}>Status</div>
          <div style={{ width: COL.chevron,  flexShrink: 0 }} />
        </div>

        {matchedSales.length === 0 && unmatchedSales.length === 0 ? (
          <div style={{ padding: "56px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💸</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>No sales yet</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Record your first sale to start tracking P&L</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => setShowAddSale(true)}>Record First Sale</button>
          </div>
        ) : matchedSales.length === 0 ? (
          <div style={{ padding: "40px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>🔗</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>No matched sales yet</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Match the sales above to inventory to see them here</div>
          </div>
        ) : eventGroups.length === 0 ? (
          <div style={{ padding: "48px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>No results</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Try adjusting your filters</div>
            <button className="ghost-btn" style={{ marginTop: 12 }} onClick={() => { setSearchQ(""); setFilterStatus("All"); setFilterPlatform("All"); }}>Clear filters</button>
          </div>
        ) : eventGroups.map((group, gi) => {
          const eKey         = (group.eventId || group.eventName) + group.date;
          const isExpanded   = expandedEvents[eKey];
          const groupProfit  = group.revenue - group.cost;
          const groupROI     = group.cost > 0 ? (groupProfit / group.cost) * 100 : 0;
          const qtySold      = group.sales.reduce((a, s) => a + s.qtySold, 0);
          const accent       = categoryAccent(group.category);
          const platforms    = [...new Set(group.sales.map(s => s.sellingPlatform).filter(Boolean))];
          const groupIds     = group.sales.map(s => s.id);
          const allGroupSel  = groupIds.every(id => selected.has(id));
          const someGroupSel = groupIds.some(id => selected.has(id));

          const toggleGroup = e => {
            e.stopPropagation();
            setSelected(prev => {
              const n = new Set(prev);
              if (allGroupSel) groupIds.forEach(id => n.delete(id));
              else groupIds.forEach(id => n.add(id));
              return n;
            });
          };

          return (
            <div key={eKey} style={{ borderBottom: gi < eventGroups.length - 1 ? "0.5px solid #f0f0f3" : "none" }}>

              {/* Event group row */}
              <div
                onClick={() => setExpandedEvents(s => ({ ...s, [eKey]: !s[eKey] }))}
                style={{ ...ROW, padding: "12px 18px", cursor: "pointer", background: someGroupSel ? "#fffbf7" : "white", borderLeft: `3px solid ${accent}`, transition: "background 0.1s" }}
                onMouseEnter={e => { if (!someGroupSel) e.currentTarget.style.background = "#fafafa"; }}
                onMouseLeave={e => { e.currentTarget.style.background = someGroupSel ? "#fffbf7" : "white"; }}
              >
                <div onClick={toggleGroup} style={{ width: COL.checkbox, height: COL.checkbox, borderRadius: 4, border: `1.5px solid ${allGroupSel ? "#1a3a6e" : someGroupSel ? "#1a3a6e" : "#d1d5db"}`, background: allGroupSel ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                  {allGroupSel  && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
                  {!allGroupSel && someGroupSel && <span style={{ color: "#1a3a6e", fontSize: 9 }}>—</span>}
                </div>
                <div style={{ width: COL.icon, height: COL.icon, borderRadius: 8, background: group.category === "Sport" ? "rgba(26,58,110,0.08)" : "rgba(124,58,237,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                  {group.category === "Sport" ? "⚽" : "🎵"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FONT }}>
                    {group.eventName}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, fontFamily: FONT, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {group.venue && <span>{group.venue} ·</span>}
                    <span>{group.sales.length} sale{group.sales.length !== 1 ? "s" : ""}</span>
                    {platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                    {/* Matched indicator */}
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#059669", background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 10, padding: "1px 7px" }}>
                      ✓ Linked
                    </span>
                  </div>
                </div>
                <div style={{ width: COL.date,     flexShrink: 0, fontSize: 12, color: "#6b7280", fontFamily: FONT }}>{group.date || "—"}</div>
                <div style={{ width: COL.platform, flexShrink: 0 }} />
                <div style={{ width: COL.qty,      flexShrink: 0, fontSize: 13, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums", fontFamily: FONT }}>{qtySold}×</div>
                <div style={{ width: COL.revenue,  flexShrink: 0, fontSize: 13, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums", fontFamily: FONT, textAlign: "right" }}>{fmt(group.revenue)}</div>
                <div style={{ width: COL.cost,     flexShrink: 0, fontSize: 13, color: "#6b7280", fontVariantNumeric: "tabular-nums", fontFamily: FONT, textAlign: "right" }}>{group.cost > 0 ? fmt(group.cost) : "—"}</div>
                <div style={{ width: COL.profit,   flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: groupProfit >= 0 ? "#059669" : "#ef4444", fontVariantNumeric: "tabular-nums", fontFamily: FONT }}>{groupProfit >= 0 ? "+" : ""}{fmt(groupProfit)}</div>
                  <div style={{ fontSize: 10, color: groupROI >= 0 ? "#059669" : "#ef4444", marginTop: 1, fontFamily: FONT }}>{fmtPct(groupROI)} ROI</div>
                </div>
                <div style={{ width: COL.status, flexShrink: 0 }} />
                <div style={{ width: COL.chevron, flexShrink: 0, fontSize: 12, color: "#9ca3af", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>›</div>
              </div>

              {/* Individual sale rows */}
              {isExpanded && group.sales.map((s, si) => {
                const matchedTickets = (s.ticketIds || []).map(id => tickets.find(t => t.id === id)).filter(Boolean);
                const costTotal      = matchedTickets.reduce((a, t) => a + (t.cost || 0), 0);
                const sProfit        = (s.salePrice || 0) - costTotal;
                const isSelected     = selected.has(s.id);
                const isSaleExpanded = expandedSales[s.id];
                const st             = SALE_STATUS_STYLES[s.saleStatus] || SALE_STATUS_STYLES.Sold;

                return (
                  <div key={s.id}>
                    {/* Sale summary row */}
                    <div
                      style={{ ...ROW, padding: "9px 18px", borderTop: "0.5px solid #f0f0f3", background: isSelected ? "rgba(26,58,110,0.03)" : isSaleExpanded ? "#f4f6fb" : "#f9f9fb", transition: "background 0.1s", cursor: "pointer" }}
                      onClick={e => toggleSaleExpanded(s.id, e)}
                      onMouseEnter={e => { if (!isSelected && !isSaleExpanded) e.currentTarget.style.background = "#f4f4f6"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(26,58,110,0.03)" : isSaleExpanded ? "#f4f6fb" : "#f9f9fb"; }}
                    >
                      <div onClick={e => toggleSelect(s.id, e)} style={{ width: COL.checkbox, height: COL.checkbox, borderRadius: 3, border: `1.5px solid ${isSelected ? "#1a3a6e" : "#d1d5db"}`, background: isSelected ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: "pointer" }}>
                        {isSelected && <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>✓</span>}
                      </div>

                      <div style={{ width: COL.icon, flexShrink: 0, display: "flex", justifyContent: "center" }}>
                        <div style={{ width: 2, height: 22, background: "#e2e6ea", borderRadius: 2 }} />
                      </div>

                      {/* Seat chips */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          {s.section && (
                            <span style={{ background: "#eef2ff", color: "#1a3a6e", border: "1px solid #c7d2fe", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                              {/standing|general admission|ga\b/i.test(s.section) ? s.section : `Sec ${s.section}`}
                            </span>
                          )}
                          {s.row && <span style={{ background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>Row {s.row}</span>}
                          {s.seats && <span style={{ background: "#fff7ed", color: "#f97316", border: "1px solid #fed7aa", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{s.seats}</span>}
                          {!s.section && !s.row && !s.seats && (
                            <span style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>{s.qtySold}× tickets</span>
                          )}
                          {s.orderId && <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>Order {s.orderId}</span>}
                          {/* Show matched ticket ref */}
                          {matchedTickets.length > 0 && matchedTickets[0]?.orderRef && (
                            <span style={{ fontSize: 10, color: "#059669", background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 4, padding: "1px 6px", whiteSpace: "nowrap" }}>
                              ✓ #{matchedTickets[0].orderRef}
                            </span>
                          )}
                        </div>
                        {(s.customerEmail || s.customerPhone) && (
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, display: "flex", gap: 8 }}>
                            {s.customerEmail && <span>✉ {s.customerEmail}</span>}
                            {s.customerPhone && <span>📱 {s.customerPhone}</span>}
                          </div>
                        )}
                      </div>

                      <div style={{ width: COL.date,     flexShrink: 0, fontSize: 11, color: "#6b7280", fontFamily: FONT }}>{s.date || "—"}</div>
                      <div style={{ width: COL.platform, flexShrink: 0 }}><PlatformBadge platform={s.sellingPlatform} /></div>
                      <div style={{ width: COL.qty,      flexShrink: 0, fontSize: 12, fontWeight: 600, color: "#374151", fontVariantNumeric: "tabular-nums", fontFamily: FONT }}>{s.qtySold}×</div>
                      <div style={{ width: COL.revenue,  flexShrink: 0, fontSize: 12, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums", fontFamily: FONT, textAlign: "right" }}>{fmt(s.salePrice)}</div>
                      <div style={{ width: COL.cost,     flexShrink: 0, fontSize: 12, color: "#6b7280", fontVariantNumeric: "tabular-nums", fontFamily: FONT, textAlign: "right" }}>{costTotal > 0 ? fmt(costTotal) : "—"}</div>
                      <div style={{ width: COL.profit,   flexShrink: 0, fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontFamily: FONT, color: sProfit >= 0 ? "#059669" : "#ef4444", textAlign: "right" }}>
                        {`${sProfit >= 0 ? "+" : ""}${fmt(sProfit)}`}
                      </div>

                      {/* Status pill */}
                      <div style={{ width: COL.status, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: st.bg, color: st.text, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600, fontFamily: FONT }}>
                          <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot }} />
                          {s.saleStatus || "Sold"}
                        </div>
                      </div>

                      {/* Delete */}
                      <div style={{ width: COL.chevron, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button onClick={e => deleteSale(s.id, e)}
                          style={{ background: "transparent", color: "#d1d5db", border: "none", cursor: "pointer", padding: "2px", borderRadius: 5, fontSize: 13, lineHeight: 1, transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; }}
                          onMouseLeave={e => { e.currentTarget.style.color = "#d1d5db"; }}>✕</button>
                      </div>
                    </div>

                    {/* Expandable detail panel */}
                    {isSaleExpanded && (
                      <SaleDetailPanel
                        sale={s}
                        tickets={tickets}
                        eventMap={eventMap}
                        updateSaleStatus={updateSaleStatus}
                        updateSale={updateSale}
                        onClose={() => setExpandedSales(prev => ({ ...prev, [s.id]: false }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </TableCard>

      {matchingSale && (
        <MatchSaleModal
          sale={matchingSale}
          tickets={tickets}
          onLink={handleLink}
          onCreateAndLink={handleCreateAndLink}
          onClose={() => setMatchingSale(null)}
        />
      )}
    </div>
  );
}