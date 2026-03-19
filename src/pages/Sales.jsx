import { useState, useMemo } from "react";
import { KpiCard } from "../components/ui";
import { fmt, fmtPct } from "../utils/format";

const FONT = "Inter, sans-serif";

const card = { background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };

const STATUS_STYLES = {
  Pending:   { bg: "rgba(245,158,11,0.08)",  color: "#d97706", dot: "#f59e0b",  border: "rgba(245,158,11,0.2)" },
  Paid:      { bg: "rgba(5,150,105,0.08)",   color: "#059669", dot: "#059669",  border: "rgba(5,150,105,0.2)" },
  Delivered: { bg: "rgba(26,58,110,0.08)",   color: "#1a3a6e", dot: "#1a3a6e",  border: "rgba(26,58,110,0.2)" },
  Cancelled: { bg: "#f1f5f9",                color: "#64748b", dot: "#94a3b8",  border: "#e2e6ea" },
};

const PLATFORM_COLORS = {
  Viagogo:               "#1a3a6e",
  Tixstock:              "#059669",
  Lysted:                "#7c3aed",
  StubHub:               "#f97316",
  "Ticketmaster Resale": "#ef4444",
  "AXS Official Resale": "#0ea5e9",
  Default:               "#64748b",
};

// Grid: checkbox + chevron + event + platform + qty + revenue + fees + profit + status + delete
const GRID = "32px 24px 2fr 1fr 60px 90px 80px 90px 130px 34px";

// ── Normalise snake_case (DB) ↔ camelCase (frontend) ─────────────────────────
function normSale(s) {
  return {
    id:         s.id,
    eventName:  s.eventName  || s.event_name  || "Unknown Event",
    category:   s.category   || "Concert",
    platform:   s.platform   || "",
    qtySold:    s.qtySold    ?? s.qty_sold    ?? 1,
    salePrice:  s.salePrice  ?? s.sale_price  ?? 0,
    fees:       s.fees       ?? 0,
    costPer:    s.costPer    ?? s.cost_per    ?? 0,
    saleStatus: s.saleStatus || s.sale_status || "Pending",
    date:       s.date       || "",
    notes:      s.notes      || "",
    ticketId:   s.ticketId   || s.ticket_id   || null,
    ticketIds:  s.ticketIds  || s.ticket_ids  || [],
    section:    s.section    || "",
    row:        s.row        || "",
    seats:      s.seats      || "",
  };
}

function StatusPill({ status, onChange }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  return (
    <select
      value={status || "Pending"}
      onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
      onClick={e => e.stopPropagation()}
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: "3px 8px", fontSize: 11, fontWeight: 700, fontFamily: FONT, cursor: "pointer", outline: "none" }}
    >
      {Object.keys(STATUS_STYLES).map(st => <option key={st} value={st}>{st}</option>)}
    </select>
  );
}

function PlatformBadge({ platform }) {
  const color = PLATFORM_COLORS[platform] || PLATFORM_COLORS.Default;
  return (
    <span style={{ background: `${color}14`, color, border: `1px solid ${color}28`, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: "0.3px", whiteSpace: "nowrap" }}>
      {platform}
    </span>
  );
}

// ── Seat chips — identical pill style to Inventory order rows ─────────────────
function SeatChips({ sale, ticket }) {
  const section = sale.section || ticket?.section || "";
  const row     = sale.row     || ticket?.row     || "";
  const seats   = sale.seats   || ticket?.seats   || "";
  const isStanding = /standing|pitch|floor|general admission|ga\b/i.test(section);

  if (!section && !row && !seats && !ticket) {
    return <span style={{ color: "#9ca3af", fontSize: 11 }}>Ticket removed</span>;
  }
  if (!section && !row && !seats) {
    return <span style={{ color: "#9ca3af", fontSize: 11 }}>No seat info</span>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
      {section && (
        <span style={{ background: isStanding ? "#f0fdfa" : "#eef2ff", color: isStanding ? "#0f766e" : "#1a3a6e", border: `1px solid ${isStanding ? "#99f6e4" : "#c7d2fe"}`, borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
          {isStanding ? section : `Sec ${section}`}
        </span>
      )}
      {row && (
        <span style={{ background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
          Row {row}
        </span>
      )}
      {seats && (
        <span style={{ background: "#fff7ed", color: "#f97316", border: "1px solid #fed7aa", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
          {seats.includes(",") ? `Seats ${seats}` : `Seat ${seats}`}
        </span>
      )}
      {sale.qtySold > 1 && !seats && (
        <span style={{ background: "rgba(249,115,22,0.1)", color: "#f97316", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 5, padding: "2px 7px", fontSize: 11, fontWeight: 600 }}>
          {sale.qtySold}×
        </span>
      )}
    </div>
  );
}

export default function Sales({ tickets, sales, setSales, updateSale, setShowAddSale }) {
  const [expandedEvents, setExpandedEvents] = useState({});
  const [filterStatus, setFilterStatus]     = useState("All");
  const [filterPlatform, setFilterPlatform] = useState("All");
  const [searchQ, setSearchQ]               = useState("");
  const [selected, setSelected]             = useState(new Set());

  const normed = useMemo(() => sales.map(normSale), [sales]);

  // ── KPIs ─────────────────────────────────────────────────────────────────────
  const totalRevenue = normed.reduce((a, s) => a + (s.salePrice * s.qtySold), 0);
  const totalFees    = normed.reduce((a, s) => a + s.fees, 0);
  const totalCost    = normed.reduce((a, s) => a + (s.costPer * s.qtySold), 0);
  const totalProfit  = totalRevenue - totalFees - totalCost;
  const totalROI     = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
  const totalQty     = normed.reduce((a, s) => a + s.qtySold, 0);

  // ── Event groups ──────────────────────────────────────────────────────────────
  const eventGroups = useMemo(() => {
    const filtered = normed.filter(s => {
      if (filterStatus !== "All" && s.saleStatus !== filterStatus) return false;
      if (filterPlatform !== "All" && s.platform !== filterPlatform) return false;
      if (searchQ) {
        const q = searchQ.toLowerCase();
        return (s.eventName || "").toLowerCase().includes(q)
          || (s.platform || "").toLowerCase().includes(q)
          || (s.notes || "").toLowerCase().includes(q)
          || (s.section || "").toLowerCase().includes(q);
      }
      return true;
    });
    const groups = {};
    filtered.forEach(s => {
      const key = s.eventName;
      if (!groups[key]) groups[key] = { eventName: key, category: s.category, sales: [], revenue: 0, fees: 0, cost: 0 };
      groups[key].sales.push(s);
      groups[key].revenue += s.salePrice * s.qtySold;
      groups[key].fees    += s.fees;
      groups[key].cost    += s.costPer * s.qtySold;
    });
    return Object.values(groups).sort((a, b) => b.revenue - a.revenue);
  }, [normed, filterStatus, filterPlatform, searchQ]);

  const allPlatforms = [...new Set(normed.map(s => s.platform).filter(Boolean))];

  // ── Actions ───────────────────────────────────────────────────────────────────
  const updateSaleStatus = (saleId, v) => {
    if (updateSale) updateSale(saleId, { sale_status: v, saleStatus: v });
    else setSales(prev => prev.map(s => s.id === saleId ? { ...s, saleStatus: v, sale_status: v } : s));
  };

  const deleteSale = (saleId, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this sale record?")) return;
    setSales(prev => prev.filter(s => s.id !== saleId));
    setSelected(prev => { const n = new Set(prev); n.delete(saleId); return n; });
  };

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    const allIds = normed.map(s => s.id);
    setSelected(selected.size === allIds.length ? new Set() : new Set(allIds));
  };

  const massDelete = () => {
    if (!selected.size) return;
    if (!window.confirm(`Delete ${selected.size} sale${selected.size !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    setSales(prev => prev.filter(s => !selected.has(s.id)));
    setSelected(new Set());
  };

  const kpis = [
    { label: "Total Revenue", value: fmt(totalRevenue), color: "#f97316", iconKey: "kpi_revenue", sub: `${totalQty} ticket${totalQty !== 1 ? "s" : ""} sold` },
    { label: "Platform Fees", value: fmt(totalFees),    color: "#ef4444", iconKey: "kpi_invested" },
    { label: "Net Profit",    value: fmt(totalProfit),  color: totalProfit >= 0 ? "#059669" : "#ef4444", iconKey: "kpi_profit" },
    { label: "ROI",           value: fmtPct(totalROI),  color: totalROI  >= 0 ? "#059669" : "#ef4444", iconKey: "kpi_roi" },
    { label: "Avg per Sale",  value: sales.length > 0 ? fmt(totalProfit / sales.length) : "—", color: "#1a3a6e", iconKey: "kpi_sold", sub: `${sales.length} transaction${sales.length !== 1 ? "s" : ""}` },
  ];

  return (
    <div className="fade-up">

      {/* ── Header — matches Inventory exactly ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 22, color: "#111827", letterSpacing: "-0.03em" }}>Sales</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>
            {eventGroups.length} event{eventGroups.length !== 1 ? "s" : ""} · {totalQty} ticket{totalQty !== 1 ? "s" : ""} sold
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selected.size > 0 && (
            <button onClick={massDelete}
              style={{ background: "#111827", color: "white", border: "none", borderRadius: 7, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              🗑 Delete {selected.size}
            </button>
          )}
          <button className="action-btn" onClick={() => setShowAddSale(true)}>+ Record Sale</button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* ── Filter bar — matches Inventory ── */}
      <div style={{ background: "#ffffff", border: "0.5px solid #e8e8ec", borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 220px", maxWidth: 280 }}>
          <input
            value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Search events, platforms, sections…"
            style={{ background: "#f9f9fb", border: "0.5px solid #e8e8ec", padding: "7px 12px 7px 30px", borderRadius: 7, fontFamily: FONT, fontSize: 12, width: "100%", outline: "none", color: "#111827" }}
          />
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9ca3af" }}>🔍</span>
        </div>

        {/* Select all */}
        <div onClick={toggleSelectAll} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px 10px", borderRadius: 20, border: `1px solid ${selected.size > 0 ? "rgba(26,58,110,0.3)" : "#e8e8ec"}`, background: selected.size > 0 ? "rgba(26,58,110,0.06)" : "transparent" }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, border: `1.5px solid ${selected.size > 0 ? "#1a3a6e" : "#d1d5db"}`, background: selected.size === normed.length && normed.length > 0 ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {selected.size === normed.length && normed.length > 0 && <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>✓</span>}
            {selected.size > 0 && selected.size < normed.length && <span style={{ color: "#1a3a6e", fontSize: 8 }}>—</span>}
          </div>
          <span style={{ fontSize: 11, color: selected.size > 0 ? "#1a3a6e" : "#6b7280", fontWeight: 600 }}>
            {selected.size > 0 ? `${selected.size} selected` : "Select all"}
          </span>
        </div>

        <div style={{ width: 1, height: 16, background: "#e8e8ec", flexShrink: 0 }} />

        {/* Status filters */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {["All", ...Object.keys(STATUS_STYLES)].map(s => {
            const st = s !== "All" ? STATUS_STYLES[s] : null;
            const active = filterStatus === s;
            return (
              <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? (st?.dot || "#1a3a6e") : "#e8e8ec"}`, background: active ? (st?.bg || "rgba(26,58,110,0.1)") : "transparent", color: active ? (st?.color || "#1a3a6e") : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
                {st && <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot }} />}{s}
              </button>
            );
          })}
        </div>

        {/* Platform filters */}
        {allPlatforms.length > 0 && (
          <>
            <div style={{ width: 1, height: 16, background: "#e8e8ec", flexShrink: 0 }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {["All", ...allPlatforms].map(p => {
                const active = filterPlatform === p;
                const color = PLATFORM_COLORS[p] || PLATFORM_COLORS.Default;
                return (
                  <button key={p} onClick={() => setFilterPlatform(p)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? color : "#e8e8ec"}`, background: active ? `${color}14` : "transparent", color: active ? color : "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    {p}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ ...card, overflow: "hidden" }}>

        {/* Column headers — matches Inventory typography exactly */}
        <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 0, padding: "9px 18px", borderBottom: "1px solid #f0f0f3", background: "#fafafa" }}>
          {["", "", "Event", "Platform", "Qty", "Revenue", "Fees", "Profit", "Status", ""].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#9ca3af" }}>{h}</div>
          ))}
        </div>

        {/* Empty states */}
        {sales.length === 0 ? (
          <div style={{ padding: "56px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💸</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>No sales yet</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Record your first sale to start tracking P&L</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => setShowAddSale(true)}>Record First Sale</button>
          </div>
        ) : eventGroups.length === 0 ? (
          <div style={{ padding: "48px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>No results</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>Try adjusting your filters</div>
            <button className="ghost-btn" style={{ marginTop: 12 }} onClick={() => { setSearchQ(""); setFilterStatus("All"); setFilterPlatform("All"); }}>Clear filters</button>
          </div>
        ) : eventGroups.map((group, gi) => {
          const isExpanded   = expandedEvents[group.eventName];
          const groupProfit  = group.revenue - group.fees - group.cost;
          const groupROI     = group.cost > 0 ? (groupProfit / group.cost) * 100 : 0;
          const qtySold      = group.sales.reduce((a, s) => a + s.qtySold, 0);
          const accent       = group.category === "Sport" ? "#1a3a6e" : "#7c3aed";
          const platforms    = [...new Set(group.sales.map(s => s.platform).filter(Boolean))];
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
            <div key={group.eventName} style={{ borderBottom: gi < eventGroups.length - 1 ? "0.5px solid #f0f0f3" : "none" }}>

              {/* ── Event group row — matches Inventory event row ── */}
              <div
                onClick={() => setExpandedEvents(s => ({ ...s, [group.eventName]: !s[group.eventName] }))}
                style={{ display: "grid", gridTemplateColumns: GRID, gap: 0, padding: "12px 18px", alignItems: "center", cursor: "pointer", background: isExpanded ? "#fafafa" : "white", borderLeft: `3px solid ${accent}`, transition: "background 0.1s" }}
                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#fafafa"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isExpanded ? "#fafafa" : "white"; }}
              >
                {/* Group checkbox — navy to match Inventory */}
                <div onClick={toggleGroup} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 15, height: 15, borderRadius: 4, border: `1.5px solid ${someGroupSel ? "#1a3a6e" : "#d1d5db"}`, background: allGroupSel ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    {allGroupSel  && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
                    {!allGroupSel && someGroupSel && <span style={{ color: "#1a3a6e", fontSize: 9 }}>—</span>}
                  </div>
                </div>

                {/* Chevron — CSS rotation, same as Inventory */}
                <div style={{ fontSize: 12, color: "#9ca3af", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", textAlign: "center" }}>›</div>

                {/* Category icon + event name — matches Inventory event row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: group.category === "Sport" ? "rgba(26,58,110,0.08)" : "rgba(124,58,237,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                    {group.category === "Sport" ? "⚽" : "🎵"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.eventName}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{group.sales.length} sale{group.sales.length !== 1 ? "s" : ""}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{qtySold}×</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{fmt(group.revenue)}</div>
                <div style={{ fontSize: 12, color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>{group.fees > 0 ? fmt(group.fees) : "—"}</div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: groupProfit >= 0 ? "#059669" : "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                    {groupProfit >= 0 ? "+" : ""}{fmt(groupProfit)}
                  </div>
                  <div style={{ fontSize: 10, color: groupROI >= 0 ? "#059669" : "#ef4444", marginTop: 1 }}>{fmtPct(groupROI)} ROI</div>
                </div>

                <div /><div />
              </div>

              {/* ── Individual sale rows — matches Inventory order rows ── */}
              {isExpanded && group.sales.map((s, si) => {
                const ticket     = tickets.find(t => t.id === s.ticketId);
                const sProfit    = (s.salePrice * s.qtySold) - s.fees - (s.costPer * s.qtySold);
                const isSelected = selected.has(s.id);

                return (
                  <div key={s.id}
                    style={{ display: "grid", gridTemplateColumns: GRID, gap: 0, padding: "9px 18px", alignItems: "center", borderTop: "0.5px solid #f0f0f3", background: isSelected ? "rgba(26,58,110,0.03)" : si % 2 === 0 ? "#f9f9fb" : "#f7f8fa", transition: "background 0.1s" }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f4f4f6"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(26,58,110,0.03)" : si % 2 === 0 ? "#f9f9fb" : "#f7f8fa"; }}
                  >
                    {/* Row checkbox */}
                    <div onClick={e => toggleSelect(s.id, e)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${isSelected ? "#1a3a6e" : "#d1d5db"}`, background: isSelected ? "#1a3a6e" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        {isSelected && <span style={{ color: "white", fontSize: 8, fontWeight: 700 }}>✓</span>}
                      </div>
                    </div>

                    {/* Indent line */}
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <div style={{ width: 2, height: 22, background: "#e2e6ea", borderRadius: 2 }} />
                    </div>

                    {/* Seat chips + date/notes */}
                    <div style={{ paddingLeft: 4 }}>
                      <SeatChips sale={s} ticket={ticket} />
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>
                        {s.date}{s.notes ? ` · ${s.notes}` : ""}
                      </div>
                    </div>

                    <div><PlatformBadge platform={s.platform} /></div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{s.qtySold}×</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", fontVariantNumeric: "tabular-nums" }}>{fmt(s.salePrice * s.qtySold)}</div>
                    <div style={{ fontSize: 12, color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>{s.fees > 0 ? fmt(s.fees) : "—"}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: sProfit >= 0 ? "#059669" : "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                      {sProfit >= 0 ? "+" : ""}{fmt(sProfit)}
                    </div>

                    <StatusPill status={s.saleStatus} onChange={v => updateSaleStatus(s.id, v)} />

                    <button
                      onClick={e => deleteSale(s.id, e)}
                      title="Delete sale"
                      style={{ background: "transparent", color: "#d1d5db", border: "none", cursor: "pointer", padding: "4px", borderRadius: 5, fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#d1d5db"; e.currentTarget.style.background = "transparent"; }}
                    >✕</button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}