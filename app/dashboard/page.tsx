"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import {
  Table2, Plus, FileSpreadsheet, Users, TrendingUp,
  ArrowRight, BarChart3, Target, Clock, Trash2
} from "lucide-react";
import CreateTableModal from "./CreateTableModal";

interface LeadTable {
  id: string; name: string; description: string;
  created_at: string; lead_count: number; member_count: number;
}
interface Profile { id: string; full_name: string; role: string; }

export default function DashboardPage() {
  const supabase = createClient();
  const [tables, setTables] = useState<LeadTable[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalLeads, setTotalLeads] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<LeadTable | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      const isDemo = document.cookie.includes('demo_bypass=true');
      if (isDemo && !user) {
        setProfile({ id: '00000000-0000-0000-0000-000000000000', full_name: 'Ahmed', role: 'admin' });
      } else if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (data) setProfile(data);
      }

      const [tablesResponse, leadsResponse, assignsResponse] = await Promise.all([
        supabase.from("lead_tables").select("*").order("created_at", { ascending: false }),
        supabase.from("leads").select("id, table_id, status"),
        supabase.from("table_assignments").select("*")
      ]);

      const { data: tablesData } = tablesResponse;
      const { data: leads } = leadsResponse;
      const { data: assigns } = assignsResponse;

      if (leads) {
        setTotalLeads(leads.length);
        const counts: Record<string, number> = {};
        leads.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });
        setStatusCounts(counts);
      }

      if (tablesData) {
        const enriched = tablesData.map(t => ({
          ...t,
          lead_count: leads?.filter(l => l.table_id === t.id).length || 0,
          member_count: assigns?.filter(a => a.table_id === t.id).length || 0,
        }));
        setTables(enriched);
      }
      setLoading(false);
    }
    init();
  }, [supabase]);

  async function confirmDeleteTable() {
    if (!tableToDelete) return;
    setIsDeleting(true);
    const id = tableToDelete.id;
    console.log("Proceeding with deletion of table:", id);
    
    // Actually delete the leads in the table
    const { data: leadsToDelete } = await supabase.from("leads").select("id").eq("table_id", id);
    if (leadsToDelete && leadsToDelete.length > 0) {
      const leadIds = leadsToDelete.map(l => l.id);
      await supabase.from("meetings").delete().in("lead_id", leadIds);
      await supabase.from("lead_notes").delete().in("lead_id", leadIds);
      await supabase.from("leads").delete().eq("table_id", id);
    }
    await supabase.from("table_assignments").delete().eq("table_id", id);
    
    const { error } = await supabase.from("lead_tables").delete().eq("id", id);
    
    setIsDeleting(false);
    if (error) { 
      console.error("Delete error:", error);
      alert("Error: " + error.message); 
      return; 
    }
    setTables(prev => prev.filter(t => t.id !== id));
    setTableToDelete(null);
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "128px 0" }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--brand)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const stats = [
    { label: "Total Leads", value: totalLeads, icon: Target, color: "var(--brand)", bg: "var(--brand-subtle)" },
    { label: "Active Tables", value: tables.length, icon: Table2, color: "var(--blue)", bg: "var(--blue-bg)" },
    { label: "Qualified", value: statusCounts["Qualified"] || 0, icon: TrendingUp, color: "var(--green)", bg: "var(--green-bg)" },
    { label: "Converted", value: statusCounts["Converted Done Deal"] || 0, icon: BarChart3, color: "var(--purple)", bg: "var(--purple-bg)" },
  ];

  const statusColors: Record<string, string> = {
    "Converted Done Deal": "var(--green)",
    "Qualified": "var(--blue)",
    "Meeting Scheduled": "var(--purple)",
    "Follow Up": "var(--amber)",
    "Not Qualified": "var(--rose)",
    "Call Again": "var(--amber)",
    "Switched Off": "var(--gray)",
    "Done Meeting": "var(--teal)",
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="font-heading" style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
          Overview of your CRM workspace
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <div
            key={i}
            className="card"
            style={{ display: "flex", alignItems: "center", gap: 16, padding: 20 }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                background: s.bg,
              }}
            >
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <div>
              <div className="font-heading" style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {s.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tables Section */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
          Your Tables
        </h2>
        {profile?.role === "admin" && (
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
            <Plus size={14} /> New Table
          </button>
        )}
      </div>

      {tables.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            borderRadius: 12,
            border: "1px dashed var(--border-default)",
            background: "var(--bg-card)",
          }}
        >
          <Table2 size={36} style={{ margin: "0 auto 12px", color: "var(--text-muted)", opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 4px" }}>No tables yet</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>Create your first table to organize leads</p>
          {profile?.role === "admin" && (
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
              <Plus size={14} /> Create Table
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {tables.map((table, i) => (
            <div
              key={table.id}
              onClick={() => router.push(`/dashboard/tables/${table.id}`)}
              className="card animate-fade-in"
              style={{ cursor: "pointer", padding: 20, animationDelay: `${i * 40}ms` }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--border-hover)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "var(--brand-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Table2 size={18} style={{ color: "var(--brand)" }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{table.name}</h3>
                    {table.description && (
                      <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{table.description}</p>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {profile?.role === "admin" && (
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
                      onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        setTableToDelete(table); 
                      }}
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
                  <ArrowRight size={14} style={{ color: "var(--text-muted)" }} />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  fontSize: 11,
                  color: "var(--text-muted)",
                  paddingTop: 12,
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FileSpreadsheet size={12} />
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{table.lead_count}</strong> leads
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Users size={12} />
                  <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{table.member_count}</strong> members
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
                  <Clock size={12} />
                  {new Date(table.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pipeline */}
      {totalLeads > 0 && (
        <div className="animate-fade-in" style={{ marginTop: 32 }}>
          <h2 className="font-heading" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>
            Pipeline
          </h2>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                <div
                  key={status}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: 6,
                    background: "var(--bg-surface)",
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColors[status] || "var(--text-muted)" }} />
                  <span style={{ color: "var(--text-secondary)" }}>{status}</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 700 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCreateModal && (
        <CreateTableModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {/* Custom Delete Confirmation Modal */}
      {tableToDelete && (
        <div className="modal-overlay animate-fade-in" onClick={() => !isDeleting && setTableToDelete(null)}>
          <div className="modal animate-pop-in" onClick={e => e.stopPropagation()} style={{ padding: 24, maxWidth: 400, width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--rose-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--rose)", flexShrink: 0 }}>
                <Trash2 size={20} />
              </div>
              <div>
                <h2 className="font-heading" style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>Delete Table</h2>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Are you sure you want to proceed?</p>
              </div>
            </div>
            
            <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 24 }}>
              You are about to delete the table <strong>{tableToDelete.name}</strong>. This will permanently remove the table and delete all its leads. This action cannot be undone.
            </p>
            
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setTableToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button 
                className="btn" 
                style={{ background: "var(--rose)", color: "white", border: "none" }}
                onClick={confirmDeleteTable}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Yes, Delete Table"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
