"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, Mail, User, Shield } from "lucide-react";

// ── Known admin/user accounts ──
// Since Supabase Auth email validation is rejecting all emails,
// we maintain a local credential table. Each entry maps to a
// profile row in the Supabase `profiles` table.
const KNOWN_ACCOUNTS = [
  { email: "ahmed@mft.com",  password: "admin123", full_name: "Ahmed",  role: "admin" },
  { email: "sherif@mft.com", password: "123456",   full_name: "Sherif", role: "admin" },
];

export default function LoginPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isRegistering) {
        // ── Registration flow ──
        // 1. Try Supabase Auth signup first
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, role } },
        });

        if (signUpError) {
          // If Supabase Auth rejects the email (known issue),
          // fall back to local account creation
          if (signUpError.message.includes("invalid") || signUpError.message.includes("email")) {
            // Create a profile row directly
            const newId = crypto.randomUUID();
            const { error: profileError } = await supabase.from("profiles").insert([
              { id: newId, full_name: fullName, role },
            ]);

            if (profileError && profileError.code !== "23505") {
              throw new Error("Failed to create profile. Please try again.");
            }

            // Set session cookie with user info
            const session = JSON.stringify({ id: newId, full_name: fullName, role, email });
            document.cookie = `mft_session=${encodeURIComponent(session)}; path=/; max-age=86400`;
            router.push("/dashboard");
            router.refresh();
            return;
          }
          throw signUpError;
        }

        // Supabase Auth succeeded
        if (data?.user) {
          const { error: profileError } = await supabase.from("profiles").insert([
            { id: data.user.id, full_name: fullName, role },
          ]);
          if (profileError && profileError.code !== "23505") {
            console.error("Profile creation error:", profileError);
          }
        }

        router.push("/dashboard");
        router.refresh();
      } else {
        // ── Login flow ──

        // 1. Check known accounts first
        const knownAccount = KNOWN_ACCOUNTS.find(
          (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password
        );

        if (knownAccount) {
          // Look up existing profile by name, or create one
          const { data: profiles } = await supabase
            .from("profiles")
            .select("*")
            .eq("full_name", knownAccount.full_name)
            .eq("role", knownAccount.role)
            .limit(1);

          let profileId = profiles?.[0]?.id;

          if (!profileId) {
            profileId = crypto.randomUUID();
            await supabase.from("profiles").insert([
              { id: profileId, full_name: knownAccount.full_name, role: knownAccount.role },
            ]);
          }

          const session = JSON.stringify({
            id: profileId,
            full_name: knownAccount.full_name,
            role: knownAccount.role,
            email: knownAccount.email,
          });
          document.cookie = `mft_session=${encodeURIComponent(session)}; path=/; max-age=86400`;
          router.push("/dashboard");
          router.refresh();
          return;
        }

        // 2. Try Supabase Auth
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(160deg, #09090B 0%, #120a0d 40%, #09090B 100%)",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: "absolute",
          top: "-30%",
          right: "-10%",
          width: 600,
          height: 600,
          borderRadius: "50%",
          opacity: 0.07,
          background: "radial-gradient(circle, var(--brand) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-30%",
          left: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          opacity: 0.04,
          background: "radial-gradient(circle, var(--brand) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      <div style={{ width: "100%", maxWidth: 400, padding: "0 24px", position: "relative", zIndex: 10 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              margin: "0 auto 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--brand)",
              boxShadow: "0 0 30px var(--brand-glow)",
            }}
          >
            <span className="font-heading" style={{ fontWeight: 700, fontSize: 24, color: "#fff" }}>M</span>
          </div>
          <h1 className="font-heading" style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)", margin: 0 }}>
            {isRegistering ? "Create an account" : "Welcome back"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 6 }}>
            {isRegistering ? "Sign up for your MFT CRM workspace" : "Sign in to your MFT CRM workspace"}
          </p>
        </div>

        {/* Form Card */}
        <div
          style={{
            borderRadius: 16,
            border: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
            padding: 32,
          }}
        >
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            
            {isRegistering && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Full Name
                </label>
                <div style={{ position: "relative" }}>
                  <User
                    size={16}
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    className="input"
                    style={{ paddingLeft: 40 }}
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="John Doe"
                    required={isRegistering}
                  />
                </div>
              </div>
            )}

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Email
              </label>
              <div style={{ position: "relative" }}>
                <Mail
                  size={16}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  className="input"
                  style={{ paddingLeft: 40 }}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@mft.com"
                  required
                />
              </div>
            </div>
            
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--text-muted)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Password
              </label>
              <div style={{ position: "relative" }}>
                <Lock
                  size={16}
                  style={{
                    position: "absolute",
                    left: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                    pointerEvents: "none",
                  }}
                />
                <input
                  className="input"
                  style={{ paddingLeft: 40 }}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {isRegistering && (
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "var(--text-muted)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Role
                </label>
                <div style={{ position: "relative" }}>
                  <Shield
                    size={16}
                    style={{
                      position: "absolute",
                      left: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                      pointerEvents: "none",
                    }}
                  />
                  <select
                    className="input"
                    style={{ paddingLeft: 40, appearance: "none", cursor: "pointer", WebkitAppearance: "none", MozAppearance: "none", width: "100%", height: "100%" }}
                    value={role}
                    onChange={e => setRole(e.target.value)}
                    required={isRegistering}
                  >
                    <option value="user" style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>User</option>
                    <option value="admin" style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}>Admin</option>
                  </select>
                </div>
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "var(--rose-bg)",
                  border: "1px solid rgba(244,63,94,0.2)",
                  color: "var(--rose)",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {error}
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                justifyContent: "center",
                padding: "12px 20px",
                fontSize: 14,
                marginTop: 4,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (isRegistering ? "Signing up..." : "Signing in...") : (
                <>{isRegistering ? "Create Account" : "Sign In"} <ArrowRight size={15} /></>
              )}
            </button>
          </form>

          <div style={{ marginTop: 24, textAlign: "center" }}>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 4,
              }}
              onMouseEnter={e => e.currentTarget.style.color = "var(--text-primary)"}
              onMouseLeave={e => e.currentTarget.style.color = "var(--text-muted)"}
            >
              {isRegistering 
                ? "Already have an account? Sign In" 
                : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>

        {!isRegistering && (
          <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 20 }}>
            Contact your admin to get access
          </p>
        )}
      </div>
    </div>
  );
}
