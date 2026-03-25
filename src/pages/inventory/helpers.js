export const FONT = "Inter, sans-serif";

export const STATUSES = ["Unsold", "Listed", "Sold", "Delivered", "Completed"];
export const ACTIVE_STATUSES = ["Unsold", "Listed"];
export const COMPLETED_STATUSES = ["Sold", "Delivered", "Completed"];

export const STATUS_STYLES = {
  Unsold:    { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  Listed:    { bg: "rgba(26,58,110,0.08)", text: "#1a3a6e", dot: "#1a3a6e" },
  Sold:      { bg: "rgba(5,150,105,0.08)", text: "#059669", dot: "#059669" },
  Delivered: { bg: "rgba(249,115,22,0.08)", text: "#f97316", dot: "#f97316" },
  Completed: { bg: "rgba(15,23,42,0.06)", text: "#374151", dot: "#374151" },
};

const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function fmtDate(d) {
  if (!d) return "—";
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${parseInt(iso[3])} ${months[parseInt(iso[2])-1]} ${iso[1]}`;
  const wordy = d.match(/(?:\w{3,}\s+)?(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
  if (wordy) return `${parseInt(wordy[1])} ${wordy[2]} ${wordy[3]}`;
  return d;
}

export function fmtTime(t) {
  if (!t) return "";
  const ampm = t.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
  if (ampm) {
    let h = parseInt(ampm[1]);
    const min = ampm[2];
    const period = ampm[3].toLowerCase();
    if (period === "pm" && h !== 12) h += 12;
    if (period === "am" && h === 12) h = 0;
    return `${String(h).padStart(2,"0")}:${min}`;
  }
  if (/^\d{1,2}:\d{2}$/.test(t.trim())) return t.trim();
  return "";
}

export function getTime(date, time) {
  if (time) return fmtTime(time);
  const bare = (date || "").replace(/\s*[·•]\s*/, " ").trim();
  const embedded = bare.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?)\s*$/i);
  return embedded ? fmtTime(embedded[1]) : "";
}

export function venueClean(v) {
  return (v || "").replace(/\s*[—–-]\s*.+$/, "").replace(/,.*$/, "").trim();
}

export function cleanRestriction(r) {
  if (!r) return r;
  return r
    .replace(/\s*(?:Aisle\s*)?Seated\s*Ticket.*/i, '')
    .replace(/\s*Ticket.*/i, '')
    .replace(/\s*Section\s*\d+.*/i, '')
    .trim();
}

export function sectionSummary(sections) {
  if (!sections.length) return "";
  const nums = sections.map(s => parseInt(s)).filter(n => !isNaN(n)).sort((a, b) => a - b);
  if (nums.length > 1) return `Sec ${nums[0]}–${nums[nums.length - 1]}`;
  if (nums.length === 1) return `Sec ${nums[0]}`;
  return sections.slice(0, 2).map(s => `Sec ${s}`).join(" · ") + (sections.length > 2 ? ` +${sections.length - 2}` : "");
}

export function cleanEmail(email) {
  if (!email) return "";
  return email.replace(/^".*?"\s*<(.+)>$/, "$1").replace(/^.*<(.+)>$/, "$1").trim();
}

export function statusPill(tix) {
  const statuses = [...new Set(tix.map(t => t.status || "Unsold"))];
  const s  = statuses.length === 1 ? statuses[0] : "Multiple";
  const st = STATUS_STYLES[s] || STATUS_STYLES.Unsold;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: st.bg, color: st.text, borderRadius: 20, padding: "4px 10px", fontSize: 11, fontWeight: 600 }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot }} />{s}
    </div>
  );
}

export function qtyBox(n, available) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <div style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#f97316", textAlign: "center", minWidth: 28, fontVariantNumeric: "tabular-nums" }}>
        {available ?? n}
      </div>
      {available !== undefined && available !== n && (
        <div style={{ fontSize: 10, color: "#9ca3af", fontVariantNumeric: "tabular-nums" }}>/{n}</div>
      )}
    </div>
  );
}

export function soldBox(sold) {
  return sold > 0
    ? <div style={{ background: "rgba(5,150,105,0.1)", border: "1px solid rgba(5,150,105,0.2)", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "#059669", textAlign: "center", minWidth: 28, fontVariantNumeric: "tabular-nums" }}>{sold}</div>
    : <div style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", borderRadius: 6, padding: "3px 10px", fontSize: 12, color: "#d1d5db", textAlign: "center", minWidth: 28 }}>0</div>;
}

export const card = { background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };

export function eventAccent(cat) {
  return cat === "Sport" ? "#1a3a6e" : "#7c3aed";
}

export function getOrderGroups(eventTickets) {
  const orders = {};
  eventTickets.forEach(t => {
    const isStandingSec = t.isStanding || /standing|pitch|floor|general admission/i.test(t.section || "");
    const key = isStandingSec && t.section
      ? (t.orderRef || t.id) + "||" + t.section
      : t.orderRef || t.id;
    if (!orders[key]) {
      orders[key] = { orderRef: t.orderRef || "", accountEmail: t.accountEmail || "", sections: new Set(), rows: new Set(), tickets: [] };
    }
    if (t.section) orders[key].sections.add(t.section);
    if (t.row)     orders[key].rows.add(t.row);
    orders[key].tickets.push(t);
  });
  Object.values(orders).forEach(o => {
    o.sections = [...o.sections].sort((a, b) => (parseInt(a)||0) - (parseInt(b)||0));
    o.rows     = [...o.rows].sort((a, b) => (parseInt(a)||0) - (parseInt(b)||0));
    o.tickets.sort((a, b) => (parseInt(a.seats)||0) - (parseInt(b.seats)||0));
  });
  return orders;
}
