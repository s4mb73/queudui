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

  // Modal state
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [showAddSale, setShowAddSale] = useState(false);
  const [editingTicket, setEditingTicket] = useState(null);
  const [tf, setTf] = useState(BLANK_TICKET);
  const [sf, setSf] = useState(BLANK_SALE);

  // Migrate localStorage data to Supabase on first load
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
        notify(`✓ Migrated ${localTickets.length} tickets to Supabase`);
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
      notify("Ticket updated ✓");
    } else {
      const qty = parseInt(tf.qty);
      setTickets(prev => [...prev, { ...tf, id: uid(), addedAt: new Date().toISOString(), qty, costPrice: parseFloat(tf.costPrice), qtyAvailable: qty }]);
      notify("Added to inventory ✓");
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
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>🎟️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>Loading Queud...</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>Connecting to database</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", background: "#f1f5f9", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>Database Error</div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{error}</div>
      </div>
    </div>
  );

  return (
    <div style={{
      "--navy": "#0f172a", "--navy2": "#1e293b",
      "--sidebar": "#0d1117", "--sidebar-hover": "rgba(255,255,255,0.06)",
      "--orange": "#f97316", "--orange-light": "#fff7ed",
      "--text": "#e2e8f0", "--muted": "#64748b", "--muted2": "#94a3b8",
      "--border": "#1e2a3a", "--border2": "#243044",
      "--card": "#111827", "--card2": "#0d1520",
      "--green": "#22c55e", "--red": "#ef4444",
      "--display": "'Nunito', sans-serif", "--body": "'Nunito', sans-serif",
      display: "flex", height: "100vh", fontFamily: "var(--body)", background: "#0a0f1a", color: "var(--text)", overflow: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .hover-row { transition: background 0.1s; }
        .hover-row:hover { background: rgba(255,255,255,0.03); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp 0.2s ease forwards; }
        .action-btn { background: var(--orange); color: white; border: none; border-radius: 10px; padding: 10px 20px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: var(--body); transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px; }
        .action-btn:hover { opacity: 0.9; transform: translateY(-1px); }
        .ghost-btn { background: rgba(255,255,255,0.05); color: #94a3b8; border: 1.5px solid #1e2a3a; border-radius: 10px; padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: var(--body); transition: all 0.15s; }
        .ghost-btn:hover { border-color: var(--orange); color: var(--orange); }
        .del-btn { background: rgba(239,68,68,0.15); color: #ef4444; border: none; border-radius: 7px; padding: 5px 10px; font-size: 11px; font-weight: 600; cursor: pointer; font-family: var(--body); }
        input, select, textarea { box-sizing: border-box; }
        input::placeholder, textarea::placeholder { color: #334155; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e2a3a; border-radius: 3px; }
        select option { background: #111827; color: #e2e8f0; }
      `}</style>

      <Sidebar view={view} setView={setView} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#0d1520", borderBottom: "1px solid #1e2a3a", padding: "0 32px", display: "flex", alignItems: "center", height: 52, flexShrink: 0, gap: 8 }}>
          <span style={{ fontSize: 11, color: "#334155", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>Queud</span>
          <span style={{ fontSize: 11, color: "#1e2a3a" }}>/</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "capitalize" }}>{view}</span>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
            <span style={{ fontSize: 10, color: "#334155" }}>Supabase</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          {view === "dashboard" && <Dashboard tickets={tickets} sales={sales} setView={setView} setShowAddTicket={setShowAddTicket} setEditingTicket={setEditingTicket} setTf={setTf} blankTicket={BLANK_TICKET} />}
          {view === "inventory" && <Inventory tickets={tickets} setTickets={setTickets} sales={sales} setSales={setSales} settings={settings} setShowAddTicket={setShowAddTicket} setEditingTicket={setEditingTicket} setTf={setTf} blankTicket={BLANK_TICKET} openSale={openSale} notify={notify} />}
          {view === "sales" && <Sales tickets={tickets} sales={sales} setShowAddSale={setShowAddSale} />}
          {view === "settings" && <Settings settings={settings} setSettings={setSettings} tickets={tickets} setTickets={setTickets} sales={sales} notify={notify} importParsed={importParsed} />}
        </div>
      </div>

      {showAddTicket && <AddTicketModal tf={tf} setTf={setTf} editingTicket={editingTicket} setEditingTicket={setEditingTicket} setShowAddTicket={setShowAddTicket} saveTicket={saveTicket} settings={settings} />}
      {showAddSale && <RecordSaleModal sf={sf} setSf={setSf} tickets={tickets} setShowAddSale={setShowAddSale} saveSale={saveSale} />}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: toast.type === "err" ? "#fee2e2" : "var(--navy)", color: toast.type === "err" ? "#dc2626" : "white", padding: "13px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 999, animation: "toastIn 0.3s ease", boxShadow: "0 8px 24px rgba(15,23,42,0.2)", display: "flex", alignItems: "center", gap: 8 }}>
          <span>{toast.type === "err" ? "⚠️" : "✓"}</span> {toast.msg}
        </div>
      )}
    </div>
  );
}