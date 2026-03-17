export default function DataManagement({ tickets, sales, setTickets, setSales, notify, today }) {
  return (
    <>
    {/* ── Data Management ── */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#f5f3ff", border: "0.5px solid #ddd6fe", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🗄️</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Data Management</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{tickets.length} tickets · {sales.length} sales stored</div>
            </div>
          </div>
          <div style={{ padding: "16px 18px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ghost-btn" onClick={() => {
              const data = { tickets, sales, exportedAt: new Date().toISOString() };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "queud-backup-" + today() + ".json"; a.click();
              URL.revokeObjectURL(url); notify("Backup downloaded");
            }}>⬇ Export JSON</button>
            <button className="ghost-btn" onClick={() => {
              const rows = [
                ["Event","Date","Venue","Section","Row","Seat","Qty","Cost","Category","Order Ref","Restrictions"],
                ...tickets.map(t => [t.event,t.date,t.venue,t.section,t.row,t.seats,t.qty,t.costPrice,t.category,t.orderRef,t.restrictions])
              ];
              const csv = rows.map(r => r.map(c => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "queud-inventory-" + today() + ".csv"; a.click();
              URL.revokeObjectURL(url); notify("CSV downloaded");
            }}>⬇ Export CSV</button>
            <button className="ghost-btn" style={{ color: "#ef4444", borderColor: "#fecaca" }} onClick={() => {
              if (window.confirm("Clear ALL data? This cannot be undone.")) {
                setTickets([]); setSales([]); notify("All data cleared");
              }
            }}>🗑 Clear all data</button>
          </div>
        </div>
    </>
  );
}