import { useState, useEffect } from "react";
import { Modal, Field, Input, Select } from "../components/ui";

const ROLE_STYLES = {
  admin: { bg: "rgba(26,58,110,0.08)", text: "#1a3a6e", label: "Admin" },
  va:    { bg: "rgba(249,115,22,0.08)", text: "#f97316", label: "VA" },
};

export default function Team({ auth, notify }) {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", displayName: "", role: "va" });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    try {
      const members = await auth.loadTeam();
      setTeam(members);
    } catch (e) {
      notify("Failed to load team: " + e.message, "err");
    }
    setLoading(false);
  };

  const handleInvite = async () => {
    if (!inviteForm.email) return notify("Enter an email address", "err");
    if (!inviteForm.displayName) return notify("Enter a display name", "err");
    setInviting(true);
    try {
      await auth.inviteUser(inviteForm.email, inviteForm.displayName, inviteForm.role);
      notify(`Invited ${inviteForm.email}`);
      setShowInvite(false);
      setInviteForm({ email: "", displayName: "", role: "va" });
      loadTeam();
    } catch (e) {
      notify("Invite failed: " + e.message, "err");
    }
    setInviting(false);
  };

  const handleRoleChange = async (userId, newRole) => {
    if (userId === auth.user.id) return notify("You can't change your own role", "err");
    try {
      await auth.updateUserRole(userId, newRole);
      setTeam(prev => prev.map(m => m.id === userId ? { ...m, role: newRole } : m));
      notify(`Role updated to ${newRole}`);
    } catch (e) {
      notify("Failed to update role: " + e.message, "err");
    }
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b", fontSize: 13 }}>Loading team...</div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>Team</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{team.length} member{team.length !== 1 ? "s" : ""}</div>
        </div>
        <button className="action-btn" onClick={() => setShowInvite(true)}>+ Invite Member</button>
      </div>

      {/* Team list */}
      <div style={{ background: "#ffffff", border: "0.5px solid #e2e6ea", borderRadius: 12, overflow: "hidden" }}>
        {/* Header row */}
        <div style={{
          display: "grid", gridTemplateColumns: "40px 1fr 1fr 100px 140px",
          gap: 12, padding: "12px 20px", borderBottom: "1px solid #f0f0f3",
          fontSize: 10, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "#94a3b8",
        }}>
          <span></span>
          <span>Name</span>
          <span>Email</span>
          <span>Role</span>
          <span>Joined</span>
        </div>

        {team.map((member, i) => {
          const rs = ROLE_STYLES[member.role] || ROLE_STYLES.va;
          const isYou = member.id === auth.user.id;
          const initials = (member.display_name || member.email || "?")
            .split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

          return (
            <div key={member.id} className="hover-row" style={{
              display: "grid", gridTemplateColumns: "40px 1fr 1fr 100px 140px",
              gap: 12, padding: "14px 20px", alignItems: "center",
              borderBottom: i < team.length - 1 ? "0.5px solid #f5f5f7" : "none",
            }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: member.role === "admin" ? "#1a3a6e" : "#f97316",
                color: "white", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {initials}
              </div>

              {/* Name */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                  {member.display_name || "Unnamed"}
                  {isYou && <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: 6 }}>(you)</span>}
                </div>
              </div>

              {/* Email */}
              <div style={{ fontSize: 12, color: "#64748b" }}>{member.email}</div>

              {/* Role */}
              <div>
                {isYou ? (
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                    padding: "3px 8px", borderRadius: 4, background: rs.bg, color: rs.text,
                  }}>{rs.label}</span>
                ) : (
                  <select value={member.role} onChange={e => handleRoleChange(member.id, e.target.value)} style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 6px", borderRadius: 4,
                    border: "1px solid #e2e6ea", background: "#f7f8fa", color: "#0f172a",
                    cursor: "pointer", fontFamily: "inherit",
                  }}>
                    <option value="admin">Admin</option>
                    <option value="va">VA</option>
                  </select>
                )}
              </div>

              {/* Joined */}
              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                {member.created_at ? new Date(member.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <Modal title="Invite Team Member" onClose={() => setShowInvite(false)}>
          <div style={{ display: "grid", gap: 16 }}>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
              They'll receive an email with a magic link to set up their account.
            </div>

            <Field label="Email *">
              <Input value={inviteForm.email} onChange={v => setInviteForm(f => ({ ...f, email: v }))} placeholder="team@example.com" type="email" />
            </Field>

            <Field label="Display Name *">
              <Input value={inviteForm.displayName} onChange={v => setInviteForm(f => ({ ...f, displayName: v }))} placeholder="John Smith" />
            </Field>

            <Field label="Role">
              <Select value={inviteForm.role} onChange={v => setInviteForm(f => ({ ...f, role: v }))}>
                <option value="va">VA (can manage tickets & sales)</option>
                <option value="admin">Admin (full access)</option>
              </Select>
            </Field>

            <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#92400e", lineHeight: 1.5 }}>
              <strong>VA permissions:</strong> Can add/edit tickets, record sales, manage tasks. Cannot delete events, access settings, or manage team.
            </div>

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button className="action-btn" onClick={handleInvite} disabled={inviting}>
                {inviting ? "Sending..." : "Send Invite"}
              </button>
              <button className="ghost-btn" onClick={() => setShowInvite(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
