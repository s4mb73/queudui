import { fmt, fmtPct } from "../utils/format";

export default function Dashboard({ tickets, sales, setView, setShowAddTicket, setEditingTicket, setTf, blankTicket }) {
  const totalInvested = tickets.reduce((a, t) => a + (t.costPrice || 0), 0);
  const totalRevenue = sales.reduce((a, s) => a + (parseFloat(s.salePrice) * parseInt(s.qtySold)), 0);
  const totalFees = sales.reduce((a, s) => a + (parseFloat(s.fees) || 0), 0);
  const totalCostSold = sales.reduce((a, s) => {
    const t = tickets.find(x => x.id === s.ticketId);
    return t ? a + ((t.costPrice / t.qty) * parseInt(s.qtySold)) : a;
  }, 0);
  const totalProfit = totalRevenue - totalFees - totalCostSold;
  const roi = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  const stockCount = tickets.reduce((a, t) => a + (t.qtyAvailable ?? t.qty), 0);
  const soldCount = sales.reduce((a, s) => a + parseInt(s.qtySold), 0);
  const salesByEvent = sales.reduce((acc, s) => { acc[s.eventName] = (acc[s.eventName] || 0) + s.profit; return acc; }, {});
  const topEvents = Object.entries(salesByEvent).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxBar = Math.max(...topEvents.map(e => Math.abs(e[1])), 1);

  // Group available stock by event + date
  const stockGroups = {};
  tickets.filter(t => (t.qtyAvailable ?? t.qty) > 0).forEach(t => {
    const key = t.event + "||" + (t.date || "");
    if (!stockGroups[key]) stockGroups[key] = { event: t.event, date: t.date, venue: t.venue, category: t.category, totalAvail: 0, totalQty: 0 };
    stockGroups[key].totalAvail += (t.qtyAvailable ?? t.qty);
    stockGroups[key].totalQty += t.qty;
  });

  const kpis = [
    { label: "Total Invested", value: fmt(totalInvested), color: "#64748b" },
    { label: "Total Revenue", value: fmt(totalRevenue), color: "#f97316" },
    { label: "Net Profit", value: fmt(totalProfit), color: totalProfit >= 0 ? "#16a34a" : "#dc2626" },
    { label: "Overall ROI", value: fmtPct(roi), color: roi >= 0 ? "#16a34a" : "#dc2626" },
    { label: "In Stock", value: stockCount, color: "#f97316", sub: tickets.length + " events" },
    { label: "Total Sold", value: soldCount, color: "#7c3aed", sub: sales.length + " transactions" },
  ];

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 26, color: "#111827", lineHeight: 1 }}>Dashboard</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Overview of your ticket portfolio</div>
        </div>
        <button className="action-btn" onClick={() => { setEditingTicket(null); setTf(blankTicket); setShowAddTicket(true); }}>+ Add Tickets</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 24 }}>
        {kpis.map(function(k) { return (
          <div key={k.label} style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.color, borderRadius: "12px 12px 0 0" }} />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color: k.color, lineHeight: 1 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 10, color: "#6b7280", marginTop: 5 }}>{k.sub}</div>}
          </div>
        ); })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Top Events by Profit</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>All time performance</div>
          </div>
          <div style={{ padding: "16px 20px" }}>
            {topEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#6b7280", fontSize: 13 }}>No sales recorded yet</div>
            ) : topEvents.map(function(entry, i) {
              var name = entry[0]; var profit = entry[1];
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < topEvents.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? "#fff7ed" : "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: i === 0 ? "var(--orange)" : "var(--muted)", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                    <div style={{ background: "#fafafa", borderRadius: 4, height: 5, marginTop: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: (Math.abs(profit) / maxBar * 100) + "%", background: profit >= 0 ? "var(--orange)" : "var(--red)", borderRadius: 4 }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: profit >= 0 ? "#16a34a" : "#dc2626", flexShrink: 0 }}>{profit >= 0 ? "+" : ""}{fmt(profit)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Recent Sales</div>
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Latest transactions</div>
            </div>
            {sales.length > 0 && <button className="ghost-btn" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setView("sales")}>View all</button>}
          </div>
          <div>
            {sales.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#6b7280", fontSize: 13 }}>No sales recorded yet</div>
            ) : sales.slice().reverse().slice(0, 7).map(function(s) { return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px", borderBottom: "1px solid #f8fafc" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{s.eventName}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{s.platform} · {s.qtySold}x · {s.date}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: s.profit >= 0 ? "#16a34a" : "#dc2626" }}>{s.profit >= 0 ? "+" : ""}{fmt(s.profit)}</div>
                  <div style={{ fontSize: 10, color: "#6b7280" }}>{fmt(s.salePrice)}</div>
                </div>
              </div>
            ); })}
          </div>
        </div>
      </div>

      <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>Current Stock</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{Object.keys(stockGroups).length} events · {stockCount} tickets available</div>
          </div>
          <button className="ghost-btn" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => setView("inventory")}>View inventory</button>
        </div>
        {Object.keys(stockGroups).length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#6b7280", fontSize: 13 }}>No tickets in stock</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {Object.entries(stockGroups).slice(0, 9).map(function(entry) {
              var key = entry[0]; var group = entry[1];
              var venueClean = (group.venue || "").replace(/\s*[—–-]\s*.+$/, "").replace(/,.*$/, "").trim();
              var fmtD = function(d) {
                if (!d) return "";
                var m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (m) { var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return parseInt(m[3]) + " " + months[parseInt(m[2])-1] + " " + m[1]; }
                return d;
              };
              return (
                <div key={key} style={{ padding: "14px 20px", borderRight: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: group.category === "Sport" ? "#eff6ff" : "#fdf4ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {group.category === "Sport" ? "⚽" : "🎵"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.event}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtD(group.date)}{venueClean ? " · " + venueClean : ""}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--orange)", lineHeight: 1 }}>{group.totalAvail}</div>
                    <div style={{ fontSize: 9, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>tickets</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}