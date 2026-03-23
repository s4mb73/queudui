// src/components/modals/MatchSaleModal.jsx
import { useState, useMemo } from "react";
import {
  FONT, COLORS, CATEGORIES, BLANK_TICKET,
  PLATFORM_COLORS, TICKET_STATUS_STYLES,
} from "../../lib/schema";

const OVERLAY = {
  position: "fixed", inset: 0,
  background: "rgba(10,14,20,0.45)",
  zIndex: 1000,
  display: "flex", justifyContent: "flex-end",
};

const PANEL = {
  width: 480, maxWidth: "95vw",
  height: "100vh",
  background: "#fff",
  boxShadow: "-4px 0 32px rgba(0,0,0,0.12)",
  display: "flex", flexDirection: "column",
  fontFamily: FONT,
  animation: "slideInRight 0.2s ease",
};

export default function MatchSaleModal({ sale, tickets, onLink, onCreateAndLink, onClose }) {
  const [tab, setTab] = useState("link");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const [form, setForm] = useState({
    ...BLANK_TICKET,
    event:    sale?.eventName || "",
    category: sale?.category  || "Sport",
    date:     sale?.date      || "",
    section:  sale?.section   || "",
    row:      sale?.row       || "",
    seats:    sale?.seats     || "",
    qty:      sale?.qtySold   || 1,
    qtyAvailable: 0,
    status:   "Sold",
  });

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tickets.filter(t => {
      if (!q) return true;
      return (
        (t.event   || "").toLowerCase().includes(q) ||
        (t.section || "").toLowerCase().includes(q) ||
        (t.row     || "").toLowerCase().includes(q) ||
        (t.orderRef|| "").toLowerCase().includes(q)
      );
    });
  }, [tickets, search]);

  const toggleTicket = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleLink = () => {
    if (!selectedIds.length) return;
    onLink?.(sale.id, selectedIds);
  };

  const handleCreate = () => {
    if (!form.event || !form.cost) return;
    onCreateAndLink?.(sale.id, form);
    onClose?.();
  };

  if (!sale) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .msmInput {
          width: 100%; box-sizing: border-box;
          border: 1px solid #e2e6ea; border-radius: 7px;
          padding: 8px 10px; font-size: 13px;
          font-family: ${FONT}; color: #111827;
          outline: none; background: #fff;
          transition: border-color 0.15s;
        }
        .msmInput:focus { border-color: #1a3a6e; }
        .msmTicketRow:hover { background: #f7f8fa !important; }
        .msmTicketRow.selected { background: rgba(26,58,110,0.05) !important; border-color: rgba(26,58,110,0.3) !important; }
      `}</style>

      <div style={OVERLAY} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
        <div style={PANEL}>

          {/* Header */}
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f0f0f3", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Match Sale</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                  Link this sale to an inventory record so cost &amp; profit can be calculated.
                </div>
              </div>
              <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4, borderRadius: 5 }}>✕</button>
            </div>

            <div style={{ marginTop: 12, background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 18 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>{sale.eventName}</div>
                <div style={{ fontSize: 11, color: "#a16207", marginTop: 2 }}>
                  {sale.qtySold}× · {sale.section || "No section"}{sale.date ? ` · ${sale.date}` : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #f0f0f3", flexShrink: 0 }}>
            {[["link", "🔗 Link Existing"], ["create", "➕ Create New"]].map(([key, label]) => (
              <button key={key} onClick={() => setTab(key)} style={{
                flex: 1, padding: "12px 0", border: "none", background: "transparent",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                color: tab === key ? "#1a3a6e" : "#6b7280",
                borderBottom: tab === key ? "2px solid #1a3a6e" : "2px solid transparent",
              }}>{label}</button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px" }}>

            {/* LINK TAB */}
            {tab === "link" && (
              <>
                <input
                  className="msmInput"
                  placeholder="Search by event, section, row, order ref…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                {filtered.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 13 }}>
                    No tickets found{search ? ` for "${search}"` : ""}
                    <div style={{ marginTop: 8 }}>
                      <button onClick={() => setTab("create")} style={{ fontSize: 12, color: "#1a3a6e", background: "none", border: "none", cursor: "pointer", fontFamily: FONT, textDecoration: "underline" }}>
                        Create a new ticket instead
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {filtered.map(t => {
                      const isSelected = selectedIds.includes(t.id);
                      const statusStyle = TICKET_STATUS_STYLES[t.status] || TICKET_STATUS_STYLES.Unsold;
                      return (
                        <div
                          key={t.id}
                          className={`msmTicketRow${isSelected ? " selected" : ""}`}
                          onClick={() => toggleTicket(t.id)}
                          style={{ border: `1px solid ${isSelected ? "rgba(26,58,110,0.3)" : "#e2e6ea"}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", background: isSelected ? "rgba(26,58,110,0.05)" : "#fff" }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.event}</div>
                              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {t.section && <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{t.section}</span>}
                                {t.row     && <span style={{ background: "#f0fdf4", color: "#166534", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>Row {t.row}</span>}
                                {t.seats   && <span style={{ background: "#fff7ed", color: "#c2410c", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{t.seats}</span>}
                                {t.date    && <span>{t.date}</span>}
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginLeft: 8, flexShrink: 0 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, background: statusStyle.bg, color: statusStyle.text, borderRadius: 10, padding: "2px 7px" }}>{t.status}</span>
                              {(t.cost || 0) > 0 && <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>£{(t.cost || 0).toFixed(2)}</span>}
                            </div>
                          </div>
                          {t.orderRef && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Ref: {t.orderRef}</div>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* CREATE TAB */}
            {tab === "create" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 4px" }}>
                  Record the purchase details. The ticket will be saved to inventory and linked to this sale.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 10 }}>
                  <FormRow label="Event *">
                    <input className="msmInput" value={form.event} onChange={e => setField("event", e.target.value)} placeholder="Event name" />
                  </FormRow>
                  <FormRow label="Category">
                    <select className="msmInput" value={form.category} onChange={e => setField("category", e.target.value)}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </FormRow>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 10 }}>
                  <FormRow label="Date">
                    <input className="msmInput" value={form.date} onChange={e => setField("date", e.target.value)} placeholder="2026-03-18" />
                  </FormRow>
                  <FormRow label="Venue">
                    <input className="msmInput" value={form.venue} onChange={e => setField("venue", e.target.value)} placeholder="Venue name" />
                  </FormRow>
                </div>

                <FormRow label="Section">
                  <input className="msmInput" value={form.section} onChange={e => setField("section", e.target.value)} placeholder="e.g. Shortside Lower Tier L15" />
                </FormRow>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <FormRow label="Row">
                    <input className="msmInput" value={form.row} onChange={e => setField("row", e.target.value)} placeholder="e.g. A" />
                  </FormRow>
                  <FormRow label="Seats">
                    <input className="msmInput" value={form.seats} onChange={e => setField("seats", e.target.value)} placeholder="e.g. 12, 13" />
                  </FormRow>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 10 }}>
                  <FormRow label="Qty">
                    <input className="msmInput" type="number" min={1} value={form.qty} onChange={e => setField("qty", parseInt(e.target.value) || 1)} />
                  </FormRow>
                  <FormRow label="Cost per Ticket (£) *">
                    <input className="msmInput" type="number" step="0.01" min={0} value={form.cost || ""} onChange={e => setField("cost", parseFloat(e.target.value) || 0)} placeholder="0.00" />
                  </FormRow>
                </div>

                <FormRow label="Order Ref">
                  <input className="msmInput" value={form.orderRef} onChange={e => setField("orderRef", e.target.value)} placeholder="e.g. 47-53831/UK3" />
                </FormRow>

                {(!form.event || !(form.cost > 0)) && (
                  <div style={{ fontSize: 11, color: "#d97706", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 6, padding: "6px 10px", marginTop: 2 }}>
                    {!form.event ? "Event name is required." : "Enter a cost price greater than £0."}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "14px 24px", borderTop: "1px solid #f0f0f3", display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
            <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 7, border: "1px solid #e2e6ea", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
              Cancel
            </button>
            {tab === "link" ? (
              <button onClick={handleLink} disabled={selectedIds.length === 0}
                style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: selectedIds.length ? "#1a3a6e" : "#e2e6ea", color: selectedIds.length ? "#fff" : "#9ca3af", fontSize: 13, fontWeight: 600, cursor: selectedIds.length ? "pointer" : "not-allowed", fontFamily: FONT }}>
                Link {selectedIds.length > 0 ? `${selectedIds.length} Ticket${selectedIds.length !== 1 ? "s" : ""}` : "Tickets"}
              </button>
            ) : (
              <button onClick={handleCreate} disabled={!form.event || !(form.cost > 0)}
                style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: form.event && form.cost > 0 ? "#1a3a6e" : "#e2e6ea", color: form.event && form.cost > 0 ? "#fff" : "#9ca3af", fontSize: 13, fontWeight: 600, cursor: form.event && form.cost > 0 ? "pointer" : "not-allowed", fontFamily: FONT }}>
                Save &amp; Link
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FormRow({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#374151", marginBottom: 4, fontFamily: "Inter, sans-serif" }}>{label}</label>
      {children}
    </div>
  );
}