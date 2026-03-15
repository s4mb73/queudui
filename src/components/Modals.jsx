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
            <div style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", padding: "10px 14px", borderRadius: 7, fontSize: 13, color: "#111827", fontWeight: 700 }}>
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

        {/* Currency info */}
        {(tf.originalCurrency && tf.originalCurrency !== "USD" && tf.originalAmount > 0) ? (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", marginBottom: 8 }}>💱 Currency Conversion</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 3 }}>ORIGINAL</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{fmtCurrency(tf.originalAmount, tf.originalCurrency)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 3 }}>RATE</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>×{parseFloat(tf.exchangeRate || 1).toFixed(4)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 3 }}>USD</div>
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
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 7, padding: "10px 14px", fontSize: 12, color: "#9a3412" }}>
              Cost basis: <b>{fmt(t.costPrice / t.qty)}</b> per ticket · Total cost: <b>{fmt(t.costPrice)}</b>
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
            <div style={{ background: profit >= 0 ? "#f0fdf4" : "#fef2f2", border: `2px solid ${profit >= 0 ? "#bbf7d0" : "#fecaca"}`, borderRadius: 7, padding: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "#6b7280", marginBottom: 12, textTransform: "uppercase" }}>Projected P&L</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[["NET PROFIT", profit >= 0 ? "+" : "", fmt(profit), profit >= 0 ? "var(--green)" : "var(--red)"],
                  ["REVENUE", "", fmt(price * qty), "var(--orange)"],
                  ["ROI", "", fmtPct(roi), roi >= 0 ? "var(--green)" : "var(--red)"]
                ].map(([label, pre, val, color]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#6b7280", fontWeight: 600, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 24, color }}>{pre}{val}</div>
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

  return (
    <Modal title="Ticket Details" onClose={onClose} wide>
      <div style={{ display: "grid", gap: 16 }}>

        {/* Event header */}
        <div style={{ background: "#fafafa", borderRadius: 7, padding: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 4 }}>{ticket.event}</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            {ticket.venue}{ticket.venue && (ticket.date || ticket.time) ? " · " : ""}
            {ticket.date ? ticket.date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, function(_, y, m, d) { return parseInt(d) + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1] + " " + y; }) : ""}
            {ticket.time ? " · " + ticket.time : ""}
          </div>
        </div>

        {/* Restrictions banner */}
        {isRestricted && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>Restrictions</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#991b1b" }}>{ticket.restrictions}</div>
            </div>
          </div>
        )}

        {/* Seat info */}
        {(clean(ticket.section) !== "—" || clean(ticket.row) !== "—" || clean(ticket.seats) !== "—") ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            {[["Section", clean(ticket.section)], ["Row", clean(ticket.row)], ["Seats", clean(ticket.seats)]].map(function(item) {
              return (
                <div key={item[0]} style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 7, padding: "10px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>{item[0]}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{item[1]}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 7, padding: "10px 14px", textAlign: "center", gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>Section</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                {ticket.restrictions ? ticket.restrictions.replace(/Album Pre-Order Pre-Sale\s*-?\s*/i, "").replace(/Ticket$/i, "").trim() : "General Admission"}
              </div>
            </div>
          </div>
        )}

        {/* Cost breakdown */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 7, overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", fontSize: 11, fontWeight: 700, color: "#6b7280", letterSpacing: 1, textTransform: "uppercase" }}>Cost Breakdown</div>
          <div style={{ padding: 16, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Total paid (USD)</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>{fmt(ticket.costPrice)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, color: "#6b7280" }}>Quantity</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>1 ticket</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Per ticket (USD)</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: "#f97316" }}>{fmt(costPerTicket)}</span>
            </div>
          </div>
        </div>

        {/* Currency conversion */}
        {hasConversion && (
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 7, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", marginBottom: 12 }}>💱 Original Purchase Currency</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              {[
                ["Original Amount", fmtCurrency(ticket.originalAmount, ticket.originalCurrency)],
                ["Exchange Rate", "1 " + ticket.originalCurrency + " = $" + parseFloat(ticket.exchangeRate || 1).toFixed(4)],
                ["Converted USD", fmt(ticket.costPrice)],
              ].map(function(item) {
                return (
                  <div key={item[0]} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#15803d", fontWeight: 600, marginBottom: 3 }}>{item[0]}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#166534" }}>{item[1]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Order info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12 }}>
          {[["Order Ref", clean(ticket.orderRef)], ["Account", clean((ticket.accountEmail || "").replace(/^".*?"\s*<(.+)>$/, "$1"))], ["Category", ticket.category], ["Added", ticket.addedAt ? new Date(ticket.addedAt).toLocaleDateString("en-GB") : "—"]].map(function(item) {
            return (
              <div key={item[0]}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{item[0]}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", wordBreak: "break-all" }}>{item[1]}</div>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          {avail > 0 && <button className="action-btn" onClick={onSell}>💷 Record Sale</button>}
          <button className="ghost-btn" onClick={onEdit}>Edit Ticket</button>
          <button className="ghost-btn" onClick={onClose} style={{ marginLeft: "auto" }}>Close</button>
        </div>
      </div>
    </Modal>
  );
}