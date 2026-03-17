export default function AIEmailParsing({ settings, setSettings, inputStyle }) {
  return (
    <>
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
    </>
  );
}