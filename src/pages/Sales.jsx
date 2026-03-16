import { Badge } from "../components/ui";
import { fmt } from "../utils/format";

export default function Sales({ tickets, sales, setShowAddSale }) {
  const totalRevenue = sales.reduce((a, s) => a + (parseFloat(s.salePrice) * parseInt(s.qtySold)), 0);
  const totalFees = sales.reduce((a, s) => a + (parseFloat(s.fees) || 0), 0);
  const totalCostSold = sales.reduce((a, s) => {
    const t = tickets.find(x => x.id === s.ticketId);
    return t ? a + ((t.costPrice / t.qty) * parseInt(s.qtySold)) : a;
  }, 0);
  const totalProfit = totalRevenue - totalFees - totalCostSold;
  const card = { background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.5px" }}>Sales</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sales.length} transactions recorded</div>
        </div>
        <button className="action-btn" onClick={() => setShowAddSale(true)}>+ Record Sale</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Total Revenue", value: fmt(totalRevenue), color: "#f97316" },
          { label: "Fees Paid",     value: fmt(totalFees),    color: "#ef4444" },
          { label: "Net Profit",    value: fmt(totalProfit),  color: totalProfit >= 0 ? "#059669" : "#ef4444" },
          { label: "Avg per Sale",  value: sales.length > 0 ? fmt(totalProfit / sales.length) : "—", color: "#0f172a" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ ...card, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: "12px 12px 0 0" }} />
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8", marginBottom: 8 }}>{label}</div>
            <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 20, color, lineHeight: 1, letterSpacing: "-0.5px", fontVariantNumeric: "tabular-nums" }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 60px 90px 80px 90px 100px", padding: "10px 20px", borderBottom: "0.5px solid #e2e6ea", background: "#f7f8fa" }}>
          {["Event", "Platform", "Qty", "Revenue", "Fees", "Profit", "Date"].map(h => (
            <div key={h} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8" }}>{h}</div>
          ))}
        </div>
        {sales.length === 0 ? (
          <div style={{ padding: 56, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>💸</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>No sales yet</div>
            <button className="action-btn" style={{ marginTop: 16 }} onClick={() => setShowAddSale(true)}>Record First Sale</button>
          </div>
        ) : sales.slice().reverse().map((s, i) => (
          <div key={s.id} className="hover-row" style={{ display: "grid", gridTemplateColumns: "2fr 1fr 60px 90px 80px 90px 100px", padding: "13px 20px", alignItems: "center", borderBottom: i < sales.length - 1 ? "0.5px solid #f1f4f8" : "none" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{s.eventName}</div>
              {s.notes && <div style={{ fontSize: 11, color: "#64748b", marginTop: 1 }}>{s.notes}</div>}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{s.platform}</div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", fontVariantNumeric: "tabular-nums" }}>{s.qtySold}×</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{fmt(parseFloat(s.salePrice) * parseInt(s.qtySold))}</div>
            <div style={{ fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{s.fees > 0 ? fmt(s.fees) : "—"}</div>
            <Badge type={s.profit >= 0 ? "profit" : "loss"}>{s.profit >= 0 ? "+" : ""}{fmt(s.profit)}</Badge>
            <div style={{ fontSize: 11, color: "#64748b" }}>{s.date}</div>
          </div>
        ))}
      </div>
    </div>
  );
}