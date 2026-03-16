import { useState, useEffect } from "react";
import { useQueudData } from "./hooks/useQueudData";
import { uid, fmt, fmtPct, today, fetchExchangeRate, detectCurrency } from "./utils/format";
import { parseEmail } from "./utils/parseEmail";
import { supabase } from "./lib/supabase";
import { Sidebar } from "./components/ui";
import { AddTicketModal, RecordSaleModal } from "./components/Modals";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Sales from "./pages/Sales";
import Settings from "./pages/Settings";

const BLANK_TICKET = { event: "", category: "Concert", subtype: "", date: "", time: "", venue: "", section: "", row: "", seats: "", qty: 2, costPrice: "", orderRef: "", notes: "", accountEmail: "", originalCurrency: "USD", originalAmount: "", exchangeRate: 1, status: "Unsold", restrictions: "" };
const BLANK_SALE = { ticketId: "", qtySold: 1, salePrice: "", platform: "StubHub", date: today(), fees: "", notes: "" };

export default function App() {
  const { tickets, setTickets, sales, setSales, settings, setSettings, loading, error } = useQueudData();
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [migrated, setMigrated] = useState(false);
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [tf, setTf] = useState(BLANK_TICKET);
  const [sf, setSf] = useState(BLANK_SALE);

  useEffect(() => {
    if (loading || migrated) return;
    const alreadyMigrated = localStorage.getItem('queud_migrated_to_supabase');
    if (alreadyMigrated) return;
    const localTickets = JSON.parse(localStorage.getItem('queud_tickets') || '[]');
    const localSales = JSON.parse(localStorage.getItem('queud_sales') || '[]');
    if (localTickets.length > 0 || localSales.length > 0) {
      notify(`Migrating ${localTickets.length} tickets and ${localSales.length} sales to Supabase...`);
      Promise.all([
        localTickets.length > 0 ? setTickets(() => localTickets) : Promise.resolve(),
        localSales.length > 0 ? setSales(() => localSales) : Promise.resolve(),
      ]).then(() => {
        localStorage.setItem('queud_migrated_to_supabase', 'true');
        setMigrated(true);
        notify(`Migrated ${localTickets.length} tickets to Supabase`);
      });
    } else {
      localStorage.setItem('queud_migrated_to_supabase', 'true');
    }
  }, [loading]);

  const notify = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const saveTicket = () => {
    if (!tf.event || !tf.costPrice) return notify("Fill in event name and cost", "err");
    if (editingTicket) {
      setTickets(prev => prev.map(t => t.id === editingTicket.id
        ? { ...tf, id: t.id, qty: parseInt(tf.qty), costPrice: parseFloat(tf.costPrice), qtyAvailable: (t.qtyAvailable ?? t.qty) + (parseInt(tf.qty) - t.qty) }
        : t));
      notify("Ticket updated");
    } else {
      const qty = parseInt(tf.qty);
      setTickets(prev => [...prev, { ...tf, id: uid(), addedAt: new Date().toISOString(), qty, costPrice: parseFloat(tf.costPrice), qtyAvailable: qty }]);
      notify("Added to inventory");
    }
    setShowAddTicket(false); setEditingTicket(null); setTf(BLANK_TICKET);
  };

  const saveSale = () => {
    if (!sf.ticketId || !sf.salePrice) return notify("Select a ticket and enter sale price", "err");
    const ticket = tickets.find(t => t.id === sf.ticketId);
    if (!ticket) return;
    const qtySold = parseInt(sf.qtySold);
    if (qtySold > (ticket.qtyAvailable ?? ticket.qty)) return notify("Not enough stock available", "err");
    const salePrice = parseFloat(sf.salePrice);
    const fees = parseFloat(sf.fees) || 0;
    const costPer = ticket.costPrice / ticket.qty;
    const profit = (salePrice * qtySold) - (costPer * qtySold) - fees;
    setSales(prev => [...prev, { ...sf, id: uid(), qtySold, salePrice, fees, profit, costPer, eventName: ticket.event, category: ticket.category, recordedAt: new Date().toISOString() }]);
    setTickets(prev => prev.map(t => t.id === sf.ticketId ? { ...t, qtyAvailable: (t.qtyAvailable ?? t.qty) - qtySold } : t));
    setShowAddSale(false); setSf(BLANK_SALE);
    notify(`Sale recorded · ${profit >= 0 ? "+" : ""}${fmt(profit)} profit`);
  };

  const importParsed = async (data) => {
    let section = data.section || "";
    let row = data.row || "";
    let seats = data.seats || "";
    if (data.section && (!row || !seats)) {
      const rowMatch = data.section.match(/Row\s*([\w\d]+)/i);
      if (rowMatch) row = row || rowMatch[1];
      const seatMatch = data.section.match(/Seat[s]?\s*([\d\s\-–]+)/i);
      if (seatMatch) seats = seats || seatMatch[1].trim();
      const secMatch = data.section.match(/Sec(?:tion)?\s*([\w\d]+)/i);
      if (secMatch) section = secMatch[1];
    }
    const originalCurrency = data.originalCurrency || detectCurrency(data.rawCostString || "") || "USD";
    const originalAmount = parseFloat(data.costPrice) || 0;
    let exchangeRate = 1;
    let costPriceUSD = originalAmount;
    if (originalCurrency !== "USD" && originalAmount > 0) {
      try {
        notify("Fetching exchange rate...");
        exchangeRate = await fetchExchangeRate(originalCurrency);
        costPriceUSD = parseFloat((originalAmount * exchangeRate).toFixed(2));
      } catch (e) { costPriceUSD = originalAmount; }
    }
    setTf({ ...BLANK_TICKET, ...data, section, row, seats, qty: data.qty || 2, costPrice: costPriceUSD.toString(), originalCurrency, originalAmount: originalAmount.toString(), exchangeRate, accountEmail: data.accountEmail || "" });
    setShowAddTicket(true);
    notify("Email parsed — review & save");
  };

  const openSale = (ticketId) => { setSf({ ...BLANK_SALE, ticketId }); setShowAddSale(true); };

  if (loading) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f7f8fa", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🎟️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Loading Queud...</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Connecting to database</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f7f8fa", fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444", marginBottom: 8 }}>Database Error</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{error}</div>
      </div>
    </div>
  );

  return (
    <div style={{
      "--navy": "#1a3a6e", "--navy2": "#15306b",
      "--bg": "#f7f8fa", "--surface": "#ffffff",
      "--border": "#e2e6ea", "--border2": "#d1d9e0",
      "--text": "#0f172a", "--text2": "#374151",
      "--muted": "#64748b", "--muted2": "#94a3b8",
      "--orange": "#f97316", "--blue": "#1a3a6e",
      "--green": "#059669", "--red": "#ef4444", "--yellow": "#f59e0b",
      "--display": "'DM Sans', sans-serif", "--body": "'DM Sans', sans-serif",
      display: "flex", height: "100vh", fontFamily: "var(--body)", background: "var(--bg)", color: "var(--text)", overflow: "hidden"
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

      <Sidebar view={view} setView={setView} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#ffffff", borderBottom: "0.5px solid #e2e6ea", padding: "0 28px", display: "flex", alignItems: "center", height: 52, flexShrink: 0, gap: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>Queud</span>
          <span style={{ fontSize: 11, color: "#e2e6ea" }}>/</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#1a3a6e", textTransform: "capitalize", letterSpacing: "-0.1px" }}>{view}</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
            <span style={{ fontSize: 10, color: "#94a3b8" }}>Supabase</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
          {view === "dashboard" && <Dashboard tickets={tickets} sales={sales} setView={setView} setShowAddTicket={setShowAddTicket} setEditingTicket={setEditingTicket} setTf={setTf} blankTicket={BLANK_TICKET} />}
          {view === "inventory" && <Inventory tickets={tickets} setTickets={setTickets} sales={sales} setSales={setSales} settings={settings} setShowAddTicket={setShowAddTicket} setEditingTicket={setEditingTicket} setTf={setTf} blankTicket={BLANK_TICKET} openSale={openSale} notify={notify} />}
          {view === "sales" && <Sales tickets={tickets} sales={sales} setShowAddSale={setShowAddSale} />}
          {view === "settings" && <Settings settings={settings} setSettings={setSettings} tickets={tickets} setTickets={setTickets} sales={sales} notify={notify} importParsed={importParsed} />}
        </div>
      </div>

      {showAddTicket && <AddTicketModal tf={tf} setTf={setTf} editingTicket={editingTicket} setEditingTicket={setEditingTicket} setShowAddTicket={setShowAddTicket} saveTicket={saveTicket} settings={settings} />}
      {showAddSale && <RecordSaleModal sf={sf} setSf={setSf} tickets={tickets} setShowAddSale={setShowAddSale} saveSale={saveSale} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.type === "err" ? "#fef2f2" : "#ffffff", color: toast.type === "err" ? "#ef4444" : "#0f172a", padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 999, animation: "toastIn 0.25s ease", border: toast.type === "err" ? "1px solid #fecaca" : "1px solid #e2e6ea", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
          <span>{toast.type === "err" ? "⚠️" : "✓"}</span> {toast.msg}
        </div>
      )}
    </div>
  );
}