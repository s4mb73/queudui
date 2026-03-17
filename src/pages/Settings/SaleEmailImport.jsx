import { useState } from "react";

function SaleTicketPicker({ tickets, allTickets, parsedSale, onRecord, fmt }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchSec, setSearchSec] = useState("");
  const pool = tickets.length > 0 ? tickets : allTickets.filter(t =>
    !["Sold","Delivered","Completed"].includes(t.status) &&
    (!searchSec || (t.section || "").toLowerCase().includes(searchSec.toLowerCase()) ||
     (t.event || "").toLowerCase().includes(searchSec.toLowerCase()))
  ).slice(0, 30);
  const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  if (!parsedSale) return null;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tickets.length === 0 && (
        <div>
          <div style={{ fontSize: 12, color: "#f97316", fontWeight: 600, marginBottom: 6 }}>⚠ No automatic matches found — search manually:</div>
          <input value={searchSec} onChange={e => setSearchSec(e.target.value)} placeholder="Search by event or section…"
            style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", padding: "7px 10px", borderRadius: 7, fontSize: 12, width: "100%", outline: "none", fontFamily: "Inter, sans-serif" }} />
        </div>
      )}
      {pool.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>
            {tickets.length > 0 ? `${pool.length} matching ticket${pool.length !== 1 ? "s" : ""} found` : "Available tickets"} — select the {parsedSale.qty} sold:
          </div>
          <div style={{ border: "0.5px solid #e8e8ec", borderRadius: 7, overflow: "hidden", maxHeight: 240, overflowY: "auto" }}>
            {pool.map((t, i) => {
              const isSelected = selectedIds.includes(t.id);
              return (
                <div key={t.id} onClick={() => toggle(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: i < pool.length - 1 ? "0.5px solid #f5f5f7" : "none", cursor: "pointer", background: isSelected ? "#fff7f0" : "white" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${isSelected ? "#f47b20" : "#e5e7eb"}`, background: isSelected ? "#f47b20" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isSelected && <span style={{ color: "white", fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>
                      {t.section && <span style={{ background: "#eef2ff", color: "#1a3a6e", borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600, marginRight: 5 }}>Sec {t.section}</span>}
                      {t.row && <span style={{ fontSize: 11, color: "#6b7280" }}>Row {t.row} · </span>}
                      <span style={{ fontSize: 11, color: "#6b7280" }}>Seat {t.seats || "—"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{t.event} · cost {fmt(t.costPrice)}</div>
                  </div>
                  {isSelected && <span style={{ fontSize: 10, fontWeight: 600, color: "#f47b20" }}>Selected</span>}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => onRecord(selectedIds)} disabled={selectedIds.length === 0}
              style={{ background: selectedIds.length === 0 ? "#e5e7eb" : "#16a34a", color: "white", border: "none", borderRadius: 7, padding: "9px 18px", fontSize: 12, fontWeight: 600, cursor: selectedIds.length === 0 ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif" }}>
              Record Sale{selectedIds.length > 0 ? ` (${selectedIds.length} ticket${selectedIds.length > 1 ? "s" : ""} · £${(parsedSale.priceEach * selectedIds.length).toFixed(2)})` : ""}
            </button>
            {selectedIds.length !== parsedSale.qty && selectedIds.length > 0 && (
              <span style={{ fontSize: 11, color: "#f59e0b" }}>⚠ {parsedSale.qty} expected, {selectedIds.length} selected</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function SaleEmailImport({ saleEmailText, setSaleEmailText, parsedSale, setParsedSale, saleMatchedTickets, setSaleMatchedTickets, tickets, parseSaleEmail, recordParsedSale, inputStyle, fmt }) {
  return (
    <>
    {/* ── Sale Notification Emails ── */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💰</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Sale Notification Emails</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Paste a Viagogo or Tixstock sale email to auto-record against inventory</div>
            </div>
          </div>
          <div style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
            <textarea value={saleEmailText} onChange={e => { setSaleEmailText(e.target.value); setParsedSale(null); setSaleMatchedTickets([]); }}
              placeholder={"Paste a Viagogo or Tixstock sale confirmation email here…"}
              style={{ ...inputStyle, height: 110, resize: "vertical", lineHeight: 1.7, padding: "12px 14px" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="action-btn" onClick={parseSaleEmail} disabled={!saleEmailText.trim()}>Parse Sale Email</button>
              <button className="ghost-btn" onClick={() => { setSaleEmailText(''); setParsedSale(null); setSaleMatchedTickets([]); }}>Clear</button>
            </div>

            {parsedSale && (
              <div style={{ display: "grid", gap: 12 }}>
                {/* Parsed summary */}
                <div style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{parsedSale.platform} · Order {parsedSale.orderId}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      ["Event", parsedSale.event || "—"],
                      ["Date", parsedSale.date || "—"],
                      ["Venue", parsedSale.venue || "—"],
                      ["Section / Row", [parsedSale.section && `Sec ${parsedSale.section}`, parsedSale.row && `Row ${parsedSale.row}`].filter(Boolean).join(" · ") || "—"],
                      ["Seats", parsedSale.seats || "—"],
                      ["Qty", String(parsedSale.qty)],
                      ["Price each", `£${parsedSale.priceEach.toFixed(2)}`],
                      ["Total proceeds", `£${parsedSale.totalProceeds.toFixed(2)}`],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: "white", padding: "8px 10px", borderRadius: 6, border: "0.5px solid #e8e8ec" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: val === "—" ? "#d1d5db" : "#111827" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ticket picker */}
                <SaleTicketPicker
                  tickets={saleMatchedTickets}
                  allTickets={tickets}
                  parsedSale={parsedSale}
                  onRecord={recordParsedSale}
                  fmt={fmt}
                />
              </div>
            )}
          </div>
        </div>
    </>
  );
}