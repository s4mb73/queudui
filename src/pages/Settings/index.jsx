import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { today } from "../../utils/format";
import EmailAccounts    from "./EmailAccounts";
import AIEmailParsing   from "./AIEmailParsing";
import DataManagement   from "./DataManagement";

export default function Settings({ settings, setSettings, tickets, setTickets, sales, setSales, notify }) {
  const navigate = useNavigate();
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
        {/* Admin Tools */}
        <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, background: "rgba(26,58,110,0.08)", border: "0.5px solid rgba(26,58,110,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>!</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Admin Tools</div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Data management and cleanup</div>
            </div>
          </div>
          <div style={{ padding: "12px 18px", display: "flex", gap: 8 }}>
            <button onClick={() => navigate("/events")} className="ghost-btn" style={{ fontSize: 12 }}>
              Merge Duplicate Events
            </button>
          </div>
        </div>

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
