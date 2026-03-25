import { forwardRef } from "react";
import { STATUSES, STATUS_STYLES } from "./helpers";

const StatusMenu = forwardRef(function StatusMenu({ ticket, onUpdateStatus }, ref) {
  return (
    <div ref={ref} style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, background: "white", border: "0.5px solid #e8e8ec", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 100, minWidth: 140, overflow: "hidden" }}>
      {STATUSES.map(st => (
        <div key={st} onClick={e => onUpdateStatus(ticket.id, st, e)}
          style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", cursor: "pointer", background: ticket.status === st ? "#f9f9fb" : "transparent", fontSize: 12, fontWeight: ticket.status === st ? 600 : 400, color: STATUS_STYLES[st].text }}
          onMouseEnter={e => e.currentTarget.style.background = "#f9f9fb"}
          onMouseLeave={e => { e.currentTarget.style.background = ticket.status === st ? "#f9f9fb" : "transparent"; }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_STYLES[st].dot }} />{st}
          {ticket.status === st && <span style={{ marginLeft: "auto", fontSize: 10 }}>✓</span>}
        </div>
      ))}
    </div>
  );
});

export default StatusMenu;
