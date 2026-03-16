import { useState } from "react";
import { fmt, today, detectCurrency } from "../utils/format";
import { parseEmail, parseLiverpoolEmail, parseTicketmasterEmail, detectSite, stripEmailForAI, isStandingTicket } from "../utils/parseEmail";

const SITES = [
  { value: "ticketmaster_uk", label: "Ticketmaster UK", subject: "You got the tickets" },
  { value: "liverpool",       label: "Liverpool FC",    subject: "Liverpool FC Booking Confirmation" },
  { value: "generic",         label: "Other / Generic", subject: "" },
];

export default function Settings({ settings, setSettings, tickets, setTickets, sales, notify, importParsed }) {
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
    var email = document.getElementById("gmail-email-input").value.trim();
    var pass = document.getElementById("gmail-pass-input").value.trim();
    if (!email || !pass) return notify("Enter both email and app password", "err");
    if (!email.includes("@")) return notify("Enter a valid email address", "err");
    var existing = settings.gmailAccounts || [];
    if (existing.find(a => a.email === email)) return notify("Account already added", "err");
    setSettings(s => ({ ...s, gmailAccounts: existing.concat([{ email, appPassword: pass, addedAt: new Date().toISOString() }]) }));
    document.getElementById("gmail-email-input").value = "";
    document.getElementById("gmail-pass-input").value = "";
    notify("Gmail account added");
  }

  function removeAccount(i) {
    setSettings(s => ({ ...s, gmailAccounts: (s.gmailAccounts || []).filter((_, j) => j !== i) }));
    notify("Account removed");
  }

  function fetchEmails() {
    var acc = (settings.gmailAccounts || []).find(a => a.email === bulkSelectedAccount);
    if (!acc) return notify("Select a Gmail account first", "err");
    setBulkFetching(true); setBulkEmails([]); setBulkParsed([]); setBulkSelected({});
    fetch("http://localhost:3001/fetch-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: acc.email, appPassword: acc.appPassword, searchSubject: bulkSearchTerm, maxEmails: 100 }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.ok) throw new Error(data.error || "Fetch failed");
        setBulkEmails(data.emails || []);
        notify("Found " + (data.emails || []).length + " emails");
      })
      .catch(e => notify("Error: " + e.message, "err"))
      .finally(() => setBulkFetching(false));
  }

  function extractEmail(raw) {
    if (!raw) return "";
    var m = raw.match(/<([^>]+@[^>]+)>/);
    if (m) return m[1].trim();
    var p = raw.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
    if (p) return p[0].trim();
    return raw.trim();
  }

  function parseSeats(seatsStr) {
    if (!seatsStr) return [];
    var s = seatsStr.replace(/seat[s]?\s*/gi, "").trim();
    var rangeMatch = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (rangeMatch) {
      var start = parseInt(rangeMatch[1]), end = parseInt(rangeMatch[2]);
      if (start > end) { var tmp = start; start = end; end = tmp; }
      var arr = []; for (var n = start; n <= end; n++) arr.push(n.toString()); return arr;
    }
    if (s.includes(",")) return s.split(",").map(x => x.trim()).filter(x => /^\d+$/.test(x)).sort((a, b) => parseInt(a) - parseInt(b));
    if (/^\d+$/.test(s)) return [s];
    return s ? [s] : [];
  }

  async function parseSelected() {
    var selected = bulkEmails.filter(e => bulkSelected[e.uid]);
    if (!selected.length) return notify("Select at least one email", "err");
    setBulkParsing(true); setBulkParsed([]);
    setParseProgress({ done: 0, total: selected.length });

    const site = bulkSite;

    // Liverpool FC — use dedicated parser, returns multiple tickets per email
    if (site === "liverpool") {
      var allResults = [];
      selected.forEach(email => {
        try {
          const tickets = parseLiverpoolEmail(email.subject + "\n" + email.body);
          tickets.forEach(t => {
            allResults.push({ ...t, originalCurrency: "GBP", originalAmount: t.costPrice, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid + "_" + (t.seats || Math.random()) });
          });
        } catch (e) {
          console.error("LFC parse error", e);
        }
      });
      setBulkParsed(allResults);
      setBulkParsing(false);
      setParseProgress({ done: selected.length, total: selected.length });
      notify("Parsed " + allResults.length + " tickets from " + selected.length + " emails");
      return;
    }

    // Ticketmaster UK — AI multi-seat parser (falls back to regex if no key)
    if (site === "ticketmaster_uk") {
      if (!settings.openAiKey) {
        // Regex fallback
        var allResults = [];
        selected.forEach(email => {
          try {
            const tickets = parseTicketmasterEmail(email.subject + "\n" + email.body);
            const currency = /£/.test(email.body) ? "GBP" : "USD";
            tickets.forEach((t, i) => {
              allResults.push({ ...t, originalCurrency: currency, originalAmount: t.costPrice, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid + "_" + (t.seats || i) });
            });
          } catch (e) { console.error("TM parse error", e); }
        });
        setBulkParsed(allResults);
        setBulkParsing(false);
        setParseProgress({ done: selected.length, total: selected.length });
        notify("Parsed " + allResults.length + " tickets from " + selected.length + " emails (regex)");
        return;
      }

      // AI path — send emails in batches of 5, one API call per batch
      var tmResults = [];
      const BATCH = 5;
      setParseProgress({ done: 0, total: selected.length });

      for (var bi = 0; bi < selected.length; bi += BATCH) {
        var batch = selected.slice(bi, bi + BATCH);
        var emailsText = batch.map((email, idx) => {
          var body = (email.body || "").substring(0, 800);
          return "--- EMAIL " + (idx + 1) + " ---\nSubject: " + email.subject + "\n" + body;
        }).join("\n\n");

        try {
          var controller = new AbortController();
          var timeout = setTimeout(() => controller.abort(), 30000);
          var res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            signal: controller.signal,
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.openAiKey },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              max_tokens: 2000,
              temperature: 0,
              messages: [{ role: "user", content:
                "Parse " + batch.length + " Ticketmaster UK emails. Return a JSON array, one object per seat/ticket.\n" +
                "Fields: emailIndex(1-based),event,date,time,venue,section,row,seats,qty,costPrice,orderRef,category,restrictions,isStanding\n" +
                "- event: subject minus \"You're in! Your \" and \" ticket confirmation\"\n" +
                "- date: DD Mon YYYY\n" +
                "- seats: one seat number per object for seated tickets\n" +
                "- costPrice: Total incl fee divided by seat count\n" +
                "- isStanding: true for Standing/Pitch — one object, qty=total\n" +
                "- restrictions: remove \"Album Pre-Order Pre-Sale - \" prefix\n" +
                "Return ONLY the JSON array.\n\n" + emailsText
              }]
            })
          });
          clearTimeout(timeout);
          var data = await res.json();
          if (!res.ok) throw new Error(data?.error?.message || "API error " + res.status);
          var txt = data.choices?.[0]?.message?.content || "[]";
          var parsed = JSON.parse(txt.replace(/```json|```/g, "").trim());
          var arr = Array.isArray(parsed) ? parsed : [parsed];
          arr.forEach((p, i) => {
            var emailIdx = Math.max(0, Math.min((p.emailIndex || 1) - 1, batch.length - 1));
            var email = batch[emailIdx];
            var currency = /£/.test(email.body || "") ? "GBP" : "USD";
            Object.keys(p).forEach(k => { if (p[k] === "null" || p[k] === null) p[k] = k === "isStanding" ? false : k === "qty" || k === "costPrice" ? 0 : ""; });
            tmResults.push({ ...p, originalCurrency: currency, originalAmount: p.costPrice, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid + "_" + (p.seats || i) });
          });
        } catch(e) {
          console.error("Batch AI error:", e.message);
          // Regex fallback for this batch
          batch.forEach(email => {
            var currency = /£/.test(email.body || "") ? "GBP" : "USD";
            parseTicketmasterEmail(email.subject + "\n" + (email.body || "")).forEach((t, i) => {
              tmResults.push({ ...t, originalCurrency: currency, originalAmount: t.costPrice, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid + "_" + (t.seats || i) });
            });
          });
        }
        setParseProgress({ done: Math.min(bi + BATCH, selected.length), total: selected.length });
        setBulkParsed([...tmResults]); // update preview as we go
      }

      setBulkParsing(false);
      notify("Parsed " + tmResults.length + " tickets from " + selected.length + " emails");
      return;
    }
    // Generic — regex fallback or AI
    if (!settings.openAiKey) {
      var regexResults = selected.map(email => {
        var p = parseEmail(email.subject + "\n" + email.body, site);
        var currency = /£/.test(email.body) ? "GBP" : /€/.test(email.body) ? "EUR" : "USD";
        return { ...p, originalCurrency: currency, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid };
      });
      setBulkParsed(regexResults);
      setBulkParsing(false);
      setParseProgress({ done: regexResults.length, total: regexResults.length });
      notify("Parsed " + regexResults.length + " emails");
      return;
    }

    const BATCH_SIZE = 10;
    var allResults = []; var done = 0;

    async function parseOne(email) {
      var currency = /£/.test(email.body || "") ? "GBP" : /€/.test(email.body || "") ? "EUR" : "USD";
      try {
        var res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.openAiKey },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 300,
            messages: [{
              role: "user",
              content: "Extract ticket info from this " + (site === "ticketmaster_uk" ? "Ticketmaster UK" : "ticket") + " confirmation email. Return ONLY compact JSON with keys: event,date,time,venue,section,row,seats,qty,costPrice,orderRef,category,accountEmail,restrictions,isStanding.\n" +
                "- qty: from Nx Mobile Ticket pattern\n" +
                "- seats: comma-separated seat numbers\n" +
                "- isStanding: true if Standing/Pitch/Floor/GA\n" +
                "- restrictions: WITHOUT Album Pre-Order Pre-Sale - prefix\n" +
                "- costPrice: from Total (incl. fee) amount\n" +
                "- date: DD Mon YYYY\n\n" +
                "Subject: " + email.subject + "\n" + (email.body || "").substring(0, 2500)
            }],
          })
        });
        var data = await res.json();
        var content = data.choices?.[0]?.message?.content || "";
        var p = JSON.parse(content.replace(/```json|```/g, "").trim());
        Object.keys(p).forEach(k => { if (p[k] === "null" || p[k] === null) p[k] = k === "isStanding" ? false : k === "qty" || k === "costPrice" ? 0 : ""; });
        done++;
        setParseProgress(prev => ({ done, total: prev.total }));
        return { ...p, originalCurrency: currency, originalAmount: p.costPrice, accountEmail: extractEmail(p.accountEmail || email.to), _subject: email.subject, _uid: email.uid };
      } catch(e) {
        done++;
        setParseProgress(prev => ({ done, total: prev.total }));
        var fallback = parseEmail(email.subject + "\n" + (email.body || ""), site);
        return { ...fallback, originalCurrency: currency, originalAmount: fallback.costPrice, accountEmail: extractEmail(email.to), _subject: email.subject, _uid: email.uid };
      }
    }

    for (var b = 0; b < selected.length; b += BATCH_SIZE) {
      var batch = selected.slice(b, b + BATCH_SIZE);
      var batchResults = await Promise.all(batch.map(parseOne));
      allResults = allResults.concat(batchResults);
      setBulkParsed(allResults.slice());
    }
    setBulkParsing(false);
    notify("Parsed " + allResults.length + " emails");
  }

  async function importAll() {
    var imported = 0, skipped = 0;
    notify("Converting currencies and importing...");
    var rateCache = { USD: 1 };

    var currencies = [...new Set(bulkParsed.map(p => p.originalCurrency || "USD"))].filter(c => c !== "USD");
    for (var i = 0; i < currencies.length; i++) {
      var cur = currencies[i];
      try {
        var r = await fetch("https://open.er-api.com/v6/latest/" + cur);
        var d = await r.json();
        rateCache[cur] = d.result === "success" ? d.rates.USD : (cur === "GBP" ? 1.27 : 1.08);
      } catch(e) { rateCache[cur] = cur === "GBP" ? 1.27 : 1.08; }
    }

    var newTickets = [];

    bulkParsed.forEach(p => {
      if (!p.event && !p._subject) return;
      var originalCurrency = p.originalCurrency || "USD";
      var originalAmount = parseFloat(p.costPrice) || 0;
      var exchangeRate = rateCache[originalCurrency] || 1;
      var totalCostUSD = originalCurrency !== "USD" ? parseFloat((originalAmount * exchangeRate).toFixed(2)) : originalAmount;
      var orderRef = p.orderRef || "";
      var standing = p.isStanding || isStandingTicket(p.restrictions || "");

      const base = {
        event: (p.event || p._subject || "").substring(0, 60),
        category: p.category || "Concert",
        subtype: "", date: p.date || "", time: p.time || "",
        venue: p.venue || "",
        originalCurrency, originalAmount, exchangeRate, orderRef,
        parentOrderRef: orderRef,
        notes: p.notes || "",
        accountEmail: p.accountEmail || "",
        restrictions: (p.restrictions || "").replace(/^Album Pre-Order Pre-Sale\s*[-–]\s*/i, "").trim(),
        status: "Unsold",
        addedAt: new Date().toISOString(),
      };

      if (standing) {
        var qty = parseInt(p.qty) || 1;
        newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: "", row: "", seats: "", qty, costPrice: totalCostUSD, qtyAvailable: qty });
        imported++;
      } else {
        // Liverpool FC & Ticketmaster UK: each parsed result is already one seat
        if ((bulkSite === "liverpool" || bulkSite === "ticketmaster_uk") && p.seats !== undefined) {
          newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: p.row || "", seats: p.seats || "", qty: p.qty || 1, costPrice: totalCostUSD, qtyAvailable: p.qty || 1 });
          imported++;
        } else {
          var seatsList = parseSeats(p.seats);
          var totalQty = seatsList.length || parseInt(p.qty) || 1;
          var costPerSeat = totalQty > 0 ? parseFloat((totalCostUSD / totalQty).toFixed(2)) : totalCostUSD;
          var origPerSeat = totalQty > 0 ? parseFloat((originalAmount / totalQty).toFixed(2)) : originalAmount;

          if (seatsList.length > 0) {
            seatsList.forEach(seat => {
              newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: p.row || "", seats: seat, qty: 1, costPrice: costPerSeat, qtyAvailable: 1, originalAmount: origPerSeat });
              imported++;
            });
          } else {
            var qty2 = parseInt(p.qty) || 1;
            newTickets.push({ ...base, id: Math.random().toString(36).slice(2, 10), section: p.section || "", row: p.row || "", seats: "", qty: qty2, costPrice: totalCostUSD, qtyAvailable: qty2 });
            imported++;
          }
        }
      }
    });

    setTickets(prev => {
      var existingOrderRefs = new Set(prev.map(t => t.orderRef).filter(Boolean));
      var existingFingerprints = new Set(prev.map(t => [t.event, t.date, t.section, t.seats, t.accountEmail].join("|").toLowerCase()));
      var toAdd = newTickets.filter(t => {
        var fp = [t.event, t.date, t.section, t.seats, t.accountEmail].join("|").toLowerCase();
        if (existingFingerprints.has(fp)) { skipped++; return false; }
        if (t.orderRef && !t.seats && existingOrderRefs.has(t.orderRef)) { skipped++; return false; }
        return true;
      });
      notify("Imported " + toAdd.length + " tickets" + (skipped > 0 ? " · " + skipped + " duplicates skipped" : ""));
      return prev.concat(toAdd);
    });

    setBulkEmails([]); setBulkParsed([]); setBulkSelected({});
  }

  async function parseWithAI() {
    if (!emailText.trim()) return;
    const site = detectSite(emailText);
    if (site === "liverpool") { setParsed(parseLiverpoolEmail(emailText)[0]); return; }
    if (!settings.openAiKey) { setParsed(parseEmail(emailText, site)); return; }
    setAiParsing(true); setParsed(null);
    try {
      var clean = stripEmailForAI(emailText);
      var res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.openAiKey },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 300,
          messages: [{ role: "user", content: "Parse this ticket confirmation. Return ONLY JSON with keys: event,date,time,venue,section,row,seats,qty,costPrice,orderRef,category,accountEmail,restrictions,isStanding.\nStanding/Pitch/Floor: isStanding=true, clear section/row/seats.\nqty = total ticket count.\nrestrictions without Album Pre-Order Pre-Sale prefix.\ncostPrice from Total (incl. fee).\n\n" + clean }]
        })
      });
      var data = await res.json();
      var content = data.choices?.[0]?.message?.content || "";
      if (!res.ok) throw new Error(content || "API error");
      var result = JSON.parse(content.replace(/```json|```/g, "").trim());
      setParsed({ ...result, confidence: "high", aiParsed: true });
    } catch(e) { notify("AI failed: " + e.message + " — using auto parser", "err"); setParsed(parseEmail(emailText)); }
    setAiParsing(false);
  }

  var gmailAccounts = settings.gmailAccounts || [];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "#0f172a", letterSpacing: "-0.5px" }}>Settings</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Integrations & Configuration</div>
      </div>

      <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>

        {/* Accounts */}
        <div style={{ background: "white", border: "0.5px solid #e2e6ea", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "0.5px solid #e2e6ea", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#ea4335", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✉️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>Email Accounts</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{gmailAccounts.length === 0 ? "No accounts added" : gmailAccounts.length + " account" + (gmailAccounts.length > 1 ? "s" : "") + " connected"}</div>
            </div>
          </div>
          <div style={{ display: "flex", borderBottom: "0.5px solid #e2e6ea", background: "#fafbfc" }}>
            {[["gmail", "📧 Gmail IMAP"], ["aycd", "⚡ AYCD Inbox"]].map(t => {
              var active = accountsTab === t[0];
              return <button key={t[0]} onClick={() => setAccountsTab(t[0])} style={{ padding: "10px 20px", fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "#f97316" : "#64748b", background: "none", border: "none", borderBottom: active ? "2px solid #f97316" : "2px solid transparent", cursor: "pointer", fontFamily: "var(--body)", marginBottom: -1 }}>{t[1]}</button>;
            })}
          </div>
          {accountsTab === "gmail" && (
            <div>
              {gmailAccounts.length > 0 && (
                <div style={{ borderBottom: "0.5px solid #e2e6ea" }}>
                  {gmailAccounts.map((acc, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 24px", borderBottom: i < gmailAccounts.length - 1 ? "0.5px solid #f1f4f8" : "none" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{acc.email}</div>
                        <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Added {acc.addedAt ? new Date(acc.addedAt).toLocaleDateString("en-GB") : "—"}</div>
                      </div>
                      <button className="del-btn" onClick={() => removeAccount(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: 24, display: "grid", gap: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Add a Gmail Account</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Gmail Address</label>
                    <input id="gmail-email-input" type="email" placeholder="you@gmail.com" style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", color: "#0f172a", fontFamily: "var(--body)", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>App Password</label>
                    <input id="gmail-pass-input" type="password" placeholder="xxxx xxxx xxxx xxxx" style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", color: "#0f172a", fontFamily: "monospace", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }} />
                  </div>
                </div>
                <button className="action-btn" style={{ width: "fit-content" }} onClick={addGmailAccount}>+ Add Account</button>
                <div style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", borderRadius: 7, padding: 16, fontSize: 12, color: "#64748b", lineHeight: 1.9 }}>
                  <b style={{ color: "#0f172a" }}>How to get a Gmail App Password:</b><br />
                  Google Account → Security → 2-Step Verification → App Passwords → Create one named "Queud"<br />
                  <a href="https://support.google.com/mail/answer/185833" target="_blank" rel="noreferrer" style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}>Open Google App Passwords guide →</a>
                </div>
              </div>
            </div>
          )}
          {accountsTab === "aycd" && (
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="password" value={aycdApiKey} onChange={e => setAycdApiKey(e.target.value)} placeholder="Paste your AYCD API key" style={{ flex: 1, background: "#f7f8fa", border: "0.5px solid #e2e6ea", borderRadius: 7, padding: "8px 10px", fontFamily: "var(--body)", fontSize: 13, color: "#0f172a", outline: "none" }} />
                <button onClick={saveAycdKey} style={{ background: "#1a3a6e", color: "white", border: "none", borderRadius: 7, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--body)" }}>Save</button>
              </div>
              {settings.aycdApiKey && <div style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>✓ API key saved</div>}
            </div>
          )}
        </div>

        {/* Email Scraper */}
        <div style={{ background: "white", border: "0.5px solid #e2e6ea", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "0.5px solid #e2e6ea", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#4285f4", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📥</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>Email Scraper</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Search Gmail and import ticket confirmations in bulk</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: serverOnline === true ? "#22c55e" : serverOnline === false ? "#ef4444" : "#d1d5db" }} />
              <span style={{ fontSize: 11, color: "#64748b" }}>{serverOnline === true ? "Server online" : serverOnline === false ? "Server offline" : "Not checked"}</span>
              <button className="ghost-btn" style={{ fontSize: 11, padding: "5px 10px" }} onClick={checkServer}>Check</button>
            </div>
          </div>
          <div style={{ padding: 24, display: "grid", gap: 16 }}>
            {serverOnline === false && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: 14, fontSize: 12, color: "#dc2626" }}>
                Server not running. In your queud-server folder run: <b>node server.js</b>
              </div>
            )}

            {/* 3-column filter row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>Gmail Account</label>
                <select value={bulkSelectedAccount} onChange={e => setBulkSelectedAccount(e.target.value)} style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", color: "#0f172a", fontFamily: "var(--body)", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }}>
                  <option value="">Select account…</option>
                  {gmailAccounts.map(a => <option key={a.email} value={a.email}>{a.email}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>Website</label>
                <select value={bulkSite} onChange={e => handleSiteChange(e.target.value)} style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", color: "#0f172a", fontFamily: "var(--body)", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }}>
                  <option value="">Select site...</option>{SITES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: "0.5px", textTransform: "uppercase", color: "#64748b", marginBottom: 6 }}>Search Subject / Keyword</label>
                <input value={bulkSearchTerm} onChange={e => setBulkSearchTerm(e.target.value)} placeholder="e.g. booking confirmation" style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", color: "#0f172a", fontFamily: "var(--body)", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }} />
              </div>
            </div>

            <button className="action-btn" style={{ width: "fit-content" }} disabled={bulkFetching || !bulkSelectedAccount} onClick={fetchEmails}>
              {bulkFetching ? "⏳ Fetching…" : "🔍 Fetch Emails"}
            </button>

            {bulkEmails.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{bulkEmails.length} emails found</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => { var all = {}; bulkEmails.forEach(e => { all[e.uid] = true; }); setBulkSelected(all); }}>Select All</button>
                    <button className="ghost-btn" style={{ fontSize: 11 }} onClick={() => setBulkSelected({})}>Deselect All</button>
                  </div>
                </div>
                <div style={{ border: "0.5px solid #e2e6ea", borderRadius: 7, overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
                  {bulkEmails.map((email, i) => (
                    <div key={email.uid} onClick={() => setBulkSelected(s => ({ ...s, [email.uid]: !s[email.uid] }))} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderBottom: i < bulkEmails.length - 1 ? "0.5px solid #f1f4f8" : "none", cursor: "pointer", background: bulkSelected[email.uid] ? "#f0fdf4" : "white" }}>
                      <div style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (bulkSelected[email.uid] ? "#f97316" : "#d1d5db"), background: bulkSelected[email.uid] ? "#f97316" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {bulkSelected[email.uid] && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.subject || "(no subject)"}</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{email.from} · {email.date ? new Date(email.date).toLocaleDateString("en-GB") : "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
                  {(() => {
                    var numSel = Object.values(bulkSelected).filter(Boolean).length;
                    var isDone = !bulkParsing && bulkParsed.length > 0 && numSel > 0;
                    return (
                      <button disabled={bulkParsing || numSel === 0} onClick={parseSelected}
                        style={{ background: isDone ? "#1a3a6e" : "#f97316", color: "white", border: "none", borderRadius: 7, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: numSel === 0 ? "not-allowed" : "pointer", fontFamily: "var(--body)", display: "inline-flex", alignItems: "center", gap: 6, opacity: numSel === 0 ? 0.5 : 1 }}>
                        {bulkParsing ? "⏳ Parsing " + parseProgress.done + " / " + parseProgress.total + "…" : isDone ? "✅ Parsed " + bulkParsed.length + " — Parse Again" : "✨ Parse " + numSel + " Selected"}
                      </button>
                    );
                  })()}
                  <span style={{ fontSize: 11, color: "#64748b" }}>{Object.values(bulkSelected).filter(Boolean).length} of {bulkEmails.length} selected</span>
                </div>

                {bulkParsed.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>{bulkParsed.length} tickets ready to import</div>
                    <div style={{ border: "0.5px solid #e2e6ea", borderRadius: 7, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                      {bulkParsed.map((p, i) => {
                        var missingPrice = !p.costPrice || p.costPrice === 0;
                        var standing = p.isStanding || isStandingTicket(p.restrictions || "");
                        return (
                          <div key={p._uid || i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderBottom: i < bulkParsed.length - 1 ? "0.5px solid #f1f4f8" : "none", background: missingPrice ? "#fffbeb" : "white" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{p.event || p._subject || "Unknown"}</div>
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                                {p.date ? "📅 " + p.date + "  " : ""}
                                {p.venue ? "📍 " + p.venue.replace(/,.*$/, "").trim() + "  " : ""}
                                {standing ? <span style={{ color: "#7c3aed", fontWeight: 600 }}>Standing ×{p.qty}  </span> : (p.section ? "§" + p.section + (p.row ? " Row " + p.row : "") + (p.seats ? " Seat " + p.seats : "") + "  " : "")}
                                {p.costPrice > 0 ? "💳 " + (p.originalCurrency === "GBP" ? "£" : p.originalCurrency === "EUR" ? "€" : "$") + p.costPrice : ""}
                              </div>
                            </div>
                            {missingPrice && <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "2px 8px", flexShrink: 0 }}>⚠ No price</div>}
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={importAll} style={{ marginTop: 12, background: "#059669", color: "white", border: "none", borderRadius: 7, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--body)", display: "inline-flex", alignItems: "center", gap: 6 }}>⬆ Import {bulkParsed.length} to Inventory</button>
                    {bulkParsed.filter(p => !p.costPrice || p.costPrice === 0).length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "8px 12px" }}>
                        ⚠ {bulkParsed.filter(p => !p.costPrice || p.costPrice === 0).length} tickets have no price — edit after importing.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: 14, fontSize: 12, color: "#1e40af", lineHeight: 1.8 }}>
              Requires local server. In your queud-server folder run: <b>npm install</b> then <b>node server.js</b>
            </div>
          </div>
        </div>

        {/* AI */}
        <div style={{ background: "white", border: "0.5px solid #e2e6ea", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "0.5px solid #e2e6ea", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#10a37f", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>AI Email Parsing</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Use Claude to extract ticket data (Anthropic API key)</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: settings.openAiKey ? "#059669" : "#64748b" }}>{settings.openAiKey ? "✓ Active" : "Not configured"}</div>
          </div>
          <div style={{ padding: 24 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#64748b", marginBottom: 6 }}>Anthropic API Key</label>
            <input type="password" value={settings.openAiKey || ""} onChange={e => setSettings(s => ({ ...s, openAiKey: e.target.value }))} placeholder="sk-..." style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", color: "#0f172a", fontFamily: "monospace", fontSize: 12, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }} />
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "#f97316", fontWeight: 700, textDecoration: "none" }}>Get your key →</a>
            </div>
          </div>
        </div>

        {/* Manual Email Paste */}
        <div style={{ background: "white", border: "0.5px solid #e2e6ea", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "0.5px solid #e2e6ea", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#34a853", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>Manual Email Paste</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Paste a full email — site is auto-detected</div>
            </div>
          </div>
          <div style={{ padding: 24, display: "grid", gap: 14 }}>
            <textarea value={emailText} onChange={e => { setEmailText(e.target.value); setParsed(null); }} placeholder={"Paste anything here:\n• Ticketmaster UK confirmation\n• Liverpool FC Booking Confirmation\n• Any ticket email"} style={{ background: "#f7f8fa", border: "0.5px solid #e2e6ea", color: "#0f172a", fontFamily: "var(--body)", fontSize: 12, padding: 16, width: "100%", height: 140, resize: "vertical", borderRadius: 7, outline: "none", lineHeight: 1.8 }} />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="action-btn" onClick={parseWithAI}>{aiParsing ? "⏳ Parsing…" : settings.openAiKey ? "✨ Parse with AI" : "Parse Email"}</button>
              <button className="ghost-btn" onClick={() => { setEmailText(""); setParsed(null); }}>Clear</button>
            </div>
            {parsed && (
              <div style={{ background: "#f0fdf4", border: "2px solid #bbf7d0", padding: 18, borderRadius: 7 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {[["Event", parsed.event || "Not detected"], ["Date", parsed.date || "—"], ["Venue", parsed.venue || "—"], ["Type", parsed.isStanding ? "Standing / Pitch" : "Seated"], ["Section", parsed.isStanding ? "N/A" : (parsed.section || "—")], ["Row", parsed.isStanding ? "N/A" : (parsed.row || "—")], ["Seats", parsed.isStanding ? "N/A" : (parsed.seats || "—")], ["Qty", parsed.qty || "—"], ["Cost", parsed.costPrice > 0 ? fmt(parsed.costPrice) : "—"], ["Restrictions", parsed.restrictions || "—"]].map(item => (
                    <div key={item[0]} style={{ background: "white", padding: "8px 12px", borderRadius: 7, border: "0.5px solid #e2e6ea" }}>
                      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#64748b", textTransform: "uppercase", marginBottom: 2 }}>{item[0]}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: item[1] === "Not detected" || item[1] === "—" || item[1] === "N/A" ? "#94a3b8" : "#0f172a" }}>{item[1]}</div>
                    </div>
                  ))}
                </div>
                <button className="action-btn" onClick={() => { importParsed(parsed); setEmailText(""); setParsed(null); }}>Import &amp; Review →</button>
              </div>
            )}
          </div>
        </div>

        {/* Data Management */}
        <div style={{ background: "white", border: "0.5px solid #e2e6ea", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "0.5px solid #e2e6ea", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#6366f1", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🗄️</div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#0f172a" }}>Data Management</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{tickets.length} events · {sales.length} sales stored</div>
            </div>
          </div>
          <div style={{ padding: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="ghost-btn" onClick={() => {
              var data = { tickets, sales, exportedAt: new Date().toISOString() };
              var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              var url = URL.createObjectURL(blob);
              var a = document.createElement("a"); a.href = url; a.download = "queud-backup-" + today() + ".json"; a.click();
              URL.revokeObjectURL(url); notify("Backup downloaded");
            }}>⬇ Export JSON Backup</button>
            <button className="ghost-btn" onClick={() => {
              var rows = [["Event","Date","Venue","Section","Row","Qty","Cost","Category","Order Ref","Restrictions"]].concat(tickets.map(t => [t.event,t.date,t.venue,t.section,t.row,t.qty,t.costPrice,t.category,t.orderRef,t.restrictions]));
              var csv = rows.map(r => r.map(c => '"' + (c || "") + '"').join(",")).join("\n");
              var blob = new Blob([csv], { type: "text/csv" });
              var url = URL.createObjectURL(blob);
              var a = document.createElement("a"); a.href = url; a.download = "queud-inventory-" + today() + ".csv"; a.click();
              URL.revokeObjectURL(url); notify("CSV downloaded");
            }}>⬇ Export Inventory CSV</button>
            <button className="ghost-btn" style={{ color: "#ef4444", borderColor: "#fecaca" }} onClick={() => {
              if (window.confirm("Clear ALL data? This cannot be undone.")) {
                setTickets([]); setSales([]); notify("All data cleared");
              }
            }}>🗑 Clear All Data</button>
          </div>
        </div>

      </div>
    </div>
  );
}