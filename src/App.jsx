import { useState, useEffect } from "react";
import { useQueudData } from "./hooks/useQueudData";
import { useAuth } from "./hooks/useAuth";
import { uid, fmt, today, fetchExchangeRate } from "./utils/format";
import { supabase } from "./lib/supabase";
import { Sidebar } from "./components/ui";
import { AddTicketModal, RecordSaleModal } from "./components/Modals";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Settings from "./pages/Settings/index";
import Team from "./pages/Team";
import Tasks from "./pages/Tasks";
import Emails from "./pages/Emails";
import Login from "./pages/Login";

const BLANK_TICKET = {
  event: "", date: "", time: "", venue: "",
  section: "", row: "", seats: "",
  qty: 2, cost: "", costPerTicket: "",
  orderRef: "", notes: "", accountEmail: "",
  buyingPlatform: "Ticketmaster",
  status: "Unsold", restrictions: "",
  isStanding: false, listedOn: "",
  eventId: "",
};

const BLANK_SALE = {
  sellingPlatform: "Viagogo",
  orderId: "",
  qtySold: 1,
  salePrice: "",
  salePriceEach: "",
  date: today(),
  notes: "",
  customerEmail: "",
  customerPhone: "",
};

export default function App() {
  const auth = useAuth();
  const {
    events,
    tickets, setTickets,
    sales, setSales, updateSale,
    settings, setSettings,
    findOrCreateEvent, linkTicketsToSale,
    deleteSaleAndResetTickets,
    logActivity,
    loading, error,
  } = useQueudData(auth.user);

  const [view, setView]                 = useState("dashboard");
  const [toast, setToast]               = useState(null);
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [showAddSale, setShowAddSale]   = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [tf, setTf] = useState(BLANK_TICKET);
  const [sf, setSf] = useState(BLANK_SALE);

  const notify = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Save ticket (add or edit) ─────────────────────────────────────────────
  const saveTicket = async () => {
    if (!tf.event || !tf.cost) return notify("Fill in event name and cost", "err");

    const cost          = parseFloat(tf.cost) || 0;
    const qty           = parseInt(tf.qty) || 1;
    const costPerTicket = parseFloat(tf.costPerTicket) || parseFloat((cost / qty).toFixed(2));

    // Find or create the event row
    let eventId = tf.eventId || null;
    if (!eventId && tf.event) {
      eventId = await findOrCreateEvent({
        name:     tf.event,
        venue:    (tf.venue || "").split(",")[0].trim(),
        date:     tf.date || "",
        time:     tf.time || "",
        category: tf.category || "Concert",
      });
    }

    if (editingTicket) {
      setTickets(prev => prev.map(t => {
        if (t.id !== editingTicket.id) return t;
        const oldQty   = t.qty ?? 1;
        const oldAvail = t.qtyAvailable ?? oldQty;
        const soldQty  = oldQty - oldAvail;
        const newAvail = Math.max(0, qty - soldQty);
        return { ...tf, id: t.id, eventId, qty, cost, costPerTicket, qtyAvailable: newAvail };
      }));
      logActivity("ticket_edited", "ticket", editingTicket.id, { event: tf.event, section: tf.section });
      notify("Ticket updated");
    } else {
      const newId = uid();
      setTickets(prev => [...prev, {
        ...tf, id: newId, eventId, qty, cost, costPerTicket,
        qtyAvailable: qty, addedAt: new Date().toISOString(),
      }]);
      logActivity("ticket_added", "ticket", newId, { event: tf.event, qty, cost });
      notify("Added to inventory");
    }

    setShowAddTicket(false);
    setEditingTicket(null);
    setTf(BLANK_TICKET);
  };

  // ── Record a sale manually ────────────────────────────────────────────────
  const saveSale = async (ticketIds) => {
    const ids = Array.isArray(ticketIds) && ticketIds.length > 0 ? ticketIds : [sf.ticketId];
    if (!ids[0] || !sf.salePrice) return notify("Select at least one ticket and enter sale price", "err");

    const selectedTickets = ids.map(id => tickets.find(t => t.id === id)).filter(Boolean);
    if (!selectedTickets.length) return;

    const qtySold       = selectedTickets.length;
    const salePrice     = parseFloat(sf.salePrice) || 0;
    const salePriceEach = parseFloat((salePrice / qtySold).toFixed(2));
    const firstTicket   = selectedTickets[0];
    const saleId        = uid();

    setSales(prev => [...prev, {
      id: saleId,
      eventId:         firstTicket.eventId || "",
      sellingPlatform: sf.sellingPlatform || "Viagogo",
      orderId:         sf.orderId || "",
      qtySold,
      salePrice,
      salePriceEach,
      saleStatus:      "Sold",
      ticketIds:       ids,
      section:         firstTicket.section || "",
      row:             firstTicket.row || "",
      seats:           selectedTickets.map(t => t.seats).filter(Boolean).join(", "),
      date:            sf.date || today(),
      customerEmail:   sf.customerEmail || "",
      customerPhone:   sf.customerPhone || "",
      notes:           sf.notes || "",
      recordedAt:      new Date().toISOString(),
    }]);

    if (linkTicketsToSale) await linkTicketsToSale(saleId, ids);
    logActivity("sale_recorded", "sale", saleId, {
      event: firstTicket.event, qtySold, salePrice,
      platform: sf.sellingPlatform,
    });

    setShowAddSale(false);
    setSf(BLANK_SALE);
    notify(`Sale recorded · ${qtySold > 1 ? `${qtySold} tickets · ` : ""}£${salePrice.toFixed(2)}`);
  };

  // ── Import parsed email into Add Ticket modal ─────────────────────────────
  const importParsed = async (data) => {
    // Multi-ticket import - skip modal and add all directly
    if (data._allTickets && data._allTickets.length > 1) {
      const allTickets = data._allTickets;
      const firstTicket = allTickets[0];
      const currency = firstTicket.originalCurrency || 'GBP';

      // Convert currency if not GBP
      let exchangeRate = 1;
      if (currency !== 'GBP') {
        exchangeRate = await fetchExchangeRate(currency);
        notify(`${currency} to GBP rate: ${exchangeRate.toFixed(4)}`);
      }

      let eventId = null;
      if (firstTicket.event) {
        eventId = await findOrCreateEvent({
          name: firstTicket.event,
          venue: (firstTicket.venue || "").split(",")[0].trim(),
          date: firstTicket.date || "",
          time: firstTicket.time || "",
          category: firstTicket.category || "Concert",
        });
      }

      const newTickets = allTickets.map(t => {
        const originalCost = parseFloat(t.cost || t.costPrice) || 0;
        const cost = currency !== 'GBP' ? parseFloat((originalCost * exchangeRate).toFixed(2)) : originalCost;
        return {
          ...BLANK_TICKET,
          id: uid(),
          event: t.event || "",
          eventId: eventId || "",
          date: t.date || "",
          time: t.time || "",
          venue: t.venue || "",
          section: t.section || "",
          row: t.row || "",
          seats: t.seats || "",
          qty: 1,
          qtyAvailable: 1,
          cost,
          costPerTicket: cost,
          orderRef: t.orderRef || "",
          buyingPlatform: t.buyingPlatform || "Ticketmaster",
          accountEmail: t.accountEmail || "",
          restrictions: t.restrictions || "",
          isStanding: t.isStanding || false,
          originalCurrency: currency,
          originalAmount: originalCost,
          exchangeRate,
          addedAt: new Date().toISOString(),
        };
      });

      setTickets(prev => [...prev, ...newTickets]);
      logActivity("tickets_imported", "ticket", "", { event: firstTicket.event, count: newTickets.length });
      notify(`Imported ${newTickets.length} tickets for ${firstTicket.event}`);
      return;
    }

    // Single ticket - open Add Ticket modal for review
    let section = data.section || "";
    let row     = data.row || "";
    let seats   = data.seats || "";

    if (data.section && (!row || !seats)) {
      const rowMatch  = data.section.match(/Row\s*([\w\d]+)/i);
      if (rowMatch) row = row || rowMatch[1];
      const seatMatch = data.section.match(/Seat[s]?\s*([\d\s\-\u2013]+)/i);
      if (seatMatch) seats = seats || seatMatch[1].trim();
      const secMatch  = data.section.match(/Sec(?:tion)?\s*([\w\d]+)/i);
      if (secMatch) section = secMatch[1];
    }

    const cost         = parseFloat(data.cost || data.costPrice) || 0;
    const qty          = parseInt(data.qty) || 1;
    const costPerTicket = parseFloat(data.costPerTicket) || parseFloat((cost / qty).toFixed(2));

    setTf({
      ...BLANK_TICKET,
      ...data,
      section, row, seats,
      qty,
      cost:            cost.toString(),
      costPerTicket:   costPerTicket.toString(),
      buyingPlatform:  data.buyingPlatform || "Ticketmaster",
      accountEmail:    data.accountEmail || "",
    });
    setShowAddTicket(true);
    notify("Email parsed — review & save");
  };

  const openSale = (ticketId) => {
    setSf({ ...BLANK_SALE, ticketId });
    setShowAddSale(true);
  };

  // ── Auth loading ──────────────────────────────────────────────────────────
  if (auth.loading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f7f8fa", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <img src="/logo.png" alt="Queud" style={{ width: 40, height: 40, marginBottom: 16 }} />
        <div style={{ fontSize: 13, color: "#64748b" }}>Loading...</div>
      </div>
    </div>
  );

  // ── Not logged in ─────────────────────────────────────────────────────────
  if (!auth.user) return (
    <Login signIn={auth.signIn} resetPassword={auth.resetPassword} />
  );

  // ── Data loading ──────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f7f8fa", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <img src="/logo.png" alt="Queud" style={{ width: 40, height: 40, marginBottom: 16 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Loading Queud...</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Connecting to database</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f7f8fa", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>!</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>Database Error</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{error}</div>
      </div>
    </div>
  );

  return (
    <div style={{
      "--navy": "#0f1729", "--navy2": "#0b1120",
      "--bg": "#f7f8fa", "--surface": "#ffffff",
      "--border": "#e2e6ea", "--border2": "#d1d9e0",
      "--text": "#0f172a", "--text2": "#374151",
      "--muted": "#64748b", "--muted2": "#94a3b8",
      "--orange": "#f97316", "--blue": "#1a3a6e",
      "--green": "#059669", "--red": "#ef4444", "--yellow": "#f59e0b",
      "--display": "'DM Sans', sans-serif", "--body": "'DM Sans', sans-serif",
      display: "flex", height: "100vh", fontFamily: "var(--body)",
      background: "var(--bg)", color: "var(--text)", overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .hover-row { transition: background 0.12s; }
        .hover-row:hover { background: #f7f8fa !important; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .fade-up { animation: fadeUp 0.22s ease forwards; }
        .action-btn { background: #f97316; color: white; border: none; border-radius: 9px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--body); transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; letter-spacing: -0.1px; box-shadow: 0 1px 3px rgba(249,115,22,0.3); }
        .action-btn:hover { background: #ea6c0a; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(249,115,22,0.35); }
        .action-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; box-shadow: none; }
        .ghost-btn { background: transparent; color: #64748b; border: 1px solid #e2e6ea; border-radius: 9px; padding: 8px 16px; font-size: 12.5px; font-weight: 500; cursor: pointer; font-family: var(--body); transition: all 0.15s; }
        .ghost-btn:hover { border-color: #1a3a6e; color: #1a3a6e; background: rgba(26,58,110,0.04); }
        .del-btn { background: rgba(239,68,68,0.08); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); border-radius: 7px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: var(--body); transition: all 0.15s; }
        .del-btn:hover { background: rgba(239,68,68,0.14); }
        input, select, textarea { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #94a3b8; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d9e0; border-radius: 4px; }
        select option { background: #ffffff; color: #0f172a; }
      `}</style>

      <Sidebar view={view} setView={setView} profile={auth.profile} isAdmin={auth.isAdmin} onSignOut={auth.signOut} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <div style={{ background: "#ffffff", borderBottom: "0.5px solid #e2e6ea", padding: "0 28px", display: "flex", alignItems: "center", height: 52, flexShrink: 0, gap: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>Queud</span>
          <span style={{ fontSize: 11, color: "#e2e6ea" }}>/</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1a3a6e", textTransform: "capitalize", letterSpacing: "-0.1px" }}>{view}</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: 10, color: "#94a3b8" }}>Supabase</span>
            </div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>
              {auth.profile?.display_name || auth.user?.email}
            </div>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
              padding: "3px 8px", borderRadius: 4,
              background: auth.isAdmin ? "rgba(26,58,110,0.08)" : "rgba(249,115,22,0.08)",
              color: auth.isAdmin ? "#1a3a6e" : "#f97316",
            }}>
              {auth.profile?.role || "va"}
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
          {view === "dashboard" && (
            <Dashboard
              tickets={tickets} sales={sales} events={events}
              setView={setView}
              setShowAddTicket={setShowAddTicket}
              setEditingTicket={setEditingTicket}
              setTf={setTf} blankTicket={BLANK_TICKET}
            />
          )}
          {view === "inventory" && (
            <Inventory
              tickets={tickets} setTickets={setTickets}
              sales={sales} setSales={setSales}
              events={events}
              settings={settings}
              setShowAddTicket={setShowAddTicket}
              setEditingTicket={setEditingTicket}
              setTf={setTf} blankTicket={BLANK_TICKET}
              openSale={openSale} notify={notify}
              isAdmin={auth.isAdmin}
              logActivity={logActivity}
            />
          )}
          {view === "sales" && (
            <Sales
              tickets={tickets} sales={sales}
              setSales={setSales} updateSale={updateSale}
              setTickets={setTickets}
              deleteSaleAndResetTickets={auth.isAdmin ? deleteSaleAndResetTickets : null}
              linkTicketsToSale={linkTicketsToSale}
              events={events}
              setShowAddSale={setShowAddSale}
              notify={notify}
              isAdmin={auth.isAdmin}
            />
          )}
          {view === "emails" && (
            <Emails
              settings={settings} setSettings={setSettings}
              tickets={tickets} setTickets={setTickets}
              sales={sales} setSales={setSales}
              events={events} findOrCreateEvent={findOrCreateEvent}
              notify={notify} importParsed={importParsed}
            />
          )}
          {view === "tasks" && (
            <Tasks
              auth={auth}
              events={events}
              tickets={tickets}
              notify={notify}
            />
          )}
          {view === "team" && auth.isAdmin && (
            <Team auth={auth} notify={notify} />
          )}
          {view === "settings" && auth.isAdmin && (
            <Settings
              settings={settings} setSettings={setSettings}
              tickets={tickets} setTickets={setTickets}
              sales={sales} setSales={setSales}
              notify={notify}
            />
          )}
          {view === "settings" && !auth.isAdmin && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>!</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}>Admin Only</div>
              <div style={{ fontSize: 13 }}>Settings are restricted to admin users.</div>
            </div>
          )}
        </div>
      </div>

      {showAddTicket && (
        <AddTicketModal
          tf={tf} setTf={setTf}
          editingTicket={editingTicket}
          setEditingTicket={setEditingTicket}
          setShowAddTicket={setShowAddTicket}
          saveTicket={saveTicket}
          settings={settings}
        />
      )}
      {showAddSale && (
        <RecordSaleModal
          sf={sf} setSf={setSf}
          tickets={tickets}
          setShowAddSale={setShowAddSale}
          saveSale={saveSale}
        />
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.type === "err" ? "#fef2f2" : "#ffffff", color: toast.type === "err" ? "#ef4444" : "#0f172a", padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 999, animation: "toastIn 0.25s ease", border: toast.type === "err" ? "1px solid #fecaca" : "1px solid #e2e6ea", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
          <span>{toast.type === "err" ? "!" : "OK"}</span> {toast.msg}
        </div>
      )}
    </div>
  );
}
