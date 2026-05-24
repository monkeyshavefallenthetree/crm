"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import { Search, Plus, MessageSquare, X, Upload, Download, Trash2, ArrowLeft, Users, CalendarDays, Building2, Trees, Video } from "lucide-react";
import MeetingModal from "../../meetings/MeetingModal";
import * as XLSX from "xlsx";

interface Lead {
  id: string; date: string; services_needed: string; industry_type: string;
  preferred_time: string; page_name: string; full_name: string; email: string;
  phone_number: string; job_title: string; status: string;
  marketing_budget_monthly: string | null; scheduled_meeting: string | null;
  created_at: string; updated_at: string; table_id: string;
}
interface Note { id: string; lead_id: string; author_id: string; author_name: string; content: string; note_type: string; created_at: string; }
interface Profile { id: string; full_name: string; role: string; }
interface TableInfo { id: string; name: string; description: string; }

const STATUSES = ["Qualified","Not Qualified","Follow Up","Call Again","Switched Off","Meeting Scheduled","Done Meeting","Converted Done Deal"];

export default function TableDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [table, setTable] = useState<TableInfo | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [notes, setNotes] = useState<Record<string, Note[]>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newNote, setNewNote] = useState("");
  const [showAddLead, setShowAddLead] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [importModal, setImportModal] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [leadMeetings, setLeadMeetings] = useState<any[]>([]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const loadLeads = useCallback(async () => {
    const { data } = await supabase.from("leads").select("*").eq("table_id", id).order("created_at", { ascending: false });
    if (data) setLeads(data);
    setLoading(false);
  }, [id]);

  const loadNotes = useCallback(async (leadId: string) => {
    const { data } = await supabase.from("lead_notes").select("*").eq("lead_id", leadId).order("created_at", { ascending: true });
    if (data) setNotes(prev => ({ ...prev, [leadId]: data }));
  }, []);

  useEffect(() => {
    async function init() {
      const [tableRes, userRes] = await Promise.all([
        supabase.from("lead_tables").select("*").eq("id", id).single(),
        supabase.auth.getUser()
      ]);
      
      const { data: t } = tableRes;
      if (t) setTable(t);
      
      const { data: { user } } = userRes;

      // Check mft_session cookie for user identity
      const mftCookie = document.cookie
        .split('; ')
        .find(row => row.startsWith('mft_session='));
      const mftSession = mftCookie
        ? JSON.parse(decodeURIComponent(mftCookie.split('=').slice(1).join('=')))
        : null;

      const isDemo = document.cookie.includes('demo_bypass=true');

      if (mftSession) {
        setProfile({ id: mftSession.id, full_name: mftSession.full_name || "User", role: mftSession.role || "user" });
      } else if (isDemo && !user) {
        setProfile({ id: '00000000-0000-0000-0000-000000000000', full_name: 'Ahmed', role: 'admin' });
      } else if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (data) setProfile(data);
      }
      loadLeads();
    }
    init();
    const handleImport = () => setImportModal(true);
    const handleExport = () => exportExcel();
    document.addEventListener("openImport", handleImport);
    document.addEventListener("exportExcel", handleExport);
    return () => { document.removeEventListener("openImport", handleImport); document.removeEventListener("exportExcel", handleExport); };
  }, [id]);

  useEffect(() => {
    if (selectedLead) {
      loadNotes(selectedLead.id);
      supabase.from("meetings").select("*").eq("lead_id", selectedLead.id).order("meeting_date", { ascending: true }).then(({ data }) => {
        setLeadMeetings(data || []);
      });
    }
  }, [selectedLead]);

  async function updateStatus(lid: string, status: string) {
    await supabase.from("leads").update({ status }).eq("id", lid);
    setLeads(prev => prev.map(l => l.id === lid ? { ...l, status } : l));
    showToast(`Status → ${status}`);
  }

  async function addNote() {
    if (!newNote.trim() || !selectedLead || !profile) return;
    const authorId = profile.id;
    const { error } = await supabase.from("lead_notes").insert({ lead_id: selectedLead.id, author_id: authorId, author_name: profile.full_name, content: newNote.trim(), note_type: "reply" });
    if (!error) { setNewNote(""); loadNotes(selectedLead.id); showToast("Note added"); }
  }

  async function deleteLead(lid: string) {
    if (!confirm("Delete this lead?")) return;
    await supabase.from("lead_notes").delete().eq("lead_id", lid);
    await supabase.from("meetings").delete().eq("lead_id", lid);
    const { error } = await supabase.from("leads").delete().eq("id", lid);
    if (error) {
      showToast("Error deleting lead: " + error.message);
      return;
    }
    setLeads(prev => prev.filter(l => l.id !== lid));
    setSelectedLead(null);
    showToast("Lead deleted");
  }

  async function addLead(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const obj: Record<string, string> = { table_id: id! };
    fd.forEach((v, k) => { if (v) obj[k] = v as string; });
    const { error } = await supabase.from("leads").insert(obj);
    if (!error) { setShowAddLead(false); loadLeads(); showToast("Lead added"); }
  }

  async function handleImportFile(file: File) {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data);

    // ── Import Leads sheet ──
    const ws = wb.Sheets["Leads"] || wb.Sheets[wb.SheetNames[0]];
    const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws);

    const validRows = rows.filter(r => r["full name"] || r["full_name"] || r["Full Name"]);
    const mappedLeads: any[] = [];
    const notesToInsert: any[] = [];
    const standardKeys = ["date","Date","what_services_do_you_need?_","services_needed","Services Needed","Service","industry_type_","industry_type","Industry","which_time_do_you_prefer?","preferred_time","Preferred Time","name_of_page_","page_name","Page Name","full name","full_name","Full Name","email","Email","phone_number","Phone","job_title","Job Title","Status","status","Marketing Budget/Month (Optional)","marketing_budget_monthly","Budget","Scheduled Meeting","scheduled_meeting","Scheduled Meetings (Optional)"];

    for (const r of validRows) {
      const leadId = crypto.randomUUID();
      mappedLeads.push({
        id: leadId, table_id: id,
        date: r["date"] || r["Date"] || "",
        services_needed: r["what_services_do_you_need?_"] || r["services_needed"] || r["Services Needed"] || r["Service"] || "",
        industry_type: r["industry_type_"] || r["industry_type"] || r["Industry"] || "",
        preferred_time: r["which_time_do_you_prefer?"] || r["preferred_time"] || r["Preferred Time"] || "",
        page_name: r["name_of_page_"] || r["page_name"] || r["Page Name"] || "",
        full_name: r["full name"] || r["full_name"] || r["Full Name"] || "",
        email: r["email"] || r["Email"] || "",
        phone_number: r["phone_number"] || r["Phone"] || "",
        job_title: r["job_title"] || r["Job Title"] || "",
        status: r["Status"] || r["status"] || "Follow Up",
        marketing_budget_monthly: r["Marketing Budget/Month (Optional)"] || r["marketing_budget_monthly"] || r["Budget"] || null,
        scheduled_meeting: r["Scheduled Meeting"] || r["scheduled_meeting"] || r["Scheduled Meetings (Optional)"] || null,
      });

      Object.entries(r).forEach(([key, value]) => {
        if (!standardKeys.includes(key) && value) {
           notesToInsert.push({ lead_id: leadId, author_id: "00000000-0000-0000-0000-000000000000", author_name: key, content: String(value), note_type: "reply" });
        }
      });
    }

    if (mappedLeads.length === 0) { showToast("No valid rows"); return; }
    const { error } = await supabase.from("leads").insert(mappedLeads);
    if (error) { showToast("Import error: " + error.message); return; }

    if (notesToInsert.length > 0) await supabase.from("lead_notes").insert(notesToInsert);

    // ── Import Meetings sheet (if present) ──
    const wsMeetings = wb.Sheets["Meetings"];
    if (wsMeetings) {
      const meetingRows: Record<string, string>[] = XLSX.utils.sheet_to_json(wsMeetings);
      const meetingsToInsert = meetingRows
        .filter(m => m["Meeting Title"] && m["Date"])
        .map(m => {
          // Find linked lead by name
          const linkedLead = mappedLeads.find(l => l.full_name === m["Lead Name"]);
          const typeRaw = (m["Type"] || "indoor").toLowerCase();
          const meetingType = ["indoor", "outdoor", "online"].includes(typeRaw) ? typeRaw : "indoor";
          // Parse date
          let meetingDate = "";
          try {
            const parsed = new Date(m["Date"]);
            if (!isNaN(parsed.getTime())) meetingDate = parsed.toISOString().slice(0, 10);
          } catch { /* skip */ }
          return {
            title: m["Meeting Title"],
            meeting_type: meetingType,
            meeting_date: meetingDate || new Date().toISOString().slice(0, 10),
            start_time: m["Start Time"] || "09:00",
            end_time: m["End Time"] || null,
            location: meetingType !== "online" ? (m["Place"] || null) : null,
            meeting_link: meetingType === "online" ? (m["Meeting Link"] || null) : null,
            lead_id: linkedLead?.id || null,
            lead_name: m["Lead Name"] || null,
            description: m["Description"] || null,
          };
        });
      if (meetingsToInsert.length > 0) {
        const { error: mtgError } = await supabase.from("meetings").insert(meetingsToInsert);
        if (mtgError) {
          console.error("Meetings Import Error:", mtgError);
          showToast("Error importing meetings: " + mtgError.message);
          return;
        }
      }
      showToast(`Imported ${mappedLeads.length} leads + ${meetingsToInsert.length} meetings`);
    } else {
      showToast(`Imported ${mappedLeads.length} leads`);
    }

    loadLeads();
    setImportModal(false);
  }

  async function exportExcel() {
    // Leads sheet — all fields in organized order
    const leadsData = filteredLeads.map(l => ({
      "Date": l.date,
      "Full Name": l.full_name,
      "Email": l.email,
      "Phone": l.phone_number,
      "Job Title": l.job_title,
      "Page Name": l.page_name,
      "Service": l.services_needed,
      "Industry": l.industry_type,
      "Preferred Time": l.preferred_time,
      "Status": l.status,
      "Budget": l.marketing_budget_monthly || "",
      "Scheduled Meeting": l.scheduled_meeting ? new Date(l.scheduled_meeting).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "",
    }));
    const wsLeads = XLSX.utils.json_to_sheet(leadsData);
    // Set column widths
    wsLeads["!cols"] = [
      { wch: 12 }, { wch: 22 }, { wch: 26 }, { wch: 16 }, { wch: 18 },
      { wch: 16 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 20 },
      { wch: 14 }, { wch: 22 },
    ];

    // Meetings sheet — fetch all meetings for this table's leads
    const leadIds = leads.map(l => l.id);
    const { data: meetingsData } = await supabase.from("meetings").select("*").in("lead_id", leadIds).order("meeting_date");
    const meetingsRows = (meetingsData || []).map(m => ({
      "Meeting Title": m.title,
      "Type": m.meeting_type.charAt(0).toUpperCase() + m.meeting_type.slice(1),
      "Date": m.meeting_date ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "",
      "Start Time": m.start_time?.slice(0, 5) || "",
      "End Time": m.end_time?.slice(0, 5) || "",
      "Place": m.location || "",
      "Meeting Link": m.meeting_link || "",
      "Lead Name": m.lead_name || "",
      "Description": m.description || "",
    }));
    const wsMeetings = XLSX.utils.json_to_sheet(meetingsRows.length > 0 ? meetingsRows : [{ "Meeting Title": "", "Type": "", "Date": "", "Start Time": "", "End Time": "", "Place": "", "Meeting Link": "", "Lead Name": "", "Description": "" }]);
    wsMeetings["!cols"] = [
      { wch: 24 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
      { wch: 24 }, { wch: 36 }, { wch: 22 }, { wch: 30 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsLeads, "Leads");
    XLSX.utils.book_append_sheet(wb, wsMeetings, "Meetings");
    XLSX.writeFile(wb, `${table?.name || "Leads"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast("Excel exported");
  }

  const filteredLeads = leads.filter(l => {
    const matchSearch = !search || [l.full_name, l.email, l.phone_number, l.services_needed].some(f => f?.toLowerCase().includes(search.toLowerCase()));
    return matchSearch && (statusFilter === "all" || l.status === statusFilter);
  });

  const statusCounts = STATUSES.reduce((a, s) => { a[s] = leads.filter(l => l.status === s).length; return a; }, {} as Record<string, number>);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            display: "flex", alignItems: "center", gap: 6, fontSize: 12,
            color: "var(--text-muted)", marginBottom: 12, fontWeight: 500,
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontFamily: "'Inter', sans-serif", transition: "color 0.15s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.color = "var(--text-primary)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}
        >
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="font-heading" style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>
              {table?.name || "Loading..."}
            </h1>
            {table?.description && <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>{table.description}</p>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setImportModal(true)}><Upload size={14} /> Import</button>
            <button className="btn btn-secondary btn-sm" onClick={exportExcel}><Download size={14} /> Export</button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddLead(true)}><Plus size={14} /> Add Lead</button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20, flexShrink: 0 }}>
        <div className="card" style={{ padding: "12px 16px" }}>
          <div className="font-heading" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{leads.length}</div>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, color: "var(--text-muted)", marginTop: 4 }}>Total</div>
        </div>
        {["Qualified","Follow Up","Meeting Scheduled","Converted Done Deal"].map(s => (
          <div key={s}
            className="card"
            style={{
              padding: "12px 16px", cursor: "pointer", transition: "all 0.18s ease",
              borderColor: statusFilter === s ? "var(--brand)" : undefined,
              background: statusFilter === s ? "var(--brand-subtle)" : undefined,
            }}
            onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}>
            <div className="font-heading" style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{statusCounts[s] || 0}</div>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 500, color: "var(--text-muted)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s === "Converted Done Deal" ? "Converted" : s}
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexShrink: 0, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search leads..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <div style={{ width: 24, height: 24, border: "2px solid var(--brand)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", borderRadius: 12, border: "1px dashed var(--border-default)", background: "var(--bg-card)" }}>
          <Users size={36} style={{ margin: "0 auto 12px", color: "var(--text-muted)", opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>No leads found</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Add a lead or import from Excel</p>
        </div>
      ) : (
        <div className="table-container" style={{ flex: 1, overflow: "auto" }}>
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft: 16 }}>Name</th><th>Email</th><th>Phone</th><th>Page</th><th>Job</th><th>Service</th><th>Industry</th><th>Time</th><th>Status</th><th>Date</th><th style={{ width: 48, textAlign: "center" }}>Notes</th>{profile?.role === "admin" && <th style={{ width: 48 }}></th>}
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map((lead, i) => (
                <tr key={lead.id} className="group" style={{ cursor: "pointer", animation: `fadeIn 0.35s var(--ease) ${i * 8}ms both` }} onClick={() => setSelectedLead(lead)}>
                  <td style={{ paddingLeft: 16, fontWeight: 500, color: "var(--text-primary)" }}>{lead.full_name}</td>
                  <td style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{lead.email}</td>
                  <td>{lead.phone_number}</td>
                  <td style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>{lead.page_name}</td>
                  <td style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis" }}>{lead.job_title}</td>
                  <td style={{ maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis" }}>{lead.services_needed}</td>
                  <td style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis" }}>{lead.industry_type}</td>
                  <td>{lead.preferred_time}</td>
                  <td onClick={e => e.stopPropagation()}>
                    <select className="select" style={{ padding: "4px 28px 4px 8px", fontSize: 11 }} value={lead.status} onChange={e => updateStatus(lead.id, e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontSize: 11 }}>{lead.date}</td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      style={{ padding: 6, borderRadius: 6, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", transition: "all 0.15s ease" }}
                      onClick={e => { e.stopPropagation(); setSelectedLead(lead); }}
                      onMouseEnter={e => { e.currentTarget.style.color = "var(--brand)"; e.currentTarget.style.background = "var(--brand-subtle)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                    >
                      <MessageSquare size={14} />
                    </button>
                  </td>
                  {profile?.role === "admin" && (
                    <td style={{ textAlign: "center" }}>
                      <button
                        style={{ padding: 6, borderRadius: 6, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", transition: "all 0.15s ease", opacity: 0 }}
                        className="group-hover:opacity-100"
                        onClick={e => { e.stopPropagation(); deleteLead(lead.id); }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--rose)"; e.currentTarget.style.background = "var(--rose-bg)"; e.currentTarget.style.opacity = "1"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selectedLead && (
        <>
          <div className="modal-overlay" onClick={() => setSelectedLead(null)} />
          <div className="slide-panel" style={{ display: "flex", flexDirection: "column" }}>
            {/* Panel Header */}
            <div style={{ padding: 20, borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <h2 className="font-heading" style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{selectedLead.full_name}</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{selectedLead.job_title} · {selectedLead.page_name}</p>
                </div>
                <button
                  style={{ padding: 6, borderRadius: 6, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                  onClick={() => setSelectedLead(null)}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <X size={18} />
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-card)", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-subtle)" }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>Status</span>
                <select className="select" style={{ flex: 1, padding: "6px 28px 6px 10px", fontSize: 12 }} value={selectedLead.status} onChange={e => { updateStatus(selectedLead.id, e.target.value); setSelectedLead({ ...selectedLead, status: e.target.value }); }}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {/* Lead Info Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 16px", marginBottom: 24 }}>
                {[["Email", selectedLead.email], ["Phone", selectedLead.phone_number], ["Service", selectedLead.services_needed], ["Industry", selectedLead.industry_type], ["Time", selectedLead.preferred_time], ["Date", selectedLead.date], ["Budget", selectedLead.marketing_budget_monthly || "—"], ["Meeting", selectedLead.scheduled_meeting ? new Date(selectedLead.scheduled_meeting).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"]].map(([l, v]) => (
                  <div key={l}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{l}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>{v || "—"}</div>
                  </div>
                ))}
              </div>

              {/* Meetings Section */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 20, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
                    <CalendarDays size={14} style={{ color: "var(--purple)" }} /> Meetings
                  </h3>
                  <button className="btn btn-sm" style={{ padding: "5px 12px", fontSize: 11, background: "var(--purple-bg)", color: "var(--purple)", border: "1px solid transparent" }}
                    onClick={() => setShowMeetingModal(true)}>
                    <Plus size={12} /> Schedule
                  </button>
                </div>
                {leadMeetings.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 16, color: "var(--text-muted)", fontSize: 12, border: "1px dashed var(--border-subtle)", borderRadius: 8 }}>No meetings scheduled</div>
                ) : leadMeetings.map(m => {
                  const typeIcon = m.meeting_type === "indoor" ? Building2 : m.meeting_type === "outdoor" ? Trees : Video;
                  const typeColor = m.meeting_type === "indoor" ? "var(--purple)" : m.meeting_type === "outdoor" ? "var(--green)" : "var(--blue)";
                  const typeBg = m.meeting_type === "indoor" ? "var(--purple-bg)" : m.meeting_type === "outdoor" ? "var(--green-bg)" : "var(--blue-bg)";
                  const Icon = typeIcon;
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 8, background: "var(--bg-surface)", border: "1px solid var(--border-subtle)", marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: typeBg, flexShrink: 0 }}>
                        <Icon size={16} style={{ color: typeColor }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{m.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {new Date(m.meeting_date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {m.start_time?.slice(0,5)}
                          {m.location ? " · " + m.location : ""}
                          {m.meeting_link ? " · Online" : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Notes */}
              <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <MessageSquare size={14} style={{ color: "var(--brand)" }} /> Notes
                </h3>
                <div style={{ paddingLeft: 4, marginBottom: 16 }}>
                  {(notes[selectedLead.id] || []).length === 0 ? (
                    <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)", fontSize: 12, border: "1px dashed var(--border-subtle)", borderRadius: 8 }}>No notes yet</div>
                  ) : (notes[selectedLead.id] || []).map(note => {
                    const isSystem = note.author_id === '00000000-0000-0000-0000-000000000000';
                    return (
                      <div key={note.id} className="timeline-item animate-fade-in">
                        <div className={`timeline-dot ${!isSystem ? 'primary' : ''}`}></div>
                        <div style={{
                          padding: 12, borderRadius: 8,
                          border: `1px solid ${!isSystem ? "rgba(220,38,38,0.1)" : "var(--border-subtle)"}`,
                          background: !isSystem ? "var(--brand-subtle)" : "var(--bg-surface)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: !isSystem ? "var(--brand)" : "var(--text-muted)" }}>{note.author_name}</span>
                            <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{new Date(note.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{note.content}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Note Input */}
            <div style={{ padding: 16, borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input className="input" placeholder="Write a note..." value={newNote} onChange={e => setNewNote(e.target.value)} onKeyDown={e => e.key === "Enter" && addNote()} />
                <button className="btn btn-primary btn-sm" onClick={addNote}>Send</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Lead Modal */}
      {showAddLead && (
        <div className="modal-overlay" onClick={() => setShowAddLead(false)}>
          <div className="modal" style={{ padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 className="font-heading" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add Lead</h2>
              <button
                style={{ padding: 6, borderRadius: 6, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
                onClick={() => setShowAddLead(false)}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={addLead} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[["Full Name *","full_name","text",true],["Email","email","email",false],["Phone","phone_number","text",false],["Job Title","job_title","text",false],["Service","services_needed","text",false],["Industry","industry_type","text",false],["Page Name","page_name","text",false],["Preferred Time","preferred_time","text",false],["Date","date","text",false]].map(([l,n,t,r]) => (
                  <div key={n as string}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l as string}</label>
                    <input className="input" name={n as string} type={t as string} required={r as boolean} />
                  </div>
                ))}
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Status</label>
                  <select className="select" style={{ width: "100%" }} name="status">{STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Budget/Month</label>
                  <input className="input" name="marketing_budget_monthly" placeholder="Optional" />
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddLead(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">Add Lead</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="modal-overlay" onClick={() => setImportModal(false)}>
          <div className="modal" style={{ padding: 24 }} onClick={e => e.stopPropagation()}>
            <h2 className="font-heading" style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Import Excel</h2>
            <p style={{ color: "var(--text-muted)", fontSize: 12, marginBottom: 20 }}>Upload .xlsx file with lead data</p>
            <div
              style={{
                border: "2px dashed var(--border-default)",
                borderRadius: 12,
                padding: 32,
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.15s ease",
                background: "var(--bg-surface)",
              }}
              onClick={() => fileRef.current?.click()}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--brand)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-default)"; }}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--brand)"; }}
              onDragLeave={e => e.currentTarget.style.borderColor = "var(--border-default)"}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImportFile(f); }}
            >
              <Upload size={28} style={{ margin: "0 auto 8px", color: "var(--text-muted)" }} />
              <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", margin: 0 }}>Drop file or click to browse</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setImportModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showMeetingModal && selectedLead && (
        <MeetingModal
          prefillLeadId={selectedLead.id}
          onClose={() => setShowMeetingModal(false)}
          onSuccess={async () => {
            setShowMeetingModal(false);
            showToast("Meeting scheduled");
            // Refresh meetings for this lead
            const { data: mtgs } = await supabase.from("meetings").select("*").eq("lead_id", selectedLead.id).order("meeting_date");
            setLeadMeetings(mtgs || []);
            // Refresh lead data so scheduled_meeting & status update
            const { data: updatedLead } = await supabase.from("leads").select("*").eq("id", selectedLead.id).single();
            if (updatedLead) {
              setSelectedLead(updatedLead);
              setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
            }
          }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

