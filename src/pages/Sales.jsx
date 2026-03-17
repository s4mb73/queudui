import { useState, useMemo } from "react";
import { Badge } from "../components/ui";
import { fmt, fmtPct } from "../utils/format";

const FONT = "Inter, sans-serif";
const card = { background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };

const STATUS_STYLES = {
  Pending:   { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  Paid:      { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  Delivered: { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  Cancelled: { bg: "#f9fafb", color: "#6b7280", border: "#e5e7eb" },
};

function StatusPill({ status, onChange }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.Pending;
  const statuses = Object.keys(STATUS_STYLES);
  return (
    <select
      value={status || "Pending"}
      onChange={e => { e.stopPropagation(); onChange(e.target.value); }}
      onClick={e => e.stopPropagation()}
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 5, padding: "3px 7px", fontSize: 11, fontWeight: 600, fontFamily: FONT, cursor: "pointer", outline: "none" }}
    >
      {statuses.map(st => <option key={st} value={st}>{st}</option>)}
    </select>
  );
}

export default function Sales({ tickets, sales, setSales, setShowAddSale }) {
  const [expandedEvents, setExpandedEvents] = useState({});
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPlatform, setFilterPlatform] = useState("All");

  // ── Aggregate KPIs ──────────────────────────────────────────────────────────
  const totalRevenue = sales.reduce((a, s) => a + (s.salePrice * s.qtySold), 0);
  const totalFees    = sales.reduce((a, s) => a + (s.fees || 0), 0);
  const totalCost    = sales.reduce((a, s) => a + (s.costPer * s.qtySold), 0);
  const totalProfit  = totalRevenue - totalFees - totalCost;
  const totalROI     = totalCost > 0 ? ((totalProfit / totalCost) * 100) : 0;

  // ── Group sales by event ────────────────────────────────────────────────────
  const eventGroups = useMemo(() => {
    const filtered = sales.filter(s => {
      if (filterStatus !== "All" && (s.saleStatus || "Pending") !== filterStatus) return false;
      if (filterPlatform !== "All" && s.platform !== filterPlatform) return false;
      return true;
    });
    const groups = {};
    filtered.forEach(s => {
      const key = s.eventName || "Unknown Event";
      if (!groups[key]) groups[key] = { eventName: key, category: s.category, sales: [], revenue: 0, fees: 0, cost: 0 };
      groups[key].sales.push(s);
      groups[key].revenue += s.salePrice * s.qtySold;
      groups[key].fees    += s.fees || 0;
      groups[key].cost    += s.costPer * s.qtySold;
    });
    return Object.values(groups).sort((a, b) => b.revenue - a.revenue);
  }, [sales, filterStatus, filterPlatform]);

  const allPlatforms = [...new Set(sales.map(s => s.platform).filter(Boolean))];

  const updateSaleStatus = (saleId, newStatus) => {
    setSales(prev => prev.map(s => s.id === saleId ? { ...s, saleStatus: newStatus } : s));
  };

  return (
    <div className="fade-up" style={{ fontFamily: FONT }}>

      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 26, color: "#111827", lineHeight: 1 }}>Sales</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{sales.length} transaction{sales.length !== 1 ? "s" : ""} recorded</div>
        </div>
        <button className="action-btn" onClick={() => setShowAddSale(true)}>+ Record Sale</button>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Revenue",  value: fmt(totalRevenue),  color: "#f97316" },
          { label: "Platform Fees",  value: fmt(totalFees),     color: "#dc2626" },
          { label: "Net Profit",     value: fmt(totalProfit),   color: totalProfit >= 0 ? "#16a34a" : "#dc2626" },
          { label: "ROI",            value: fmtPct(totalROI),   color: totalROI  >= 0 ? "#16a34a" : "#dc2626" },
          { label: "Avg per Sale",   value: sales.length > 0 ? fmt(totalProfit / sales.length) : "—", color: "#0f172a" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "10px 10px 0 0" }} />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      {sales.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Filter:</span>
          {["All", ...Object.keys(STATUS_STYLES)].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: filterStatus === s ? "none" : "0.5px solid #e5e7eb", background: filterStatus === s ? "#111827" : "white", color: filterStatus === s ? "white" : "#6b7280", fontFamily: FONT }}>
              {s}
            </button>
          ))}
          {allPlatforms.length > 1 && (
            <>
              <div style={{ width: 1, height: 16, background: "#e5e7eb", margin: "0 4px" }} />
              {["All", ...allPlatforms].map(p => (
                <button key={p} onClick={() => setFilterPlatform(p)}
                  style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer", border: filterPlatform === p ? "none" : "0.5px solid #e5e7eb", background: filterPlatform === p ? "#f97316" : "white", color: filterPlatform === p ? "white" : "#6b7280", fontFamily: FONT }}>
                  {p}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Sales table */}
      <div style={{ ...card, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "28px 2fr 90px 70px 80px 80px 80px 110px 20px", gap: 0, padding: "10px 18px", borderBottom: "1px solid #f0f0f3", background: "#fafafa" }}>
          {["", "Event / Ticket", "Section", "Qty", "Revenue", "Fees", "Profit", "Status", ""].map((h, i) => (
            <div key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8" }}>{h}</div>
          ))}
        </div>

        {sales.length === 0 ? (
          <div style={{ padding: 56, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>No sales yet</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Record your first sale to start tracking P&L</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => setShowAddSale(true)}>Record First Sale</button>
          </div>
        ) : eventGroups.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280", fontSize: 13 }}>No sales match the current filters</div>
        ) : eventGroups.map((group, gi) => {
          const isExpanded = expandedEvents[group.eventName];
          const groupProfit = group.revenue - group.fees - group.cost;
          const groupROI = group.cost > 0 ? ((groupProfit / group.cost) * 100) : 0;
          const qtySold = group.sales.reduce((a, s) => a + s.qtySold, 0);

          return (
            <div key={group.eventName} style={{ borderBottom: gi < eventGroups.length - 1 ? "1px solid #f0f0f3" : "none" }}>

              {/* Event row */}
              <div
                onClick={() => setExpandedEvents(s => ({ ...s, [group.eventName]: !s[group.eventName] }))}
                style={{ display: "grid", gridTemplateColumns: "28px 2fr 90px 70px 80px 80px 80px 110px 20px", gap: 0, padding: "11px 18px", alignItems: "center", cursor: "pointer", background: isExpanded ? "#fafafa" : "white", transition: "background 0.1s" }}
                onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#fafafa"; }}
                onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = "white"; }}
              >
                {/* Expand toggle */}
                <div style={{ fontSize: 11, color: "#9ca3af", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s", textAlign: "center" }}>›</div>

                {/* Event name */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{group.eventName}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{group.sales.length} sale{group.sales.length !== 1 ? "s" : ""} · {group.sales.map(s => s.platform).filter((p, i, a) => a.indexOf(p) === i).join(", ")}</div>
                </div>

                {/* Section — blank at event level */}
                <div />

                {/* Qty */}
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{qtySold}×</div>

                {/* Revenue */}
                <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{fmt(group.revenue)}</div>

                {/* Fees */}
                <div style={{ fontSize: 12, color: "#6b7280" }}>{group.fees > 0 ? fmt(group.fees) : "—"}</div>

                {/* Profit */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: groupProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                    {groupProfit >= 0 ? "+" : ""}{fmt(groupProfit)}
                  </div>
                  <div style={{ fontSize: 10, color: groupROI >= 0 ? "#16a34a" : "#dc2626", marginTop: 1 }}>{fmtPct(groupROI)} ROI</div>
                </div>

                {/* Status — blank at event level */}
                <div />
                <div />
              </div>

              {/* Individual sales rows */}
              {isExpanded && group.sales.map((s, si) => {
                const ticket = tickets.find(t => t.id === s.ticketId);
                const sProfit = (s.salePrice * s.qtySold) - (s.fees || 0) - (s.costPer * s.qtySold);
                const saleStatus = s.saleStatus || "Pending";

                return (
                  <div key={s.id}
                    style={{ display: "grid", gridTemplateColumns: "28px 2fr 90px 70px 80px 80px 80px 110px 20px", gap: 0, padding: "10px 18px 10px 46px", alignItems: "center", background: si % 2 === 0 ? "#fafbfc" : "#f7f8fa", borderTop: "0.5px solid #f0f0f3" }}>

                    {/* Indent marker */}
                    <div style={{ width: 2, height: 28, background: "#e5e7eb", borderRadius: 2, margin: "0 auto" }} />

                    {/* Ticket detail */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
                        {ticket ? (
                          <>
                            {ticket.section && <span style={{ background: /standing|pitch|floor|ga/i.test(ticket.section) ? "#f0fdfa" : "#eef2ff", color: /standing|pitch|floor|ga/i.test(ticket.section) ? "#0f766e" : "#1a3a6e", border: `1px solid ${/standing|pitch|floor|ga/i.test(ticket.section) ? "#99f6e4" : "#c7d2fe"}`, borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600, marginRight: 5 }}>{/standing|pitch|floor|ga/i.test(ticket.section) ? ticket.section : `Sec ${ticket.section}`}</span>}
                            {ticket.row && <span style={{ fontSize: 11, color: "#6b7280" }}>Row {ticket.row} · </span>}
                            {ticket.seats && <span style={{ fontSize: 11, color: "#6b7280" }}>Seat {ticket.seats}</span>}
                          </>
                        ) : <span style={{ color: "#9ca3af", fontSize: 11 }}>Ticket removed</span>}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                        {s.platform} · {s.date}
                        {s.notes && ` · ${s.notes}`}
                      </div>
                    </div>

                    {/* Section */}
                    <div style={{ fontSize: 11, color: "#6b7280" }}>{ticket?.section || "—"}</div>

                    {/* Qty */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{s.qtySold}×</div>

                    {/* Revenue */}
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{fmt(s.salePrice * s.qtySold)}</div>

                    {/* Fees */}
                    <div style={{ fontSize: 12, color: "#6b7280" }}>{s.fees > 0 ? fmt(s.fees) : "—"}</div>

                    {/* Profit */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: sProfit >= 0 ? "#16a34a" : "#dc2626" }}>
                      {sProfit >= 0 ? "+" : ""}{fmt(sProfit)}
                    </div>

                    {/* Status pill */}
                    <StatusPill status={saleStatus} onChange={v => updateSaleStatus(s.id, v)} />

                    {/* spacer */}
                    <div />
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