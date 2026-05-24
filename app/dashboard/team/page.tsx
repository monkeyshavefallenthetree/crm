"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { Users, Shield, User, UserPlus, Trash2, X, Search } from "lucide-react";

interface Profile { id: string; full_name: string; role: string; created_at: string; }

export default function TeamPage() {
  const supabase = createClient();
  const [members, setMembers] = useState<Profile[]>([]);
  const [myRole, setMyRole] = useState("");
  const [showAddUser, setShowAddUser] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const isDemo = document.cookie.includes('demo_bypass=true');

      if (isDemo && !user) {
        setMyRole("admin");
      } else if (user) {
        const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
        if (me) setMyRole(me.role);
      }

      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
      if (data) setMembers(data);
    }
    load();
  }, []);

  async function updateRole(id: string, role: string) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
    if (error) { showToast("Error: " + error.message); return; }
    setMembers(prev => prev.map(m => m.id === id ? { ...m, role } : m));
    showToast(`Role updated to ${role}`);
  }

  async function addUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError("");
    setAddLoading(true);

    try {
      const { error } = await supabase.rpc("admin_create_user", {
        p_email: newEmail,
        p_password: newPassword,
        p_full_name: newName,
        p_role: newRole,
      });

      if (error) throw error;

      const { data: refreshed } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
      if (refreshed) setMembers(refreshed);

      showToast(`User ${newName} created successfully`);
      setShowAddUser(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("user");
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setAddLoading(false);
    }
  }

  async function deleteUser(id: string) {
    await supabase.from("lead_notes").delete().eq("author_id", id);
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) { showToast("Error: " + error.message); return; }
    setMembers(prev => prev.filter(m => m.id !== id));
    setDeleteConfirm(null);
    showToast("User removed");
  }

  const filteredMembers = members.filter(m =>
    !searchQuery || m.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const adminCount = members.filter(m => m.role === "admin").length;
  const userCount = members.filter(m => m.role === "user").length;

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
        <div>
          <h1 className="font-heading" style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
            Team
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            Manage members and permissions
          </p>
        </div>
        {myRole === "admin" && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddUser(true)}>
            <UserPlus size={14} /> Add User
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "Total", value: members.length, icon: Users, color: "var(--brand)", bg: "var(--brand-subtle)" },
          { label: "Admins", value: adminCount, icon: Shield, color: "var(--rose)", bg: "var(--rose-bg)" },
          { label: "Users", value: userCount, icon: User, color: "var(--blue)", bg: "var(--blue-bg)" },
        ].map((s, i) => (
          <div key={i} className="card" style={{ padding: 20, display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: s.bg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <div className="font-heading" style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 16, maxWidth: 360 }}>
        <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        <input
          className="input"
          style={{ paddingLeft: 36 }}
          placeholder="Search members..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Members */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filteredMembers.map((member, i) => (
          <div
            key={member.id}
            className="card animate-fade-in"
            style={{ display: "flex", alignItems: "center", gap: 16, padding: 16, animationDelay: `${i * 25}ms` }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-card-hover)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-card)"; }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: member.role === "admin" ? "#fff" : "var(--text-primary)",
                background: member.role === "admin" ? "var(--brand)" : "var(--bg-surface)",
                border: member.role === "admin" ? "none" : "1px solid var(--border-subtle)",
              }}
            >
              {member.full_name?.[0]?.toUpperCase() || "U"}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {member.full_name || "Unnamed"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                {member.role === "admin" ? <Shield size={11} style={{ color: "var(--brand)" }} /> : <User size={11} />}
                <span style={{ textTransform: "capitalize", fontWeight: 500, color: member.role === "admin" ? "var(--brand)" : "var(--text-muted)" }}>
                  {member.role}
                </span>
              </div>
            </div>

            <div style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
              {new Date(member.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>

            {myRole === "admin" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <select
                  className="select"
                  style={{ padding: "6px 28px 6px 10px", fontSize: 11 }}
                  value={member.role}
                  onChange={e => updateRole(member.id, e.target.value)}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>

                {deleteConfirm === member.id ? (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="btn btn-primary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => deleteUser(member.id)}>Yes</button>
                    <button className="btn btn-secondary" style={{ padding: "4px 10px", fontSize: 11 }} onClick={() => setDeleteConfirm(null)}>No</button>
                  </div>
                ) : (
                  <button
                    style={{
                      padding: 6,
                      borderRadius: 6,
                      color: "var(--text-muted)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => setDeleteConfirm(member.id)}
                    title="Delete user"
                    onMouseEnter={e => {
                      e.currentTarget.style.color = "var(--rose)";
                      e.currentTarget.style.background = "var(--rose-bg)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = "var(--text-muted)";
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {filteredMembers.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "64px 24px",
              borderRadius: 12,
              border: "1px dashed var(--border-default)",
              background: "var(--bg-card)",
            }}
          >
            <Users size={36} style={{ margin: "0 auto 12px", color: "var(--text-muted)", opacity: 0.4 }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>No members found</p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="modal-overlay" onClick={() => setShowAddUser(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 className="font-heading" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Add User</h2>
              <button
                style={{
                  padding: 6,
                  borderRadius: 6,
                  color: "var(--text-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => setShowAddUser(false)}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-surface)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={addUser} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Full Name *</label>
                <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="John Doe" required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email *</label>
                <input className="input" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="name@mft.com" required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password *</label>
                <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Role</label>
                <select className="select" style={{ width: "100%" }} value={newRole} onChange={e => setNewRole(e.target.value)}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {addError && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: "var(--rose-bg)",
                    border: "1px solid rgba(244,63,94,0.2)",
                    color: "var(--rose)",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {addError}
                </div>
              )}

              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddUser(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={addLoading}>
                  {addLoading ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
