import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Modal, Field, Input, Select } from "../components/ui";

const PRIORITY_STYLES = {
  low:    { bg: "#f1f5f9", text: "#64748b", dot: "#94a3b8" },
  medium: { bg: "rgba(26,58,110,0.08)", text: "#1a3a6e", dot: "#1a3a6e" },
  high:   { bg: "rgba(249,115,22,0.08)", text: "#f97316", dot: "#f97316" },
  urgent: { bg: "rgba(239,68,68,0.08)", text: "#ef4444", dot: "#ef4444" },
};

const STATUS_STYLES = {
  pending:     { bg: "#f1f5f9", text: "#64748b", label: "Pending" },
  in_progress: { bg: "rgba(26,58,110,0.08)", text: "#1a3a6e", label: "In Progress" },
  completed:   { bg: "rgba(5,150,105,0.08)", text: "#059669", label: "Completed" },
};

export default function Tasks({ auth, events, tickets, notify }) {
  const [tasks, setTasks] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState("active"); // "active" | "completed" | "all"
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [form, setForm] = useState({ title: "", description: "", priority: "medium", assigned_to: "", due_date: "" });
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.warn('Tasks load error:', error.message); return; }
    setTasks(data || []);
  }, []);

  const loadTeam = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*');
    setTeam(data || []);
  }, []);

  useEffect(() => {
    Promise.all([loadTasks(), loadTeam()]).then(() => setLoading(false));
  }, [loadTasks, loadTeam]);

  const createTask = async () => {
    if (!form.title) return notify("Enter a task title", "err");
    setSaving(true);
    const { data, error } = await supabase.from('tasks').insert({
      title: form.title,
      description: form.description,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      created_by: auth.user.id,
      due_date: form.due_date || null,
    }).select().single();

    if (error) {
      notify("Failed to create task: " + error.message, "err");
    } else {
      setTasks(prev => [data, ...prev]);
      setShowCreate(false);
      setForm({ title: "", description: "", priority: "medium", assigned_to: "", due_date: "" });
      notify("Task created");
    }
    setSaving(false);
  };

  const updateTaskStatus = async (taskId, newStatus) => {
    const patch = { status: newStatus };
    if (newStatus === "completed") patch.completed_at = new Date().toISOString();
    if (newStatus !== "completed") patch.completed_at = null;

    const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
    if (error) return notify("Failed to update: " + error.message, "err");
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t));
  };

  const deleteTask = async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) return notify("Failed to delete: " + error.message, "err");
    setTasks(prev => prev.filter(t => t.id !== taskId));
    notify("Task deleted");
  };

  const teamMap = Object.fromEntries(team.map(m => [m.id, m]));

  const filtered = tasks.filter(t => {
    if (filterStatus === "active" && t.status === "completed") return false;
    if (filterStatus === "completed" && t.status !== "completed") return false;
    if (filterAssignee !== "all" && t.assigned_to !== filterAssignee) return false;
    return true;
  });

  const pendingCount = tasks.filter(t => t.status === "pending").length;
  const inProgressCount = tasks.filter(t => t.status === "in_progress").length;
  const completedCount = tasks.filter(t => t.status === "completed").length;

  if (loading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b", fontSize: 13 }}>Loading tasks...</div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.5px" }}>Tasks</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
            {pendingCount} pending · {inProgressCount} in progress · {completedCount} completed
          </div>
        </div>
        <button className="action-btn" onClick={() => setShowCreate(true)}>+ New Task</button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {["active", "completed", "all"].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            border: filterStatus === f ? "1.5px solid #1a3a6e" : "1px solid #e2e6ea",
            background: filterStatus === f ? "rgba(26,58,110,0.06)" : "white",
            color: filterStatus === f ? "#1a3a6e" : "#64748b",
            cursor: "pointer", fontFamily: "inherit", textTransform: "capitalize",
          }}>{f}</button>
        ))}
        <div style={{ width: 1, background: "#e2e6ea", margin: "0 4px" }} />
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{
          padding: "6px 10px", borderRadius: 8, fontSize: 11, fontWeight: 500,
          border: "1px solid #e2e6ea", background: "white", color: "#0f172a",
          cursor: "pointer", fontFamily: "inherit",
        }}>
          <option value="all">All members</option>
          <option value={auth.user.id}>My tasks</option>
          {team.filter(m => m.id !== auth.user.id).map(m => (
            <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
          ))}
          <option value="unassigned">Unassigned</option>
        </select>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: 13 }}>
          No tasks found
        </div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {filtered.map(task => {
            const ps = PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium;
            const ss = STATUS_STYLES[task.status] || STATUS_STYLES.pending;
            const assignee = teamMap[task.assigned_to];
            const creator = teamMap[task.created_by];
            const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed";

            return (
              <div key={task.id} style={{
                background: "white", border: "0.5px solid #e2e6ea", borderRadius: 10,
                padding: "14px 18px", display: "flex", alignItems: "flex-start", gap: 12,
                opacity: task.status === "completed" ? 0.6 : 1,
              }}>
                {/* Status checkbox */}
                <button onClick={() => updateTaskStatus(task.id, task.status === "completed" ? "pending" : "completed")} style={{
                  width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                  border: task.status === "completed" ? "2px solid #059669" : "2px solid #d1d9e0",
                  background: task.status === "completed" ? "#059669" : "white",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: 11, fontWeight: 700,
                }}>
                  {task.status === "completed" && "OK"}
                </button>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 600, color: "#0f172a",
                      textDecoration: task.status === "completed" ? "line-through" : "none",
                    }}>{task.title}</span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                      padding: "2px 6px", borderRadius: 4, background: ps.bg, color: ps.text,
                    }}>{task.priority}</span>
                    {task.status === "in_progress" && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase",
                        padding: "2px 6px", borderRadius: 4, background: ss.bg, color: ss.text,
                      }}>{ss.label}</span>
                    )}
                  </div>

                  {task.description && (
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, lineHeight: 1.4 }}>{task.description}</div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#94a3b8" }}>
                    {assignee && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: "50%", fontSize: 8, fontWeight: 700,
                          background: assignee.role === "admin" ? "#1a3a6e" : "#f97316",
                          color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center",
                        }}>{(assignee.display_name || "?")[0].toUpperCase()}</span>
                        {assignee.display_name || assignee.email}
                      </span>
                    )}
                    {!assignee && <span style={{ color: "#d1d9e0" }}>Unassigned</span>}
                    {task.due_date && (
                      <span style={{ color: isOverdue ? "#ef4444" : "#94a3b8", fontWeight: isOverdue ? 600 : 400 }}>
                        Due {new Date(task.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </span>
                    )}
                    {creator && <span>by {creator.display_name || creator.email}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  {task.status !== "completed" && task.status !== "in_progress" && (
                    <button onClick={() => updateTaskStatus(task.id, "in_progress")} style={{
                      padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                      border: "1px solid #e2e6ea", background: "white", color: "#1a3a6e",
                      cursor: "pointer", fontFamily: "inherit",
                    }}>Start</button>
                  )}
                  {task.status === "in_progress" && (
                    <button onClick={() => updateTaskStatus(task.id, "pending")} style={{
                      padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                      border: "1px solid #e2e6ea", background: "white", color: "#64748b",
                      cursor: "pointer", fontFamily: "inherit",
                    }}>Pause</button>
                  )}
                  {(auth.isAdmin || task.created_by === auth.user.id) && (
                    <button onClick={() => deleteTask(task.id)} style={{
                      padding: "4px 8px", borderRadius: 5, fontSize: 10, fontWeight: 600,
                      border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.06)",
                      color: "#ef4444", cursor: "pointer", fontFamily: "inherit",
                    }}>Del</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create task modal */}
      {showCreate && (
        <Modal title="New Task" onClose={() => setShowCreate(false)}>
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Title *">
              <Input value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="e.g. Deliver tickets for Order #12345" autoFocus />
            </Field>

            <Field label="Description">
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details..."
                rows={3} style={{
                  background: "#f7f8fa", border: "1.5px solid #e2e6ea", color: "#0f172a",
                  fontFamily: "inherit", fontSize: 13, padding: "9px 13px", width: "100%",
                  borderRadius: 8, outline: "none", resize: "vertical",
                }} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Priority">
                <Select value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </Field>

              <Field label="Assign To">
                <Select value={form.assigned_to} onChange={v => setForm(f => ({ ...f, assigned_to: v }))}>
                  <option value="">Unassigned</option>
                  {team.map(m => (
                    <option key={m.id} value={m.id}>{m.display_name || m.email}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Due Date">
              <Input type="date" value={form.due_date} onChange={v => setForm(f => ({ ...f, due_date: v }))} />
            </Field>

            <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
              <button className="action-btn" onClick={createTask} disabled={saving}>
                {saving ? "Creating..." : "Create Task"}
              </button>
              <button className="ghost-btn" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
