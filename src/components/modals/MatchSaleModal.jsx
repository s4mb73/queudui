// src/components/modals/MatchSaleModal.jsx
import { useState, useMemo } from "react";
import { fmt } from "../../utils/format";
import { FONT, PLATFORM_COLORS } from "../../lib/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveEventName(sale, tickets) {
  const linked = (sale.ticketIds || []).map(id => tickets.find(t => t.id === id)).filter(Boolean);
  if (linked[0]?.event) return linked[0].event;
  if (sale.eventName) return sale.eventName;
  if (sale.notes)     return sale.notes;
  return null;
}

function scoreTicket(ticket, sale) {
  let score = 0;
  const saleSection = (sale.section || "").toLowerCase().trim();
  const saleRow     = (sale.row     || "").toLowerCase().trim();
  const saleSeats   = (sale.seats   || "").toLowerCase().trim();
  const tSection    = (ticket.section || "").toLowerCase().trim();
  const tRow        = (ticket.row     || "").toLowerCase().trim();
  const tSeats      = (ticket.seats   || "").toLowerCase().trim();

  if (saleSection && tSection && saleSection === tSection) score += 10;
  if (saleRow     && tRow     && saleRow     === tRow)     score += 8;
  if (saleSeats   && tSeats   && tSeats.includes(saleSeats)) score += 6;

  const salePlatform = (sale.sellingPlatform || "").toLowerCase();
  const tPlatform    = (ticket.buyingPlatform || "").toLowerCase();
  if (salePlatform && tPlatform && tPlatform.includes(salePlatform)) score += 3;

  return score;
}

// Build consecutive seat groups from candidates
function buildSeatGroups(candidates, qty) {
  if (qty <= 1) return []; // No grouping needed for single tickets

  // Group candidates by section+row
  const bySecRow = {};
  candidates.forEach(t => {
    const key = `${(t.section || "").toLowerCase().trim()}||${(t.row || "").toLowerCase().trim()}`;
    if (!bySecRow[key]) bySecRow[key] = [];
    bySecRow[key].push(t);
  });

  const groups = [];

  Object.values(bySecRow).forEach(rowTickets => {
    // Parse seat numbers and sort
    const withNum = rowTickets
      .map(t => ({ ...t, _seatNum: parseInt(t.seats) }))
      .filter(t => !isNaN(t._seatNum))
      .sort((a, b) => a._seatNum - b._seatNum);

    if (withNum.length < qty) return;

    // Find all consecutive windows of size qty
    for (let i = 0; i <= withNum.length - qty; i++) {
      const window = withNum.slice(i, i + qty);
      // Check if consecutive
      let isConsecutive = true;
      for (let j = 1; j < window.length; j++) {
        if (window[j]._seatNum !== window[j - 1]._seatNum + 1) {
          isConsecutive = false;
          break;
        }
      }
      if (isConsecutive) {
        const first = window[0];
        const last = window[window.length - 1];
        const totalCost = window.reduce((a, t) => a + (t.cost || 0), 0);
        groups.push({
          ids: window.map(t => t.id),
          tickets: window,
          section: first.section || "",
          row: first.row || "",
          seatRange: `${first.seats}-${last.seats}`,
          seatNums: window.map(t => t.seats).join(", "),
          event: first.event || "",
          date: first.date || "",
          buyingPlatform: first.buyingPlatform || "",
          orderRef: first.orderRef || "",
          totalCost,
          score: window.reduce((a, t) => a + (t._score || 0), 0),
        });
      }
    }
  });

  // Sort by score (best matches first), then by seat number
  return groups.sort((a, b) => b.score - a.score || a.tickets[0]._seatNum - b.tickets[0]._seatNum);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchSaleModal({ sale, tickets, onLink, onCreateAndLink, onClose }) {
  const [selected, setSelected]       = useState(new Set((sale.ticketIds || [])));
  const [showNew, setShowNew]         = useState(false);
  const [manualMode, setManualMode]   = useState(false);
  const [newTicket, setNewTicket]     = useState({
    event: "", date: "", venue: "", section: "", row: "", seats: "",
    qty: sale.qtySold || 1, cost: "", buyingPlatform: "", orderRef: "",
  });

  const eventName = resolveEventName(sale, tickets);
  const requiredQty = sale.qtySold || 1;

  const candidates = useMemo(() => {
    return tickets
      .filter(t => {
        if (!["Unsold", "Listed"].includes(t.status)) return false;
        if ((t.qtyAvailable ?? t.qty ?? 1) < 1) return false;
        return true;
      })
      .map(t => ({ ...t, _score: scoreTicket(t, sale) }))
      .sort((a, b) => b._score - a._score);
  }, [tickets, sale]);

  // Build consecutive seat groups for multi-ticket sales
  const seatGroups = useMemo(() => buildSeatGroups(candidates, requiredQty), [candidates, requiredQty]);

  const selectGroup = (group) => {
    setSelected(new Set(group.ids));
  };

  const toggle = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
      } else {
        if (n.size >= requiredQty) return prev;
        n.add(id);
      }
      return n;
    });
  };

  const exactMatch = selected.size === requiredQty;

  const handleConfirm = () => {
    if (!exactMatch) return;
    onLink(sale.id, [...selected]);
  };

  const handleCreateNew = () => {
    if (!newTicket.event && !newTicket.section) return;
    onCreateAndLink(sale.id, {
      ...newTicket,
      qty: parseInt(newTicket.qty) || 1,
      qtyAvailable: 0,
      cost: parseFloat(newTicket.cost) || 0,
      status: "Sold",
    });
    onClose();
  };

  const fmtD = (d) => {
    if (!d) return "";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return parseInt(m[3]) + " " + months[parseInt(m[2])-1] + " " + m[1];
    }
    return d;
  };

  const showGroupView = requiredQty > 1 && seatGroups.length > 0 && !manualMode;

  const overlay = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 1000, padding: 20,
  };

  const modal = {
    background: "#fff", borderRadius: 16,
    width: "100%", maxWidth: 620, maxHeight: "90vh",
    display: "flex", flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
    overflow: "hidden",
  };

  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 8,
    border: "1px solid #e2e6ea", fontSize: 12, fontFamily: FONT,
    outline: "none", background: "#fafbfc", color: "#111827",
    boxSizing: "border-box",
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal}>

        {/* Header */}
        <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #f0f0f3", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", fontFamily: FONT, letterSpacing: "-0.3px" }}>
                Match Sale to Inventory
              </div>
              <div style={{
                marginTop: 8, padding: "8px 12px",
                background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
                border: "1px solid #fcd34d", borderRadius: 8,
                display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>
                  {eventName || "Unidentified Event"}
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {sale.sellingPlatform && (
                    <span style={{ fontSize: 11, fontFamily: "monospace", background: "rgba(245,158,11,0.15)", borderRadius: 4, padding: "1px 6px", color: "#a16207" }}>
                      {sale.sellingPlatform}
                    </span>
                  )}
                  {sale.qtySold && <span style={{ fontSize: 11, color: "#a16207", fontWeight: 600 }}>{sale.qtySold}x tickets</span>}
                  {sale.salePrice > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#a16207" }}>{fmt(sale.salePrice)}</span>}
                  {sale.section && <span style={{ fontSize: 11, color: "#a16207" }}>Sec {sale.section}</span>}
                  {sale.row     && <span style={{ fontSize: 11, color: "#a16207" }}>Row {sale.row}</span>}
                  {sale.date    && <span style={{ fontSize: 11, color: "#a16207" }}>{fmtD(sale.date)}</span>}
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af", padding: "2px 4px", lineHeight: 1, flexShrink: 0 }}>x</button>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
            {["Match existing", "Create new ticket"].map(tab => (
              <button key={tab} onClick={() => { setShowNew(tab === "Create new ticket"); setManualMode(false); }}
                style={{
                  padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                  fontFamily: FONT, cursor: "pointer", border: "none",
                  background: (tab === "Create new ticket") === showNew ? "#1a3a6e" : "#f1f4f8",
                  color: (tab === "Create new ticket") === showNew ? "white" : "#6b7280",
                  transition: "all 0.15s",
                }}>
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>

          {!showNew ? (
            <>
              {candidates.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>📦</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>No available tickets</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>All inventory is sold or unavailable</div>
                  <button onClick={() => setShowNew(true)} style={{ marginTop: 12, background: "#1a3a6e", color: "white", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
                    Create a new ticket instead
                  </button>
                </div>
              ) : showGroupView ? (
                /* ── Grouped consecutive seats view ── */
                <>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Select a group of <strong style={{ color: "#111827" }}>{requiredQty} consecutive seats</strong></span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, fontFamily: FONT, padding: "3px 10px", borderRadius: 10,
                        background: exactMatch ? "rgba(5,150,105,0.08)" : "#f1f5f9",
                        color: exactMatch ? "#059669" : "#94a3b8",
                        border: `1px solid ${exactMatch ? "rgba(5,150,105,0.2)" : "#e2e6ea"}`,
                      }}>
                        {selected.size} / {requiredQty}
                      </span>
                      <button onClick={() => { setManualMode(true); setSelected(new Set()); }}
                        style={{ fontSize: 10, color: "#6b7280", background: "none", border: "1px solid #e2e6ea", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
                        Manual
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {seatGroups.map((group, gi) => {
                      const isSelected = group.ids.every(id => selected.has(id));
                      const platformColor = PLATFORM_COLORS[group.buyingPlatform] || PLATFORM_COLORS.Default;
                      return (
                        <div key={gi} onClick={() => selectGroup(group)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "12px 14px", borderRadius: 10, cursor: "pointer",
                            border: `1.5px solid ${isSelected ? "#059669" : "#e2e6ea"}`,
                            background: isSelected ? "rgba(5,150,105,0.04)" : "#fafbfc",
                            transition: "all 0.12s",
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f1f4f8"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(5,150,105,0.04)" : "#fafbfc"; }}
                        >
                          {/* Radio */}
                          <div style={{
                            width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                            border: `2px solid ${isSelected ? "#059669" : "#d1d5db"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {isSelected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669" }} />}
                          </div>

                          {/* Group info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", fontFamily: FONT }}>
                                Seats {group.seatNums}
                              </span>
                              {group.score > 0 && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: "#059669", background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 10, padding: "1px 6px" }}>
                                  Best match
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                              {group.section && <span style={{ background: "#eef2ff", color: "#1a3a6e", border: "1px solid #c7d2fe", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>Sec {group.section}</span>}
                              {group.row && <span style={{ background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>Row {group.row}</span>}
                              <span style={{ background: "#fff7ed", color: "#f97316", border: "1px solid #fed7aa", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
                                {requiredQty}x seats ({group.seatNums})
                              </span>
                              {group.date && <span style={{ fontSize: 10, color: "#6b7280" }}>{fmtD(group.date)}</span>}
                              {group.buyingPlatform && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: platformColor, background: `${platformColor}14`, border: `1px solid ${platformColor}30`, borderRadius: 4, padding: "1px 6px" }}>
                                  {group.buyingPlatform}
                                </span>
                              )}
                              {group.orderRef && <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>#{group.orderRef}</span>}
                            </div>
                          </div>

                          {/* Cost */}
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {group.totalCost > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", fontFamily: FONT }}>{fmt(group.totalCost)}</div>}
                            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{requiredQty} tickets</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* ── Manual individual ticket selection ── */
                <>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>Select exactly <strong style={{ color: "#111827" }}>{requiredQty} ticket{requiredQty !== 1 ? "s" : ""}</strong> to match this sale.</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, fontFamily: FONT, padding: "3px 10px", borderRadius: 10,
                        background: exactMatch ? "rgba(5,150,105,0.08)" : selected.size === 0 ? "#f1f5f9" : "rgba(239,68,68,0.08)",
                        color: exactMatch ? "#059669" : selected.size === 0 ? "#94a3b8" : "#ef4444",
                        border: `1px solid ${exactMatch ? "rgba(5,150,105,0.2)" : selected.size === 0 ? "#e2e6ea" : "rgba(239,68,68,0.2)"}`,
                      }}>
                        {selected.size} / {requiredQty}
                      </span>
                      {requiredQty > 1 && seatGroups.length > 0 && (
                        <button onClick={() => { setManualMode(false); setSelected(new Set()); }}
                          style={{ fontSize: 10, color: "#6b7280", background: "none", border: "1px solid #e2e6ea", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: FONT, fontWeight: 600 }}>
                          Groups
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {candidates.map(t => {
                      const isSelected = selected.has(t.id);
                      const platformColor = PLATFORM_COLORS[t.buyingPlatform] || PLATFORM_COLORS.Default;
                      return (
                        <div key={t.id} onClick={() => toggle(t.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                            border: `1.5px solid ${isSelected ? "#1a3a6e" : "#e2e6ea"}`,
                            background: isSelected ? "rgba(26,58,110,0.04)" : "#fafbfc",
                            transition: "all 0.12s",
                          }}
                          onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f1f4f8"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(26,58,110,0.04)" : "#fafbfc"; }}
                        >
                          <div style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                            border: `1.5px solid ${isSelected ? "#1a3a6e" : "#d1d5db"}`,
                            background: isSelected ? "#1a3a6e" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {isSelected && <span style={{ color: "white", fontSize: 9, fontWeight: 700 }}>✓</span>}
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                                {t.event || "Unknown Event"}
                              </span>
                              {t._score > 0 && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: "#059669", background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 10, padding: "1px 6px", flexShrink: 0 }}>
                                  Best match
                                </span>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                              {t.section && <span style={{ background: "#eef2ff", color: "#1a3a6e", border: "1px solid #c7d2fe", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>Sec {t.section}</span>}
                              {t.row     && <span style={{ background: "#f0fdf4", color: "#059669", border: "1px solid #bbf7d0", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>Row {t.row}</span>}
                              {t.seats   && <span style={{ background: "#fff7ed", color: "#f97316", border: "1px solid #fed7aa", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{t.seats}</span>}
                              {t.date    && <span style={{ fontSize: 10, color: "#6b7280" }}>{fmtD(t.date)}</span>}
                              {t.buyingPlatform && (
                                <span style={{ fontSize: 10, fontWeight: 600, color: platformColor, background: `${platformColor}14`, border: `1px solid ${platformColor}30`, borderRadius: 4, padding: "1px 6px" }}>
                                  {t.buyingPlatform}
                                </span>
                              )}
                              {t.orderRef && <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>#{t.orderRef}</span>}
                            </div>
                          </div>

                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {t.cost > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", fontFamily: FONT }}>{fmt(t.cost)}</div>}
                            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>
                              {t.qtyAvailable ?? t.qty ?? 1} available
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            // Create new ticket form
            <div>
              <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 12, fontFamily: FONT }}>
                Create a new inventory record for this sale. It will be immediately marked as Sold.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { label: "Event Name *", key: "event",           type: "text",   placeholder: "e.g. Manchester City vs Arsenal" },
                  { label: "Date",         key: "date",            type: "date",   placeholder: "" },
                  { label: "Venue",        key: "venue",           type: "text",   placeholder: "e.g. Etihad Stadium" },
                  { label: "Section",      key: "section",         type: "text",   placeholder: "e.g. 104" },
                  { label: "Row",          key: "row",             type: "text",   placeholder: "e.g. G" },
                  { label: "Seats",        key: "seats",           type: "text",   placeholder: "e.g. 12, 13" },
                  { label: "Quantity",     key: "qty",             type: "number", placeholder: "1" },
                  { label: "Cost Paid",    key: "cost",            type: "number", placeholder: "0.00" },
                  { label: "Platform",     key: "buyingPlatform",  type: "text",   placeholder: "e.g. Ticketmaster" },
                  { label: "Order Ref",    key: "orderRef",        type: "text",   placeholder: "e.g. TM-123456" },
                ].map(f => (
                  <label key={f.key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", fontFamily: FONT }}>{f.label}</span>
                    <input
                      type={f.type}
                      placeholder={f.placeholder}
                      value={newTicket[f.key]}
                      onChange={e => setNewTicket(p => ({ ...p, [f.key]: e.target.value }))}
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = "#1a3a6e"; e.currentTarget.style.background = "#fff"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#e2e6ea"; e.currentTarget.style.background = "#fafbfc"; }}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f0f3", display: "flex", justifyContent: "flex-end", gap: 8, flexShrink: 0, background: "#fafbfc" }}>
          <button onClick={onClose}
            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #e2e6ea", background: "transparent", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>
            Cancel
          </button>
          {!showNew ? (
            <button onClick={handleConfirm} disabled={!exactMatch}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: !exactMatch ? "#e5e7eb" : "#1a3a6e", color: !exactMatch ? "#9ca3af" : "white", fontSize: 12, fontWeight: 700, cursor: !exactMatch ? "default" : "pointer", fontFamily: FONT, transition: "all 0.15s" }}>
              {exactMatch ? `Link ${selected.size} ticket${selected.size !== 1 ? "s" : ""}` : `Select ${requiredQty - selected.size} more`}
            </button>
          ) : (
            <button onClick={handleCreateNew} disabled={!newTicket.event}
              style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: !newTicket.event ? "#e5e7eb" : "#1a3a6e", color: !newTicket.event ? "#9ca3af" : "white", fontSize: 12, fontWeight: 700, cursor: !newTicket.event ? "default" : "pointer", fontFamily: FONT }}>
              Create & Link
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
