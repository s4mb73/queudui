import { Modal, Field, Input, Select } from "../ui";
import { fmt, fmtCurrency, PLATFORMS, SPORT_TYPES, MUSIC_TYPES } from "../../utils/format";

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
