"use client";
import { useState, useEffect } from "react";
import { Bell, ChevronRight, Lock, Droplets, RefreshCw, Flame, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Medication {
  id: number;
  name: string;
  icon: string;
  color: string;
  time: string;
  status: 'taken' | 'due' | 'upcoming';
  iconBg: string;
  requiresLock: boolean;
}

interface DashboardData {
  user: {
    name: string;
    streak: number;
    streakHistory: boolean[];
  };
  medications: Medication[];
  hydration: {
    current: number;
    goal: number;
  };
  refills: {
    pending: number;
  };
  adherence: {
    percent: number;
    taken: number;
    total: number;
  };
}

function AdherenceRing({ percent }: { percent: number }) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} strokeWidth="7" fill="none" className="progress-ring-bg" />
      <circle cx="48" cy="48" r={r} strokeWidth="7" fill="none" className="progress-ring-fill"
        strokeDasharray={circ} strokeDashoffset={offset} transform="rotate(-90 48 48)" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
      <text x="48" y="45" textAnchor="middle" fill="var(--accent-green)" fontSize="18" fontWeight="800">{percent}%</text>
      <text x="48" y="59" textAnchor="middle" fill="var(--text-muted)" fontSize="9">TAKEN</text>
    </svg>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const router = useRouter();

  const fetchDashboardData = async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard metrics');
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleLogDose = async (med: Medication) => {
    if (med.requiresLock) {
      // Redirect to puzzle-lock screen with medId query param
      router.push(`/puzzle-lock?medId=${med.id}`);
      return;
    }

    try {
      const res = await fetch('/api/dashboard/log-dose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationId: med.id }),
      });
      if (!res.ok) throw new Error('Could not log dose');
      const updated = await res.json();
      setData(updated);
    } catch (err: any) {
      alert(err.message || 'Log failed');
    }
  };

  const handleHydrationAdd = async () => {
    if (!data) return;
    
    // Optimistic update
    const previousData = data;
    setData(prev => {
      if (!prev) return null;
      const nextCurrent = Math.min(prev.hydration.goal, parseFloat((prev.hydration.current + 0.25).toFixed(2)));
      return {
        ...prev,
        hydration: { ...prev.hydration, current: nextCurrent }
      };
    });

    try {
      const res = await fetch('/api/dashboard/hydration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 0.25 }),
      });
      if (!res.ok) throw new Error('Failed to update water');
      const updated = await res.json();
      setData(updated);
    } catch (err) {
      // Revert if API fails
      setData(previousData);
    }
  };

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      const res = await fetch('/api/dashboard/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reset');
      const resetData = await res.json();
      setData(resetData);
    } catch (err: any) {
      alert(err.message || 'Reset failed');
    } finally {
      setIsResetting(false);
    }
  };

  // Get current weekday date string
  const getTodayDateString = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date();
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifySelf: "center", alignSelf: "center", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: "16px" }}>
        <Loader2 size={40} className="animate-spin" style={{ color: "var(--accent-green)" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 600 }}>Loading health status...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: "40px 20px", textAlign: "center" }}>
        <p style={{ color: "var(--accent-red)", marginBottom: "16px" }}>Error: {error || 'No data found'}</p>
        <button onClick={fetchDashboardData} className="btn-green" style={{ display: "inline-flex", gap: "8px", alignItems: "center" }}>
          <RefreshCw size={14} /> Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ padding: "20px 20px 16px", background: "linear-gradient(180deg,#13162a 0%,transparent 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "2px" }}>Good morning,</p>
            <h1 style={{ fontSize: "24px", fontWeight: 800 }}>{data.user.name} 👋</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>{getTodayDateString()}</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "4px" }}>
            <button 
              onClick={handleResetDemo}
              disabled={isResetting}
              style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              title="Reset Demo Data"
            >
              <RefreshCw size={18} color="var(--text-secondary)" className={isResetting ? "animate-spin" : ""} />
            </button>
            <button style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "8px", cursor: "pointer", position: "relative" }}>
              <Bell size={18} color="var(--text-secondary)" />
              <span style={{ position: "absolute", top: "6px", right: "6px", width: "7px", height: "7px", background: "var(--accent-green)", borderRadius: "50%", border: "1.5px solid var(--bg-card)" }} />
            </button>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "linear-gradient(135deg,#39ff9e,#1aae6a)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "13px", color: "#0d1a10" }}>
              {data.user.name.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {/* Adherence */}
        <div className="card" style={{ background: "linear-gradient(135deg,#161929 0%,#1a2038 100%)", border: "1px solid var(--border-green)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: "radial-gradient(circle,rgba(57,255,158,0.08) 0%,transparent 70%)", borderRadius: "50%" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "10px" }}>TODAY'S ADHERENCE</p>
          <AdherenceRing percent={data.adherence.percent} />
          <p style={{ color: "var(--text-secondary)", fontSize: "11px", marginTop: "6px" }}>{data.adherence.taken} of {data.adherence.total} taken</p>
          <div style={{ marginTop: "8px", height: "4px", background: "var(--bg-surface2)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ width: `${data.adherence.percent}%`, height: "100%", background: "var(--accent-green)", borderRadius: "4px", boxShadow: "0 0 8px var(--accent-green)", transition: "width 0.8s ease" }} />
          </div>
        </div>

        {/* Weekly Streak */}
        <div className="card" style={{ background: "linear-gradient(135deg,#161929 0%,#1e1a2a 100%)", display: "flex", flexDirection: "column" }}>
          <p style={{ color: "var(--text-muted)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.1em" }}>WEEKLY STREAK</p>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "12px 0 4px" }}>
            <span style={{ fontSize: "44px", fontWeight: 900, lineHeight: 1 }}>{data.user.streak}</span>
            <Flame size={28} style={{ color: "#f97316", filter: "drop-shadow(0 0 8px #f97316)" }} />
          </div>
          <p style={{ color: "var(--text-muted)", fontSize: "11px", flex: 1 }}>Personal record 🏆</p>
          <div style={{ display: "flex", gap: "4px", marginTop: "auto", paddingTop: "10px" }}>
            {data.user.streakHistory.map((taken, d) => (
              <div key={d} style={{ flex: 1, height: "5px", borderRadius: "3px", background: taken ? "var(--accent-green)" : "var(--bg-surface2)", boxShadow: taken ? "0 0 4px var(--accent-green)" : "none" }} />
            ))}
          </div>
        </div>
      </div>

      {/* Today's Schedule */}
      <div style={{ padding: "20px 16px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Today's Schedule</h2>
          <button style={{ color: "var(--accent-green)", fontSize: "12px", fontWeight: 700, background: "none", border: "none", cursor: "pointer" }}>EDIT PLAN</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {data.medications.map((med) => {
            const status = med.status;
            return (
              <div key={med.id} className="card-surface" style={{ display: "flex", alignItems: "center", gap: "12px", opacity: status === "upcoming" ? 0.65 : 1, border: status === "due" ? "1px solid rgba(245,158,11,0.35)" : "1px solid var(--border)" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: med.iconBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0, border: `1px solid ${med.color}33` }}>
                  {med.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>{med.name}</p>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>{med.time}</p>
                    {status === "taken" && <span className="badge-taken">✓ TAKEN</span>}
                    {status === "due" && <span className="badge-due">⚡ DUE SOON</span>}
                    {status === "upcoming" && <span className="badge-upcoming">UPCOMING</span>}
                  </div>
                </div>
                {status === "due" ? (
                  <button onClick={() => handleLogDose(med)} style={{ background: "var(--accent-green)", color: "#0d1a10", fontWeight: 700, fontSize: "11px", padding: "8px 12px", borderRadius: "10px", border: "none", cursor: "pointer", boxShadow: "0 0 14px var(--accent-green-glow)", flexShrink: 0, whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "4px" }}>
                    {med.requiresLock && <Lock size={10} />} LOG DOSE
                  </button>
                ) : status === "upcoming" ? (
                  <Lock size={16} color="var(--text-muted)" />
                ) : (
                  <ChevronRight size={16} color="var(--text-muted)" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Tiles */}
      <div style={{ padding: "16px 16px 8px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div className="card" style={{ background: "linear-gradient(135deg,#0a1520,#0f2035)", border: "1px solid rgba(59,130,246,0.3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Droplets size={18} color="#3b82f6" />
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#3b82f6" }}>Hydration</span>
            </div>
            <button 
              onClick={handleHydrationAdd}
              disabled={data.hydration.current >= data.hydration.goal}
              style={{ background: "rgba(59,130,246,0.15)", border: "none", borderRadius: "6px", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6", fontWeight: "bold", fontSize: "14px", cursor: "pointer" }}
              title="Add 250ml"
            >
              +
            </button>
          </div>
          <p style={{ fontSize: "22px", fontWeight: 800 }}>{data.hydration.current}L</p>
          <p style={{ color: "var(--text-muted)", fontSize: "11px", marginBottom: "10px" }}>/ {data.hydration.goal}L goal</p>
          <div style={{ height: "4px", background: "var(--bg-surface2)", borderRadius: "4px", overflow: "hidden" }}>
            <div style={{ width: `${Math.round((data.hydration.current / data.hydration.goal) * 100)}%`, height: "100%", background: "#3b82f6", borderRadius: "4px", transition: "width 0.4s ease" }} />
          </div>
        </div>

        <div className="card" style={{ background: "linear-gradient(135deg,#1a0f0f,#2a1515)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <RefreshCw size={18} color="#ef4444" />
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#ef4444" }}>Refills</span>
          </div>
          <p style={{ fontSize: "22px", fontWeight: 800 }}>{data.refills.pending}</p>
          <p style={{ color: "#ef4444", fontSize: "11px", fontWeight: 700, marginBottom: "10px" }}>Pending</p>
          <button style={{ background: "rgba(239,68,68,0.13)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "8px", padding: "6px 10px", color: "#ef4444", fontSize: "11px", fontWeight: 700, cursor: "pointer", width: "100%" }}>
            Order Now
          </button>
        </div>
      </div>
    </div>
  );
}

