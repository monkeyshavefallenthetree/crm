"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { X, Building2, Trees, Video } from "lucide-react";

interface Lead { id: string; full_name: string; }
interface MeetingModalProps {
  onClose: () => void;
  onSuccess: () => void;
  editMeeting?: any;
  prefillLeadId?: string;
}

const TYPES = [
  { value: "indoor", label: "Indoor", icon: Building2, color: "var(--purple)" },
  { value: "outdoor", label: "Outdoor", icon: Trees, color: "var(--green)" },
  { value: "online", label: "Online", icon: Video, color: "var(--blue)" },
];

export default function MeetingModal({ onClose, onSuccess, editMeeting, prefillLeadId }: MeetingModalProps) {
  const supabase = createClient();
  const [title, setTitle] = useState(editMeeting?.title || "");
  const [meetingType, setMeetingType] = useState(editMeeting?.meeting_type || "indoor");
  const [location, setLocation] = useState(editMeeting?.location || "");
  const [meetingLink, setMeetingLink] = useState(editMeeting?.meeting_link || "");
  const [meetingDate, setMeetingDate] = useState(editMeeting?.meeting_date || "");
  const [startTime, setStartTime] = useState(editMeeting?.start_time?.slice(0,5) || "");
  const [endTime, setEndTime] = useState(editMeeting?.end_time?.slice(0,5) || "");
  const [leadId, setLeadId] = useState(editMeeting?.lead_id || prefillLeadId || "");
  const [description, setDescription] = useState(editMeeting?.description || "");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("leads").select("id, full_name").order("full_name").then(({ data }) => {
      if (data) setLeads(data);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const selectedLead = leads.find(l => l.id === leadId);
    const obj: any = {
      title, meeting_type: meetingType, meeting_date: meetingDate,
      start_time: startTime, end_time: endTime || null,
      location: meetingType !== "online" ? location : null,
      meeting_link: meetingType === "online" ? meetingLink : null,
      lead_id: leadId || null, lead_name: selectedLead?.full_name || null,
      description: description || null,
    };
    let error;
    if (editMeeting?.id) {
      ({ error } = await supabase.from("meetings").update(obj).eq("id", editMeeting.id));
    } else {
      ({ error } = await supabase.from("meetings").insert(obj));
    }
    // Sync meeting date+time to the lead's scheduled_meeting field
    if (!error && leadId && meetingDate && startTime) {
      const scheduledTs = `${meetingDate}T${startTime}:00`;
      await supabase.from("leads").update({ scheduled_meeting: scheduledTs, status: "Meeting Scheduled" }).eq("id", leadId);
    }
    setSaving(false);
    if (!error) onSuccess();
    else alert("Error: " + error.message);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ padding: 24, maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 className="font-heading" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
            {editMeeting ? "Edit Meeting" : "Schedule Meeting"}
          </h2>
          <button onClick={onClose} style={{ padding: 6, borderRadius: 6, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Title */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Title *</label>
            <input className="input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Meeting title" />
          </div>

          {/* Meeting Type */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Type *</label>
            <div style={{ display: "flex", gap: 8 }}>
              {TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setMeetingType(t.value)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "'Inter',sans-serif",
                    fontSize: 13, fontWeight: 600, transition: "all 0.18s ease",
                    background: meetingType === t.value ? `color-mix(in srgb, ${t.color} 15%, transparent)` : "var(--bg-surface)",
                    color: meetingType === t.value ? t.color : "var(--text-secondary)",
                    border: `1.5px solid ${meetingType === t.value ? t.color : "var(--border-subtle)"}`,
                  }}>
                  <t.icon size={16} /> {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location or Link */}
          {meetingType !== "online" ? (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Place *
              </label>
              <input className="input" value={location} onChange={e => setLocation(e.target.value)} required placeholder={meetingType === "indoor" ? "Office, room name..." : "Park, venue..."} />
            </div>
          ) : (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Meeting Link *
              </label>
              <input className="input" type="url" value={meetingLink} onChange={e => setMeetingLink(e.target.value)} required placeholder="https://zoom.us/j/..." />
            </div>
          )}

          {/* Date & Time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Date *</label>
              <input className="input" type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Start *</label>
              <input className="input" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} required />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>End</label>
              <input className="input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Lead */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Linked Lead</label>
            <select className="select" style={{ width: "100%" }} value={leadId} onChange={e => setLeadId(e.target.value)}>
              <option value="">None</option>
              {leads.map(l => <option key={l.id} value={l.id}>{l.full_name}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 500, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Description</label>
            <textarea className="input" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Agenda, notes..." style={{ resize: "vertical" }} />
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "Saving..." : editMeeting ? "Update" : "Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
