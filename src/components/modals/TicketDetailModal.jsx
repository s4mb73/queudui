import { Modal } from "../ui";

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

