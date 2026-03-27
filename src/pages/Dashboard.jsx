import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fmt, fmtPct } from "../utils/format";
import { KpiCard } from "../components/ui";
import { supabase } from "../lib/supabase";

function timeAgo(dateStr) {
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + "d ago";
  return Math.floor(days / 30) + "mo ago";
}

function getInitials(email) {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function describeAction(entry) {
  const d = entry.details || {};
  const event = d.event_name || d.event || "an event";
  switch (entry.action) {
    case "ticket_added":
      return `added ${d.qty || ""} ticket${(d.qty || 0) !== 1 ? "s" : ""} for ${event}`;
    case "ticket_edited":
      return `edited ticket for ${event}`;
    case "tickets_imported":
      return `imported ${d.count || "?"} tickets for ${event}`;
    case "sale_recorded":
      return `recorded sale of ${d.qtySold || "?"}x for ${event}`;
    default:
      return entry.action.replace(/_/g, " ");
  }
}

export default function Dashboard({ tickets, sales, events, setShowAddTicket, setEditingTicket, setTf, blankTicket }) {
  const navigate = useNavigate();

  // ── Recent Activity ───────────────────────────────────────────────────────
  const [activity, setActivity] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [activityRes, profilesRes] = await Promise.all([
        supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("profiles").select("id, display_name, email, role"),
      ]);
      if (!cancelled) {
        if (activityRes.data) setActivity(activityRes.data);
        if (profilesRes.data) {
          const map = {};
          profilesRes.data.forEach(p => { map[p.id] = p; map[p.email] = p; });
          setProfileMap(map);
        }
      }
      if (activityRes.error) console.error("activity_log fetch error:", activityRes.error);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Build event lookup map ─────────────────────────────────────────────────
  const eventMap = (events || []).reduce((acc, e) => { acc[e.id] = e; return acc; }, {});

  // ── Helper: get matched tickets for a sale ────────────────────────────────
  function getSaleTickets(sale) {
    return (sale.ticketIds || []).map(id => tickets.find(t => t.id === id)).filter(Boolean);
  }

  // ── Helper: get event name for a sale ─────────────────────────────────────
  function getSaleEventName(sale) {
    const ev = eventMap[sale.eventId];
    if (ev?.name) return ev.name;
    const matched = getSaleTickets(sale);
    if (matched[0]?.event) return matched[0].event;
    return sale.notes || "Unknown Event";
  }

  // ── Helper: get cost for a sale ───────────────────────────────────────────
  function getSaleCost(sale) {
    return getSaleTickets(sale).reduce((a, t) => a + (t.cost || 0), 0);
  }

  // ── KPI calculations ───────────────────────────────────────────────────────
  const totalInvested = tickets.reduce((a, t) => a + (t.cost || 0), 0);
  const totalRevenue  = sales.reduce((a, s) => a + (parseFloat(s.salePrice) || 0), 0);
  const totalCostSold = sales.reduce((a, s) => a + getSaleCost(s), 0);
  const totalProfit   = totalRevenue - totalCostSold;
  const roi           = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

  const stockCount = tickets.reduce((a, t) => {
    if (['Sold','Delivered'].includes(t.status)) return a;
    return a + (t.qtyAvailable ?? t.qty ?? 1);
  }, 0);

  const soldCount = sales.reduce((a, s) => a + (parseInt(s.qtySold) || 0), 0);

  // ── Top events by profit ───────────────────────────────────────────────────
  const salesByEvent = sales.reduce((acc, s) => {
    const name   = getSaleEventName(s);
    const profit = (parseFloat(s.salePrice) || 0) - getSaleCost(s);
    acc[name] = (acc[name] || 0) + profit;
    return acc;
  }, {});
  const topEvents = Object.entries(salesByEvent).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxBar    = Math.max(...topEvents.map(e => Math.abs(e[1])), 1);

  // ── Current stock groups ───────────────────────────────────────────────────
  const stockGroups = {};
  tickets.filter(t => !['Sold','Delivered'].includes(t.status)).forEach(t => {
    const key = (t.event || "") + "||" + (t.date || "");
    if (!stockGroups[key]) stockGroups[key] = {
      event: t.event, date: t.date, venue: t.venue,
      category: t.category, totalAvail: 0, totalQty: 0,
    };
    stockGroups[key].totalAvail += (t.qtyAvailable ?? t.qty ?? 1);
    stockGroups[key].totalQty  += (t.qty ?? 1);
  });

  const kpis = [
    { label: "Total Invested", value: fmt(totalInvested),  color: "#1a3a6e", iconKey: "kpi_invested" },
    { label: "Total Revenue",  value: fmt(totalRevenue),   color: "#f97316", iconKey: "kpi_revenue" },
    { label: "Net Profit",     value: fmt(totalProfit),    color: totalProfit >= 0 ? "#059669" : "#ef4444", iconKey: "kpi_profit" },
    { label: "Overall ROI",    value: fmtPct(roi),         color: roi >= 0 ? "#059669" : "#ef4444", iconKey: "kpi_roi" },
    { label: "In Stock",       value: stockCount,          color: "#f97316", sub: tickets.length + " events", iconKey: "kpi_stock" },
    { label: "Total Sold",     value: soldCount,           color: "#7c3aed", sub: sales.length + " transactions", iconKey: "kpi_sold" },
  ];

  const card = { background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" };

  const fmtD = (d) => {
    if (!d) return "";
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      return parseInt(m[3]) + " " + months[parseInt(m[2])-1] + " " + m[1];
    }
    return d;
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 24, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.5px" }}>Dashboard</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>Overview of your ticket portfolio</div>
        </div>
        <button className="action-btn" onClick={() => { setEditingTicket(null); setTf(blankTicket); setShowAddTicket(true); }}>+ Add Tickets</button>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, marginBottom: 18 }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 14 }}>

        {/* Top Events by Profit */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e2e6ea" }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", letterSpacing: "-0.2px" }}>Top Events by Profit</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>All time performance</div>
          </div>
          <div style={{ padding: "12px 18px" }}>
            {topEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>No sales recorded yet</div>
            ) : topEvents.map((entry, i) => (
              <div key={entry[0]} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderBottom: i < topEvents.length - 1 ? "0.5px solid #f1f4f8" : "none" }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? "rgba(249,115,22,0.1)" : "#f7f8fa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i === 0 ? "#f97316" : "#94a3b8", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry[0]}</div>
                  <div style={{ background: "#f1f4f8", borderRadius: 4, height: 4, marginTop: 5, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: (Math.abs(entry[1]) / maxBar * 100) + "%", background: entry[1] >= 0 ? "#f97316" : "#ef4444", borderRadius: 4 }} />
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: entry[1] >= 0 ? "#059669" : "#ef4444", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                  {entry[1] >= 0 ? "+" : ""}{fmt(entry[1])}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Sales */}
        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e2e6ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", letterSpacing: "-0.2px" }}>Completed Sales</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>All matched transactions</div>
            </div>
            {sales.length > 0 && <button className="ghost-btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => navigate("/sales")}>View all</button>}
          </div>
          <div>
            {sales.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>No sales recorded yet</div>
            ) : sales.slice().reverse().slice(0, 7).map(s => {
              const eventName = getSaleEventName(s);
              const profit    = (parseFloat(s.salePrice) || 0) - getSaleCost(s);
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: "0.5px solid #f1f4f8" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{eventName}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{s.sellingPlatform} · {s.qtySold}x · {s.date || s.recordedAt?.slice(0,10)}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: profit >= 0 ? "#059669" : "#ef4444", fontVariantNumeric: "tabular-nums" }}>
                      {profit >= 0 ? "+" : ""}{fmt(profit)}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>{fmt(s.salePrice)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Current Stock — cards are clickable, navigate to Inventory */}
      <div style={{ ...card, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e2e6ea", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", letterSpacing: "-0.2px" }}>Current Stock</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{Object.keys(stockGroups).length} events · {stockCount} tickets available</div>
          </div>
          <button className="ghost-btn" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => navigate("/inventory")}>View inventory</button>
        </div>
        {Object.keys(stockGroups).length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>No tickets in stock</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {Object.entries(stockGroups).slice(0, 9).map(([key, group]) => {
              const venueClean = (group.venue || "").replace(/\s*[—–-]\s*.+$/, "").replace(/,.*$/, "").trim();
              return (
                <div
                  key={key}
                  onClick={() => navigate("/inventory")}
                  style={{
                    padding: "13px 18px",
                    borderRight: "0.5px solid #f1f4f8",
                    borderBottom: "0.5px solid #f1f4f8",
                    display: "flex", alignItems: "center", gap: 12,
                    borderLeft: `3px solid ${group.category === "Sport" ? "#1a3a6e" : "#7c3aed"}`,
                    cursor: "pointer",
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f7f8fa"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: group.category === "Sport" ? "rgba(26,58,110,0.08)" : "rgba(124,58,237,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>
                    {group.category === "Sport" ? "⚽" : "🎵"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.event}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fmtD(group.date)}{venueClean ? " · " + venueClean : ""}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#f97316", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{group.totalAvail}</div>
                    <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>tickets</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div style={{ ...card, overflow: "hidden", marginTop: 14 }}>
        <div style={{ padding: "14px 18px", borderBottom: "0.5px solid #e2e6ea" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", letterSpacing: "-0.2px" }}>Recent Activity</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Latest actions across your team</div>
        </div>
        <div>
          {activity.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8", fontSize: 13 }}>No recent activity</div>
          ) : activity.map((entry, i) => {
            const profile = profileMap[entry.user_id] || profileMap[entry.user_email];
            const userName = profile?.display_name || (entry.user_email ? entry.user_email.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Unknown");
            const initials = userName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderBottom: i < activity.length - 1 ? "0.5px solid #f1f4f8" : "none" }}>
                <div style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: "linear-gradient(135deg, #1a3a6e, #2a5298)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                  letterSpacing: "0.5px",
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <span style={{ fontWeight: 600 }}>{userName}</span>{" "}
                    <span style={{ color: "#475569" }}>{describeAction(entry)}</span>
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0, whiteSpace: "nowrap" }}>{timeAgo(entry.created_at)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}