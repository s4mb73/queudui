export default function ManualEmailPaste({ emailText, setEmailText, parsed, setParsed, aiParsing, parseWithAI, importParsed, inputStyle, settings, isStandingTicket }) {
  return (
    <>
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
    </>
  );
}