import { Badge, StatCard } from "../components/ui";
import { fmt } from "../utils/format";

export default function Sales({ tickets, sales, setShowAddSale }) {
  const totalRevenue = sales.reduce((a, s) => a + (parseFloat(s.salePrice) * parseInt(s.qtySold)), 0);
  const totalFees = sales.reduce((a, s) => a + (parseFloat(s.fees) || 0), 0);
  const totalCostSold = sales.reduce((a, s) => {
    const t = tickets.find(x => x.id === s.ticketId);
    return t ? a + ((t.costPrice / t.qty) * parseInt(s.qtySold)) : a;
  }, 0);
  const totalProfit = totalRevenue - totalFees - totalCostSold;

  return (
    <div className="fade-up">
      {/* Page header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 26, color: "#111827", lineHeight: 1 }}>Sales</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>{sales.length} transactions recorded</div>
        </div>
        <button className="action-btn" onClick={() => setShowAddSale(true)}>+ Record Sale</button>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Revenue", value: fmt(totalRevenue), color: "#f97316" },
          { label: "Fees Paid", value: fmt(totalFees), color: "#dc2626" },
          { label: "Net Profit", value: fmt(totalProfit), color: totalProfit >= 0 ? "#16a34a" : "#dc2626" },
          { label: "Avg per Sale", value: sales.length > 0 ? fmt(totalProfit / sales.length) : "—", color: "#0f172a" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, padding: "16px 18px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "12px 12px 0 0" }} />
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 22, color, lineHeight: 1 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 60px 90px 80px 90px 100px", padding: "10px 20px", borderBottom: "1px solid var(--border)", background: "#fafafa" }}>
          {["Event", "Platform", "Qty", "Revenue", "Fees", "Profit", "Date"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#94a3b8" }}>{h}</div>
          ))}
        </div>
        {sales.length === 0 ? (
          <div style={{ padding: 56, textAlign: "center", color: "#6b7280" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💸</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>No sales yet</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => setShowAddSale(true)}>Record First Sale</button>
          </div>
        ) : sales.slice().reverse().map((s, i) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 60px 90px 80px 90px 100px", padding: "13px 20px", alignItems: "center", borderBottom: i < sales.length - 1 ? "1px solid #f8fafc" : "none", transition: "background 0.1s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
            onMouseLeave={e => e.currentTarget.style.background = "white"}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{s.eventName}</div>
              {s.notes && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{s.notes}</div>}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{s.platform}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{s.qtySold}×</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{fmt(parseFloat(s.salePrice) * parseInt(s.qtySold))}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{s.fees > 0 ? fmt(s.fees) : "—"}</div>
            <Badge type={s.profit >= 0 ? "profit" : "loss"}>{s.profit >= 0 ? "+" : ""}{fmt(s.profit)}</Badge>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{s.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}