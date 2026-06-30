// Patient dashboard rendering adherence rings, weekly streaks, medication schedules, hydration levels, and caregiver link requests.
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  Bell, ChevronRight, Lock, Droplets, RefreshCw, Flame, Loader2,
  LogOut, Check, X, ShieldAlert, ArrowRight, UserCheck
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signOut } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

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
    id?: string;
    name: string;
    role?: 'PATIENT' | 'CAREGIVER' | 'DOCTOR';
    phone?: string;
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

interface ConnectionRequest {
  id: string;
  caregiver_id?: string;
  doctor_id?: string;
  status: 'PENDING' | 'ACTIVE' | 'REVOKED';
  caregiver?: { id: string; name: string; role: string };
  doctor?: { id: string; name: string; role: string };
}

function AdherenceRing({ percent }: { percent: number }) {
  const r = 38;
  // Calculate circumference of the circular progress indicator track.
  const circ = 2 * Math.PI * r;
  // Determine SVG stroke-dashoffset length needed to fill the circle relative to taken medications percent.
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 96 96">
      <circle cx="48" cy="48" r={r} strokeWidth="7" fill="none" className="progress-ring-bg" />
      {/* Rotated -90 degrees so progress filling animation begins from the 12 o'clock top mark. */}
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
  const [caregiverLinks, setCaregiverLinks] = useState<ConnectionRequest[]>([]);
  const [doctorLinks, setDoctorLinks] = useState<ConnectionRequest[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const router = useRouter();

  const fetchConnections = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    try {
      const res = await fetch('/api/connections');
      if (res.ok) {
        const json = await res.json();
        setCaregiverLinks(json.caregiverLinks || []);
        setDoctorLinks(json.doctorLinks || []);
      }
    } catch (err) {
      console.error('Failed to fetch connections', err);
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error('Failed to load dashboard metrics');
      const json = await res.json();
      setData(json);
      setError(null);
      if (json.user?.role === 'PATIENT') {
        fetchConnections();
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [fetchConnections]);

  useEffect(() => {
    // Load the dashboard data once the page mounts.
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleLogDose = async (med: Medication) => {
    // Redirect to puzzle-lock screen with medId query param
    if (med.requiresLock) {
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
    
    // Cache current state for rollback should the remote API update encounter errors.
    const previousData = data;
    // Optimistic UI update: instantly update the hydration stats in local state to give the user immediate feedback.
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
    } catch {
      // Revert state change if the network or API request fails.
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

  const handleConnectionResponse = async (id: string, type: 'CAREGIVER' | 'DOCTOR', action: 'APPROVE' | 'REVOKE') => {
    setRespondingId(id);
    try {
      const res = await fetch('/api/connections/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: id, connectionType: type, action }),
      });
      if (!res.ok) throw new Error('Action failed');
      await fetchConnections();
    } catch (err: any) {
      alert(err.message || 'Failed to update connection');
    } finally {
      setRespondingId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
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

  
  const isCaregiver = data.user?.role === 'CAREGIVER';
  const isDoctor = data.user?.role === 'DOCTOR';

  if (isCaregiver || isDoctor) {
    return (
      <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80dvh", gap: "24px", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 20, background: "rgba(57,255,158,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-green)" }}>
          <UserCheck size={36} />
        </div>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 800 }}>Welcome, {data.user.name}</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "8px", lineHeight: 1.5 }}>
            You are logged in as a <strong>{data.user.role}</strong>. Please use your specialized workspace portal to monitor patient progress.
          </p>
        </div>
        
        <Link 
          href={isCaregiver ? "/caregiver" : "/doctor-report"}
          style={{ width: "100%", textDecoration: "none" }}
        >
          <button className="btn-green" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            Go to {isCaregiver ? "Caregiver Portal" : "Doctor Report Workspace"} <ArrowRight size={18} />
          </button>
        </Link>

        <button 
          onClick={handleSignOut}
          style={{ background: "none", border: "1px solid var(--border)", borderRadius: "12px", padding: "12px 24px", color: "var(--text-secondary)", fontWeight: 700, cursor: "pointer", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    );
  }

  const pendingCaregivers = caregiverLinks.filter(l => l.status === 'PENDING');
  const pendingDoctors = doctorLinks.filter(l => l.status === 'PENDING');
  const hasPendingRequests = pendingCaregivers.length > 0 || pendingDoctors.length > 0;

  return (
    <div>
      {}
      <div style={{ padding: "20px 20px 16px", background: "linear-gradient(180deg,#13162a 0%,transparent 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "2px" }}>Good morning,</p>
            <h1 style={{ fontSize: "24px", fontWeight: 800 }}>{data.user.name} 👋</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "12px", marginTop: "2px" }}>{getTodayDateString()}</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "4px" }}>
            {isSupabaseConfigured && (
              <button 
                onClick={handleSignOut}
                style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                title="Sign Out"
              >
                <LogOut size={18} color="var(--text-secondary)" />
              </button>
            )}
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
          </div>
        </div>
      </div>

      {}
      {hasPendingRequests && (
        <div style={{ padding: "0 16px 16px" }}>
          <div className="card" style={{ background: "linear-gradient(135deg, #1b162a 0%, #1e1525 100%)", border: "1px solid rgba(245,158,11,0.25)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <ShieldAlert size={18} color="var(--accent-amber)" />
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-amber)" }}>Connection Consent Requests</span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {pendingCaregivers.map(req => (
                <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px" }}>
                    <p style={{ fontWeight: 600 }}>Caregiver Request</p>
                    <p style={{ color: "var(--text-muted)" }}>{req.caregiver?.name || "Caregiver"}</p>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button 
                      onClick={() => handleConnectionResponse(req.id, 'CAREGIVER', 'APPROVE')}
                      disabled={respondingId === req.id}
                      style={{ background: "var(--accent-green)", border: "none", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#0d1a10" }}
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => handleConnectionResponse(req.id, 'CAREGIVER', 'REVOKE')}
                      disabled={respondingId === req.id}
                      style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--accent-red)" }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}

              {pendingDoctors.map(req => (
                <div key={req.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.03)", padding: "10px", borderRadius: "8px" }}>
                  <div style={{ fontSize: "12px" }}>
                    <p style={{ fontWeight: 600 }}>Doctor Request</p>
                    <p style={{ color: "var(--text-muted)" }}>{req.doctor?.name || "Doctor"}</p>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button 
                      onClick={() => handleConnectionResponse(req.id, 'DOCTOR', 'APPROVE')}
                      disabled={respondingId === req.id}
                      style={{ background: "var(--accent-green)", border: "none", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#0d1a10" }}
                    >
                      <Check size={14} />
                    </button>
                    <button 
                      onClick={() => handleConnectionResponse(req.id, 'DOCTOR', 'REVOKE')}
                      disabled={respondingId === req.id}
                      style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "6px", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--accent-red)" }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {}
      <div style={{ padding: "0 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        {}
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
