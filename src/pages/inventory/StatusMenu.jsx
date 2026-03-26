import { forwardRef, useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { STATUSES, STATUS_STYLES } from "./helpers";

const StatusMenu = forwardRef(function StatusMenu({ ticket, onUpdateStatus, triggerRef }, ref) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });

  useEffect(() => {
    // Position relative to the trigger button using fixed positioning
    const trigger = triggerRef?.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = 220; // approximate height of 5 status items
    const openUp = rect.bottom + menuHeight > window.innerHeight;
    setPos({
      top: openUp ? rect.top - menuHeight : rect.bottom + 4,
      left: Math.min(rect.right - 140, window.innerWidth - 160),
      openUp,
    });
  }, [triggerRef]);

  const menu = (
    <div ref={el => { menuRef.current = el; if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}
      style={{
        position: "fixed", top: pos.top, left: pos.left,
        background: "white", border: "0.5px solid #e8e8ec", borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 9999,
        minWidth: 140, overflow: "hidden", fontFamily: "'DM Sans', sans-serif",
      }}>
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

  // Portal to document.body to escape overflow:hidden containers
  return createPortal(menu, document.body);
});

export default StatusMenu;
