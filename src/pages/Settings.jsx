import { useState } from "react";
import { fmt, today, uid } from "../utils/format";
import { parseEmail, parseLiverpoolEmail, parseTicketmasterEmail, detectSite, stripEmailForAI, isStandingTicket } from "../utils/parseEmail";

const SITES = [
  { value: "ticketmaster_uk", label: "Ticketmaster UK", subject: "You got the tickets" },
  { value: "liverpool",       label: "Liverpool FC",    subject: "Liverpool FC Booking Confirmation" },
  { value: "generic",         label: "Other / Generic", subject: "" },
];

// ── Sale email parsers ────────────────────────────────────────────────────────
function stripQP(raw) {
  return raw.replace(/=\r?\n/g, '').replace(/=C2=A3/g, '£').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function stripHtmlBasic(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#163;/g, '£').replace(/&#8203;/g, '').replace(/\s{2,}/g, ' ').trim();
}

function parseViagogoSaleEmail(raw) {
  const text = stripHtmlBasic(stripQP(raw));
  const orderIdM = text.match(/Order\s*ID[:\s]+(\d{6,12})/i);
  const eventM = text.match(/Event[:\s]+([^\n|]+?)(?:\s*Venue:|$)/i);
  const venueM = text.match(/Venue[:\s]+([^\n|]+?)(?:\s*Date:|$)/i);
  const dateM = text.match(/Date[:\s]+((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+\w+\s+\d{1,2},\s+\d{4}[^|]*)/i);
  const ticketsM = text.match(/Ticket\(s\)[:\s]+([^\n]+)/i);
  const priceM = text.match(/Price\s+per\s+Ticket[:\s]+£\s*([\d,]+\.?\d*)/i);
  const totalM = text.match(/Total\s+Proceeds[:\s]+£\s*([\d,]+\.?\d*)/i);
  const qtyM = text.match(/Number\s+of\s+Tickets[:\s]+(\d+)/i);

  const qty = qtyM ? parseInt(qtyM[1]) : 1;
  const priceEach = priceM ? parseFloat(priceM[1].replace(/,/g, '')) : (totalM ? parseFloat(totalM[1].replace(/,/g, '')) / qty : 0);

  // Parse section/row/seats from tickets line e.g. "Section ARENA E, Row 15, Seat(s) 27 - 28"
  let section = '', row = '', seats = '';
  if (ticketsM) {
    const t = ticketsM[1];
    const secM = t.match(/Section\s+([^,]+)/i);
    const rowM = t.match(/Row\s+(\d+)/i);
    const seatM = t.match(/Seat\(?s?\)?\s+([\d\s\-–]+)/i);
    if (secM) section = secM[1].trim();
    if (rowM) row = rowM[1].trim();
    if (seatM) {
      const rangeM = seatM[1].trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (rangeM) {
        const lo = Math.min(parseInt(rangeM[1]), parseInt(rangeM[2]));
        const hi = Math.max(parseInt(rangeM[1]), parseInt(rangeM[2]));
        seats = Array.from({ length: hi - lo + 1 }, (_, i) => String(lo + i)).join(', ');
      } else seats = seatM[1].trim();
    }
  }

  return {
    platform: 'Viagogo',
    orderId: orderIdM ? orderIdM[1] : '',
    event: eventM ? eventM[1].trim().substring(0, 60) : '',
    venue: venueM ? venueM[1].trim().substring(0, 50) : '',
    date: dateM ? dateM[1].trim() : '',
    section, row, seats, qty,
    priceEach,
    totalProceeds: totalM ? parseFloat(totalM[1].replace(/,/g, '')) : priceEach * qty,
  };
}

function parseTixstockSaleEmail(raw) {
  const text = stripHtmlBasic(stripQP(raw));
  const orderIdM = text.match(/Order\s+ID[:\s]+([A-Z0-9]+)/i);
  const eventM = text.match(/Event[:\s|\s]+([^\n|]+?)(?:\s*Event date:|$)/i);
  const venueM = text.match(/Venue[:\s]+([^\n|]+?)(?:\s*Quantity:|$)/i);
  const dateM = text.match(/Event\s+date[:\s]+([\d\/]+(?:,\s*[\d:]+)?)/i);
  const sectionM = text.match(/Section[:\s]+([^\n|]+?)(?:\s*Row:|$)/i);
  const rowM = text.match(/\bRow[:\s]+([^\n|]+?)(?:\s*Format:|$)/i);
  const qtyM = text.match(/(?:Number of tickets|Quantity)[:\s]+(\d+)/i);
  const priceM = text.match(/Price\s+per\s+ticket[:\s]+£\s*([\d,]+\.?\d*)/i);
  const totalM = text.match(/Total\s+proceeds[:\s]+£\s*([\d,]+\.?\d*)/i);

  const qty = qtyM ? parseInt(qtyM[1]) : 1;
  const priceEach = priceM ? parseFloat(priceM[1].replace(/,/g, '')) : (totalM ? parseFloat(totalM[1].replace(/,/g, '')) / qty : 0);

  return {
    platform: 'Tixstock',
    orderId: orderIdM ? orderIdM[1] : '',
    event: eventM ? eventM[1].trim().replace(/\s+/g, ' ').substring(0, 60) : '',
    venue: venueM ? venueM[1].trim().replace(/,.*$/, '').substring(0, 50) : '',
    date: dateM ? dateM[1].trim() : '',
    section: sectionM ? sectionM[1].trim().replace(/\s+/g, ' ') : '',
    row: rowM ? rowM[1].trim() : '',
    seats: '',
    qty,
    priceEach,
    totalProceeds: totalM ? parseFloat(totalM[1].replace(/,/g, '')) : priceEach * qty,
  };
}

function detectSaleSite(raw) {
  if (/viagogo\.com|automated@orders\.viagogo/i.test(raw)) return 'viagogo';
  if (/tixstock\.com|orders@tixstock/i.test(raw)) return 'tixstock';
  return null;
}

// Sub-component with its own state for ticket selection
function SaleTicketPicker({ tickets, allTickets, parsedSale, onRecord, fmt }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchSec, setSearchSec] = useState("");

  // If we have matches use them, otherwise let user search all available tickets
  const pool = tickets.length > 0 ? tickets : allTickets.filter(t =>
    !['Sold','Delivered','Completed'].includes(t.status) &&
    (!searchSec || (t.section || '').toLowerCase().includes(searchSec.toLowerCase()) ||
     (t.event || '').toLowerCase().includes(searchSec.toLowerCase()))
  ).slice(0, 30);

  const toggle = (id) => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  if (!parsedSale) return null;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {tickets.length === 0 && (
        <div>
          <div style={{ fontSize: 12, color: "#f97316", fontWeight: 600, marginBottom: 6 }}>⚠ No automatic matches found — search manually:</div>
          <input value={searchSec} onChange={e => setSearchSec(e.target.value)}
            placeholder="Search by event or section…"
            style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", padding: "7px 10px", borderRadius: 7, fontSize: 12, width: "100%", outline: "none", fontFamily: "Inter, sans-serif" }} />
        </div>
      )}
      {pool.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>
            {tickets.length > 0 ? `${pool.length} matching ticket${pool.length !== 1 ? 's' : ''} found` : 'Available tickets'} — select the {parsedSale.qty} sold:
          </div>
          <div style={{ border: "0.5px solid #e8e8ec", borderRadius: 7, overflow: "hidden", maxHeight: 240, overflowY: "auto" }}>
            {pool.map((t, i) => {
              const isSelected = selectedIds.includes(t.id);
              return (
                <div key={t.id} onClick={() => toggle(t.id)}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: i < pool.length - 1 ? "0.5px solid #f5f5f7" : "none", cursor: "pointer", background: isSelected ? "#fff7f0" : "white" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${isSelected ? "#f47b20" : "#e5e7eb"}`, background: isSelected ? "#f47b20" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {isSelected && <span style={{ color: "white", fontSize: 10, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>
                      {t.section && <span style={{ background: "#eef2ff", color: "#1a3a6e", borderRadius: 4, padding: "1px 6px", fontSize: 11, fontWeight: 600, marginRight: 5 }}>Sec {t.section}</span>}
                      {t.row && <span style={{ fontSize: 11, color: "#6b7280" }}>Row {t.row} · </span>}
                      <span style={{ fontSize: 11, color: "#6b7280" }}>Seat {t.seats || "—"}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{t.event} · cost {fmt(t.costPrice)}</div>
                  </div>
                  {isSelected && <span style={{ fontSize: 10, fontWeight: 600, color: "#f47b20" }}>Selected</span>}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => onRecord(selectedIds)}
              disabled={selectedIds.length === 0}
              style={{ background: selectedIds.length === 0 ? "#e5e7eb" : "#16a34a", color: "white", border: "none", borderRadius: 7, padding: "9px 18px", fontSize: 12, fontWeight: 600, cursor: selectedIds.length === 0 ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif" }}>
              Record Sale{selectedIds.length > 0 ? ` (${selectedIds.length} ticket${selectedIds.length > 1 ? 's' : ''} · £${(parsedSale.priceEach * selectedIds.length).toFixed(2)})` : ""}
            </button>
            {selectedIds.length !== parsedSale.qty && selectedIds.length > 0 && (
              <span style={{ fontSize: 11, color: "#f59e0b" }}>⚠ {parsedSale.qty} expected, {selectedIds.length} selected</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function Settings({ settings, setSettings, tickets, setTickets, sales, setSales, notify, importParsed }) {
  const [serverOnline, setServerOnline] = useState(null);
  const [bulkSelectedAccount, setBulkSelectedAccount] = useState("");
  const [bulkSite, setBulkSite] = useState("");
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");
  const [bulkFetching, setBulkFetching] = useState(false);
  const [bulkEmails, setBulkEmails] = useState([]);
  const [bulkSelected, setBulkSelected] = useState({});
  const [bulkParsing, setBulkParsing] = useState(false);
  const [bulkParsed, setBulkParsed] = useState([]);
  const [parseProgress, setParseProgress] = useState({ done: 0, total: 0 });
  const [emailText, setEmailText] = useState("");
  const [parsed, setParsed] = useState(null);
  const [aiParsing, setAiParsing] = useState(false);
  const [aycdApiKey, setAycdApiKey] = useState(settings.aycdApiKey || "");
  const [accountsTab, setAccountsTab] = useState("gmail");
  const [saleEmailText, setSaleEmailText] = useState("");
  const [parsedSale, setParsedSale] = useState(null);
  const [saleMatchedTickets, setSaleMatchedTickets] = useState([]);

  function handleSiteChange(val) {
    setBulkSite(val);
    const s = SITES.find(s => s.value === val);
    if (s) setBulkSearchTerm(s.subject);
  }

  function checkServer() {
    fetch("http://localhost:3001/health")
      .then(r => r.json()).then(d => setServerOnline(d.ok === true)).catch(() => setServerOnline(false));
  }

  function saveAycdKey() {
    if (!aycdApiKey.trim()) return notify("Enter your AYCD API key", "err");
    setSettings(s => ({ ...s, aycdApiKey: aycdApiKey.trim() }));
    notify("AYCD API key saved ✓");
  }

  function addGmailAccount() {
    const emailEl = document.getElementById("gmail-email-input");
    const passEl = document.getElementById("gmail-pass-input");
    const email = emailEl.value.trim();
    const pass = passEl.value.trim();
    if (!email || !pass) return notify("Enter both email and app password", "err");
    if (!email.includes("@")) return notify("Enter a valid email address", "err");
    const existing = settings.gmailAccounts || [];
    if (existing.find(a => a.email === email)) return notify("Account already added", "err");
    setSettings(s => ({ ...s, gmailAccounts: [...existing, { email, appPassword: pass, addedAt: new Date().toISOString() }] }));
    emailEl.value = "";
    passEl.value = "";
    notify("Gmail account added");
  }

  function removeAccount(i) {
    setSettings(s => ({ ...s, gmailAccounts: (s.gmailAccounts || []).filter((_, j) => j !== i) }));
    notify("Account removed");
  }

  function fetchEmails() {
    const acc = (settings.gmailAccounts || []).find(a => a.email === bulkSelectedAccount);
    if (!acc) return notify("Select a Gmail account first", "err");
    setBulkFetching(true); setBulkEmails([]); setBulkParsed([]); setBulkSelected({});
    setParseProgress({ done: 0, total: 0 });
    fetch("http://localhost:3001/fetch-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: acc.email, appPassword: acc.appPassword, searchSubject: bulkSearchTerm, maxEmails: 100 }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) throw new Error(data.error || "Fetch failed");
        setBulkEmails(data.emails || []);
        notify(`Found ${(data.emails || []).length} emails`);
      })
      .catch(e => notify("Error: " + e.message, "err"))
      .finally(() => setBulkFetching(false));
  }

  function extractEmail(raw) {
    if (!raw) return "";
    const m = raw.match(/<([^>]+@[^>]+)>/);
    if (m) return m[1].trim();
    const p = raw.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
    return p ? p[0].trim() : raw.trim();
  }

  function parseSeats(seatsStr) {
    if (!seatsStr) return [];
    const s = seatsStr.replace(/seat[s]?\s*/gi, "").trim();
    const rangeMatch = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      let start = parseInt(rangeMatch[1]), end = parseInt(rangeMatch[2]);
      if (start > end) [start, end] = [end, start];
      return Array.from({ length: end - start + 1 }, (_, i) => String(start + i));
    }
    if (s.includes(",")) return s.split(",").map(x => x.trim()).filter(x => /^\d+$/.test(x)).sort((a, b) => parseInt(a) - parseInt(b));
    if (/^\d+$/.test(s)) return [s];
    return s ? [s] : [];
  }

  async function parseSelected() {
    const selected = bulkEmails.filter(e => bulkSelected[e.uid]);
    if (!selected.length) return notify("Select at least one email", "err");
    setBulkParsing(true);
    setBulkParsed([]);
    setParseProgress({ done: 0, total: selected.length });
    const site = bulkSite;

    // ── Shared: pre-strip all bodies once up front ────────────────────────────
    // stripEmailForAI is expensive on large HTML bodies — do it once per email,
    // not once per retry/fallback
    const stripped = new Map(selected.map(e => [e.uid, stripEmailForAI(e.body || "")]));

    // ── Shared: result accumulator with live UI updates ───────────────────────
    const resultMap = new Map(); // uid_seat → result, prevents duplicates
    let doneCount = 0;
    function addResults(items) {
      items.forEach(r => resultMap.set(r._uid, r));
      doneCount = Math.min(doneCount + items.length > selected.length ? selected.length : doneCount, selected.length);
    }
    function flushUI(done) {
      setBulkParsed([...resultMap.values()]);
      setParseProgress({ done, total: selected.length });
    }

    // ── Liverpool FC — pure regex, instant ───────────────────────────────────
    if (site === "liverpool") {
      selected.forEach(email => {
        try {
          parseLiverpoolEmail(email.subject + "\n" + email.body).forEach(r => {
            const uid = email.uid + "_" + (r.seats || Math.random());
            resultMap.set(uid, { ...r, originalCurrency: "GBP", originalAmount: r.costPrice, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: uid });
          });
        } catch(e) { console.error("LFC parse error", e); }
      });
      setBulkParsed([...resultMap.values()]);
      setBulkParsing(false);
      setParseProgress({ done: selected.length, total: selected.length });
      notify(`Parsed ${resultMap.size} tickets from ${selected.length} emails`);
      return;
    }

    // ── Ticketmaster UK ───────────────────────────────────────────────────────
    // Strategy: regex handles everything structural (seats, price, date, venue)
    // instantly. AI only cleans the event name — one call per batch of 20
    // subjects, not one call per email. Much faster and still consistent.
    if (site === "ticketmaster_uk") {

      // Step 1: regex parse everything — instant
      selected.forEach(email => {
        try {
          parseTicketmasterEmail(email.subject + "\n" + stripped.get(email.uid)).forEach((r, i) => {
            const uid = email.uid + "_" + (r.seats || i);
            resultMap.set(uid, { ...r, originalCurrency: "GBP", originalAmount: r.costPrice, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: uid });
          });
        } catch(e) { console.error("TM parse error", e); }
      });

      // Show regex results immediately — user sees everything right away
      flushUI(selected.length);

      if (!settings.openAiKey) {
        setBulkParsing(false);
        notify(`Parsed ${resultMap.size} tickets from ${selected.length} emails`);
        return;
      }

      // Step 2: clean up event names with AI — send ALL subjects in one or two
      // calls (20 per call), not one call per email. Tiny payload = fast.
      // Deduplicate subjects first — no point asking AI about the same event twice
      const uniqueSubjects = [...new Set(selected.map(e => e.subject))];
      const EVENT_BATCH = 20;
      const eventNameMap = new Map(); // raw subject → cleaned name

      await Promise.all(
        Array.from({ length: Math.ceil(uniqueSubjects.length / EVENT_BATCH) }, (_, i) =>
          uniqueSubjects.slice(i * EVENT_BATCH, (i + 1) * EVENT_BATCH)
        ).map(async subjectBatch => {
          const subjectList = subjectBatch.map((s, i) => `${i + 1}. ${s}`).join("\n");
          try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.openAiKey },
              body: JSON.stringify({
                model: "gpt-4o-mini",
                max_tokens: 500,
                temperature: 0,
                messages: [{
                  role: "user",
                  content:
                    "These are Ticketmaster UK email subjects. Clean up each event name.\n" +
                    "Rules:\n" +
                    "- Remove ONLY: \"You're in! Your \", \" ticket confirmation\"\n" +
                    "- Keep EVERYTHING else exactly — artist name AND full tour name\n" +
                    "- Do NOT remove subtitles, tour names, or any words after colons or dashes\n" +
                    "Examples:\n" +
                    "  \"You're in! Your HARRY STYLES: LOVE ON TOUR ticket confirmation\" → \"HARRY STYLES: LOVE ON TOUR\"\n" +
                    "  \"You're in! Your Oasis - Live '25 ticket confirmation\" → \"Oasis - Live '25\"\n" +
                    "  \"You're in! Your HARRY STYLES: TOGETHER, TOGETHER ticket confirmation\" → \"HARRY STYLES: TOGETHER, TOGETHER\"\n" +
                    "Return JSON: {\"1\": \"name\", \"2\": \"name\", ...}\n\n" +
                    subjectList
                }]
              })
            });
            const data = await res.json();
            const txt = (data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g, "").trim();
            const nameMap = JSON.parse(txt);
            subjectBatch.forEach((subject, i) => {
              const cleaned = nameMap[String(i + 1)];
              if (cleaned && cleaned.trim()) eventNameMap.set(subject, cleaned.trim().substring(0, 60));
            });
          } catch(e) {
            console.error("Event name AI error:", e.message);
            // Keep regex names — no update needed
          }
        })
      );

      // Step 3: apply cleaned event names to all results
      if (eventNameMap.size > 0) {
        resultMap.forEach((ticket, key) => {
          const cleanedName = eventNameMap.get(ticket._subject);
          if (cleanedName) resultMap.set(key, { ...ticket, event: cleanedName });
        });
        flushUI(selected.length);
      }

      setBulkParsing(false);
      notify(`Parsed ${resultMap.size} tickets from ${selected.length} emails`);
      return;
    }

    // ── Generic — regex first, AI only for low-confidence results ────────────
    const GENERIC_SYSTEM = "Extract ticket info. Return ONLY JSON: {event,date,time,venue,section,row,seats,qty,costPrice,orderRef,category,restrictions,isStanding}. costPrice=total including fees. isStanding=true for Standing/Pitch/Floor/GA.";
    const needsAI = [];

    selected.forEach(email => {
      const currency = /£/.test(email.body || "") ? "GBP" : /€/.test(email.body || "") ? "EUR" : "USD";
      const p = parseEmail(email.subject + "\n" + stripped.get(email.uid));
      if (p.confidence === "high" || (!settings.openAiKey)) {
        // High confidence or no AI key — use regex result directly
        resultMap.set(email.uid, { ...p, originalCurrency: currency, originalAmount: p.costPrice, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid });
      } else {
        // Low/medium confidence — queue for AI, but store regex result as placeholder
        resultMap.set(email.uid, { ...p, originalCurrency: currency, originalAmount: p.costPrice, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid });
        needsAI.push({ email, currency });
      }
    });

    // Show regex results immediately
    flushUI(selected.length - needsAI.length);

    if (needsAI.length === 0) {
      setBulkParsing(false);
      notify(`Parsed ${resultMap.size} emails`);
      return;
    }

    notify(`${selected.length - needsAI.length > 0 ? (selected.length - needsAI.length) + " done · " : ""}Sending ${needsAI.length} to AI…`);

    // Fire all AI calls simultaneously
    await Promise.all(needsAI.map(async ({ email, currency }) => {
      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.openAiKey },
          body: JSON.stringify({
            model: "gpt-4o-mini", max_tokens: 400, temperature: 0,
            messages: [
              { role: "system", content: GENERIC_SYSTEM },
              { role: "user", content: "Subject: " + email.subject + "\n" + stripped.get(email.uid).substring(0, 2000) }
            ]
          })
        });
        const data = await res.json();
        const p = JSON.parse((data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g, "").trim());
        Object.keys(p).forEach(k => { if (p[k] === "null" || p[k] === null) p[k] = k === "isStanding" ? false : k === "costPrice" ? 0 : ""; });
        resultMap.set(email.uid, { ...p, originalCurrency: currency, originalAmount: p.costPrice, accountEmail: extractEmail(p.accountEmail || email.to), _subject: email.subject, _uid: email.uid });
      } catch(e) {
        // Keep the regex placeholder already in resultMap — don't overwrite with nothing
        console.error("Generic AI error:", e.message);
      }
      doneCount++;
      flushUI(selected.length - needsAI.length + doneCount);
    }));

    setBulkParsing(false);
    notify(`Parsed ${resultMap.size} emails`);
  }

  async function importAll() {
    let skipped = 0;
    notify("Converting currencies and importing...");
    const rateCache = { USD: 1 };
    const currencies = [...new Set(bulkParsed.map(p => p.originalCurrency || "USD"))].filter(c => c !== "USD");
    for (const cur of currencies) {
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/" + cur);
        const d = await r.json();
        rateCache[cur] = d.result === "success" ? d.rates.USD : (cur === "GBP" ? 1.27 : 1.08);
      } catch(e) { rateCache[cur] = cur === "GBP" ? 1.27 : 1.08; }
    }

    const newTickets = [];
    bulkParsed.forEach(p => {
      if (!p.event && !p._subject) return;
      const origCurrency = p.originalCurrency || "USD";
      const origAmount = parseFloat(p.costPrice) || 0;
      const rate = rateCache[origCurrency] || 1;
      const totalUSD = origCurrency !== "USD" ? parseFloat((origAmount * rate).toFixed(2)) : origAmount;
      const orderRef = p.orderRef || "";
      const standing = p.isStanding || isStandingTicket(p.restrictions || "");
      const base = {
        event: (p.event || p._subject || "").substring(0, 60),
        category: p.category || "Concert",
        subtype: "", date: p.date || "", time: p.time || "",
        venue: p.venue || "", originalCurrency: origCurrency, originalAmount: origAmount,
        exchangeRate: rate, orderRef, parentOrderRef: orderRef,
        notes: "", accountEmail: p.accountEmail || "",
        restrictions: (p.restrictions || "").replace(/^Album Pre-Order Pre-Sale\s*[-–]\s*/i, "").trim(),
        status: "Unsold", addedAt: new Date().toISOString(),
      };

      if (standing) {
        const qty = parseInt(p.qty) || 1;
        newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: "", seats: "", qty, costPrice: totalUSD, qtyAvailable: qty });
      } else if ((bulkSite === "liverpool" || bulkSite === "ticketmaster_uk") && p.seats !== undefined) {
        newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: p.row || "", seats: p.seats || "", qty: 1, costPrice: totalUSD, qtyAvailable: 1 });
      } else {
        const seatsList = parseSeats(p.seats);
        const totalQty = seatsList.length || parseInt(p.qty) || 1;
        const costPerSeat = parseFloat((totalUSD / totalQty).toFixed(2));
        const origPerSeat = parseFloat((origAmount / totalQty).toFixed(2));
        if (seatsList.length > 0) {
          seatsList.forEach(seat => newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: p.row || "", seats: seat, qty: 1, costPrice: costPerSeat, qtyAvailable: 1, originalAmount: origPerSeat }));
        } else {
          const qty = parseInt(p.qty) || 1;
          newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: p.row || "", seats: "", qty, costPrice: totalUSD, qtyAvailable: qty });
        }
      }
    });

    setTickets(prev => {
      const existingFPs = new Set(prev.map(t => [t.event, t.date, t.section, t.seats, t.accountEmail].join("|").toLowerCase()));
      const existingORefs = new Set(prev.map(t => t.orderRef).filter(Boolean));
      const toAdd = newTickets.filter(t => {
        const fp = [t.event, t.date, t.section, t.seats, t.accountEmail].join("|").toLowerCase();
        if (existingFPs.has(fp)) { skipped++; return false; }
        if (t.orderRef && !t.seats && !t.section && existingORefs.has(t.orderRef)) { skipped++; return false; }
        return true;
      });
      notify(`Imported ${toAdd.length} tickets${skipped > 0 ? ` · ${skipped} duplicates skipped` : ""}`);
      return prev.concat(toAdd);
    });
    setBulkEmails([]); setBulkParsed([]); setBulkSelected({});
    setParseProgress({ done: 0, total: 0 }); // FIX: reset progress counter
  }

  async function parseWithAI() {
    if (!emailText.trim()) return;
    const site = detectSite(emailText);
    if (site === "liverpool") { setParsed(parseLiverpoolEmail(emailText)[0]); return; }
    if (site === "ticketmaster_uk" && !settings.openAiKey) { setParsed(parseTicketmasterEmail(emailText)[0]); return; }
    if (!settings.openAiKey) { setParsed(parseEmail(emailText)); return; }
    setAiParsing(true); setParsed(null);
    try {
      const clean = stripEmailForAI(emailText);
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.openAiKey },
        body: JSON.stringify({
          model: "gpt-4o-mini", max_tokens: 400, temperature: 0,
          messages: [
            { role: "system", content: "Extract ticket info. Return ONLY JSON: {event,date,time,venue,section,row,seats,qty,costPrice,orderRef,category,restrictions,isStanding}. costPrice=total including fees. isStanding=true for Standing/Pitch/Floor/GA. restrictions without 'Album Pre-Order Pre-Sale -' prefix." },
            { role: "user", content: clean }
          ]
        })
      });
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      if (!res.ok) throw new Error(content || "API error");
      const result = JSON.parse(content.replace(/```json|```/g, "").trim());
      setParsed({ ...result, confidence: "high", aiParsed: true });
    } catch(e) {
      notify("AI failed: " + e.message + " — using auto parser", "err");
      setParsed(parseEmail(emailText));
    }
    setAiParsing(false);
  }

  function parseSaleEmail() {
    if (!saleEmailText.trim()) return;
    const site = detectSaleSite(saleEmailText);
    if (!site) return notify("Couldn't detect platform — paste a Viagogo or Tixstock sale email", "err");
    const parsed = site === 'viagogo' ? parseViagogoSaleEmail(saleEmailText) : parseTixstockSaleEmail(saleEmailText);
    setParsedSale(parsed);
    // Try to find matching tickets in inventory
    const matches = tickets.filter(t => {
      const eventMatch = parsed.event && t.event.toLowerCase().includes(parsed.event.toLowerCase().substring(0, 15));
      const secMatch = !parsed.section || (t.section || '').toLowerCase().includes(parsed.section.toLowerCase().substring(0, 6));
      return eventMatch && secMatch && !['Sold','Delivered','Completed'].includes(t.status);
    });
    setSaleMatchedTickets(matches.slice(0, 20));
  }

  function recordParsedSale(ticketIds) {
    if (!parsedSale || !ticketIds.length) return;
    const selectedTickets = ticketIds.map(id => tickets.find(t => t.id === id)).filter(Boolean);
    if (!selectedTickets.length) return;
    const qtySold = selectedTickets.length;
    const salePrice = parsedSale.priceEach;
    const totalCostBasis = selectedTickets.reduce((a, t) => a + t.costPrice, 0);
    const profit = (salePrice * qtySold) - totalCostBasis;
    const costPer = totalCostBasis / qtySold;
    const firstTicket = selectedTickets[0];
    setSales(prev => [...prev, {
      id: uid(), ticketId: firstTicket.id, ticketIds,
      qtySold, salePrice, fees: 0, profit, costPer,
      saleStatus: 'Pending',
      platform: parsedSale.platform,
      eventName: firstTicket.event, category: firstTicket.category,
      section: firstTicket.section, row: firstTicket.row,
      seats: selectedTickets.map(t => t.seats).filter(Boolean).join(', '),
      date: today(), notes: `${parsedSale.platform} order ${parsedSale.orderId}`,
      recordedAt: new Date().toISOString(),
    }]);
    setTickets(prev => prev.map(t => ticketIds.includes(t.id) ? { ...t, status: 'Sold', qtyAvailable: 0 } : t));
    setSaleEmailText(''); setParsedSale(null); setSaleMatchedTickets([]);
    notify(`Sale recorded · ${qtySold > 1 ? `${qtySold} tickets · ` : ''}${profit >= 0 ? '+' : ''}${fmt(profit)} profit`);
  }

  const gmailAccounts = settings.gmailAccounts || [];
  const inputStyle = { background: "#fafafa", border: "0.5px solid #e5e7eb", color: "#111827", fontFamily: "Inter, sans-serif", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 20, color: "#111827", letterSpacing: "-0.02em" }}>Settings</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>Integrations & Configuration</div>
      </div>

      <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>

        {/* ── Email Accounts ── */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#fff4ee", border: "0.5px solid #fde0cc", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📧</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Email Accounts</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                {gmailAccounts.length === 0 ? "No accounts added" : `${gmailAccounts.length} account${gmailAccounts.length > 1 ? "s" : ""} connected`}
              </div>
            </div>
          </div>
          {/* Tabs */}
          <div style={{ display: "flex", background: "#f9f9fb", borderBottom: "0.5px solid #f0f0f3", padding: "3px 3px 0", gap: 2 }}>
            {[["gmail", "Gmail IMAP"], ["aycd", "AYCD Inbox"]].map(([id, label]) => {
              const active = accountsTab === id;
              return (
                <button key={id} onClick={() => setAccountsTab(id)} style={{ padding: "7px 16px", fontSize: 12, fontWeight: active ? 600 : 400, color: active ? "#111827" : "#9ca3af", background: active ? "white" : "none", border: active ? "0.5px solid #e8e8ec" : "none", borderBottom: active ? "0.5px solid white" : "none", borderRadius: "6px 6px 0 0", cursor: "pointer", fontFamily: "Inter, sans-serif", marginBottom: -1 }}>
                  {label}
                </button>
              );
            })}
          </div>

          {accountsTab === "gmail" && (
            <div>
              {gmailAccounts.length > 0 && (
                <div style={{ borderBottom: "0.5px solid #f0f0f3" }}>
                  {gmailAccounts.map((acc, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: i < gmailAccounts.length - 1 ? "0.5px solid #f5f5f7" : "none" }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 0 2px rgba(34,197,94,0.2)", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{acc.email}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Added {acc.addedAt ? new Date(acc.addedAt).toLocaleDateString("en-GB") : "—"}</div>
                      </div>
                      <button className="del-btn" onClick={() => removeAccount(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em" }}>Add a Gmail Account</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 5 }}>Gmail address</label>
                    <input id="gmail-email-input" type="email" placeholder="you@gmail.com" style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 5 }}>App password</label>
                    <input id="gmail-pass-input" type="password" placeholder="xxxx xxxx xxxx xxxx" style={{ ...inputStyle, fontFamily: "monospace" }} />
                  </div>
                </div>
                <button className="action-btn" style={{ width: "fit-content" }} onClick={addGmailAccount}>+ Add account</button>
                <div style={{ background: "#fafafa", border: "0.5px solid #e8e8ec", borderRadius: 7, padding: "12px 14px", fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
                  <b style={{ color: "#111827" }}>How to get a Gmail App Password:</b><br />
                  Google Account → Security → 2-Step Verification → App Passwords → Create one named "Queud"<br />
                  <a href="https://support.google.com/mail/answer/185833" target="_blank" rel="noreferrer" style={{ color: "#f47b20", fontWeight: 600, textDecoration: "none" }}>Open Google App Passwords guide →</a>
                </div>
              </div>
            </div>
          )}

          {accountsTab === "aycd" && (
            <div style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="password" value={aycdApiKey} onChange={e => setAycdApiKey(e.target.value)} placeholder="Paste your AYCD API key" style={inputStyle} />
                <button onClick={saveAycdKey} className="action-btn">Save</button>
              </div>
              {settings.aycdApiKey && <div style={{ fontSize: 12, fontWeight: 600, color: "#16a34a" }}>✓ API key saved</div>}
              <div style={{ background: "#fafafa", border: "0.5px solid #e8e8ec", borderRadius: 7, padding: "12px 14px", fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
                Open the AYCD Inbox desktop app → <b>Settings → Tasks (API)</b> → copy your key. The app must be open when fetching.
              </div>
            </div>
          )}
        </div>

        {/* ── Sales Platforms ── */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏪</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Sales Platforms</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Associate selling accounts with each platform</div>
            </div>
          </div>
          <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
            {[
              { id: "tixstock",  label: "Tixstock",  color: "#059669", icon: "📦" },
              { id: "viagogo",   label: "Viagogo",   color: "#1a3a6e", icon: "🎫" },
              { id: "lysted",    label: "Lysted",    color: "#7c3aed", icon: "📋" },
              { id: "stubhub",   label: "StubHub",   color: "#f97316", icon: "🎟" },
            ].map(platform => {
              const key = `salesPlatform_${platform.id}`;
              const saved = settings[key] || { email: "", notes: "" };
              return (
                <div key={platform.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 12, alignItems: "center", padding: "12px 14px", background: "#fafafa", borderRadius: 8, border: "0.5px solid #f0f0f3" }}>
                  {/* Platform badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: `${platform.color}14`, border: `1px solid ${platform.color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{platform.icon}</div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: platform.color }}>{platform.label}</span>
                  </div>
                  {/* Email dropdown */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Selling Account</label>
                    <select
                      value={saved.email || ""}
                      onChange={e => setSettings(s => ({ ...s, [key]: { ...saved, email: e.target.value } }))}
                      style={{ ...inputStyle, fontSize: 12 }}>
                      <option value="">No account linked…</option>
                      {gmailAccounts.map(a => <option key={a.email} value={a.email}>{a.email}</option>)}
                      <option value="__other__">Other (enter below)</option>
                    </select>
                    {saved.email === "__other__" && (
                      <input
                        value={saved.customEmail || ""}
                        onChange={e => setSettings(s => ({ ...s, [key]: { ...saved, customEmail: e.target.value } }))}
                        placeholder="seller@email.com"
                        style={{ ...inputStyle, marginTop: 6 }} />
                    )}
                  </div>
                  {/* Notes */}
                  <div>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Notes / Username</label>
                    <input
                      value={saved.notes || ""}
                      onChange={e => setSettings(s => ({ ...s, [key]: { ...saved, notes: e.target.value } }))}
                      placeholder={`e.g. ${platform.label} seller username`}
                      style={{ ...inputStyle, fontSize: 12 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Email Scraper ── */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#eff6ff", border: "0.5px solid #bfdbfe", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Email Scraper</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Search Gmail and import ticket confirmations in bulk</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9ca3af" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: serverOnline === true ? "#22c55e" : serverOnline === false ? "#ef4444" : "#d1d5db" }} />
                {serverOnline === true ? "Server online" : serverOnline === false ? "Server offline" : "Not checked"}
              </div>
              <button className="ghost-btn" style={{ fontSize: 11, padding: "5px 10px" }} onClick={checkServer}>Check</button>
            </div>
          </div>

          <div style={{ padding: "16px 18px", display: "grid", gap: 14 }}>
            {serverOnline === false && (
              <div style={{ background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 7, padding: 12, fontSize: 12, color: "#dc2626" }}>
                Server not running. In your queud-server folder run: <b>node server.js</b>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 5 }}>Gmail account</label>
                <select value={bulkSelectedAccount} onChange={e => setBulkSelectedAccount(e.target.value)} style={inputStyle}>
                  <option value="">Select account…</option>
                  {gmailAccounts.map(a => <option key={a.email} value={a.email}>{a.email}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 5 }}>Website</label>
                <select value={bulkSite} onChange={e => handleSiteChange(e.target.value)} style={inputStyle}>
                  <option value="">Select site…</option>
                  {SITES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 5 }}>Search keyword</label>
                <input value={bulkSearchTerm} onChange={e => setBulkSearchTerm(e.target.value)} placeholder="e.g. booking confirmation" style={inputStyle} />
              </div>
            </div>

            <button className="action-btn" style={{ width: "fit-content" }} disabled={bulkFetching || !bulkSelectedAccount} onClick={fetchEmails}>
              {bulkFetching ? "⏳ Fetching…" : "Fetch Emails"}
            </button>

            {bulkEmails.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{bulkEmails.length} emails found</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="ghost-btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => { const all = {}; bulkEmails.forEach(e => { all[e.uid] = true; }); setBulkSelected(all); }}>Select all</button>
                    <button className="ghost-btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => setBulkSelected({})}>Deselect all</button>
                  </div>
                </div>

                <div style={{ border: "0.5px solid #e8e8ec", borderRadius: 7, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                  {bulkEmails.map((email, i) => (
                    <div key={email.uid} onClick={() => setBulkSelected(s => ({ ...s, [email.uid]: !s[email.uid] }))} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: i < bulkEmails.length - 1 ? "0.5px solid #f5f5f7" : "none", cursor: "pointer", background: bulkSelected[email.uid] ? "#fff7f0" : "white" }}>
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: "0.5px solid " + (bulkSelected[email.uid] ? "#f47b20" : "#e5e7eb"), background: bulkSelected[email.uid] ? "#f47b20" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {bulkSelected[email.uid] && <span style={{ color: "white", fontSize: 10, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.subject || "(no subject)"}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{email.from} · {email.date ? new Date(email.date).toLocaleDateString("en-GB") : "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                  {(() => {
                    const numSel = Object.values(bulkSelected).filter(Boolean).length;
                    const isDone = !bulkParsing && bulkParsed.length > 0 && numSel > 0;
                    return (
                      <>
                        <button disabled={bulkParsing || numSel === 0} onClick={parseSelected}
                          style={{ background: isDone ? "#111827" : "#f47b20", color: "white", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: numSel === 0 ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", display: "inline-flex", alignItems: "center", gap: 6, opacity: numSel === 0 ? 0.5 : 1 }}>
                          {bulkParsing
                            ? `Parsing ${parseProgress.done} / ${parseProgress.total}…`
                            : isDone
                            ? `✓ Parsed ${bulkParsed.length} — Parse again`
                            : `Parse ${numSel} selected`}
                        </button>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>{numSel} of {bulkEmails.length} selected</span>
                      </>
                    );
                  })()}
                </div>

                {bulkParsed.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", marginBottom: 8 }}>{bulkParsed.length} tickets ready to import</div>
                    <div style={{ border: "0.5px solid #e8e8ec", borderRadius: 7, overflow: "hidden", maxHeight: 260, overflowY: "auto" }}>
                      {bulkParsed.map((p, i) => {
                        const noPrice = !p.costPrice || p.costPrice === 0;
                        const standing = p.isStanding || isStandingTicket(p.restrictions || "");
                        const sym = p.originalCurrency === "GBP" ? "£" : p.originalCurrency === "EUR" ? "€" : "$";
                        return (
                          <div key={p._uid || i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: i < bulkParsed.length - 1 ? "0.5px solid #f5f5f7" : "none", background: noPrice ? "#fffbeb" : "white" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>{p.event || p._subject || "Unknown"}</div>
                              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                                {p.date ? p.date + " · " : ""}
                                {p.venue ? p.venue.replace(/,.*$/, "").trim() + " · " : ""}
                                {standing
                                  ? <span style={{ color: "#7c3aed" }}>Standing ×{p.qty} · </span>
                                  : p.section ? `Sec ${p.section}${p.row ? " Row " + p.row : ""}${p.seats ? " Seat " + p.seats : ""} · ` : ""}
                                {p.costPrice > 0 ? sym + p.costPrice : <span style={{ color: "#ef4444" }}>No price</span>}
                              </div>
                            </div>
                            {noPrice && <span style={{ fontSize: 10, fontWeight: 600, color: "#d97706", background: "#fef3c7", padding: "2px 7px", borderRadius: 4, flexShrink: 0 }}>⚠ No price</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
                      <button onClick={importAll} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                        Import {bulkParsed.length} to Inventory
                      </button>
                      {bulkParsed.filter(p => !p.costPrice || p.costPrice === 0).length > 0 && (
                        <span style={{ fontSize: 11, color: "#d97706" }}>
                          {bulkParsed.filter(p => !p.costPrice || p.costPrice === 0).length} tickets have no price
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ background: "#eff6ff", border: "0.5px solid #bfdbfe", borderRadius: 7, padding: "10px 14px", fontSize: 12, color: "#1e40af" }}>
              Requires local server. In your queud-server folder run: <b>npm install</b> then <b>node server.js</b>
            </div>
          </div>
        </div>

        {/* ── AI Email Parsing ── */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>AI Email Parsing</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Use ChatGPT to extract ticket data from any email</div>
            </div>
            <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 600, background: settings.openAiKey ? "#f0fdf4" : "#f5f5f7", color: settings.openAiKey ? "#16a34a" : "#9ca3af", border: settings.openAiKey ? "0.5px solid #bbf7d0" : "0.5px solid #e8e8ec" }}>
              {settings.openAiKey ? "Active" : "Not configured"}
            </span>
          </div>
          <div style={{ padding: "16px 18px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 5 }}>OpenAI API key</label>
            <input type="password" value={settings.openAiKey || ""} onChange={e => setSettings(s => ({ ...s, openAiKey: e.target.value }))} placeholder="sk-..." style={{ ...inputStyle, fontFamily: "monospace", letterSpacing: "0.02em" }} />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
              Saved locally. Never shared except with OpenAI. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "#f47b20", fontWeight: 600, textDecoration: "none" }}>Get your key →</a>
            </div>
          </div>
        </div>

        {/* ── Manual Email Paste ── */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#f5f3ff", border: "0.5px solid #ddd6fe", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📋</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Manual Email Paste</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Paste a full email — site is auto-detected</div>
            </div>
          </div>
          <div style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
            <textarea value={emailText} onChange={e => { setEmailText(e.target.value); setParsed(null); }}
              placeholder={"Paste anything here:\n• Ticketmaster UK confirmation\n• Liverpool FC Booking Confirmation\n• Any ticket email"}
              style={{ ...inputStyle, height: 130, resize: "vertical", lineHeight: 1.7, padding: "12px 14px" }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="action-btn" onClick={parseWithAI}>
                {aiParsing ? "⏳ Parsing…" : settings.openAiKey ? "✦ Parse with AI" : "Parse Email"}
              </button>
              <button className="ghost-btn" onClick={() => { setEmailText(""); setParsed(null); }}>Clear</button>
            </div>
            {parsed && (
              <div style={{ background: "#f9fafb", border: "0.5px solid #e8e8ec", padding: "14px 16px", borderRadius: 7 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                  {[
                    ["Event",        parsed.event || "Not detected"],
                    ["Date",         parsed.date || "—"],
                    ["Venue",        parsed.venue || "—"],
                    ["Type",         parsed.isStanding ? "Standing / Pitch" : "Seated"],
                    ["Section",      parsed.isStanding ? "N/A" : (parsed.section || "—")],
                    ["Row",          parsed.isStanding ? "N/A" : (parsed.row || "—")],
                    ["Seats",        parsed.isStanding ? "N/A" : (parsed.seats || "—")],
                    ["Qty",          parsed.qty || "—"],
                    ["Cost",         parsed.costPrice > 0 ? "£" + parsed.costPrice : "—"],
                    ["Restrictions", parsed.restrictions || "—"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: "white", padding: "8px 10px", borderRadius: 6, border: "0.5px solid #e8e8ec" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "#9ca3af", textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: ["Not detected","—","N/A"].includes(val) ? "#d1d5db" : "#111827" }}>{val}</div>
                    </div>
                  ))}
                </div>
                <button className="action-btn" onClick={() => { importParsed(parsed); setEmailText(""); setParsed(null); }}>
                  Import &amp; Review →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Sale Notification Emails ── */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>💰</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Sale Notification Emails</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Paste a Viagogo or Tixstock sale email to auto-record against inventory</div>
            </div>
          </div>
          <div style={{ padding: "16px 18px", display: "grid", gap: 12 }}>
            <textarea value={saleEmailText} onChange={e => { setSaleEmailText(e.target.value); setParsedSale(null); setSaleMatchedTickets([]); }}
              placeholder={"Paste a Viagogo or Tixstock sale confirmation email here…"}
              style={{ ...inputStyle, height: 110, resize: "vertical", lineHeight: 1.7, padding: "12px 14px" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="action-btn" onClick={parseSaleEmail} disabled={!saleEmailText.trim()}>Parse Sale Email</button>
              <button className="ghost-btn" onClick={() => { setSaleEmailText(''); setParsedSale(null); setSaleMatchedTickets([]); }}>Clear</button>
            </div>

            {parsedSale && (
              <div style={{ display: "grid", gap: 12 }}>
                {/* Parsed summary */}
                <div style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, padding: "12px 16px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#15803d", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>{parsedSale.platform} · Order {parsedSale.orderId}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      ["Event", parsedSale.event || "—"],
                      ["Date", parsedSale.date || "—"],
                      ["Venue", parsedSale.venue || "—"],
                      ["Section / Row", [parsedSale.section && `Sec ${parsedSale.section}`, parsedSale.row && `Row ${parsedSale.row}`].filter(Boolean).join(" · ") || "—"],
                      ["Seats", parsedSale.seats || "—"],
                      ["Qty", String(parsedSale.qty)],
                      ["Price each", `£${parsedSale.priceEach.toFixed(2)}`],
                      ["Total proceeds", `£${parsedSale.totalProceeds.toFixed(2)}`],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: "white", padding: "8px 10px", borderRadius: 6, border: "0.5px solid #e8e8ec" }}>
                        <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: val === "—" ? "#d1d5db" : "#111827" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ticket picker */}
                <SaleTicketPicker
                  tickets={saleMatchedTickets}
                  allTickets={tickets}
                  parsedSale={parsedSale}
                  onRecord={recordParsedSale}
                  fmt={fmt}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Data Management ── */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "#f5f3ff", border: "0.5px solid #ddd6fe", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🗄️</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Data Management</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{tickets.length} tickets · {sales.length} sales stored</div>
            </div>
          </div>
          <div style={{ padding: "16px 18px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="ghost-btn" onClick={() => {
              const data = { tickets, sales, exportedAt: new Date().toISOString() };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "queud-backup-" + today() + ".json"; a.click();
              URL.revokeObjectURL(url); notify("Backup downloaded");
            }}>⬇ Export JSON</button>
            <button className="ghost-btn" onClick={() => {
              const rows = [
                ["Event","Date","Venue","Section","Row","Seat","Qty","Cost","Category","Order Ref","Restrictions"],
                ...tickets.map(t => [t.event,t.date,t.venue,t.section,t.row,t.seats,t.qty,t.costPrice,t.category,t.orderRef,t.restrictions])
              ];
              const csv = rows.map(r => r.map(c => `"${(c ?? "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "queud-inventory-" + today() + ".csv"; a.click();
              URL.revokeObjectURL(url); notify("CSV downloaded");
            }}>⬇ Export CSV</button>
            <button className="ghost-btn" style={{ color: "#ef4444", borderColor: "#fecaca" }} onClick={() => {
              if (window.confirm("Clear ALL data? This cannot be undone.")) {
                setTickets([]); setSales([]); notify("All data cleared");
              }
            }}>🗑 Clear all data</button>
          </div>
        </div>

      </div>
    </div>
  );
}