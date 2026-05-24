"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { X, Upload, Table2, Check } from "lucide-react";
import * as XLSX from "xlsx";

interface Profile { id: string; full_name: string; role: string; }

export default function CreateTableModal({ 
  onClose, 
  onSuccess 
}: { 
  onClose: () => void, 
  onSuccess: () => void 
}) {
  const supabase = createClient();
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [createMode, setCreateMode] = useState<"empty" | "excel">("empty");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    async function loadMembers() {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      if (data) setMembers(data);
    }
    loadMembers();
  }, []);

  function handleImportFile(file: File) {
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      showToast("Please upload an Excel file (.xlsx or .xls)");
      return;
    }
    setExcelFile(file);
    showToast(`File selected: ${file.name}`);
  }

  async function createTable(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreateLoading(true);

    try {
      const { data: table, error } = await supabase.from("lead_tables").insert({
        name: newName.trim(),
        description: newDesc.trim(),
      }).select().single();

      if (error) throw error;

      if (selectedUsers.length > 0) {
        const assigns = selectedUsers.map(uid => ({ table_id: table.id, user_id: uid }));
        await supabase.from("table_assignments").insert(assigns);
      }

      if (createMode === "excel" && excelFile) {
        const data = await excelFile.arrayBuffer();
        const wb = XLSX.read(data);
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws);
        
        const validRows = rows.filter(r => r["full name"] || r["full_name"] || r["Full Name"]);
        const mappedLeads = [];
        const notesToInsert: any[] = [];

        const standardKeys = ["date","Date","what_services_do_you_need?_","services_needed","Services Needed","industry_type_","industry_type","Industry","which_time_do_you_prefer?","preferred_time","Preferred Time","name_of_page_","page_name","Page Name","full name","full_name","Full Name","email","Email","phone_number","Phone","job_title","Job Title","Status","status","Marketing Budget/Month (Optional)","marketing_budget_monthly"];

        for (const r of validRows) {
          const leadId = crypto.randomUUID();
          mappedLeads.push({
            id: leadId, table_id: table.id,
            date: r["date"] || r["Date"] || "",
            services_needed: r["what_services_do_you_need?_"] || r["services_needed"] || r["Services Needed"] || "",
            industry_type: r["industry_type_"] || r["industry_type"] || r["Industry"] || "",
            preferred_time: r["which_time_do_you_prefer?"] || r["preferred_time"] || r["Preferred Time"] || "",
            page_name: r["name_of_page_"] || r["page_name"] || r["Page Name"] || "",
            full_name: r["full name"] || r["full_name"] || r["Full Name"] || "",
            email: r["email"] || r["Email"] || "",
            phone_number: r["phone_number"] || r["Phone"] || "",
            job_title: r["job_title"] || r["Job Title"] || "",
            status: r["Status"] || r["status"] || "Follow Up",
            marketing_budget_monthly: r["Marketing Budget/Month (Optional)"] || r["marketing_budget_monthly"] || null,
          });

          Object.entries(r).forEach(([key, value]) => {
            if (!standardKeys.includes(key) && value) {
               notesToInsert.push({ lead_id: leadId, author_id: "00000000-0000-0000-0000-000000000000", author_name: key, content: String(value), note_type: "reply" });
            }
          });
        }

        if (mappedLeads.length > 0) {
          await supabase.from("leads").insert(mappedLeads);
          if (notesToInsert.length > 0) await supabase.from("lead_notes").insert(notesToInsert);
          alert(`Table created with ${mappedLeads.length} leads imported`);
        } else {
          alert("Table created (no valid leads in Excel)");
        }
      } else {
        alert(`Table "${newName}" created successfully`);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Error: " + (err.message || "Failed to create table"));
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal p-6 animate-pop-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold font-heading text-[var(--text-primary)]">Create Table</h2>
            <button className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-surface)]" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <form onSubmit={createTable} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Table Name *</label>
              <input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. April Leads" required />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Description</label>
              <input className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Optional" />
            </div>

            {/* Data Source Toggle */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Data Source</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setCreateMode("empty")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    createMode === "empty"
                      ? "border-[var(--brand)] bg-[var(--brand-subtle)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]"
                  }`}>
                  <Table2 size={18} className={createMode === "empty" ? "text-[var(--brand)]" : "text-[var(--text-muted)]"} />
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">Empty Table</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Add leads later</span>
                </button>
                <button type="button" onClick={() => setCreateMode("excel")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    createMode === "excel"
                      ? "border-[var(--brand)] bg-[var(--brand-subtle)]"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-default)]"
                  }`}>
                  <Upload size={18} className={createMode === "excel" ? "text-[var(--brand)]" : "text-[var(--text-muted)]"} />
                  <span className="text-[12px] font-semibold text-[var(--text-primary)]">Upload Excel</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Import from file</span>
                </button>
              </div>
            </div>

            {/* Excel Upload Zone */}
            {createMode === "excel" && (
              <div className="border-2 border-dashed border-[var(--border-default)] hover:border-[var(--brand)] rounded-lg p-6 text-center cursor-pointer transition-colors bg-[var(--bg-surface)]"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = "var(--brand)"; }}
                onDragLeave={e => e.currentTarget.style.borderColor = "var(--border-default)"}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleImportFile(f); }}>
                {excelFile ? (
                  <div className="flex items-center justify-center gap-2 text-[var(--brand)] font-semibold text-[13px]">
                    <Check size={16} /> {excelFile.name}
                  </div>
                ) : (
                  <>
                    <Upload size={22} className="mx-auto mb-2 text-[var(--text-muted)]" />
                    <p className="text-[13px] font-medium">Select Excel File</p>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">.xlsx or .xls</p>
                  </>
                )}
                <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); }} />
              </div>
            )}

            {/* Team Members */}
            <div>
              <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Assign Members</label>
              <div className="max-h-[120px] overflow-y-auto border border-[var(--border-subtle)] rounded-lg p-1">
                {members.map(m => (
                  <label key={m.id} className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${selectedUsers.includes(m.id) ? 'bg-[var(--bg-surface)]' : 'hover:bg-[var(--bg-surface)]'}`}>
                    <input type="checkbox" checked={selectedUsers.includes(m.id)}
                      onChange={() => setSelectedUsers(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                      className="accent-[var(--brand)] w-3.5 h-3.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium text-[var(--text-primary)] truncate">{m.full_name}</div>
                      <div className="text-[10px] text-[var(--text-muted)] capitalize">{m.role}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <button type="button" className="btn btn-secondary btn-sm flex-1" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm flex-1" disabled={createLoading}>
                {createLoading ? "Creating..." : "Create Table"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
