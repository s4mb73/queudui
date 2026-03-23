import { useState } from "react";
import { Modal, Field, Input, Select } from "../ui";
import { fmt, fmtPct, PLATFORMS } from "../../utils/format";

export function RecordSaleModal({ sf, setSf, tickets, setShowAddSale, saveSale }) {
  const [selectedEvent, setSelectedEvent]     = useState("");
  const [selectedDate, setSelectedDate]       = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedTicketIds, setSelectedTicketIds] = useState([]);

  const avail = (t) => (t.qtyAvailable ?? t.qty) > 0 && !["Sold","Delivered","Completed"].includes(t.status);

  const availableEvents = [...new Set(tickets.filter(avail).map(t => t.event))].sort();

  const datesForEvent = selectedEvent
    ? [...new Set(tickets.filter(t => t.event === selectedEvent && avail(t)).map(t => t.date || "No date"))].sort()
    : [];

  const sectionsForDate = selectedEvent && selectedDate
    ? [...new Set(tickets.filter(t => t.event === selectedEvent && (t.date || "No date") === selectedDate && avail(t)).map(t => t.section || "General"))].sort()
    : [];

  const ticketsForSection = selectedEvent && selectedDate && selectedSection
    ? tickets.filter(t =>
        t.event === selectedEvent &&
        (t.date || "No date") === selectedDate &&
        (t.section || "General") === selectedSection &&
        avail(t)
      ).sort((a, b) => (parseInt(a.seats) || 0) - (parseInt(b.seats) || 0))
    : [];

  const toggleTicket = (id) => {
    setSelectedTicketIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAllInSection = () => {
    const ids = ticketsForSection.map(t => t.id);
    const allSelected = ids.every(id => selectedTicketIds.includes(id));
    setSelectedTicketIds(allSelected ? [] : ids);
  };

  const selectedTickets   = selectedTicketIds.map(id => tickets.find(t => t.id === id)).filter(Boolean);
  const totalCostBasis    = selectedTickets.reduce((a, t) => a + (t.cost || 0), 0);
  const isStandingSec     = selectedSection && /standing|pitch|floor|general admission/i.test(selectedSection);

  const fmtDate = (d) => {
    if (!d || d === "No date") return d;
    const m = d.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
    if (m) return `${parseInt(m[1])} ${m[2]} ${m[3]}`;
    return d;
  };

  const handleEventChange = (event) => {
    setSelectedEvent(event); setSelectedDate(""); setSelectedSection(""); setSelectedTicketIds([]);
    const dates = [...new Set(tickets.filter(t => t.event === event && avail(t)).map(t => t.date || "No date"))];
    if (dates.length === 1) setSelectedDate(dates[0]);
  };

  const handleDateChange = (date) => {
    setSelectedDate(date); setSelectedSection(""); setSelectedTicketIds([]);
    const sections = [...new Set(tickets.filter(t => t.event === selectedEvent && (t.date || "No date") === date && avail(t)).map(t => t.section || "General"))];
    if (sections.length === 1) setSelectedSection(sections[0]);
  };

  const handleSectionChange = (section) => { setSelectedSection(section); setSelectedTicketIds([]); };

  return (
    <Modal title="Record a Sale" onClose={() => setShowAddSale(false)}>
      <div style={{ display: "grid", gap: 16 }}>

        {/* Step 1: Event */}
        <Field label="1. Event *">
          <Select value={selectedEvent} onChange={handleEventChange}>
            <option value="">Select event…</option>
            {availableEvents.map(e => {
              const count = tickets.filter(t => t.event === e && avail(t)).length;
              return <option key={e} value={e}>{e} ({count} available)</option>;
            })}
          </Select>
        </Field>

        {/* Step 2: Date chips */}
        {selectedEvent && datesForEvent.length > 1 && (
          <Field label="2. Date">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {datesForEvent.map(d => {
                const isSelected = selectedDate === d;
                const count = tickets.filter(t => t.event === selectedEvent && (t.date || "No date") === d && avail(t)).length;
                return (
                  <button key={d} onClick={() => handleDateChange(d)}
                    style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s", border: isSelected ? "none" : "0.5px solid #e5e7eb", background: isSelected ? "#1a3a6e" : "#f8fafc", color: isSelected ? "white" : "#374151" }}>
                    {fmtDate(d)} <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {/* Step 3: Section chips */}
        {selectedEvent && selectedDate && sectionsForDate.length > 0 && (
          <Field label={datesForEvent.length > 1 ? "3. Section" : "2. Section"}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {sectionsForDate.map(sec => {
                const isStanding = /standing|pitch|floor|general admission/i.test(sec);
                const count = tickets.filter(t => t.event === selectedEvent && (t.date || "No date") === selectedDate && (t.section || "General") === sec && avail(t)).length;
                const isSelected = selectedSection === sec;
                return (
                  <button key={sec} onClick={() => handleSectionChange(sec)}
                    style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.15s", border: isSelected ? "none" : "0.5px solid #e5e7eb", background: isSelected ? (isStanding ? "#0f766e" : "#1a3a6e") : (isStanding ? "#f0fdfa" : "#eef2ff"), color: isSelected ? "white" : (isStanding ? "#0f766e" : "#1a3a6e") }}>
                    {isStanding ? sec : `Sec ${sec}`}
                    <span style={{ marginLeft: 5, fontSize: 10, opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </Field>
        )}

        {/* Step 4: Seat multi-select */}
        {selectedSection && ticketsForSection.length > 0 && (
          <Field label={isStandingSec ? (datesForEvent.length > 1 ? "4. Ticket" : "3. Ticket") : (datesForEvent.length > 1 ? "4. Seats" : "3. Seats")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 6 }}>
              {ticketsForSection.length > 1 && (
                <button onClick={selectAllInSection}
                  style={{ padding: "7px 14px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", border: "0.5px solid #e5e7eb", background: ticketsForSection.every(t => selectedTicketIds.includes(t.id)) ? "#111827" : "#f8fafc", color: ticketsForSection.every(t => selectedTicketIds.includes(t.id)) ? "white" : "#6b7280" }}>
                  {ticketsForSection.every(t => selectedTicketIds.includes(t.id)) ? "✓ All selected" : `Select all (${ticketsForSection.length})`}
                </button>
              )}
              {ticketsForSection.map(t => {
                const isSelected = selectedTicketIds.includes(t.id);
                const label = isStandingSec ? `#${t.seats || "—"}` : t.row ? `Row ${t.row} · Seat ${t.seats}` : `Seat ${t.seats || "—"}`;
                return (
                  <button key={t.id} onClick={() => toggleTicket(t.id)}
                    style={{ padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif", border: isSelected ? "none" : "0.5px solid #e5e7eb", background: isSelected ? "#f97316" : "white", color: isSelected ? "white" : "#374151" }}>
                    {isSelected && <span style={{ marginRight: 4, fontSize: 10 }}>✓</span>}
                    {label}
                    <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.65 }}>{fmt(t.cost || 0)}</span>
                  </button>
                );
              })}
            </div>
            {selectedTicketIds.length > 1 && (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                {selectedTicketIds.length} tickets selected · total cost basis <b style={{ color: "#0f172a" }}>{fmt(totalCostBasis)}</b>
              </div>
            )}
          </Field>
        )}

        {/* Cost basis banner */}
        {selectedTicketIds.length > 0 && (
          <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#94a3b8", display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>Cost basis: <b style={{ color: "#0f172a" }}>{fmt(totalCostBasis)}</b>{selectedTicketIds.length > 1 ? ` (${selectedTicketIds.length} tickets)` : ""}</span>
            {selectedTickets[0]?.orderRef && <span style={{ color: "#c2410c", fontFamily: "monospace", fontSize: 11 }}>#{selectedTickets[0].orderRef}</span>}
          </div>
        )}

        {/* Price & platform */}
        {selectedTicketIds.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Sale Price (£) — total *">
                <Input value={sf.salePrice} onChange={v => setSf(f => ({ ...f, salePrice: v }))} type="number" step="0.01" placeholder="0.00" />
              </Field>
              <Field label="Selling Platform">
                <Select value={sf.sellingPlatform} onChange={v => setSf(f => ({ ...f, sellingPlatform: v }))}>
                  {PLATFORMS.map(p => <option key={p}>{p}</option>)}
                </Select>
              </Field>
            </div>

            {/* Live P&L preview */}
            {sf.salePrice && (() => {
              const qty    = selectedTicketIds.length;
              const total  = parseFloat(sf.salePrice) || 0;
              const profit = total - totalCostBasis;
              const roi    = totalCostBasis > 0 ? (profit / totalCostBasis) * 100 : 0;
              return (
                <div style={{ background: profit >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${profit >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#64748b", marginBottom: 12, textTransform: "uppercase" }}>
                    Projected P&L{qty > 1 ? ` · ${qty} tickets` : ""}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      ["NET PROFIT", profit >= 0 ? "+" : "", fmt(profit), profit >= 0 ? "#10b981" : "#ef4444"],
                      ["REVENUE",    "",                    fmt(total),   "#f97316"],
                      ["ROI",        "",                    fmtPct(roi),  roi >= 0 ? "#10b981" : "#ef4444"],
                    ].map(([label, pre, val, color]) => (
                      <div key={label} style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 4, letterSpacing: "0.5px" }}>{label}</div>
                        <div style={{ fontWeight: 700, fontSize: 22, color }}>{pre}{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Sale Date">
                <Input value={sf.date} onChange={v => setSf(f => ({ ...f, date: v }))} type="date" />
              </Field>
              <Field label="Notes">
                <Input value={sf.notes} onChange={v => setSf(f => ({ ...f, notes: v }))} placeholder="Optional" />
              </Field>
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button className="action-btn" onClick={() => saveSale(selectedTicketIds)} disabled={selectedTicketIds.length === 0 || !sf.salePrice}>
            Record Sale{selectedTicketIds.length > 1 ? ` (${selectedTicketIds.length} tickets)` : ""}
          </button>
          <button className="ghost-btn" onClick={() => setShowAddSale(false)}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}