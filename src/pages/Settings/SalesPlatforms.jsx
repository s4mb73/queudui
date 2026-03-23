import { useState, useEffect, useRef } from "react";

const PLATFORMS = [
  { id: "tixstock", label: "Tixstock", color: "#059669", icon: "📦" },
  { id: "viagogo",  label: "Viagogo",  color: "#1a3a6e", icon: "🎫" },
  { id: "lysted",   label: "Lysted",   color: "#7c3aed", icon: "📋" },
];

const VIAGOGO_LOGIN_STEPS = [
  { key: "captcha", label: "Solving reCAPTCHA" },
  { key: "csrf",    label: "Loading login page" },
  { key: "email",   label: "Submitting email" },
  { key: "otp",     label: "Waiting for OTP" },
  { key: "verify",  label: "Verifying OTP" },
  { key: "done",    label: "Logged in" },
];

const SERVER  = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const SECRET  = import.meta.env.VITE_API_SECRET || "";
const HEADERS = { "Content-Type": "application/json", "x-queud-secret": SECRET };

export default function SalesPlatforms({ settings, setSettings, gmailAccounts, inputStyle, notify }) {
  const [syncStatus, setSyncStatus]       = useState({});
  const [syncing, setSyncing]             = useState({});
  const [serverUp, setServerUp]           = useState(null);
  const [viagogoSession, setViagogoSession] = useState(null);
  const [loginOpen, setLoginOpen]         = useState(false);
  const [loginEmail, setLoginEmail]       = useState("");
  const [loginStep, setLoginStep]         = useState(null);   // current step key
  const [loginStepMsg, setLoginStepMsg]   = useState("");
  const [loginError, setLoginError]       = useState(null);
  const [loginDone, setLoginDone]         = useState(false);
  const sseRef = useRef(null);

  useEffect(() => { fetchSyncStatus(); fetchViagogoSession(); }, []);

  function fetchSyncStatus() {
    fetch(`${SERVER}/sync-status`, { headers: HEADERS })
      .then(r => r.json())
      .then(d => { if (d.ok) setSyncStatus(d.status || {}); setServerUp(true); })
      .catch(() => setServerUp(false));
  }

  function fetchViagogoSession() {
    fetch(`${SERVER}/viagogo/status`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setViagogoSession(d); })
      .catch(() => {});
  }

  // ── Platform connections (Tixstock / Lysted) ───────────────────────────────
  function getConn(platformId) {
    return (settings.extra || {})[`salesPlatform_${platformId}`] || { email: "", connected: false };
  }

  function setConn(platformId, patch) {
    const current = getConn(platformId);
    setSettings(s => ({
      ...s,
      extra: { ...(s.extra || {}), [`salesPlatform_${platformId}`]: { ...current, ...patch } },
    }));
  }

  async function connectPlatform(platform) {
    const conn = getConn(platform.id);
    if (!conn.email) return notify("Select an email account first", "err");
    setSyncing(s => ({ ...s, [platform.id]: true }));
    try {
      setConn(platform.id, { connected: true });
      const res  = await fetch(`${SERVER}/sync-sales`, { method: "POST", headers: HEADERS, body: JSON.stringify({ platform: platform.id }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Sync failed");
      fetchSyncStatus();
      notify(`${platform.label} connected · ${data.total > 0 ? `${data.total} new sale${data.total !== 1 ? "s" : ""}` : "no new sales"}`);
    } catch(e) {
      setConn(platform.id, { connected: false });
      notify(`Failed to connect: ${e.message}`, "err");
    }
    setSyncing(s => ({ ...s, [platform.id]: false }));
  }

  async function syncNow(platform) {
    setSyncing(s => ({ ...s, [platform.id]: true }));
    try {
      const res  = await fetch(`${SERVER}/sync-sales`, { method: "POST", headers: HEADERS, body: JSON.stringify({ platform: platform.id }) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      fetchSyncStatus();
      notify(`${platform.label} synced · ${data.total > 0 ? `+${data.total} new sale${data.total !== 1 ? "s" : ""}` : "no new sales"}`);
    } catch(e) {
      notify(`Sync failed: ${e.message}`, "err");
    }
    setSyncing(s => ({ ...s, [platform.id]: false }));
  }

  function disconnect(platformId) {
    setConn(platformId, { connected: false, email: "" });
    notify("Disconnected");
  }

  // ── Viagogo login via SSE ──────────────────────────────────────────────────
  function openLoginModal() {
    setLoginEmail("");
    setLoginStep(null);
    setLoginStepMsg("");
    setLoginError(null);
    setLoginDone(false);
    setLoginOpen(true);
  }

  function closeLoginModal() {
    if (sseRef.current) { sseRef.current.abort(); sseRef.current = null; }
    setLoginOpen(false);
  }

  async function startViagogoLogin() {
    if (!loginEmail) return notify("Select a Gmail account", "err");
    const gmailIndex = gmailAccounts.findIndex(a => a.email === loginEmail);
    setLoginStep("captcha");
    setLoginError(null);
    setLoginDone(false);

    // SSE via fetch (POST + text/event-stream)
    const ctrl = new AbortController();
    sseRef.current = ctrl;

    try {
      const res = await fetch(`${SERVER}/viagogo/login`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ email: loginEmail, gmailIndex: gmailIndex >= 0 ? gmailIndex : 0 }),
        signal: ctrl.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const { step, message } = JSON.parse(line.slice(6));
            setLoginStep(step);
            setLoginStepMsg(message);
            if (step === "done") {
              setLoginDone(true);
              fetchViagogoSession();
              notify("Viagogo login successful ✓");
            }
            if (step === "error") {
              setLoginError(message);
            }
          } catch {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") setLoginError(e.message);
    }
  }

  async function scrapeViagogoNow() {
    setSyncing(s => ({ ...s, viagogo: true }));
    try {
      const res  = await fetch(`${SERVER}/viagogo/scrape`, { method: "POST", headers: HEADERS });
      const data = await res.json();
      if (res.status === 401) {
        setViagogoSession(null);
        notify("Viagogo session expired — please login again", "err");
        return;
      }
      if (!data.ok) throw new Error(data.error);
      notify(`Viagogo scraped · ${data.inserted} new, ${data.updated} updated`);
    } catch(e) {
      notify(`Scrape failed: ${e.message}`, "err");
    }
    setSyncing(s => ({ ...s, viagogo: false }));
  }

  function fmtTime(iso) {
    if (!iso) return null;
    const diff = Date.now() - new Date(iso);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString("en-GB");
  }

  const connectedCount = PLATFORMS.filter(p =>
    p.id === "viagogo" ? viagogoSession?.loggedIn : getConn(p.id).connected
  ).length;

  const currentStepIndex = VIAGOGO_LOGIN_STEPS.findIndex(s => s.key === loginStep);

  return (
    <div style={{ background: "white", border: "0.5px solid #e8e8ec", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>

      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #f0f0f3", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 34, height: 34, background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>🏪</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>Sales Platforms</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
            {connectedCount > 0 ? `${connectedCount} platform${connectedCount !== 1 ? "s" : ""} connected · auto-syncing every 5 min` : "Connect platforms to auto-import sales"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#9ca3af" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: serverUp === true ? "#22c55e" : serverUp === false ? "#ef4444" : "#d1d5db" }} />
          {serverUp === true ? "Server online" : serverUp === false ? "Server offline" : "Checking…"}
        </div>
      </div>

      {serverUp === false && (
        <div style={{ margin: "12px 18px 0", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 7, padding: "10px 14px", fontSize: 12, color: "#dc2626" }}>
          Server not reachable — sales won't sync.
          <span style={{ marginLeft: 8, color: "#1a3a6e", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }} onClick={fetchSyncStatus}>Retry</span>
        </div>
      )}

      {/* Platform rows */}
      <div style={{ padding: "14px 18px", display: "grid", gap: 10 }}>
        {PLATFORMS.map(platform => {
          const isViagogo   = platform.id === "viagogo";
          const conn        = isViagogo ? null : getConn(platform.id);
          const isConnected = isViagogo ? (viagogoSession?.loggedIn === true) : conn.connected;
          const isSyncing   = syncing[platform.id];
          const syncKey     = `sync_${platform.id}_${(conn?.email || "").replace(/[@.]/g, "_")}`;
          const lastSync    = syncStatus[syncKey];

          return (
            <div key={platform.id} style={{ border: `1px solid ${isConnected ? `${platform.color}28` : "#f0f0f3"}`, borderRadius: 9, background: isConnected ? `${platform.color}06` : "#fafafa", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>

                {/* Identity */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: `${platform.color}14`, border: `1px solid ${platform.color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{platform.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: platform.color }}>{platform.label}</div>
                    <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                      {isViagogo
                        ? (isConnected ? `Session expires ${fmtTime(viagogoSession?.expiresAt)}` : "Not logged in")
                        : (isConnected ? (lastSync ? `Synced ${fmtTime(lastSync)}` : "Never synced") : "")}
                    </div>
                  </div>
                </div>

                {/* Middle — email or session info */}
                <div>
                  {isViagogo ? (
                    isConnected ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#374151" }}>{viagogoSession?.email}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>Login to enable direct scraping</span>
                    )
                  ) : (
                    isConnected ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: "#374151" }}>{conn.email}</span>
                      </div>
                    ) : (
                      <select value={conn.email || ""} onChange={e => setConn(platform.id, { email: e.target.value })}
                        style={{ ...inputStyle, fontSize: 12, background: "white" }}>
                        <option value="">Select email account…</option>
                        {gmailAccounts.map(a => <option key={a.email} value={a.email}>{a.email}</option>)}
                      </select>
                    )
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6 }}>
                  {isViagogo ? (
                    isConnected ? (
                      <>
                        <button onClick={scrapeViagogoNow} disabled={isSyncing || !serverUp}
                          style={{ background: isSyncing ? "#f0f4ff" : `${platform.color}14`, color: isSyncing ? "#9ca3af" : platform.color, border: `1px solid ${platform.color}28`, borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: isSyncing ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                          {isSyncing ? "⏳ Scraping…" : "↻ Sync now"}
                        </button>
                        <button onClick={openLoginModal}
                          style={{ background: "white", color: "#9ca3af", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>
                          Re-login
                        </button>
                      </>
                    ) : (
                      <button onClick={openLoginModal} disabled={!serverUp}
                        style={{ background: serverUp ? platform.color : "#e5e7eb", color: "white", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: serverUp ? "pointer" : "not-allowed" }}>
                        Login
                      </button>
                    )
                  ) : (
                    isConnected ? (
                      <>
                        <button onClick={() => syncNow(platform)} disabled={isSyncing || !serverUp}
                          style={{ background: isSyncing ? "#f0fdf4" : `${platform.color}14`, color: isSyncing ? "#9ca3af" : platform.color, border: `1px solid ${platform.color}28`, borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: isSyncing ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}>
                          {isSyncing ? "⏳ Syncing…" : "↻ Sync now"}
                        </button>
                        <button onClick={() => disconnect(platform.id)}
                          style={{ background: "white", color: "#9ca3af", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "6px 10px", fontSize: 11, cursor: "pointer" }}>
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button onClick={() => connectPlatform(platform)} disabled={!conn.email || isSyncing || !serverUp}
                        style={{ background: conn.email && serverUp ? platform.color : "#e5e7eb", color: "white", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: conn.email && serverUp ? "pointer" : "not-allowed" }}>
                        {isSyncing ? "⏳ Connecting…" : "Connect"}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Viagogo Login Modal ── */}
      {loginOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) closeLoginModal(); }}>
          <div style={{ background: "white", borderRadius: 14, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", fontFamily: "Inter, sans-serif" }}>

            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#111827" }}>Viagogo Login</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>An OTP will be sent to your Viagogo email</div>
              </div>
              <button onClick={closeLoginModal} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>×</button>
            </div>

            {/* Email select — only show before login starts */}
            {!loginStep && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Viagogo account email</label>
                {gmailAccounts.length > 0 ? (
                  <select
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    style={{ ...inputStyle, marginBottom: 0 }}
                    autoFocus
                  >
                    <option value="">Select email account…</option>
                    {gmailAccounts.map(a => (
                      <option key={a.email} value={a.email}>{a.email}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: 12, color: "#f97316", background: "#fff7ed", border: "0.5px solid #fed7aa", borderRadius: 7, padding: "10px 12px" }}>
                    No Gmail accounts connected — add one in Email Accounts first.
                  </div>
                )}
              </div>
            )}

            {/* Progress steps */}
            {loginStep && (
              <div style={{ marginBottom: 20 }}>
                {VIAGOGO_LOGIN_STEPS.filter(s => s.key !== "error").map((step, i) => {
                  const stepIdx    = VIAGOGO_LOGIN_STEPS.findIndex(s => s.key === loginStep);
                  const isDone     = i < stepIdx || loginDone;
                  const isCurrent  = step.key === loginStep && !loginDone && !loginError;
                  const isPending  = i > stepIdx && !loginDone;

                  return (
                    <div key={step.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < VIAGOGO_LOGIN_STEPS.length - 2 ? "0.5px solid #f5f5f7" : "none" }}>
                      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700,
                        background: isDone ? "#dcfce7" : isCurrent ? "#dbeafe" : "#f3f4f6",
                        color:      isDone ? "#16a34a" : isCurrent ? "#1a3a6e" : "#9ca3af",
                        border:     isCurrent ? "2px solid #1a3a6e" : "none",
                      }}>
                        {isDone ? "✓" : i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: isCurrent ? 600 : 400, color: isPending ? "#d1d5db" : "#374151" }}>{step.label}</div>
                        {isCurrent && loginStepMsg && (
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>{loginStepMsg}</div>
                        )}
                      </div>
                      {isCurrent && !loginError && (
                        <div style={{ width: 14, height: 14, border: "2px solid #1a3a6e", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Error */}
            {loginError && (
              <div style={{ background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16 }}>
                ✕ {loginError}
              </div>
            )}

            {/* Success */}
            {loginDone && (
              <div style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#16a34a", marginBottom: 16, fontWeight: 600 }}>
                ✓ Logged in successfully — session saved for ~14 days
              </div>
            )}

            {/* Footer buttons */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
              <button onClick={closeLoginModal}
                style={{ background: "white", color: "#6b7280", border: "0.5px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer" }}>
                {loginDone ? "Close" : "Cancel"}
              </button>
              {!loginStep && (
                <button onClick={startViagogoLogin} disabled={!loginEmail.trim()}
                  style={{ background: loginEmail.trim() ? "#1a3a6e" : "#e5e7eb", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 600, cursor: loginEmail.trim() ? "pointer" : "not-allowed" }}>
                  Login →
                </button>
              )}
              {loginError && (
                <button onClick={startViagogoLogin}
                  style={{ background: "#1a3a6e", color: "white", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}