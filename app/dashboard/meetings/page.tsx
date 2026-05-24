"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import {
  Plus, CalendarDays, List, Search, Building2, Trees, Video,
  Clock, Trash2, ExternalLink, MapPin, X
} from "lucide-react";
import CalendarView from "./CalendarView";
import MeetingModal from "./MeetingModal";

interface Meeting {
  id: string; title: string; meeting_type: string; location: string | null;
  meeting_link: string | null; meeting_date: string; start_time: string;
  end_time: string | null; lead_id: string | null; lead_name: string | null;
  description: string | null; created_at: string;
}

const TYPE_CFG: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  indoor:  { icon: Building2, color: "var(--purple)", bg: "var(--purple-bg)", label: "Indoor" },
  outdoor: { icon: Trees,     color: "var(--green)",  bg: "var(--green-bg)",  label: "Outdoor" },
  online:  { icon: Video,     color: "var(--blue)",   bg: "var(--blue-bg)",   label: "Online" },
};

export default function MeetingsPage() {
  const supabase = createClient();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"calendar" | "list">("list");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };

  async function loadMeetings() {
    const { data } = await supabase.from("meetings").select("*").order("meeting_date", { ascending: true }).order("start_time", { ascending: true });
    if (data) setMeetings(data);
    setLoading(false);
  }

  useEffect(() => { loadMeetings(); }, []);

  async function deleteMeeting(id: string) {
    if (!confirm("Delete this meeting?")) return;
    const { error } = await supabase.from("meetings").delete().eq("id", id);
    if (!error) { setMeetings(p => p.filter(m => m.id !== id)); setSelectedMeeting(null); showToast("Meeting deleted"); }
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayMeetings = meetings.filter(m => m.meeting_date === today).length;
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
  const weekStr = weekEnd.toISOString().slice(0, 10);
  const weekMeetings = meetings.filter(m => m.meeting_date >= today && m.meeting_date <= weekStr).length;
  const upcoming = meetings.filter(m => m.meeting_date >= today).length;

  const filtered = meetings.filter(m => {
    if (typeFilter !== "all" && m.meeting_type !== typeFilter) return false;
    if (selectedDate && m.meeting_date !== selectedDate) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.title.toLowerCase().includes(q) || m.lead_name?.toLowerCase().includes(q);
    }
    return true;
  });

  const stats = [
    { label: "Total", value: meetings.length, color: "var(--brand)", bg: "var(--brand-subtle)" },
    { label: "Today", value: todayMeetings, color: "var(--amber)", bg: "var(--amber-bg)" },
    { label: "This Week", value: weekMeetings, color: "var(--blue)", bg: "var(--blue-bg)" },
    { label: "Upcoming", value: upcoming, color: "var(--green)", bg: "var(--green-bg)" },
  ];

  function fmtTime(t: string) { return t?.slice(0, 5) || ""; }
  function fmtDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "128px 0" }}>
        <div style={{ width: 24, height: 24, border: "2px solid var(--brand)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="font-heading" style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em", margin: 0 }}>Meetings</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>Schedule and track all your meetings</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditMeeting(null); setShowModal(true); }}>
          <Plus size={14} /> Schedule Meeting
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {stats.map((s, i) => (
          <div key={i} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: s.bg, flexShrink: 0 }}>
              <CalendarDays size={18} style={{ color: s.color }} />
            </div>
            <div>
              <div className="font-heading" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: "var(--text-muted)", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
          <input className="input" style={{ paddingLeft: 36 }} placeholder="Search meetings..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="select" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="indoor">Indoor</option>
          <option value="outdoor">Outdoor</option>
          <option value="online">Online</option>
        </select>
        {selectedDate && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDate(null)} style={{ gap: 6 }}>
            {fmtDate(selectedDate)} <X size={12} />
          </button>
        )}
        <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
          {(["list", "calendar"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: "none", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: 6,
                background: view === v ? "var(--brand-subtle)" : "var(--bg-surface)",
                color: view === v ? "var(--brand)" : "var(--text-muted)",
              }}>
              {v === "list" ? <List size={14} /> : <CalendarDays size={14} />}
              {v === "list" ? "List" : "Calendar"}
            </button>
          ))}
        </div>
      </div>

      {/* Views */}
      {view === "calendar" ? (
        <CalendarView meetings={meetings} onDateClick={d => { setSelectedDate(d === selectedDate ? null : d); setView("list"); }} />
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 24px", borderRadius: 12, border: "1px dashed var(--border-default)", background: "var(--bg-card)" }}>
          <CalendarDays size={36} style={{ margin: "0 auto 12px", color: "var(--text-muted)", opacity: 0.4 }} />
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", margin: "0 0 4px" }}>No meetings found</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 16px" }}>Schedule your first meeting to get started</p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}><Plus size={14} /> Schedule Meeting</button>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Time</th><th>Title</th><th>Type</th><th>Location / Link</th><th>Lead</th><th style={{ width: 48 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => {
                const cfg = TYPE_CFG[m.meeting_type] || TYPE_CFG.indoor;
                const Icon = cfg.icon;
                return (
                  <tr key={m.id} style={{ cursor: "pointer", animation: `fadeIn 0.35s var(--ease) ${i * 8}ms both` }} onClick={() => setSelectedMeeting(m)}>
                    <td style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: 12 }}>{fmtDate(m.meeting_date)}</td>
                    <td><span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={12} style={{ color: "var(--text-muted)" }} />{fmtTime(m.start_time)}{m.end_time ? ` – ${fmtTime(m.end_time)}` : ""}</span></td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{m.title}</td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                        <Icon size={12} /> {cfg.label}
                      </span>
                    </td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {m.meeting_type === "online" ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--blue)" }} onClick={e => { e.stopPropagation(); window.open(m.meeting_link!, "_blank"); }}>
                          <ExternalLink size={12} /> {m.meeting_link}
                        </span>
                      ) : (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={12} style={{ color: "var(--text-muted)" }} /> {m.location}</span>
                      )}
                    </td>
                    <td>{m.lead_name || "—"}</td>
                    <td>
                      <button onClick={e => { e.stopPropagation(); deleteMeeting(m.id); }}
                        style={{ padding: 6, borderRadius: 6, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", transition: "all 0.15s ease" }}
                        onMouseEnter={e => { e.currentTarget.style.color = "var(--rose)"; e.currentTarget.style.background = "var(--rose-bg)"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Panel */}
      {selectedMeeting && (() => {
        const m = selectedMeeting;
        const cfg = TYPE_CFG[m.meeting_type] || TYPE_CFG.indoor;
        const Icon = cfg.icon;
        return (
          <>
            <div className="modal-overlay" onClick={() => setSelectedMeeting(null)} />
            <div className="slide-panel" style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: 20, borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)", flexShrink: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <h2 className="font-heading" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{m.title}</h2>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: cfg.bg, color: cfg.color, marginTop: 8 }}>
                      <Icon size={12} /> {cfg.label}
                    </span>
                  </div>
                  <button onClick={() => setSelectedMeeting(null)} style={{ padding: 6, borderRadius: 6, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 16px", marginBottom: 24 }}>
                  {[
                    ["Date", fmtDate(m.meeting_date)],
                    ["Time", `${fmtTime(m.start_time)}${m.end_time ? " – " + fmtTime(m.end_time) : ""}`],
                    m.meeting_type === "online" ? ["Meeting Link", m.meeting_link || "—"] : ["Place", m.location || "—"],
                    ["Lead", m.lead_name || "—"],
                  ].map(([l, v]) => (
                    <div key={l as string}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
                        {l === "Meeting Link" && v !== "—" ? (
                          <a href={v as string} target="_blank" rel="noopener" style={{ color: "var(--blue)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
                            <ExternalLink size={12} /> Join Meeting
                          </a>
                        ) : v}
                      </div>
                    </div>
                  ))}
                </div>
                {m.description && (
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Description</div>
                    <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0 }}>{m.description}</p>
                  </div>
                )}
              </div>
              <div style={{ padding: 16, borderTop: "1px solid var(--border-subtle)", background: "var(--bg-surface)", flexShrink: 0, display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => { setEditMeeting(m); setShowModal(true); setSelectedMeeting(null); }}>Edit</button>
                <button className="btn btn-sm" style={{ flex: 1, background: "var(--rose-bg)", color: "var(--rose)", border: "1px solid transparent" }} onClick={() => deleteMeeting(m.id)}>Delete</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* Modal */}
      {showModal && (
        <MeetingModal
          editMeeting={editMeeting}
          onClose={() => { setShowModal(false); setEditMeeting(null); }}
          onSuccess={() => { setShowModal(false); setEditMeeting(null); loadMeetings(); showToast(editMeeting ? "Meeting updated" : "Meeting scheduled"); }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
