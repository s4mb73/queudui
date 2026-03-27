import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function EventMerge({ notify }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(null); // groupKey being merged
  const [deleting, setDeleting] = useState(null); // eventId being deleted
  const [selectedPrimary, setSelectedPrimary] = useState({}); // { groupKey: eventId }
  const [confirmMerge, setConfirmMerge] = useState(null); // groupKey awaiting confirmation
  const [confirmDelete, setConfirmDelete] = useState(null); // eventId awaiting confirmation

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Load events
      const { data: evts, error: evtErr } = await supabase
        .from("events")
        .select("*")
        .order("name");
      if (evtErr) throw evtErr;

      // Load ticket counts per event
      const { data: ticketCounts, error: tcErr } = await supabase
        .from("tickets")
        .select("event_id");
      if (tcErr) throw tcErr;

      // Load sale counts per event
      const { data: saleCounts, error: scErr } = await supabase
        .from("sales")
        .select("event_id");
      if (scErr) throw scErr;

      // Build count maps
      const ticketMap = {};
      (ticketCounts || []).forEach((t) => {
        ticketMap[t.event_id] = (ticketMap[t.event_id] || 0) + 1;
      });

      const saleMap = {};
      (saleCounts || []).forEach((s) => {
        saleMap[s.event_id] = (saleMap[s.event_id] || 0) + 1;
      });

      const enriched = (evts || []).map((e) => ({
        ...e,
        ticketCount: ticketMap[e.id] || 0,
        saleCount: saleMap[e.id] || 0,
      }));

      setEvents(enriched);
    } catch (e) {
      notify("Failed to load events: " + e.message, "err");
    }
    setLoading(false);
  };

  // Normalize name for grouping
  const normalize = (name) => (name || "").toLowerCase().trim().replace(/\s+/g, " ");

  // Group duplicates
  const groups = {};
  events.forEach((e) => {
    const key = normalize(e.name);
    if (!groups[key]) groups[key] = [];
    groups[key].push(e);
  });

  const duplicateGroups = Object.entries(groups).filter(([, arr]) => arr.length >= 2);
  const orphanEvents = events.filter((e) => e.ticketCount === 0 && e.saleCount === 0);

  const handleMerge = async (groupKey, eventsInGroup) => {
    const primaryId = selectedPrimary[groupKey];
    if (!primaryId) return notify("Select a primary event first", "err");

    setMerging(groupKey);
    setConfirmMerge(null);

    try {
      const primary = eventsInGroup.find((e) => e.id === primaryId);
      const others = eventsInGroup.filter((e) => e.id !== primaryId);
      const otherIds = others.map((e) => e.id);

      // If primary has no date but a duplicate does, copy the date
      if (!primary.date) {
        const withDate = others.find((e) => e.date);
        if (withDate) {
          const { error: dateErr } = await supabase
            .from("events")
            .update({ date: withDate.date })
            .eq("id", primaryId);
          if (dateErr) throw dateErr;
        }
      }

      // Reassign tickets
      const { error: ticketErr } = await supabase
        .from("tickets")
        .update({ event_id: primaryId })
        .in("event_id", otherIds);
      if (ticketErr) throw ticketErr;

      // Reassign sales
      const { error: saleErr } = await supabase
        .from("sales")
        .update({ event_id: primaryId })
        .in("event_id", otherIds);
      if (saleErr) throw saleErr;

      // Update sale_tickets junction table
      const { error: junctionErr } = await supabase
        .from("sale_tickets")
        .update({ event_id: primaryId })
        .in("event_id", otherIds);
      if (junctionErr) {
        // sale_tickets might not have event_id column, ignore if so
        console.warn("sale_tickets update skipped:", junctionErr.message);
      }

      // Delete duplicate events
      const { error: delErr } = await supabase
        .from("events")
        .delete()
        .in("id", otherIds);
      if (delErr) throw delErr;

      notify(`Merged ${others.length} duplicate(s) into "${primary.name}"`);
      setSelectedPrimary((prev) => {
        const next = { ...prev };
        delete next[groupKey];
        return next;
      });
      await loadEvents();
    } catch (e) {
      notify("Merge failed: " + e.message, "err");
    }
    setMerging(null);
  };

  const handleDeleteOrphan = async (eventId) => {
    setDeleting(eventId);
    setConfirmDelete(null);
    try {
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
      notify("Orphan event deleted");
      await loadEvents();
    } catch (e) {
      notify("Delete failed: " + e.message, "err");
    }
    setDeleting(null);
  };

  const formatDate = (d) => {
    if (!d) return "No date";
    try {
      return new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b", fontSize: 13, fontFamily: "var(--body)" }}>
        Loading events...
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "var(--body)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>
            Event Merge Tool
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {duplicateGroups.length} duplicate group{duplicateGroups.length !== 1 ? "s" : ""} found
            {" / "}
            {orphanEvents.length} orphan event{orphanEvents.length !== 1 ? "s" : ""}
          </div>
        </div>
        <button className="ghost-btn" onClick={loadEvents}>
          Refresh
        </button>
      </div>

      {/* Duplicate Groups */}
      {duplicateGroups.length === 0 && (
        <div
          style={{
            background: "#ffffff",
            border: "0.5px solid #e2e6ea",
            borderRadius: 12,
            padding: "40px 20px",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
            No duplicates found
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>All event names are unique.</div>
        </div>
      )}

      {duplicateGroups.map(([groupKey, groupEvents]) => (
        <div
          key={groupKey}
          style={{
            background: "#ffffff",
            border: "0.5px solid #e2e6ea",
            borderRadius: 12,
            marginBottom: 16,
            overflow: "hidden",
          }}
        >
          {/* Group header */}
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid #f0f0f3",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: "rgba(249,115,22,0.08)",
                  color: "#f97316",
                }}
              >
                {groupEvents.length} duplicates
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                {groupEvents[0].name}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {confirmMerge === groupKey ? (
                <>
                  <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>
                    Merge {groupEvents.length - 1} event{groupEvents.length - 1 !== 1 ? "s" : ""} into primary?
                  </span>
                  <button
                    className="action-btn"
                    style={{ padding: "6px 14px", fontSize: 12 }}
                    disabled={merging === groupKey}
                    onClick={() => handleMerge(groupKey, groupEvents)}
                  >
                    {merging === groupKey ? "Merging..." : "Confirm"}
                  </button>
                  <button
                    className="ghost-btn"
                    style={{ padding: "6px 12px", fontSize: 11 }}
                    onClick={() => setConfirmMerge(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  className="action-btn"
                  style={{ padding: "6px 14px", fontSize: 12 }}
                  disabled={!selectedPrimary[groupKey] || merging === groupKey}
                  onClick={() => setConfirmMerge(groupKey)}
                >
                  Merge
                </button>
              )}
            </div>
          </div>

          {/* Column headers */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "40px 1fr 1fr 110px 80px 80px",
              gap: 12,
              padding: "10px 20px",
              borderBottom: "1px solid #f0f0f3",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            <span></span>
            <span>Name</span>
            <span>Venue</span>
            <span>Date</span>
            <span>Tickets</span>
            <span>Sales</span>
          </div>

          {/* Event rows */}
          {groupEvents.map((evt, i) => (
            <div
              key={evt.id}
              className="hover-row"
              style={{
                display: "grid",
                gridTemplateColumns: "40px 1fr 1fr 110px 80px 80px",
                gap: 12,
                padding: "12px 20px",
                alignItems: "center",
                borderBottom: i < groupEvents.length - 1 ? "0.5px solid #f5f5f7" : "none",
                background: selectedPrimary[groupKey] === evt.id ? "rgba(26,58,110,0.04)" : undefined,
              }}
            >
              {/* Radio */}
              <div>
                <input
                  type="radio"
                  name={`primary-${groupKey}`}
                  checked={selectedPrimary[groupKey] === evt.id}
                  onChange={() => setSelectedPrimary((prev) => ({ ...prev, [groupKey]: evt.id }))}
                  style={{ cursor: "pointer", accentColor: "#1a3a6e" }}
                />
              </div>

              {/* Name */}
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                {evt.name}
                {selectedPrimary[groupKey] === evt.id && (
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: "rgba(26,58,110,0.08)",
                      color: "#1a3a6e",
                      marginLeft: 8,
                    }}
                  >
                    Primary
                  </span>
                )}
              </div>

              {/* Venue */}
              <div style={{ fontSize: 12, color: "#64748b" }}>{evt.venue || "No venue"}</div>

              {/* Date */}
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(evt.date)}</div>

              {/* Tickets */}
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{evt.ticketCount}</div>

              {/* Sales */}
              <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{evt.saleCount}</div>
            </div>
          ))}
        </div>
      ))}

      {/* Orphan Events */}
      {orphanEvents.length > 0 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 4, letterSpacing: "-0.3px" }}>
            Orphan Events
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>
            Events with 0 tickets and 0 sales. Safe to delete.
          </div>

          <div
            style={{
              background: "#ffffff",
              border: "0.5px solid #e2e6ea",
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 110px 80px",
                gap: 12,
                padding: "10px 20px",
                borderBottom: "1px solid #f0f0f3",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.8px",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              <span>Name</span>
              <span>Venue</span>
              <span>Date</span>
              <span></span>
            </div>

            {orphanEvents.map((evt, i) => (
              <div
                key={evt.id}
                className="hover-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 110px 80px",
                  gap: 12,
                  padding: "12px 20px",
                  alignItems: "center",
                  borderBottom: i < orphanEvents.length - 1 ? "0.5px solid #f5f5f7" : "none",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{evt.name}</div>
                <div style={{ fontSize: 12, color: "#64748b" }}>{evt.venue || "No venue"}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(evt.date)}</div>
                <div>
                  {confirmDelete === evt.id ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="del-btn"
                        style={{ padding: "4px 8px", fontSize: 10 }}
                        disabled={deleting === evt.id}
                        onClick={() => handleDeleteOrphan(evt.id)}
                      >
                        {deleting === evt.id ? "..." : "Yes"}
                      </button>
                      <button
                        className="ghost-btn"
                        style={{ padding: "4px 8px", fontSize: 10 }}
                        onClick={() => setConfirmDelete(null)}
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button className="del-btn" onClick={() => setConfirmDelete(evt.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
