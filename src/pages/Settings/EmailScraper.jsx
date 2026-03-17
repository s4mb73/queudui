export default function EmailScraper({ settings, gmailAccounts, serverOnline, checkServer, bulkSelectedAccount, setBulkSelectedAccount, bulkSite, handleSiteChange, bulkSearchTerm, setBulkSearchTerm, bulkFetching, fetchEmails, bulkEmails, bulkSelected, setBulkSelected, bulkParsing, parseSelected, bulkParsed, parseProgress, importAll, inputStyle, notify, SITES, isStandingTicket }) {
  return (
    <>
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
    </>
  );
}