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

  const stockGroups = {};
  tickets.filter(t => (t.qtyAvailable ?? t.qty) > 0).forEach(t => {
    const key = t.event + "||" + (t.date || "");
    if (!stockGroups[key]) stockGroups[key] = { event: t.event, date: t.date, venue: t.venue, category: t.category, totalAvail: 0, totalQty: 0 };
    stockGroups[key].totalAvail += (t.qtyAvailable ?? t.qty);
    stockGroups[key].totalQty += t.qty;
  });

  const kpis = [
    { label: "Total Invested", value: fmt(totalInvested), color: "#1a3a6e" },
    { label: "Total Revenue",  value: fmt(totalRevenue),  color: "#f97316" },
    { label: "Net Profit",     value: fmt(totalProfit),   color: totalProfit >= 0 ? "#059669" : "#ef4444" },
    { label: "Overall ROI",    value: fmtPct(roi),        color: roi >= 0 ? "#059669" : "#ef4444" },
    { label: "In Stock",       value: stockCount,         color: "#f97316", sub: tickets.length + " events" },
    { label: "Total Sold",     value: soldCount,          color: "#7c3aed", sub: sales.length + " transactions" },
  ];

  const card = { background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.5px" }}>Dashboard</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Overview of your ticket portfolio</div>
        </div>
        <button className="action-btn" onClick={() => { setEditingTicket(null); setTf(blankTicket); setShowAddTicket(true); }}>+ Add Tickets</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 18 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: k.color, borderRadius: "12px 12px 0 0" }} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 20, color: k.color, lineHeight: 1, letterSpacing: "-0.5px" }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e2e6ea" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", letterSpacing: "-0.2px" }}>Top Events by Profit</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>All time performance</div>
          </div>
          <div style={{ padding: "12px 18px" }}>
            {topEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>No sales recorded yet</div>
            ) : topEvents.map((entry, i) => (
              <div key={entry[0]} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < topEvents.length - 1 ? "0.5px solid #f1f4f8" : "none" }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? "rgba(249,115,22,0.1)" : "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "#f97316" : "#94a3b8", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry[0]}</div>
                  <div style={{ background: "#f1f4f8", borderRadius: 4, height: 4, marginTop: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: (Math.abs(entry[1]) / maxBar * 100) + "%", background: entry[1] >= 0 ? "#f97316" : "#ef4444", borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: entry[1] >= 0 ? "#059669" : "#ef4444", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{entry[1] >= 0 ? "+" : ""}{fmt(entry[1])}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e2e6ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", letterSpacing: "-0.2px" }}>Recent Sales</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Latest transactions</div>
            </div>
            {sales.length > 0 && <button className="ghost-btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setView("sales")}>View all</button>}
          </div>
          <div>
            {sales.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>No sales recorded yet</div>
            ) : sales.slice().reverse().slice(0, 7).map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: "0.5px solid #f1f4f8" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{s.eventName}</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.platform} · {s.qtySold}x · {s.date}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.profit >= 0 ? "#059669" : "#ef4444", fontVariantNumeric: "tabular-nums" }}>{s.profit >= 0 ? "+" : ""}{fmt(s.profit)}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>{fmt(s.salePrice)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e2e6ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", letterSpacing: "-0.2px" }}>Current Stock</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{Object.keys(stockGroups).length} events · {stockCount} tickets available</div>
          </div>
          <button className="ghost-btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setView("inventory")}>View inventory</button>
        </div>
        {Object.keys(stockGroups).length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>No tickets in stock</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {Object.entries(stockGroups).slice(0, 9).map(([key, group]) => {
              const venueClean = (group.venue || "").replace(/\s*[—–-]\s*.+$/, "").replace(/,.*$/, "").trim();
              const fmtD = (d) => {
                if (!d) return "";
                const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (m) { const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return parseInt(m[3]) + " " + months[parseInt(m[2])-1] + " " + m[1]; }
                return d;
              };
              return (
                <div key={key} style={{ padding: "13px 18px", borderRight: "0.5px solid #f1f4f8", borderBottom: "0.5px solid #f1f4f8", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: group.category === "Sport" ? "rgba(26,58,110,0.08)" : "rgba(124,58,237,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                    {group.category === "Sport" ? "⚽" : "🎵"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.event}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtD(group.date)}{venueClean ? " · " + venueClean : ""}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#f97316", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{group.totalAvail}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>tickets</div>
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