import { FONT, STATUS_STYLES } from "./helpers";

export default function InventoryHeader({
  activeStockCount,
  completedStockCount,
  searchQ,
  setSearchQ,
  filterStatus,
  setFilterStatus,
  setEditingTicket,
  setTf,
  blankTicket,
  setShowAddTicket,
}) {
  return (
    <>
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
    </>
  );
}
