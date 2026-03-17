import { useState, useEffect } from "react";

const PLATFORMS = [
  { id: "tixstock", label: "Tixstock", color: "#059669", icon: "📦" },
  { id: "viagogo",  label: "Viagogo",  color: "#1a3a6e", icon: "🎫" },
  { id: "lysted",   label: "Lysted",   color: "#7c3aed", icon: "📋" },
];

const SERVER = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const SECRET = import.meta.env.VITE_API_SECRET || "";
const HEADERS = { "Content-Type": "application/json", "x-queud-secret": SECRET };

export default function SalesPlatforms({ settings, setSettings, gmailAccounts, inputStyle, notify }) {
  const [syncStatus, setSyncStatus] = useState({});
  const [syncing, setSyncing]       = useState({});
  const [serverUp, setServerUp]     = useState(null);

  useEffect(() => { fetchSyncStatus(); }, []);

  function fetchSyncStatus() {
    fetch(`${SERVER}/sync-status`, { headers: HEADERS })
      .then(r => r.json())
      .then(d => { if (d.ok) setSyncStatus(d.status || {}); setServerUp(true); })
      .catch(() => setServerUp(false));
  }

  function getConn(platformId) {
    return settings[`salesPlatform_${platformId}`] || { email: "", connected: false };
  }

  function setConn(platformId, patch) {
    const key = `salesPlatform_${platformId}`;
    setSettings(s => ({ ...s, [key]: { ...getConn(platformId), ...patch } }));
  }

  async function connectPlatform(platform) {
    const conn = getConn(platform.id);
    if (!conn.email) return notify("Select an email account first", "err");

    setSyncing(s => ({ ...s, [platform.id]: true }));
    try {
      // Save connected state first so server can read it from Supabase
      setConn(platform.id, { connected: true });
      // Small delay for Supabase write to propagate
      await new Promise(r => setTimeout(r, 800));

      const res = await fetch(`${SERVER}/sync-sales`, {
        method: "POST", headers: HEADERS,
        body: JSON.stringify({ platform: platform.id }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Sync failed");
      fetchSyncStatus();
      notify(`${platform.label} connected · ${data.total > 0 ? `${data.total} new sale${data.total !== 1 ? "s" : ""} imported` : "no new sales"}`);
    } catch(e) {
      setConn(platform.id, { connected: false });
      notify(`Failed to connect: ${e.message}`, "err");
    }
    setSyncing(s => ({ ...s, [platform.id]: false }));
  }

  async function syncNow(platform) {
    setSyncing(s => ({ ...s, [platform.id]: true }));
    try {
      const res = await fetch(`${SERVER}/sync-sales`, {
        method: "POST", headers: HEADERS,
        body: JSON.stringify({ platform: platform.id }),
      });
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

  const connectedCount = PLATFORMS.filter(p => getConn(p.id).connected).length;

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

      {/* Server offline warning */}
      {serverUp === false && (
        <div style={{ margin: "12px 18px 0", background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: 7, padding: "10px 14px", fontSize: 12, color: "#dc2626" }}>
          Server not reachable — sales won't sync.
          <span style={{ marginLeft: 8, color: "#1a3a6e", fontWeight: 600, cursor: "pointer", textDecoration: "underline" }} onClick={fetchSyncStatus}>Retry</span>
        </div>
      )}

      {/* Platform rows */}
      <div style={{ padding: "14px 18px", display: "grid", gap: 10 }}>
        {PLATFORMS.map(platform => {
          const conn = getConn(platform.id);
          const isConnected = conn.connected;
          const isSyncing   = syncing[platform.id];
          const syncKey     = `sync_${platform.id}_${(conn.email || "").replace(/[@.]/g, "_")}`;
          const lastSync    = syncStatus[syncKey];

          return (
            <div key={platform.id} style={{ border: `1px solid ${isConnected ? `${platform.color}28` : "#f0f0f3"}`, borderRadius: 9, background: isConnected ? `${platform.color}06` : "#fafafa", overflow: "hidden" }}>
              <div style={{ padding: "12px 14px", display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center" }}>

                {/* Identity */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 110 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 7, background: `${platform.color}14`, border: `1px solid ${platform.color}28`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>{platform.icon}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: platform.color }}>{platform.label}</div>
                    {isConnected && (
                      <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                        {lastSync ? `Synced ${fmtTime(lastSync)}` : "Never synced"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Email select or connected status */}
                <div>
                  {isConnected ? (
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
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 6 }}>
                  {isConnected ? (
                    <>
                      <button onClick={() => syncNow(platform)} disabled={isSyncing || !serverUp}
                        style={{ background: isSyncing ? "#f0fdf4" : `${platform.color}14`, color: isSyncing ? "#9ca3af" : platform.color, border: `1px solid ${platform.color}28`, borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: isSyncing ? "not-allowed" : "pointer", fontFamily: "var(--body)", whiteSpace: "nowrap" }}>
                        {isSyncing ? "⏳ Syncing…" : "↻ Sync now"}
                      </button>
                      <button onClick={() => disconnect(platform.id)}
                        style={{ background: "white", color: "#9ca3af", border: "0.5px solid #e5e7eb", borderRadius: 7, padding: "6px 10px", fontSize: 11, cursor: "pointer", fontFamily: "var(--body)" }}>
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button onClick={() => connectPlatform(platform)} disabled={!conn.email || isSyncing || !serverUp}
                      style={{ background: conn.email && serverUp ? platform.color : "#e5e7eb", color: "white", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: conn.email && serverUp ? "pointer" : "not-allowed", fontFamily: "var(--body)" }}>
                      {isSyncing ? "⏳ Connecting…" : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}