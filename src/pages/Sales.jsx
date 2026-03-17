import { useState, useMemo } from "react";
import { KpiCard } from "../components/ui";
import { fmt, fmtPct } from "../utils/format";

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

// ── Normalise a sale record regardless of snake_case (DB) or camelCase (frontend) ──
function normSale(s) {
  return {
    id:          s.id,
    eventName:   s.eventName   || s.event_name  || "Unknown Event",
    category:    s.category    || "Concert",
    platform:    s.platform    || "",
    qtySold:     s.qtySold     ?? s.qty_sold     ?? 1,
    salePrice:   s.salePrice   ?? s.sale_price   ?? 0,
    fees:        s.fees        ?? 0,
    costPer:     s.costPer     ?? s.cost_per     ?? 0,
    profit:      s.profit      ?? ((s.salePrice ?? s.sale_price ?? 0) * (s.qtySold ?? s.qty_sold ?? 1)) - (s.fees ?? 0) - ((s.costPer ?? s.cost_per ?? 0) * (s.qtySold ?? s.qty_sold ?? 1)),
    saleStatus:  s.saleStatus  || s.sale_status  || "Pending",
    date:        s.date        || "",
    notes:       s.notes       || "",
    ticketId:    s.ticketId    || s.ticket_id    || null,
    ticketIds:   s.ticketIds   || s.ticket_ids   || [],
    section:     s.section     || "",
    row:         s.row         || "",
    seats:       s.seats       || "",
  };
}

function StatusPill({ status, onChange }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  return (
    <select
      value={status || "Pending"}
      onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
      onClick={e => e.stopPropagation()}
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, padding: "3px 8px", fontSize: 11, fontWeight: 700, fontFamily: "var(--body)", cursor: "pointer", outline: "none" }}
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

export default function Sales({ tickets, sales, setSales, updateSale, setShowAddSale }) {
  const [expandedEvents, setExpandedEvents] = useState({});
  const [filterStatus, setFilterStatus]     = useState("All");
  const [filterPlatform, setFilterPlatform] = useState("All");
  const [selected, setSelected]             = useState(new Set()); // ids for mass delete

  const normed = useMemo(() => sales.map(normSale), [sales]);

  const totalRevenue = normed.reduce((a, s) => a + (s.salePrice * s.qtySold), 0);
  const totalFees    = normed.reduce((a, s) => a + s.fees, 0);
  const totalCost    = normed.reduce((a, s) => a + (s.costPer * s.qtySold), 0);
  const totalProfit  = totalRevenue - totalFees - totalCost;
  const totalROI     = totalCost > 0 ? ((totalProfit / totalCost) * 100) : 0;
  const totalQty     = normed.reduce((a, s) => a + s.qtySold, 0);

  const eventGroups = useMemo(() => {
    const filtered = normed.filter(s => {
      if (filterStatus !== "All" && s.saleStatus !== filterStatus) return false;
      if (filterPlatform !== "All" && s.platform !== filterPlatform) return false;
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
  }, [normed, filterStatus, filterPlatform]);

  const allPlatforms = [...new Set(normed.map(s => s.platform).filter(Boolean))];

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
    if (selected.size === allIds.length) setSelected(new Set());
    else setSelected(new Set(allIds));
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

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.5px" }}>Sales</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Track revenue, profit and sale status</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {selected.size > 0 && (
            <button onClick={massDelete}
              style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--body)" }}>
              🗑 Delete {selected.size} selected
            </button>
          )}
          <button className="action-btn" onClick={() => setShowAddSale(true)}>+ Record Sale</button>
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 18 }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Filter bar */}
      {sales.length > 0 && (
        <div style={{ background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          {/* Select all checkbox */}
          <div onClick={toggleSelectAll} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "2px 8px", borderRadius: 6, border: "0.5px solid #e2e6ea", background: selected.size > 0 ? "rgba(239,68,68,0.06)" : "#fafafa" }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${selected.size > 0 ? "#ef4444" : "#d1d5db"}`, background: selected.size === normed.length && normed.length > 0 ? "#ef4444" : "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {selected.size === normed.length && normed.length > 0 && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
              {selected.size > 0 && selected.size < normed.length && <span style={{ color: "#ef4444", fontSize: 9, fontWeight: 700 }}>–</span>}
            </div>
            <span style={{ fontSize: 11, color: selected.size > 0 ? "#ef4444" : "#64748b", fontWeight: 500 }}>
              {selected.size > 0 ? `${selected.size} selected` : "Select all"}
            </span>
          </div>

          <div style={{ width: 1, height: 16, background: "#e2e6ea" }} />
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8" }}>Status</span>
          <div style={{ display: "flex", gap: 4 }}>
            {["All", ...Object.keys(STATUS_STYLES)].map(s => {
              const st = s !== "All" ? STATUS_STYLES[s] : null;
              const active = filterStatus === s;
              return (
                <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? (st?.dot || "#1a3a6e") : "#e2e6ea"}`, background: active ? (st?.bg || "rgba(26,58,110,0.1)") : "transparent", color: active ? (st?.color || "#1a3a6e") : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--body)", display: "flex", alignItems: "center", gap: 4 }}>
                  {st && <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot }} />}{s}
                </button>
              );
            })}
          </div>
          {allPlatforms.length > 0 && (
            <>
              <div style={{ width: 1, height: 16, background: "#e2e6ea" }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8" }}>Platform</span>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {["All", ...allPlatforms].map(p => {
                  const active = filterPlatform === p;
                  const color = PLATFORM_COLORS[p] || PLATFORM_COLORS.Default;
                  return (
                    <button key={p} onClick={() => setFilterPlatform(p)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${active ? color : "#e2e6ea"}`, background: active ? `${color}14` : "transparent", color: active ? color : "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "var(--body)" }}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "32px 24px 2fr 1fr 60px 90px 80px 90px 130px 34px", gap: 0, padding: "9px 18px", borderBottom: "0.5px solid #e2e6ea", background: "#fafafa" }}>
          {["", "", "Event", "Platform", "Qty", "Revenue", "Fees", "Profit", "Status", ""].map((h, i) => (
            <div key={i} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8" }}>{h}</div>
          ))}
        </div>

        {sales.length === 0 ? (
          <div style={{ padding: "56px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💸</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>No sales yet</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>Record your first sale to start tracking P&L</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => setShowAddSale(true)}>Record First Sale</button>
          </div>
        ) : eventGroups.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>No sales match the current filters</div>
        ) : eventGroups.map((group, gi) => {
          const isExpanded = expandedEvents[group.eventName];
          const groupProfit = group.revenue - group.fees - group.cost;
          const groupROI = group.cost > 0 ? ((groupProfit / group.cost) * 100) : 0;
          const qtySold = group.sales.reduce((a, s) => a + s.qtySold, 0);
          const accent = group.category === "Sport" ? "#1a3a6e" : "#7c3aed";
          const platforms = [...new Set(group.sales.map(s => s.platform).filter(Boolean))];
          const groupIds = group.sales.map(s => s.id);
          const allGroupSelected = groupIds.every(id => selected.has(id));
          const someGroupSelected = groupIds.some(id => selected.has(id));

          const toggleGroup = (e) => {
            e.stopPropagation();
            setSelected(prev => {
              const n = new Set(prev);
              if (allGroupSelected) groupIds.forEach(id => n.delete(id));
              else groupIds.forEach(id => n.add(id));
              return n;
            });
          };

          return (
            <div key={group.eventName} style={{ borderBottom: gi < eventGroups.length - 1 ? "0.5px solid #f1f4f8" : "none" }}>

              {/* Event group row */}
              <div
                className="hover-row"
                onClick={() => setExpandedEvents(s => ({ ...s, [group.eventName]: !s[group.eventName] }))}
                style={{ display: "grid", gridTemplateColumns: "32px 24px 2fr 1fr 60px 90px 80px 90px 130px 34px", gap: 0, padding: "12px 18px", alignItems: "center", cursor: "pointer", background: isExpanded ? "#fafafa" : "white", borderLeft: `3px solid ${accent}`, transition: "background 0.1s" }}
              >
                {/* Group checkbox */}
                <div onClick={toggleGroup} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${someGroupSelected ? "#ef4444" : "#d1d5db"}`, background: allGroupSelected ? "#ef4444" : "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    {allGroupSelected && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
                    {!allGroupSelected && someGroupSelected && <span style={{ color: "#ef4444", fontSize: 9, fontWeight: 700 }}>–</span>}
                  </div>
                </div>

                <div style={{ fontSize: 12, color: "#94a3b8", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", textAlign: "center" }}>›</div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.eventName}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{group.sales.length} sale{group.sales.length !== 1 ? "s" : ""}</div>
                </div>

                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {platforms.map(p => <PlatformBadge key={p} platform={p} />)}
                </div>

                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{qtySold}×</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{fmt(group.revenue)}</div>
                <div style={{ fontSize: 12, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{group.fees > 0 ? fmt(group.fees) : "—"}</div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: groupProfit >= 0 ? "#059669" : "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                    {groupProfit >= 0 ? "+" : ""}{fmt(groupProfit)}
                  </div>
                  <div style={{ fontSize: 10, color: groupROI >= 0 ? "#059669" : "#ef4444", marginTop: 1 }}>{fmtPct(groupROI)} ROI</div>
                </div>

                <div /><div />
              </div>

              {/* Individual sale rows */}
              {isExpanded && group.sales.map((s, si) => {
                const ticket = tickets.find(t => t.id === s.ticketId);
                const sProfit = (s.salePrice * s.qtySold) - s.fees - (s.costPer * s.qtySold);
                const isStanding = ticket && /standing|pitch|floor|ga/i.test(ticket.section || "");
                const isSelected = selected.has(s.id);

                return (
                  <div key={s.id} style={{ display: "grid", gridTemplateColumns: "32px 24px 2fr 1fr 60px 90px 80px 90px 130px 34px", gap: 0, padding: "10px 18px 10px 18px", alignItems: "center", background: isSelected ? "rgba(239,68,68,0.04)" : si % 2 === 0 ? "#fafafa" : "#f7f8fa", borderTop: "0.5px solid #f1f4f8" }}>

                    {/* Row checkbox */}
                    <div onClick={e => toggleSelect(s.id, e)} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: `1.5px solid ${isSelected ? "#ef4444" : "#d1d5db"}`, background: isSelected ? "#ef4444" : "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                        {isSelected && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
                      </div>
                    </div>

                    <div style={{ width: 2, height: 24, background: "#e2e6ea", borderRadius: 2, margin: "0 auto" }} />

                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                        {s.section || s.row || s.seats ? (
                          <>
                            {s.section && (
                              <span style={{ background: isStanding ? "#f0fdfa" : "#eef2ff", color: isStanding ? "#0f766e" : "#1a3a6e", border: `1px solid ${isStanding ? "#99f6e4" : "#c7d2fe"}`, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600 }}>
                                {isStanding ? s.section : `Sec ${s.section}`}
                              </span>
                            )}
                            {s.row && <span style={{ fontSize: 11, color: "#64748b" }}>Row {s.row}</span>}
                            {s.seats && <span style={{ fontSize: 11, color: "#64748b" }}>· Seat{s.seats.includes(",") ? "s" : ""} {s.seats}</span>}
                            {s.qtySold > 1 && !s.seats && (
                              <span style={{ background: "rgba(249,115,22,0.1)", color: "#f97316", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{s.qtySold}×</span>
                            )}
                          </>
                        ) : ticket ? (
                          <>
                            {ticket.section && (
                              <span style={{ background: isStanding ? "#f0fdfa" : "#eef2ff", color: isStanding ? "#0f766e" : "#1a3a6e", border: `1px solid ${isStanding ? "#99f6e4" : "#c7d2fe"}`, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600 }}>
                                {isStanding ? ticket.section : `Sec ${ticket.section}`}
                              </span>
                            )}
                            {ticket.row && <span style={{ fontSize: 11, color: "#64748b" }}>Row {ticket.row}</span>}
                            {ticket.seats && <span style={{ fontSize: 11, color: "#64748b" }}>· Seat {ticket.seats}</span>}
                          </>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 11 }}>Ticket removed</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                        {s.date}{s.notes ? ` · ${s.notes}` : ""}
                      </div>
                    </div>

                    <div><PlatformBadge platform={s.platform} /></div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{s.qtySold}×</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{fmt(s.salePrice * s.qtySold)}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8", fontVariantNumeric: "tabular-nums" }}>{s.fees > 0 ? fmt(s.fees) : "—"}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: sProfit >= 0 ? "#059669" : "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                      {sProfit >= 0 ? "+" : ""}{fmt(sProfit)}
                    </div>

                    <StatusPill status={s.saleStatus} onChange={v => updateSaleStatus(s.id, v)} />

                    <button
                      onClick={e => deleteSale(s.id, e)}
                      title="Delete sale"
                      style={{ background: "transparent", color: "#d1d9e0", border: "none", cursor: "pointer", padding: "4px", borderRadius: 5, fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.background = "rgba(239,68,68,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#d1d9e0"; e.currentTarget.style.background = "transparent"; }}>
                      ✕
                    </button>
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