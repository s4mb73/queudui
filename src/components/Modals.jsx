import { Modal, Field, Input, Select, Badge } from "./ui";
import { fmt, fmtCurrency, fmtPct, PLATFORMS, SPORT_TYPES, MUSIC_TYPES } from "../utils/format";
import { parseEmail } from "../utils/parseEmail";

export function AddTicketModal({ tf, setTf, editingTicket, setEditingTicket, setShowAddTicket, saveTicket, settings }) {
  const CURRENCIES = ["USD", "GBP", "EUR", "CAD", "AUD"];
  return (
    <Modal title={editingTicket ? "Edit Ticket" : "Add Tickets to Inventory"} onClose={() => { setShowAddTicket(false); setEditingTicket(null); }}>
      <div style={{ display: "grid", gap: 16 }}>

        <Field label="Account Email">
          <Select value={tf.accountEmail} onChange={v => setTf(f => ({ ...f, accountEmail: v }))}>
            <option value="">Select account…</option>
            {(settings.gmailAccounts || []).map(a => <option key={a.email} value={a.email}>{a.email}</option>)}
            <option value="__manual__">Enter manually…</option>
          </Select>
          {tf.accountEmail === "__manual__" && (
            <Input value={""} onChange={v => setTf(f => ({ ...f, accountEmail: v }))} placeholder="your@gmail.com" style={{ marginTop: 8 }} />
          )}
        </Field>

        <Field label="Event Name *">
          <Input value={tf.event} onChange={v => setTf(f => ({ ...f, event: v }))} placeholder="e.g. Oasis — Old Trafford / Man Utd vs Liverpool" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Category">
            <Select value={tf.category} onChange={v => setTf(f => ({ ...f, category: v, subtype: "" }))}>
              <option>Concert</option><option>Sport</option>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={tf.subtype} onChange={v => setTf(f => ({ ...f, subtype: v }))}>
              <option value="">Select type…</option>
              {(tf.category === "Sport" ? SPORT_TYPES : MUSIC_TYPES).map(o => <option key={o}>{o}</option>)}
            </Select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Event Date"><Input value={tf.date} onChange={v => setTf(f => ({ ...f, date: v }))} placeholder="e.g. Apr 03, 2026" /></Field>
          <Field label="Time"><Input value={tf.time} onChange={v => setTf(f => ({ ...f, time: v }))} placeholder="e.g. 7:00 PM" /></Field>
        </div>

        <Field label="Venue / Stadium">
          <Input value={tf.venue} onChange={v => setTf(f => ({ ...f, venue: v }))} placeholder="e.g. SoFi Stadium" />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Section / Block"><Input value={tf.section} onChange={v => setTf(f => ({ ...f, section: v }))} placeholder="e.g. 543" /></Field>
          <Field label="Row"><Input value={tf.row} onChange={v => setTf(f => ({ ...f, row: v }))} placeholder="e.g. 21" /></Field>
          <Field label="Seats"><Input value={tf.seats} onChange={v => setTf(f => ({ ...f, seats: v }))} placeholder="e.g. 8-9" /></Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Quantity *"><Input value={tf.qty} onChange={v => setTf(f => ({ ...f, qty: v }))} type="number" min="1" /></Field>
          <Field label="Amount Paid *"><Input value={tf.costPrice} onChange={v => setTf(f => ({ ...f, costPrice: v }))} type="number" step="0.01" placeholder="0.00" /></Field>
          <Field label="Price per Ticket">
            <div style={{ background: "#f7f8fa", border: "1.5px solid #1c2840", padding: "9px 13px", borderRadius: 8, fontSize: 13, color: "#0f172a", fontWeight: 700 }}>
              {tf.costPrice && tf.qty ? fmt(parseFloat(tf.costPrice) / parseInt(tf.qty)) : "—"}
            </div>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Order / Booking Ref"><Input value={tf.orderRef} onChange={v => setTf(f => ({ ...f, orderRef: v }))} placeholder="e.g. 19-21054/WES" /></Field>
          <Field label="Restrictions / Ticket Type"><Input value={tf.restrictions || ""} onChange={v => setTf(f => ({ ...f, restrictions: v }))} placeholder="e.g. Restricted Side View" /></Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
          <Field label="Notes"><Input value={tf.notes} onChange={v => setTf(f => ({ ...f, notes: v }))} placeholder="Optional" /></Field>
        </div>

        {(tf.originalCurrency && tf.originalCurrency !== "USD" && tf.originalAmount > 0) ? (
          <div style={{ background: "rgba(26,58,110,0.06)", border: "1px solid rgba(46,124,246,0.2)", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1a3a6e", marginBottom: 10, letterSpacing: "0.5px", textTransform: "uppercase" }}>Currency Conversion</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>Original</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{fmtCurrency(tf.originalAmount, tf.originalCurrency)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>Rate</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>×{parseFloat(tf.exchangeRate || 1).toFixed(4)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.5px" }}>USD</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#f97316" }}>{fmt(tf.costPrice)}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Original Currency">
              <Select value={tf.originalCurrency || "USD"} onChange={v => setTf(f => ({ ...f, originalCurrency: v }))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Original Amount">
              <Input value={tf.originalAmount || ""} onChange={v => setTf(f => ({ ...f, originalAmount: v }))} type="number" step="0.01" placeholder="0.00" />
            </Field>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <button className="action-btn" onClick={saveTicket}>{editingTicket ? "Save Changes" : "Add to Inventory"}</button>
          <button className="ghost-btn" onClick={() => { setShowAddTicket(false); setEditingTicket(null); }}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

export function RecordSaleModal({ sf, setSf, tickets, setShowAddSale, saveSale }) {
  return (
    <Modal title="Record a Sale" onClose={() => setShowAddSale(false)}>
      <div style={{ display: "grid", gap: 16 }}>
        <Field label="Event *">
          <Select value={sf.ticketId} onChange={v => setSf(f => ({ ...f, ticketId: v }))}>
            <option value="">Select event…</option>
            {tickets.filter(t => (t.qtyAvailable ?? t.qty) > 0).map(t => (
              <option key={t.id} value={t.id}>{t.event} ({t.qtyAvailable ?? t.qty} available)</option>
            ))}
          </Select>
        </Field>

        {sf.ticketId && (() => {
          const t = tickets.find(x => x.id === sf.ticketId);
          return t ? (
            <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#94a3b8" }}>
              Cost basis: <b style={{ color: "#0f172a" }}>{fmt(t.costPrice / t.qty)}</b> per ticket · Total cost: <b style={{ color: "#0f172a" }}>{fmt(t.costPrice)}</b>
            </div>
          ) : null;
        })()}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Qty Sold"><Input value={sf.qtySold} onChange={v => setSf(f => ({ ...f, qtySold: v }))} type="number" min="1" /></Field>
          <Field label="Sale Price Each (£) *"><Input value={sf.salePrice} onChange={v => setSf(f => ({ ...f, salePrice: v }))} type="number" step="0.01" placeholder="0.00" /></Field>
        </div>

        <Field label="Platform Fees / Commission (£)">
          <Input value={sf.fees} onChange={v => setSf(f => ({ ...f, fees: v }))} type="number" step="0.01" placeholder="0.00" />
        </Field>

        {sf.ticketId && sf.salePrice && (() => {
          const t = tickets.find(x => x.id === sf.ticketId);
          if (!t) return null;
          const qty = parseInt(sf.qtySold) || 1;
          const price = parseFloat(sf.salePrice) || 0;
          const fees = parseFloat(sf.fees) || 0;
          const costPer = t.costPrice / t.qty;
          const profit = (price * qty) - (costPer * qty) - fees;
          const roi = costPer > 0 ? ((price - costPer) / costPer) * 100 : 0;
          return (
            <div style={{ background: profit >= 0 ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${profit >= 0 ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#64748b", marginBottom: 12, textTransform: "uppercase" }}>Projected P&L</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[["NET PROFIT", profit >= 0 ? "+" : "", fmt(profit), profit >= 0 ? "#10b981" : "#ef4444"],
                  ["REVENUE", "", fmt(price * qty), "#f97316"],
                  ["ROI", "", fmtPct(roi), roi >= 0 ? "#10b981" : "#ef4444"]
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
          <Field label="Platform">
            <Select value={sf.platform} onChange={v => setSf(f => ({ ...f, platform: v }))}>
              {PLATFORMS.map(p => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="Sale Date"><Input value={sf.date} onChange={v => setSf(f => ({ ...f, date: v }))} type="date" /></Field>
        </div>

        <Field label="Notes"><Input value={sf.notes} onChange={v => setSf(f => ({ ...f, notes: v }))} placeholder="Optional" /></Field>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="action-btn" onClick={saveSale}>Record Sale</button>
          <button className="ghost-btn" onClick={() => setShowAddSale(false)}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

export function TicketDetailModal({ ticket, onClose, onEdit, onSell, fmt, fmtCurrency }) {
  const clean = (v) => (!v || v === "null" || v === "undefined") ? "—" : v;
  const avail = ticket.qtyAvailable ?? ticket.qty;
  const costPerTicket = ticket.qty > 0 ? ticket.costPrice / ticket.qty : 0;
  const hasConversion = ticket.originalCurrency && ticket.originalCurrency !== "USD" && ticket.originalAmount > 0;
  const isRestricted = ticket.restrictions && /restrict/i.test(ticket.restrictions);

  const fmtDate = (d) => {
    if (!d) return "—";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) { const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]; return `${parseInt(m[3])} ${months[parseInt(m[2])-1]} ${m[1]}`; }
    return d;
  };

  return (
    <Modal title="Ticket Details" onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Event header */}
        <div style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", borderRadius: 10, padding: "16px 18px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", marginBottom: 4, letterSpacing: "-0.3px" }}>{ticket.event}</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>
            {ticket.venue}{ticket.venue && (ticket.date || ticket.time) ? " · " : ""}
            {ticket.date ? fmtDate(ticket.date) : ""}
            {ticket.time ? " · " + ticket.time : ""}
          </div>
        </div>

        {/* Restrictions banner */}
        {isRestricted && (
          <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Restriction</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#fca5a5" }}>{ticket.restrictions}</div>
            </div>
          </div>
        )}

        {/* Seat info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          {[["Section", clean(ticket.section)], ["Row", clean(ticket.row)], ["Seats", clean(ticket.seats)]].map(([label, val]) => (
            <div key={label} style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", borderRadius: 8, padding: "12px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: "#64748b", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Cost breakdown */}
        <div style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "0.5px solid #e2e6ea", fontSize: 10, fontWeight: 700, color: "#64748b", letterSpacing: 1.2, textTransform: "uppercase" }}>Cost Breakdown</div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Total paid (USD)</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{fmt(ticket.costPrice)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Quantity</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>1 ticket</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "0.5px solid #e2e6ea" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Per ticket (USD)</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: "#f97316" }}>{fmt(costPerTicket)}</span>
            </div>
          </div>
        </div>

        {/* Currency conversion */}
        {hasConversion && (
          <div style={{ background: "rgba(26,58,110,0.06)", border: "1px solid rgba(46,124,246,0.2)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#1a3a6e", marginBottom: 12, letterSpacing: 1.2, textTransform: "uppercase" }}>Original Purchase Currency</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                ["Original Amount", fmtCurrency(ticket.originalAmount, ticket.originalCurrency)],
                ["Exchange Rate", `1 ${ticket.originalCurrency} = $${parseFloat(ticket.exchangeRate || 1).toFixed(4)}`],
                ["Converted USD", fmt(ticket.costPrice)],
              ].map(([label, val]) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#1a3a6e", fontWeight: 600, marginBottom: 4, letterSpacing: "0.5px" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#e2e8ff" }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: "#2d3748", border: "0.5px solid #e2e6ea", borderRadius: 10, overflow: "hidden" }}>
          {[
            ["Order Ref", clean(ticket.orderRef)],
            ["Account", clean((ticket.accountEmail || "").replace(/^".*?"\s*<(.+)>$/, "$1"))],
            ["Category", ticket.category],
            ["Added", ticket.addedAt ? new Date(ticket.addedAt).toLocaleDateString("en-GB") : "—"]
          ].map(([label, val]) => (
            <div key={label} style={{ background: "#f7f8fa", padding: "12px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a", wordBreak: "break-all" }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, paddingTop: 2 }}>
          {avail > 0 && <button className="action-btn" onClick={onSell}>💷 Record Sale</button>}
          <button className="ghost-btn" onClick={onEdit}>Edit Ticket</button>
          <button className="ghost-btn" onClick={onClose} style={{ marginLeft: "auto" }}>Close</button>
        </div>
      </div>
    </Modal>
  );
}