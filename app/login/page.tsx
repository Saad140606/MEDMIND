// Authentication screen handling patient, caregiver, and doctor credentials, registrations, and environment configuration alerts.
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff, Sparkles, AlertCircle } from "lucide-react";
import { signIn, signUp } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

type Role = "PATIENT" | "CAREGIVER" | "DOCTOR";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("PATIENT");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  
  const notConfigured = !isSupabaseConfigured;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      if (mode === "login") {
        // Authenticate credentials against database, returning browser session cookies.
        await signIn(email, password);
        const redirectTo = new URLSearchParams(window.location.search).get("redirectTo") || "/";
        router.replace(redirectTo);
        router.refresh();
      } else {
        if (!name.trim()) throw new Error("Name is required");
        // Create auth registration and trigger automated seeding for the chosen profile role.
        await signUp(email, password, name.trim(), role, phone.trim() || undefined);
        setSuccess("Account created! Check your email to confirm, then log in.");
        setMode("login");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const roleOptions: { value: Role; label: string; emoji: string; desc: string }[] = [
    { value: "PATIENT", label: "Patient", emoji: "🏥", desc: "Track my own medications" },
    { value: "CAREGIVER", label: "Caregiver", emoji: "❤️", desc: "Monitor a loved one's meds" },
    { value: "DOCTOR", label: "Doctor", emoji: "👨‍⚕️", desc: "View patient adherence reports" },
  ];

  return (
    <div className="login-page-container" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", padding: "24px 20px", position: "relative", overflow: "hidden" }}>
      {}
      <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 300, height: 300, background: "radial-gradient(circle, rgba(57,255,158,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />

      {}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "40px", marginTop: "20px" }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#39ff9e,#1aae6a)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sparkles size={20} color="#0d1a10" />
        </div>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800 }}>MedMind</h1>
          <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>Smart Medication Tracker</p>
        </div>
      </div>

      {notConfigured && (
        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 24 }}>
          <AlertCircle size={18} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontSize: 13, color: "var(--accent-amber)", lineHeight: 1.5 }}>
            Supabase is not configured. Auth features require <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your <code>.env.local</code>. The app runs in local-fallback mode without login.
          </p>
        </div>
      )}

      {}
      <div style={{ display: "flex", background: "var(--bg-surface)", borderRadius: 12, padding: 4, marginBottom: 28 }}>
        {(["login", "signup"] as const).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null); setSuccess(null); }}
            style={{
              flex: 1, padding: "10px", borderRadius: 9, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, transition: "all 0.2s",
              background: mode === m ? "var(--accent-green)" : "transparent",
              color: mode === m ? "#0d1a10" : "var(--text-muted)",
            }}
          >
            {m === "login" ? "Log In" : "Sign Up"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        {mode === "signup" && (
          <>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>FULL NAME</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ahmed Hassan"
                required
                style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", color: "var(--text-primary)", fontSize: 15, outline: "none" }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>PHONE NUMBER (OPTIONAL)</label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 555-0199"
                style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", color: "var(--text-primary)", fontSize: 15, outline: "none" }}
              />
            </div>
          </>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", color: "var(--text-primary)", fontSize: 15, outline: "none" }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>PASSWORD</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              style={{ width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 48px 14px 16px", color: "var(--text-primary)", fontSize: 15, outline: "none" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(p => !p)}
              style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0 }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>I AM A</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {roleOptions.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: `1px solid ${role === opt.value ? "var(--accent-green)" : "var(--border)"}`,
                    background: role === opt.value ? "rgba(57,255,158,0.08)" : "var(--bg-surface)",
                    cursor: "pointer", textAlign: "left", transition: "all 0.2s",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{opt.emoji}</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: role === opt.value ? "var(--accent-green)" : "var(--text-primary)" }}>{opt.label}</p>
                    <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{opt.desc}</p>
                  </div>
                  <div style={{ marginLeft: "auto", width: 18, height: 18, borderRadius: "50%", border: `2px solid ${role === opt.value ? "var(--accent-green)" : "var(--border)"}`, background: role === opt.value ? "var(--accent-green)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {role === opt.value && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0d1a10" }} />}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 14px", display: "flex", gap: 8, alignItems: "flex-start" }}>
            <AlertCircle size={16} color="var(--accent-red)" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 13, color: "var(--accent-red)" }}>{error}</p>
          </div>
        )}

        {success && (
          <div style={{ background: "rgba(57,255,158,0.1)", border: "1px solid var(--border-green)", borderRadius: 10, padding: "12px 14px" }}>
            <p style={{ fontSize: 13, color: "var(--accent-green)" }}>{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || notConfigured}
          className="btn-green"
          style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          {loading && <Loader2 size={18} className="animate-spin" />}
          {mode === "login" ? "Log In" : "Create Account"}
        </button>
      </form>

      <p style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 24, paddingBottom: 20 }}>
        {mode === "login" ? "Don't have an account? " : "Already have an account? "}
        <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }} style={{ background: "none", border: "none", color: "var(--accent-green)", fontWeight: 700, cursor: "pointer", fontSize: 12 }}>
          {mode === "login" ? "Sign up" : "Log in"}
        </button>
      </p>
    </div>
  );
}
