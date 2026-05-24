"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import { LayoutDashboard, Users, Upload, Download, LogOut, Menu, X, ChevronDown, CalendarDays } from "lucide-react";
import Link from "next/link";

interface Profile { id: string; full_name: string; role: string; }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      const isDemo = document.cookie.includes('demo_bypass=true');
      
      if (!user && !isDemo) { router.push("/"); return; }
      
      if (isDemo && !user) {
        setProfile({ id: '00000000-0000-0000-0000-000000000000', full_name: 'Ahmed', role: 'admin' });
        return;
      }
      
      if (user) {
        const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (data) setProfile(data);
      }
    }
    load();
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    document.cookie = "demo_bypass=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/");
    router.refresh();
  }

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
    { icon: CalendarDays, label: "Meetings", href: "/dashboard/meetings" },
    { icon: Users, label: "Team", href: "/dashboard/team" },
  ];

  const actionItems = [
    { icon: Upload, label: "Import", event: "openImport" },
    { icon: Download, label: "Export", event: "exportExcel" },
  ];

  const sidebarW = sidebarOpen ? 260 : 72;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 40,
          }}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          height: "100vh",
          width: sidebarW,
          background: "var(--bg-card)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          transition: "width 0.3s var(--ease), transform 0.3s var(--ease)",
          overflow: "hidden",
        }}
      >
        {/* Logo */}
        <div
          style={{
            height: 56,
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            flexShrink: 0,
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              background: "var(--brand)",
              boxShadow: "0 0 12px var(--brand-glow)",
            }}
          >
            <span className="font-heading" style={{ fontWeight: 700, color: "#fff", fontSize: 16 }}>M</span>
          </div>
          {sidebarOpen && (
            <div className="font-heading" style={{ fontWeight: 700, fontSize: 15, color: "var(--text-primary)", letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
              MFT CRM
            </div>
          )}
          <button
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
            style={{
              marginLeft: "auto",
              padding: 4,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "24px 12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {sidebarOpen && (
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
                padding: "0 12px",
              }}
            >
              Menu
            </div>
          )}
          {navItems.map(item => {
            const isActive = item.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: sidebarOpen ? "10px 12px" : "10px",
                  borderRadius: 8,
                  transition: "all 0.18s ease",
                  position: "relative",
                  textDecoration: "none",
                  justifyContent: sidebarOpen ? "flex-start" : "center",
                  background: isActive ? "var(--brand-subtle)" : "transparent",
                  color: isActive ? "#fff" : "var(--text-secondary)",
                  fontWeight: isActive ? 600 : 400,
                }}
                title={!sidebarOpen ? item.label : undefined}
                onMouseEnter={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = "var(--bg-surface)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 3,
                      height: 20,
                      background: "var(--brand)",
                      borderRadius: "0 4px 4px 0",
                    }}
                  />
                )}
                <item.icon size={18} style={{ flexShrink: 0, color: isActive ? "var(--brand)" : "currentColor" }} />
                {sidebarOpen && (
                  <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}

          <div style={{ height: 16 }} />

          {pathname.startsWith('/dashboard/tables/') && (
            <>
              {sidebarOpen && (
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                    padding: "0 12px",
                  }}
                >
                  Quick Actions
                </div>
              )}
              {actionItems.map(item => (
                <button
                  key={item.event}
                  onClick={() => document.dispatchEvent(new CustomEvent(item.event))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: sidebarOpen ? "10px 12px" : "10px",
                    borderRadius: 8,
                    color: "var(--text-secondary)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    justifyContent: sidebarOpen ? "flex-start" : "center",
                    width: "100%",
                    textAlign: "left",
                    fontFamily: "'Inter', sans-serif",
                  }}
                  title={item.label}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "var(--bg-surface)";
                    e.currentTarget.style.color = "var(--text-primary)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--text-secondary)";
                  }}
                >
                  <item.icon size={18} style={{ flexShrink: 0 }} />
                  {sidebarOpen && <span style={{ fontSize: 13, whiteSpace: "nowrap" }}>{item.label}</span>}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Profile */}
        <div
          style={{
            padding: 12,
            flexShrink: 0,
            position: "relative",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: 10,
              borderRadius: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "all 0.18s ease",
              justifyContent: sidebarOpen ? "flex-start" : "center",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "var(--bg-surface)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                background: "var(--brand)",
              }}
            >
              {profile?.full_name?.[0]?.toUpperCase() || "U"}
            </div>
            {sidebarOpen && (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "left" }}>
                    {profile?.full_name || "User"}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 500, textTransform: "capitalize" }}>
                    {profile?.role || "Member"}
                  </span>
                </div>
                <ChevronDown size={14} style={{ marginLeft: "auto", color: "var(--text-muted)", flexShrink: 0 }} />
              </>
            )}
          </button>

          {dropdownOpen && (
            <div
              className="animate-pop-in"
              style={{
                position: "absolute",
                bottom: "100%",
                left: 12,
                right: 12,
                marginBottom: 8,
                padding: 4,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                boxShadow: "var(--shadow-lg)",
              }}
            >
              <button
                onClick={handleLogout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "8px 12px",
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--rose)",
                  background: "none",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  fontFamily: "'Inter', sans-serif",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--rose-bg)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
              >
                <LogOut size={15} /> Sign Out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          height: "100vh",
          overflow: "hidden",
          marginLeft: sidebarW,
          transition: "margin-left 0.3s var(--ease)",
        }}
      >
        {/* Top Bar */}
        <header
          style={{
            height: 56,
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-base)",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              padding: 8,
              borderRadius: 6,
              color: "var(--text-muted)",
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "var(--bg-surface)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <Menu size={18} />
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            {profile?.full_name || "User"}
          </span>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              background: "var(--brand)",
            }}
          >
            {profile?.full_name?.[0]?.toUpperCase() || "U"}
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
