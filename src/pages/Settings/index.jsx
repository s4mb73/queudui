import { useState } from "react";
import { fmt, today, uid } from "../../utils/format";
import { parseEmail, parseLiverpoolEmail, parseTicketmasterEmail, parseTicketmasterUSEmail, detectSite, stripEmailForAI, isStandingTicket } from "../../utils/parseEmail";
import { parseViagogoSaleEmail, parseTixstockSaleEmail, detectSaleSite } from "../../utils/parseSaleEmail";
import EmailAccounts    from "./EmailAccounts";
import SalesPlatforms   from "./SalesPlatforms";
import EmailScraper     from "./EmailScraper";
import AIEmailParsing   from "./AIEmailParsing";
import ManualEmailPaste from "./ManualEmailPaste";
import SaleEmailImport  from "./SaleEmailImport";
import DataManagement   from "./DataManagement";

const SERVER  = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const SECRET  = import.meta.env.VITE_API_SECRET || "";
const HEADERS = { "Content-Type": "application/json", "x-queud-secret": SECRET };

const SITES = [
  { value: "ticketmaster_uk", label: "Ticketmaster UK",  subject: "You got the tickets" },
  { value: "ticketmaster_us", label: "Ticketmaster USA", subject: "You Got Tickets To" },
  { value: "liverpool",       label: "Liverpool FC",     subject: "Liverpool FC Booking Confirmation" },
  { value: "generic",         label: "Other / Generic",  subject: "" },
];

function SaleTicketPicker({ tickets, allTickets, parsedSale, onRecord, fmt }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchSec, setSearchSec]     = useState("");

  const pool = tickets.length > 0 ? tickets : allTickets.filter(t =>
    !['Sold','Delivered','Completed'].includes(t.status) &&
    (!searchSec || (t.section || '').toLowerCase().includes(searchSec.toLowerCase()) ||
     (t.event   || '').toLowerCase().includes(searchSec.toLowerCase()))
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
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{t.event} · cost {fmt(t.cost)}</div>
                  </div>
                  {isSelected && <span style={{ fontSize: 10, fontWeight: 600, color: "#f47b20" }}>Selected</span>}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => onRecord(selectedIds)} disabled={selectedIds.length === 0}
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

export default function Settings({ settings, setSettings, tickets, setTickets, sales, setSales, events, findOrCreateEvent, notify, importParsed }) {
  const [serverOnline, setServerOnline]               = useState(null);
  const [bulkSelectedAccount, setBulkSelectedAccount] = useState("");
  const [bulkSite, setBulkSite]                       = useState("");
  const [bulkSearchTerm, setBulkSearchTerm]           = useState("");
  const [bulkFetching, setBulkFetching]               = useState(false);
  const [bulkEmails, setBulkEmails]                   = useState([]);
  const [bulkSelected, setBulkSelected]               = useState({});
  const [bulkParsing, setBulkParsing]                 = useState(false);
  const [bulkParsed, setBulkParsed]                   = useState([]);
  const [parseProgress, setParseProgress]             = useState({ done: 0, total: 0 });
  const [emailText, setEmailText]                     = useState("");
  const [parsed, setParsed]                           = useState(null);
  const [aiParsing, setAiParsing]                     = useState(false);
  const [aycdApiKey, setAycdApiKey]                   = useState(settings.aycdApiKey || "");
  const [accountsTab, setAccountsTab]                 = useState("gmail");
  const [saleEmailText, setSaleEmailText]             = useState("");
  const [parsedSale, setParsedSale]                   = useState(null);
  const [saleMatchedTickets, setSaleMatchedTickets]   = useState([]);

  function handleSiteChange(val) {
    setBulkSite(val);
    const s = SITES.find(s => s.value === val);
    if (s) setBulkSearchTerm(s.subject);
  }

  function checkServer() {
    fetch(`${SERVER}/health`)
      .then(r => r.json()).then(d => setServerOnline(d.ok === true)).catch(() => setServerOnline(false));
  }

  function saveAycdKey() {
    if (!aycdApiKey.trim()) return notify("Enter your AYCD API key", "err");
    setSettings(s => ({ ...s, aycdApiKey: aycdApiKey.trim() }));
    notify("AYCD API key saved ✓");
  }

  function addGmailAccount() {
    const emailEl = document.getElementById("gmail-email-input");
    const passEl  = document.getElementById("gmail-pass-input");
    const email   = emailEl.value.trim();
    const pass    = passEl.value.trim();
    if (!email || !pass) return notify("Enter both email and app password", "err");
    if (!email.includes("@")) return notify("Enter a valid email address", "err");
    const existing = settings.gmailAccounts || [];
    if (existing.find(a => a.email === email)) return notify("Account already added", "err");
    setSettings(s => ({ ...s, gmailAccounts: [...existing, { email, appPassword: pass, addedAt: new Date().toISOString() }] }));
    emailEl.value = ""; passEl.value = "";
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
    fetch(`${SERVER}/fetch-emails`, {
      method: "POST",
      headers: HEADERS,
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
    const site     = bulkSite;
    const stripped = new Map(selected.map(e => [e.uid, stripEmailForAI(e.body || "")]));
    const resultMap = new Map();
    let doneCount = 0;

    function flushUI(done) {
      setBulkParsed([...resultMap.values()]);
      setParseProgress({ done, total: selected.length });
    }

    if (site === "liverpool") {
      selected.forEach(email => {
        try {
          parseLiverpoolEmail(email.subject + "\n" + email.body).forEach(r => {
            const id = email.uid + "_" + (r.seats || Math.random());
            resultMap.set(id, { ...r, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: id });
          });
        } catch(e) { console.error("LFC parse error", e); }
      });
      setBulkParsed([...resultMap.values()]);
      setBulkParsing(false);
      setParseProgress({ done: selected.length, total: selected.length });
      notify(`Parsed ${resultMap.size} tickets from ${selected.length} emails`);
      return;
    }

    if (site === "ticketmaster_uk") {
      selected.forEach(email => {
        try {
          parseTicketmasterEmail(email.subject + "\n" + stripped.get(email.uid)).forEach((r, i) => {
            const id = email.uid + "_" + (r.seats || i);
            resultMap.set(id, { ...r, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: id });
          });
        } catch(e) { console.error("TM parse error", e); }
      });
      flushUI(selected.length);

      if (!settings.openAiKey) {
        setBulkParsing(false);
        notify(`Parsed ${resultMap.size} tickets from ${selected.length} emails`);
        return;
      }

      const uniqueSubjects = [...new Set(selected.map(e => e.subject))];
      const EVENT_BATCH    = 20;
      const eventNameMap   = new Map();

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
                model: "gpt-4o-mini", max_tokens: 500, temperature: 0,
                messages: [{ role: "user", content: "These are Ticketmaster UK email subjects. Clean up each event name.\nRules:\n- Remove ONLY: \"You're in! Your \", \" ticket confirmation\"\n- Keep EVERYTHING else exactly\nReturn JSON: {\"1\": \"name\", \"2\": \"name\", ...}\n\n" + subjectList }]
              })
            });
            const data    = await res.json();
            const txt     = (data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g, "").trim();
            const nameMap = JSON.parse(txt);
            subjectBatch.forEach((subject, i) => {
              const cleaned = nameMap[String(i + 1)];
              if (cleaned?.trim()) eventNameMap.set(subject, cleaned.trim().substring(0, 60));
            });
          } catch(e) { console.error("Event name AI error:", e.message); }
        })
      );

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

    if (site === "ticketmaster_us") {
      selected.forEach(email => {
        try {
          const body = email.rawHtml || email.body || "";
          parseTicketmasterUSEmail("Subject: " + email.subject + "\n" + body).forEach((r, i) => {
            const id = email.uid + "_" + (r.seats || i);
            resultMap.set(id, {
              ...r,
              accountEmail: extractEmail(email.to),
              _subject: email.subject,
              _uid: id,
            });
          });
        } catch(e) { console.error("TM USA parse error", e); }
      });
      flushUI(selected.length);
      setBulkParsing(false);
      notify(`Parsed ${resultMap.size} tickets from ${selected.length} emails`);
      return;
    }

    const GENERIC_SYSTEM = "Extract ticket info. Return ONLY JSON: {event,date,time,venue,section,row,seats,qty,costPrice,orderRef,restrictions,isStanding}. costPrice=total paid in GBP including fees. isStanding=true for Standing/Pitch/Floor/GA.";
    const needsAI = [];

    selected.forEach(email => {
      const p = parseEmail(email.subject + "\n" + stripped.get(email.uid));
      if (p.confidence === "high" || !settings.openAiKey) {
        resultMap.set(email.uid, { ...p, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid });
      } else {
        resultMap.set(email.uid, { ...p, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid });
        needsAI.push({ email });
      }
    });

    flushUI(selected.length - needsAI.length);

    if (needsAI.length === 0) {
      setBulkParsing(false);
      notify(`Parsed ${resultMap.size} emails`);
      return;
    }

    notify(`${selected.length - needsAI.length > 0 ? (selected.length - needsAI.length) + " done · " : ""}Sending ${needsAI.length} to AI…`);

    await Promise.all(needsAI.map(async ({ email }) => {
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
        const p    = JSON.parse((data.choices?.[0]?.message?.content || "{}").replace(/```json|```/g, "").trim());
        Object.keys(p).forEach(k => { if (p[k] === "null" || p[k] === null) p[k] = k === "isStanding" ? false : k === "costPrice" ? 0 : ""; });
        resultMap.set(email.uid, { ...p, accountEmail: extractEmail(p.accountEmail || email.to), _subject: email.subject, _uid: email.uid });
      } catch(e) { console.error("Generic AI error:", e.message); }
      doneCount++;
      flushUI(selected.length - needsAI.length + doneCount);
    }));

    setBulkParsing(false);
    notify(`Parsed ${resultMap.size} emails`);
  }

  // ── Import all parsed emails into inventory ───────────────────────────────
  async function importAll() {
    let skipped = 0;
    notify("Importing tickets…");

    // Fetch USD→GBP rate once for the whole batch if any tickets are USD
    let usdToGbp = null;
    const hasUSD = bulkParsed.some(p => p.originalCurrency === "USD");
    if (hasUSD) {
      try {
        const rateRes  = await fetch("https://open.er-api.com/v6/latest/USD");
        const rateData = await rateRes.json();
        usdToGbp = rateData?.rates?.GBP;
      } catch(e) {
        console.error("Rate fetch failed:", e);
      }
      if (!usdToGbp) {
        notify("⚠ Couldn't fetch USD→GBP rate — cost will be £0, edit manually after import", "err");
      } else {
        notify(`USD→GBP rate: ${usdToGbp.toFixed(4)}`);
      }
    }

    const newTickets = [];

    for (const p of bulkParsed) {
      if (!p.event && !p._subject) continue;

      const eventName = (p.event || p._subject || "").substring(0, 60);
      const isUSD     = p.originalCurrency === "USD";
      const rawCost   = parseFloat(p.costPrice) || 0;
      const cost      = isUSD && usdToGbp
        ? parseFloat((rawCost * usdToGbp).toFixed(2))
        : rawCost;
      const standing  = p.isStanding || isStandingTicket(p.restrictions || "");

      let eventId = null;
      if (findOrCreateEvent && eventName) {
        eventId = await findOrCreateEvent({
          name:     eventName,
          venue:    (p.venue || "").split(",")[0].trim(),
          date:     p.date || "",
          time:     p.time || "",
          category: p.category || "Concert",
        });
      }

      const base = {
        event:            eventName,
        eventId:          eventId || "",
        buyingPlatform:   p.buyingPlatform || "Ticketmaster",
        date:             p.date || "",
        time:             p.time || "",
        venue:            p.venue || "",
        orderRef:         p.orderRef || "",
        notes:            "",
        accountEmail:     p.accountEmail || "",
        restrictions:     (p.restrictions || "").replace(/^Album Pre-Order Pre-Sale\s*[-–]\s*/i, "").trim(),
        isStanding:       standing,
        status:           "Unsold",
        listedOn:         "",
        addedAt:          new Date().toISOString(),
        originalCurrency: p.originalCurrency || "GBP",
        originalAmount:   p.originalAmount || rawCost,
        exchangeRate:     isUSD && usdToGbp ? usdToGbp : 1,
      };

      if (standing) {
        const qty = parseInt(p.qty) || 1;
        newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: "", seats: "", qty, qtyAvailable: qty, cost, costPerTicket: parseFloat((cost / qty).toFixed(2)) });
      } else if ((bulkSite === "liverpool" || bulkSite === "ticketmaster_uk" || bulkSite === "ticketmaster_us") && p.seats !== undefined) {
        newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: p.row || "", seats: p.seats || "", qty: 1, qtyAvailable: 1, cost, costPerTicket: cost });
      } else {
        const seatsList   = parseSeats(p.seats);
        const totalQty    = seatsList.length || parseInt(p.qty) || 1;
        const costPerSeat = parseFloat((cost / totalQty).toFixed(2));
        if (seatsList.length > 0) {
          seatsList.forEach(seat => newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: p.row || "", seats: seat, qty: 1, qtyAvailable: 1, cost: costPerSeat, costPerTicket: costPerSeat }));
        } else {
          const qty = parseInt(p.qty) || 1;
          newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: p.row || "", seats: "", qty, qtyAvailable: qty, cost, costPerTicket: parseFloat((cost / qty).toFixed(2)) });
        }
      }
    }

    setTickets(prev => {
      const existingFPs   = new Set(prev.map(t => [t.event, t.date, t.section, t.seats, t.accountEmail].join("|").toLowerCase()));
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
    setParseProgress({ done: 0, total: 0 });
  }

  async function parseWithAI() {
    if (!emailText.trim()) return;
    const site = detectSite(emailText);
    if (site === "liverpool") { setParsed(parseLiverpoolEmail(emailText)[0]); return; }
    if (site === "ticketmaster_uk" && !settings.openAiKey) { setParsed(parseTicketmasterEmail(emailText)[0]); return; }
    if (site === "ticketmaster_us") { setParsed(parseTicketmasterUSEmail(emailText)[0]); return; }
    if (!settings.openAiKey) { setParsed(parseEmail(emailText)); return; }
    setAiParsing(true); setParsed(null);
    try {
      const clean = stripEmailForAI(emailText);
      const res   = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.openAiKey },
        body: JSON.stringify({
          model: "gpt-4o-mini", max_tokens: 400, temperature: 0,
          messages: [
            { role: "system", content: "Extract ticket info. Return ONLY JSON: {event,date,time,venue,section,row,seats,qty,costPrice,orderRef,restrictions,isStanding}. costPrice=total paid in GBP. isStanding=true for Standing/Pitch/Floor/GA." },
            { role: "user", content: clean }
          ]
        })
      });
      const data    = await res.json();
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
    const matches = tickets.filter(t => {
      const eventMatch = parsed.event && t.event.toLowerCase().includes(parsed.event.toLowerCase().substring(0, 15));
      const secMatch   = !parsed.section || (t.section || '').toLowerCase().includes(parsed.section.toLowerCase().substring(0, 6));
      return eventMatch && secMatch && !['Sold','Delivered','Completed'].includes(t.status);
    });
    setSaleMatchedTickets(matches.slice(0, 20));
  }

  function recordParsedSale(ticketIds) {
    if (!parsedSale || !ticketIds.length) return;
    const selectedTickets = ticketIds.map(id => tickets.find(t => t.id === id)).filter(Boolean);
    if (!selectedTickets.length) return;

    const qtySold       = selectedTickets.length;
    const salePrice     = parsedSale.priceEach * qtySold;
    const salePriceEach = parsedSale.priceEach;
    const firstTicket   = selectedTickets[0];
    const saleId        = uid();

    setSales(prev => [...prev, {
      id:              saleId,
      eventId:         firstTicket.eventId || "",
      sellingPlatform: parsedSale.platform,
      orderId:         parsedSale.orderId || "",
      qtySold,
      salePrice,
      salePriceEach,
      saleStatus:      "Pending",
      ticketIds,
      section:         firstTicket.section || "",
      row:             firstTicket.row || "",
      seats:           selectedTickets.map(t => t.seats).filter(Boolean).join(', '),
      date:            today(),
      customerEmail:   "",
      customerPhone:   "",
      notes:           `${parsedSale.platform} order ${parsedSale.orderId}`,
      recordedAt:      new Date().toISOString(),
    }]);

    setTickets(prev => prev.map(t => ticketIds.includes(t.id) ? { ...t, status: 'Sold', qtyAvailable: 0 } : t));
    setSaleEmailText(''); setParsedSale(null); setSaleMatchedTickets([]);

    const totalCost = selectedTickets.reduce((a, t) => a + (t.cost || 0), 0);
    const profit    = salePrice - totalCost;
    notify(`Sale recorded · ${qtySold > 1 ? `${qtySold} tickets · ` : ''}${profit >= 0 ? '+' : ''}£${Math.abs(profit).toFixed(2)} profit`);
  }

  const gmailAccounts = settings.gmailAccounts || [];
  const inputStyle    = { background: "#fafafa", border: "0.5px solid #e5e7eb", color: "#111827", fontFamily: "Inter, sans-serif", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "#0f172a", letterSpacing: "-0.5px" }}>Settings</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Integrations & Configuration</div>
      </div>

      <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>
        <EmailAccounts
          settings={settings} setSettings={setSettings}
          gmailAccounts={gmailAccounts}
          accountsTab={accountsTab} setAccountsTab={setAccountsTab}
          aycdApiKey={aycdApiKey} setAycdApiKey={setAycdApiKey}
          addGmailAccount={addGmailAccount} removeAccount={removeAccount}
          saveAycdKey={saveAycdKey} inputStyle={inputStyle} notify={notify}
        />
        <SalesPlatforms
          settings={settings} setSettings={setSettings}
          gmailAccounts={gmailAccounts} inputStyle={inputStyle}
          notify={notify}
        />
        <EmailScraper
          settings={settings}
          gmailAccounts={gmailAccounts}
          serverOnline={serverOnline} checkServer={checkServer}
          bulkSelectedAccount={bulkSelectedAccount} setBulkSelectedAccount={setBulkSelectedAccount}
          bulkSite={bulkSite} handleSiteChange={handleSiteChange}
          bulkSearchTerm={bulkSearchTerm} setBulkSearchTerm={setBulkSearchTerm}
          bulkFetching={bulkFetching} fetchEmails={fetchEmails}
          bulkEmails={bulkEmails}
          bulkSelected={bulkSelected} setBulkSelected={setBulkSelected}
          bulkParsing={bulkParsing} parseSelected={parseSelected}
          bulkParsed={bulkParsed}
          parseProgress={parseProgress}
          importAll={importAll}
          inputStyle={inputStyle} notify={notify} SITES={SITES}
          isStandingTicket={isStandingTicket}
        />
        <AIEmailParsing
          settings={settings} setSettings={setSettings}
          inputStyle={inputStyle}
        />
        <ManualEmailPaste
          emailText={emailText} setEmailText={setEmailText}
          parsed={parsed} setParsed={setParsed}
          aiParsing={aiParsing}
          parseWithAI={parseWithAI}
          importParsed={importParsed}
          inputStyle={inputStyle}
          settings={settings}
          isStandingTicket={isStandingTicket}
        />
        <SaleEmailImport
          saleEmailText={saleEmailText} setSaleEmailText={setSaleEmailText}
          parsedSale={parsedSale} setParsedSale={setParsedSale}
          saleMatchedTickets={saleMatchedTickets} setSaleMatchedTickets={setSaleMatchedTickets}
          tickets={tickets}
          parseSaleEmail={parseSaleEmail}
          recordParsedSale={recordParsedSale}
          inputStyle={inputStyle} fmt={fmt}
        />
        <DataManagement
          tickets={tickets} sales={sales}
          setTickets={setTickets} setSales={setSales}
          notify={notify} today={today}
        />
      </div>
    </div>
  );
}