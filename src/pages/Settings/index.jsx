import { useState } from "react";
import { today } from "../../utils/format";
import EmailAccounts    from "./EmailAccounts";
import AIEmailParsing   from "./AIEmailParsing";
import DataManagement   from "./DataManagement";

export default function Settings({ settings, setSettings, tickets, setTickets, sales, setSales, notify }) {
  const [aycdApiKey, setAycdApiKey]     = useState(settings.aycdApiKey || "");
  const [accountsTab, setAccountsTab]   = useState("gmail");

  function saveAycdKey() {
    if (!aycdApiKey.trim()) return notify("Enter your AYCD API key", "err");
    setSettings(s => ({ ...s, aycdApiKey: aycdApiKey.trim() }));
    notify("AYCD API key saved");
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

  const gmailAccounts = settings.gmailAccounts || [];
  const inputStyle    = { background: "#fafafa", border: "0.5px solid #e5e7eb", color: "#111827", fontFamily: "Inter, sans-serif", fontSize: 13, padding: "8px 10px", width: "100%", borderRadius: 7, outline: "none" };

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "#0f172a", letterSpacing: "-0.5px" }}>Settings</div>
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Accounts, API keys & data management</div>
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
        <AIEmailParsing
          settings={settings} setSettings={setSettings}
          inputStyle={inputStyle}
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
