export default function EmailAccounts({ settings, setSettings, gmailAccounts, accountsTab, setAccountsTab, aycdApiKey, setAycdApiKey, addGmailAccount, removeAccount, saveAycdKey, inputStyle, notify }) {
  return (
    <>
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
    </>
  );
}