import { useState } from "react";
import { fmt, today, detectCurrency } from "../utils/format";
import { parseEmail, stripEmailForAI } from "../utils/parseEmail";

export default function Settings({ settings, setSettings, tickets, setTickets, sales, notify, importParsed }) {
  const [serverOnline, setServerOnline] = useState(null);
  const [bulkSelectedAccount, setBulkSelectedAccount] = useState("");
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

  function checkServer() {
    fetch("http://localhost:3001/health")
      .then(function(r) { return r.json(); })
      .then(function(d) { setServerOnline(d.ok === true); })
      .catch(function() { setServerOnline(false); });
  }

  function saveAycdKey() {
    if (!aycdApiKey.trim()) return notify("Enter your AYCD API key", "err");
    setSettings(function(s) { return { ...s, aycdApiKey: aycdApiKey.trim() }; });
    notify("AYCD API key saved ✓");
  }

  function addGmailAccount() {
    var email = document.getElementById("gmail-email-input").value.trim();
    var pass = document.getElementById("gmail-pass-input").value.trim();
    if (!email || !pass) return notify("Enter both email and app password", "err");
    if (!email.includes("@")) return notify("Enter a valid email address", "err");
    var existing = settings.gmailAccounts || [];
    if (existing.find(function(a) { return a.email === email; })) return notify("Account already added", "err");
    setSettings(function(s) { return Object.assign({}, s, { gmailAccounts: existing.concat([{ email: email, appPassword: pass, addedAt: new Date().toISOString() }]) }); });
    document.getElementById("gmail-email-input").value = "";
    document.getElementById("gmail-pass-input").value = "";
    notify("Gmail account added");
  }

  function removeAccount(i) {
    var updated = (settings.gmailAccounts || []).filter(function(_, j) { return j !== i; });
    setSettings(function(s) { return Object.assign({}, s, { gmailAccounts: updated }); });
    notify("Account removed");
  }

  function fetchEmails() {
    var acc = (settings.gmailAccounts || []).find(function(a) { return a.email === bulkSelectedAccount; });
    if (!acc) return notify("Select a Gmail account first", "err");
    setBulkFetching(true); setBulkEmails([]); setBulkParsed([]); setBulkSelected({});
    fetch("http://localhost:3001/fetch-emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: acc.email, appPassword: acc.appPassword, searchSubject: bulkSearchTerm, maxEmails: 100 }),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (!data.ok) throw new Error(data.error || "Fetch failed");
        setBulkEmails(data.emails || []);
        notify("Found " + (data.emails || []).length + " emails");
      })
      .catch(function(e) { notify("Error: " + e.message, "err"); })
      .finally(function() { setBulkFetching(false); });
  }

  // Extract clean email address from strings like '"Hide My Email" <user@icloud.com>'
  function extractEmail(raw) {
    if (!raw) return "";
    var match = raw.match(/<([^>]+@[^>]+)>/);
    if (match) return match[1].trim();
    var plain = raw.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i);
    if (plain) return plain[0].trim();
    return raw.trim();
  }

  // Calculate qty from seat range e.g. "9 - 10" = 2, "9-11" = 3
  function calcQtyFromSeats(seats, fallbackQty) {
    if (!seats) return fallbackQty || 1;
    var m = seats.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (m) return Math.abs(parseInt(m[2]) - parseInt(m[1])) + 1;
    return fallbackQty || 1;
  }

  async function parseSelected() {
    var selected = bulkEmails.filter(function(e) { return bulkSelected[e.uid]; });
    if (!selected.length) return notify("Select at least one email", "err");
    setBulkParsing(true); setBulkParsed([]);
    setParseProgress({ done: 0, total: selected.length });

    // If no AI key, just use regex — instant
    if (!settings.openAiKey) {
      var regexResults = selected.map(function(email) {
        var p = parseEmail(email.subject + "\n" + email.body);
        var currency = /£/.test(email.body) ? "GBP" : /€/.test(email.body) ? "EUR" : "USD";
        return Object.assign({}, p, { originalCurrency: currency, accountEmail: extractEmail(email.to), qty: calcQtyFromSeats(p.seats, p.qty), _subject: email.subject, _uid: email.uid });
      });
      setBulkParsed(regexResults);
      setBulkParsing(false);
      setParseProgress({ done: regexResults.length, total: regexResults.length });
      notify("Parsed " + regexResults.length + " emails");
      return;
    }

    // AI parsing — run in parallel batches of 10
    const BATCH_SIZE = 10;
    var allResults = [];
    var done = 0;

    async function parseOne(email) {
      // Detect currency from raw email body
      var currency = /£/.test(email.body || "") ? "GBP" : /€/.test(email.body || "") ? "EUR" : "USD";
      try {
        var res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.openAiKey },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            max_tokens: 200,
            messages: [
              { role: "system", content: 'Extract ticket info from this Ticketmaster UK confirmation email. Return ONLY compact JSON: {"event":"","date":"","time":"","venue":"","section":"","row":"","seats":"","qty":1,"costPrice":0,"orderRef":"","category":"Concert","accountEmail":"","restrictions":""}. CRITICAL RULES: (1) "section" = the Section number e.g. "517". (2) "row" = the Row value e.g. "6" - this is a short value like a number or letter. (3) "seats" = ALL individual Seat numbers comma-separated e.g. "93, 94" - these are the individual seat numbers listed in each ticket box. Row and Seat are DIFFERENT fields - do not mix them up. (4) "restrictions" = ticket type e.g. "Seated Ticket", "Restricted Side View Seated Ticket". (5) "costPrice" = the number from "Total (incl. fee) £X". Return numbers only, empty string for missing fields.' },
              { role: "user", content: "Subject: " + email.subject + "\n" + (email.body || "").substring(0, 2000) }
            ],
            temperature: 0,
          })
        });
        var data = await res.json();
        var content = data.choices[0].message.content;
        var p = JSON.parse(content.replace(/```json|```/g, "").trim());
        // Clean up null strings returned by AI
        Object.keys(p).forEach(function(k) { if (p[k] === "null" || p[k] === null) p[k] = ""; });
        done++;
        setParseProgress(function(prev) { return { done: done, total: prev.total }; });
        return Object.assign({}, p, { originalCurrency: currency, originalAmount: p.costPrice, accountEmail: extractEmail(p.accountEmail || email.to), qty: calcQtyFromSeats(p.seats, p.qty), _subject: email.subject, _uid: email.uid });
      } catch(e) {
        done++;
        setParseProgress(function(prev) { return { done: done, total: prev.total }; });
        var fallback = parseEmail(email.subject + "\n" + (email.body || ""));
        return Object.assign({}, fallback, { originalCurrency: currency, originalAmount: fallback.costPrice, accountEmail: extractEmail(email.to), qty: calcQtyFromSeats(fallback.seats, fallback.qty), _subject: email.subject, _uid: email.uid });
      }
    }

    // Process in batches
    for (var b = 0; b < selected.length; b += BATCH_SIZE) {
      var batch = selected.slice(b, b + BATCH_SIZE);
      var batchResults = await Promise.all(batch.map(parseOne));
      allResults = allResults.concat(batchResults);
      setBulkParsed(allResults.slice()); // show results as they come in
    }

    setBulkParsing(false);
    notify("Parsed " + allResults.length + " emails");
  }

  async function importAll() {
    var imported = 0;
    notify("Converting currencies and importing...");
    var rateCache = { USD: 1 };

    var currencies = [...new Set(bulkParsed.map(function(p) {
      return p.originalCurrency || detectCurrency(p.rawCostString || "") || "USD";
    }))].filter(function(c) { return c !== "USD"; });

    for (var i = 0; i < currencies.length; i++) {
      var cur = currencies[i];
      try {
        var r = await fetch("https://open.er-api.com/v6/latest/" + cur);
        var d = await r.json();
        rateCache[cur] = d.result === "success" ? d.rates.USD : (cur === "GBP" ? 1.27 : 1.08);
      } catch(e) {
        rateCache[cur] = cur === "GBP" ? 1.27 : 1.08;
      }
    }

    // Parse seat string into individual seat numbers
    function parseSeats(seatsStr) {
      if (!seatsStr) return [];
      var s = seatsStr.replace(/seat[s]?\s*/gi, "").trim();
      // Range like "209 - 216" or "209-216"
      var rangeMatch = s.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (rangeMatch) {
        var start = parseInt(rangeMatch[1]);
        var end = parseInt(rangeMatch[2]);
        if (start > end) { var tmp = start; start = end; end = tmp; }
        var seats = [];
        for (var n = start; n <= end; n++) seats.push(n.toString());
        return seats;
      }
      // Comma separated "209, 210, 211, 212"
      if (s.includes(",")) {
        return s.split(",").map(function(x) { return x.trim(); }).filter(function(x) { return /^\d+$/.test(x); }).sort(function(a, b) { return parseInt(a) - parseInt(b); });
      }
      // Single seat number
      if (/^\d+$/.test(s)) return [s];
      // Range result — already sorted above
      return s ? [s] : [];
    }

    var skipped = 0;
    var newTickets = [];

    bulkParsed.forEach(function(p) {
      if (!p.event && !p._subject) return;
      var originalCurrency = p.originalCurrency || detectCurrency(p.rawCostString || "") || "USD";
      var originalAmount = parseFloat(p.costPrice) || 0;
      var exchangeRate = rateCache[originalCurrency] || 1;
      var totalCostUSD = originalCurrency !== "USD"
        ? parseFloat((originalAmount * exchangeRate).toFixed(2))
        : originalAmount;

      var seats = parseSeats(p.seats);
      var qty = seats.length || parseInt(p.qty) || 1;
      var costPerSeat = qty > 0 ? parseFloat((totalCostUSD / qty).toFixed(2)) : totalCostUSD;
      var origPerSeat = qty > 0 ? parseFloat((originalAmount / qty).toFixed(2)) : originalAmount;

      // Dedupe check — skip if orderRef already exists
      var orderRef = p.orderRef || "";

      if (seats.length > 0) {
        seats.forEach(function(seat, si) {
          newTickets.push({
            id: Math.random().toString(36).slice(2, 10),
            event: (p.event || p._subject || "").substring(0, 60),
            category: p.category || "Concert",
            subtype: "", date: p.date || "", time: (function(t) { if (!t) return ""; var pm = t.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i); if (pm) { var h = parseInt(pm[1]); if (pm[3].toLowerCase() === "pm" && h !== 12) h += 12; if (pm[3].toLowerCase() === "am" && h === 12) h = 0; return String(h).padStart(2,"0") + ":" + pm[2]; } return t; })(p.time),
            venue: p.venue || "",
            section: p.section || "",
            row: p.row || "",
            seats: seat,
            qty: 1,
            costPrice: costPerSeat,
            qtyAvailable: 1,
            originalCurrency: originalCurrency,
            originalAmount: origPerSeat,
            exchangeRate: exchangeRate,
            orderRef: orderRef,
            parentOrderRef: orderRef,
            notes: "", accountEmail: p.accountEmail || "",
            restrictions: p.restrictions || "",
            status: "Unsold",
            addedAt: new Date().toISOString(),
          });
          imported++;
        });
      } else {
        // No seats — import as single record (e.g. standing tickets)
        newTickets.push({
          id: Math.random().toString(36).slice(2, 10),
          event: (p.event || p._subject || "").substring(0, 60),
          category: p.category || "Concert",
          subtype: "", date: p.date || "", time: p.time || "",
          venue: p.venue || "", section: p.section || "", row: p.row || "", seats: "",
          qty: qty, costPrice: totalCostUSD, qtyAvailable: qty,
          originalCurrency: originalCurrency,
          originalAmount: originalAmount,
          exchangeRate: exchangeRate,
          orderRef: orderRef,
          parentOrderRef: orderRef,
          notes: "", accountEmail: p.accountEmail || "",
          restrictions: p.restrictions || "",
          status: "Unsold",
          addedAt: new Date().toISOString(),
        });
        imported++;
      }
    });

    setTickets(function(prev) {
      var existingOrderRefs = new Set(prev.map(function(t) { return t.orderRef; }).filter(Boolean));
      var existingFingerprints = new Set(prev.map(function(t) {
        return [t.event, t.date, t.section, t.seats, t.accountEmail].join("|").toLowerCase();
      }));

      var toAdd = newTickets.filter(function(t) {
        // Skip if orderRef already imported
        if (t.orderRef && existingOrderRefs.has(t.orderRef)) { skipped++; return false; }
        // Skip by fingerprint
        var fp = [t.event, t.date, t.section, t.seats, t.accountEmail].join("|").toLowerCase();
        if (existingFingerprints.has(fp)) { skipped++; return false; }
        return true;
      });

      notify("Imported " + toAdd.length + " tickets" + (skipped > 0 ? " · " + skipped + " duplicates skipped" : ""));
      return prev.concat(toAdd);
    });

    setBulkEmails([]); setBulkParsed([]); setBulkSelected({});
  }

  async function parseWithAI() {
    if (!emailText.trim()) return;
    if (!settings.openAiKey) { setParsed(parseEmail(emailText)); return; }
    setAiParsing(true); setParsed(null);
    try {
      var clean = stripEmailForAI(emailText);
      var res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + settings.openAiKey },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: 'Parse ticket confirmation. Return ONLY JSON: {"event":"","date":"","time":"","venue":"","section":"","row":"","seats":"","qty":1,"costPrice":0,"orderRef":"","category":"Concert","accountEmail":""}. null for missing.' },
            { role: "user", content: "Parse this:\n\n" + clean }
          ],
          temperature: 0,
        })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error.message);
      var result = JSON.parse(data.choices[0].message.content.replace(/```json|```/g, "").trim());
      setParsed(Object.assign({}, result, { confidence: "high", aiParsed: true }));
    } catch(e) {
      notify("AI failed: " + e.message + " — using auto parser", "err");
      setParsed(parseEmail(emailText));
    }
    setAiParsing(false);
  }

  var gmailAccounts = settings.gmailAccounts || [];

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 500, fontSize: 22, color: "#111827", letterSpacing: "-0.02em" }}>Settings</div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, letterSpacing: "0.04em", textTransform: "uppercase" }}>Integrations & Configuration</div>
      </div>

      <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>

        {/* Accounts */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#ea4335", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✉️</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>Email Accounts</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{gmailAccounts.length === 0 ? "No accounts added" : gmailAccounts.length + " account" + (gmailAccounts.length > 1 ? "s" : "") + " connected"}</div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border)", background: "#fafafa" }}>
            {[["gmail", "📧 Gmail IMAP"], ["aycd", "⚡ AYCD Inbox"]].map(function(t) {
              var active = accountsTab === t[0];
              return (
                <button key={t[0]} onClick={function() { setAccountsTab(t[0]); }}
                  style={{ padding: "10px 20px", fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "var(--orange)" : "var(--muted)", background: "none", border: "none", borderBottom: active ? "2px solid var(--orange)" : "2px solid transparent", cursor: "pointer", fontFamily: "Inter, sans-serif", marginBottom: -1 }}>
                  {t[1]}
                </button>
              );
            })}
          </div>

          {/* Gmail tab */}
          {accountsTab === "gmail" && (
            <div>
              {gmailAccounts.length > 0 && (
                <div style={{ borderBottom: "1px solid var(--border)" }}>
                  {gmailAccounts.map(function(acc, i) {
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 24px", borderBottom: i < gmailAccounts.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{acc.email}</div>
                          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Added {acc.addedAt ? new Date(acc.addedAt).toLocaleDateString("en-GB") : "—"}</div>
                        </div>
                        <button className="del-btn" onClick={function() { removeAccount(i); }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{ padding: 24, display: "grid", gap: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>Add a Gmail Account</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 6 }}>Gmail Address</label>
                    <input id="gmail-email-input" type="email" placeholder="you@gmail.com" style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", color: "#111827", fontFamily: "Inter, sans-serif", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 6 }}>App Password</label>
                    <input id="gmail-pass-input" type="password" placeholder="xxxx xxxx xxxx xxxx" style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", color: "#111827", fontFamily: "monospace", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }} />
                  </div>
                </div>
                <button className="action-btn" style={{ width: "fit-content" }} onClick={addGmailAccount}>+ Add Account</button>
                <div style={{ background: "#fafafa", border: "0.5px solid #e8e8ec", borderRadius: 7, padding: 16, fontSize: 12, color: "#6b7280", lineHeight: 1.9 }}>
                  <b style={{ color: "#111827" }}>How to get a Gmail App Password:</b><br />
                  Google Account → Security → 2-Step Verification → App Passwords → Create one named "Queud"<br />
                  <a href="https://support.google.com/mail/answer/185833" target="_blank" rel="noreferrer" style={{ color: "var(--orange)", fontWeight: 700, textDecoration: "none" }}>Open Google App Passwords guide →</a>
                </div>
              </div>
            </div>
          )}

          {/* AYCD tab */}
          {accountsTab === "aycd" && (
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="password" value={aycdApiKey} onChange={function(e) { setAycdApiKey(e.target.value); }}
                  placeholder="Paste your AYCD API key"
                  style={{ flex: 1, background: "#fafafa", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "8px 10px", fontFamily: "Inter, sans-serif", fontSize: 13, color: "#111827", outline: "none" }} />
                <button onClick={saveAycdKey} style={{ background: "var(--navy)", color: "white", border: "none", borderRadius: 7, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  Save
                </button>
              </div>
              {settings.aycdApiKey && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
                  ✓ API key saved — AYCD Inbox is ready to use in Email Scraper
                </div>
              )}
              <div style={{ background: "#fafafa", border: "0.5px solid #e8e8ec", borderRadius: 7, padding: 16, fontSize: 12, color: "#6b7280", lineHeight: 1.9 }}>
                <b style={{ color: "#111827" }}>How to get your AYCD API key:</b><br />
                Open the AYCD Inbox desktop app → Settings → Tasks (API) → copy your key.<br />
                The Inbox app must be open whenever you fetch emails via AYCD.
              </div>
            </div>
          )}
        </div>

        {/* OpenAI */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#10a37f", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>AI Email Parsing</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Use ChatGPT to extract ticket data from any email</div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: settings.openAiKey ? "#16a34a" : "var(--muted)" }}>{settings.openAiKey ? "✓ Active" : "Not configured"}</div>
          </div>
          <div style={{ padding: 24, display: "grid", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 6 }}>OpenAI API Key</label>
              <input type="password" value={settings.openAiKey || ""} onChange={function(e) { setSettings(function(s) { return Object.assign({}, s, { openAiKey: e.target.value }); }); }} placeholder="sk-..." style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", color: "#111827", fontFamily: "monospace", fontSize: 12, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }} />
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>Saved locally. Never shared except with OpenAI. <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "var(--orange)", fontWeight: 700, textDecoration: "none" }}>Get your key →</a></div>
            </div>
          </div>
        </div>

        {/* Email Scraper */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#4285f4", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📥</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>Email Scraper</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Search your Gmail inbox and import ticket confirmation emails in bulk</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: serverOnline === true ? "#22c55e" : serverOnline === false ? "#ef4444" : "#d1d5db" }} />
              <span style={{ fontSize: 11, color: "#6b7280" }}>{serverOnline === true ? "Server online" : serverOnline === false ? "Server offline" : "Not checked"}</span>
              <button className="ghost-btn" style={{ fontSize: 11, padding: "5px 10px" }} onClick={checkServer}>Check</button>
            </div>
          </div>
          <div style={{ padding: 24, display: "grid", gap: 16 }}>
            {serverOnline === false && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 7, padding: 14, fontSize: 12, color: "#dc2626" }}>
                Server not running. Open a terminal in your queud-server folder and run: node server.js
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 6 }}>Gmail Account</label>
                <select value={bulkSelectedAccount} onChange={function(e) { setBulkSelectedAccount(e.target.value); }} style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", color: "#111827", fontFamily: "Inter, sans-serif", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }}>
                  <option value="">Select account…</option>
                  {gmailAccounts.map(function(a) { return <option key={a.email} value={a.email}>{a.email}</option>; })}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#6b7280", marginBottom: 6 }}>Search Subject / Keyword</label>
                <input value={bulkSearchTerm} onChange={function(e) { setBulkSearchTerm(e.target.value); }} placeholder="e.g. Your booking confirmation" style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", color: "#111827", fontFamily: "Inter, sans-serif", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" }} />
              </div>
            </div>
            <button className="action-btn" style={{ width: "fit-content" }} disabled={bulkFetching || !bulkSelectedAccount} onClick={fetchEmails}>
              {bulkFetching ? "⏳ Fetching…" : "🔍 Fetch Emails"}
            </button>

            {bulkEmails.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{bulkEmails.length} emails found</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="ghost-btn" style={{ fontSize: 11 }} onClick={function() { var all = {}; bulkEmails.forEach(function(e) { all[e.uid] = true; }); setBulkSelected(all); }}>Select All</button>
                    <button className="ghost-btn" style={{ fontSize: 11 }} onClick={function() { setBulkSelected({}); }}>Deselect All</button>
                  </div>
                </div>
                <div style={{ border: "0.5px solid #e8e8ec", borderRadius: 7, overflow: "hidden", maxHeight: 300, overflowY: "auto" }}>
                  {bulkEmails.map(function(email, i) {
                    return (
                      <div key={email.uid} onClick={function() { setBulkSelected(function(s) { var n = Object.assign({}, s); n[email.uid] = !n[email.uid]; return n; }); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderBottom: i < bulkEmails.length - 1 ? "1px solid #f1f5f9" : "none", cursor: "pointer", background: bulkSelected[email.uid] ? "#f0fdf4" : "white" }}>
                        <div style={{ width: 18, height: 18, borderRadius: 4, border: "2px solid " + (bulkSelected[email.uid] ? "var(--orange)" : "#d1d5db"), background: bulkSelected[email.uid] ? "var(--orange)" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {bulkSelected[email.uid] && <span style={{ color: "white", fontSize: 11, fontWeight: 700 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email.subject || "(no subject)"}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{email.from} · {email.date ? new Date(email.date).toLocaleDateString("en-GB") : "—"}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
                  {(() => {
                    var numSel = Object.values(bulkSelected).filter(Boolean).length;
                    var isDone = !bulkParsing && bulkParsed.length > 0 && bulkParsed.length >= numSel && numSel > 0;
                    return (
                      <button disabled={bulkParsing || numSel === 0} onClick={parseSelected}
                        style={{ background: isDone ? "var(--navy)" : "var(--orange)", color: "white", border: "none", borderRadius: 7, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: numSel === 0 ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", transition: "background 0.3s", display: "inline-flex", alignItems: "center", gap: 6, opacity: numSel === 0 ? 0.5 : 1 }}>
                        {bulkParsing ? "⏳ Parsing " + parseProgress.done + " / " + parseProgress.total + "…" : isDone ? "✅ Parsed " + bulkParsed.length + " — Parse Again" : "✨ Parse " + numSel + " Selected"}
                      </button>
                    );
                  })()}
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{Object.values(bulkSelected).filter(Boolean).length} of {bulkEmails.length} selected</span>
                </div>
                {bulkParsed.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 10 }}>{bulkParsed.length} ready to import</div>
                    <div style={{ border: "0.5px solid #e8e8ec", borderRadius: 7, overflow: "hidden", maxHeight: 280, overflowY: "auto" }}>
                      {bulkParsed.map(function(p, i) {
                        var missingPrice = !p.costPrice || p.costPrice === 0;
                        return (
                          <div key={p._uid} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderBottom: i < bulkParsed.length - 1 ? "1px solid #f1f5f9" : "none", background: missingPrice ? "#fffbeb" : "white" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{p.event || p._subject || "Unknown"}</div>
                              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                                {p.date ? "📅 " + p.date + "  " : ""}
                                {p.venue ? "📍 " + p.venue + "  " : ""}
                                {p.section ? "§" + p.section + "  " : ""}
                                {p.costPrice > 0 ? "💳 " + (p.originalCurrency === "GBP" ? "£" : p.originalCurrency === "EUR" ? "€" : "$") + p.costPrice + (p.originalCurrency && p.originalCurrency !== "USD" ? " " + p.originalCurrency : "") : ""}
                              </div>
                            </div>
                            {missingPrice && (
                              <div style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "2px 8px", flexShrink: 0 }}>⚠ No price</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={importAll} style={{ marginTop: 12, background: "#16a34a", color: "white", border: "none", borderRadius: 7, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "Inter, sans-serif", display: "inline-flex", alignItems: "center", gap: 6 }}>⬆ Import {bulkParsed.length} to Inventory</button>
                    {bulkParsed.filter(function(p) { return !p.costPrice || p.costPrice === 0; }).length > 0 && (
                      <div style={{ marginTop: 8, fontSize: 11, color: "#d97706", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 7, padding: "8px 12px" }}>
                        ⚠ {bulkParsed.filter(function(p) { return !p.costPrice || p.costPrice === 0; }).length} tickets have no price — edit after importing.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 7, padding: 14, fontSize: 12, color: "#1e40af", lineHeight: 1.8 }}>
              Requires local server running. In your queud-server folder run: <b>npm install</b> then <b>node server.js</b>
            </div>
          </div>
        </div>

        {/* Manual Email Paste */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#34a853", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>Manual Email Paste</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Paste anything — subject line, full email, or any snippet</div>
            </div>
          </div>
          <div style={{ padding: 24, display: "grid", gap: 14 }}>
            <textarea value={emailText} onChange={function(e) { setEmailText(e.target.value); setParsed(null); }} placeholder={"Paste anything here:\n• Just the subject: \"You Got Tickets To Oasis\"\n• Full confirmation email\n• Any order summary"} style={{ background: "#fafafa", border: "0.5px solid #e5e7eb", color: "#111827", fontFamily: "Inter, sans-serif", fontSize: 12, padding: 16, width: "100%", height: 140, resize: "vertical", borderRadius: 7, outline: "none", lineHeight: 1.8 }} />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button className="action-btn" onClick={parseWithAI}>
                {aiParsing ? "⏳ AI Parsing…" : settings.openAiKey ? "✨ Parse with AI" : "Parse Email"}
              </button>
              <button className="ghost-btn" onClick={function() { setEmailText(""); setParsed(null); }}>Clear</button>
            </div>
            {parsed && (
              <div style={{ background: "#f0fdf4", border: "2px solid #bbf7d0", padding: 18, borderRadius: 7 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
                  {[["Event", parsed.event || "Not detected"], ["Date", parsed.date || "—"], ["Venue", parsed.venue || "—"], ["Section", parsed.section || "—"], ["Row", parsed.row || "—"], ["Seats", parsed.seats || "—"], ["Qty", parsed.qty || "—"], ["Cost", parsed.costPrice > 0 ? fmt(parsed.costPrice) : "—"]].map(function(item) {
                    return (
                      <div key={item[0]} style={{ background: "white", padding: "8px 12px", borderRadius: 7, border: "0.5px solid #e8e8ec" }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: "#6b7280", textTransform: "uppercase", marginBottom: 2 }}>{item[0]}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: item[1] === "Not detected" || item[1] === "—" ? "var(--muted)" : "var(--navy)" }}>{item[1]}</div>
                      </div>
                    );
                  })}
                </div>
                <button className="action-btn" onClick={function() { importParsed(parsed); setEmailText(""); setParsed(null); }}>Import &amp; Review →</button>
              </div>
            )}
          </div>
        </div>

        {/* Data Management */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, background: "#6366f1", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🗄️</div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 14, color: "#111827" }}>Data Management</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{tickets.length} events · {sales.length} sales stored locally</div>
            </div>
          </div>
          <div style={{ padding: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button className="ghost-btn" onClick={function() {
              var data = { tickets: tickets, sales: sales, exportedAt: new Date().toISOString() };
              var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              var url = URL.createObjectURL(blob);
              var a = document.createElement("a"); a.href = url; a.download = "queud-backup-" + today() + ".json"; a.click();
              URL.revokeObjectURL(url); notify("Backup downloaded");
            }}>⬇ Export JSON Backup</button>
            <button className="ghost-btn" onClick={function() {
              var rows = [["Event","Date","Venue","Section","Qty","Cost","Category","Order Ref"]].concat(tickets.map(function(t) { return [t.event,t.date,t.venue,t.section,t.qty,t.costPrice,t.category,t.orderRef]; }));
              var csv = rows.map(function(r) { return r.map(function(c) { return '"' + (c || "") + '"'; }).join(","); }).join("\n");
              var blob = new Blob([csv], { type: "text/csv" });
              var url = URL.createObjectURL(blob);
              var a = document.createElement("a"); a.href = url; a.download = "queud-inventory-" + today() + ".csv"; a.click();
              URL.revokeObjectURL(url); notify("CSV downloaded");
            }}>⬇ Export Inventory CSV</button>
            <button className="ghost-btn" style={{ color: "var(--red)", borderColor: "#fecaca" }} onClick={function() {
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