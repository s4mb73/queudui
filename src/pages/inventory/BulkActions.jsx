import { FONT, STATUS_STYLES } from "./helpers";

export default function BulkActions({
  numSelected,
  bulkUpdateStatus,
  exportSelected,
  clearSelection,
  deleteSelected,
}) {
  if (numSelected <= 0) return null;

  return (
    <div style={{ background: "#111827", borderRadius: 8, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "white" }}>{numSelected} selected</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {["Unsold", "Listed", "Sold", "Delivered"].map(s => {
          const st = STATUS_STYLES[s];
          return (
            <button key={s} onClick={() => bulkUpdateStatus(s)}
              style={{ background: st.bg, color: st.text, border: `1px solid ${st.dot}40`, borderRadius: 7, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot }} />{s}
            </button>
          );
        })}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button onClick={exportSelected} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>⬇ Export CSV</button>
        <button onClick={clearSelection} style={{ background: "rgba(255,255,255,0.1)", color: "white", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}>Deselect all</button>
        <button onClick={deleteSelected} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>🗑 Delete {numSelected}</button>
      </div>
    </div>
  );
}
