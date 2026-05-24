"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Meeting { id: string; meeting_date: string; title: string; meeting_type: string; start_time: string; }

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const typeColors: Record<string, string> = { indoor: "var(--purple)", outdoor: "var(--green)", online: "var(--blue)" };

export default function CalendarView({ meetings, onDateClick }: { meetings: Meeting[]; onDateClick: (date: string) => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function prev() { if (month === 0) { setMonth(11); setYear(y => y-1); } else setMonth(m => m-1); }
  function next() { if (month === 11) { setMonth(0); setYear(y => y+1); } else setMonth(m => m+1); }

  function dateStr(day: number) {
    return `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={prev} className="btn btn-ghost btn-icon"><ChevronLeft size={18} /></button>
        <h3 className="font-heading" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{MONTHS[month]} {year}</h3>
        <button onClick={next} className="btn btn-ghost btn-icon"><ChevronRight size={18} /></button>
      </div>
      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAYS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "6px 0" }}>{d}</div>
        ))}
      </div>
      {/* Cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} />;
          const ds = dateStr(day);
          const isToday = ds === todayStr;
          const dayMeetings = meetings.filter(m => m.meeting_date === ds);
          return (
            <div key={ds} onClick={() => onDateClick(ds)}
              style={{
                minHeight: 64, padding: "4px 6px", borderRadius: 8, cursor: "pointer",
                transition: "all 0.15s ease",
                background: isToday ? "var(--brand-subtle)" : "transparent",
                border: isToday ? "1px solid var(--brand)" : "1px solid transparent",
              }}
              onMouseEnter={e => { if (!isToday) e.currentTarget.style.background = "var(--bg-surface)"; }}
              onMouseLeave={e => { if (!isToday) e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? "var(--brand)" : "var(--text-secondary)", marginBottom: 4 }}>{day}</div>
              {dayMeetings.slice(0, 3).map(m => (
                <div key={m.id} style={{
                  fontSize: 9, fontWeight: 600, padding: "2px 4px", borderRadius: 4, marginBottom: 2,
                  background: `color-mix(in srgb, ${typeColors[m.meeting_type] || "var(--gray)"} 15%, transparent)`,
                  color: typeColors[m.meeting_type] || "var(--gray)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{m.title}</div>
              ))}
              {dayMeetings.length > 3 && (
                <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 600 }}>+{dayMeetings.length - 3}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
