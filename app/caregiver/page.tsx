// Caregiver portal dashboard allowing patient connection requests, adherence monitoring, and missed dose alerts.
"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, Phone, MessageSquare, AlertTriangle, ShieldCheck,
  Loader2, UserPlus, Bell, RefreshCw, CheckCircle2, XCircle, Users
} from "lucide-react";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

interface MissedMed {
  id: number;
  name: string;
  time: string;
  scheduledMinutesAgo: number;
}

interface PatientData {
  id: string;
  name: string;
  phone: string | null;
  streak: number;
  streakHistory: boolean[];
  medications: Array<{ id: number; name: string; status: string; time: string }>;
  todayAdherence: { percent: number; taken: number; total: number };
  weekAdherence: { percent: number; taken: number; total: number };
  missed: MissedMed[];
  lastUpdated: string;
}

interface Notification {
  id: string;
  type: string;
  payload: {
    patient_name: string;
    medication_name: string;
    scheduled_time: string;
    date: string;
  };
  created_at: string;
}

export default function CaregiverDashboard() {
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectEmail, setConnectEmail] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [showConnect, setShowConnect] = useState(false);

  const notConfigured = !isSupabaseConfigured;

  const fetchPatients = useCallback(async () => {
    try {
      const res = await fetch("/api/caregiver/patients");
      if (res.status === 503) {
        setError("requiresSupabase");
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch patients");
      const data = await res.json();
      setPatients(data.patients || []);
      setPendingCount(data.pendingCount || 0);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/caregiver/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      
    }
  }, []);

  useEffect(() => {
    if (notConfigured) { setLoading(false); setError("requiresSupabase"); return; }
    fetchPatients();
    fetchNotifications();

    
    // Periodically poll patient and notification endpoints every 30 seconds to maintain real-time telemetry.
    const interval = setInterval(() => {
      fetchPatients();
      fetchNotifications();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPatients, fetchNotifications, notConfigured]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnecting(true);
    setConnectMsg(null);
    try {
      const res = await fetch("/api/connections/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientEmail: connectEmail }),
      });
      const data = await res.json();
      if (res.ok) {
        setConnectMsg({ text: data.message || "Request sent!", ok: true });
        setConnectEmail("");
        fetchPatients();
      } else {
        setConnectMsg({ text: data.error || "Failed to send request", ok: false });
      }
    } catch {
      setConnectMsg({ text: "Network error. Try again.", ok: false });
    } finally {
      setConnecting(false);
    }
  };

  const dismissNotification = async (id: string) => {
    setNotifications(p => p.filter(n => n.id !== id));
    await fetch("/api/caregiver/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationId: id }),
    }).catch(() => null);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 16 }}>
        <Loader2 size={40} className="animate-spin" style={{ color: "var(--accent-green)" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading caregiver portal...</p>
      </div>
    );
  }

  if (error === "requiresSupabase") {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Users size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Caregiver Mode</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          The Caregiver portal requires Supabase. Add{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
          to your <code>.env.local</code> to enable multi-user features.
        </p>
        <Link href="/" className="btn-green" style={{ display: "inline-block", maxWidth: 200, textDecoration: "none", textAlign: "center", padding: "12px 24px" }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}><ArrowLeft size={24} /></Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700 }}>Caregiver Mode</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {notifications.length > 0 && (
            <div style={{ position: "relative" }}>
              <Bell size={20} color="var(--accent-red)" />
              <span style={{ position: "absolute", top: -4, right: -4, width: 14, height: 14, background: "var(--accent-red)", borderRadius: "50%", fontSize: 9, fontWeight: 700, color: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {notifications.length}
              </span>
            </div>
          )}
          <button
            onClick={() => { fetchPatients(); fetchNotifications(); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {}
      {notifications.map(notif => (
        <div key={notif.id} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 16, display: "flex", gap: 12, marginBottom: 16 }}>
          <AlertTriangle size={24} color="var(--accent-red)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <h3 style={{ color: "var(--accent-red)", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Missed Dose Alert</h3>
            <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.4 }}>
              {notif.payload?.patient_name} missed {notif.payload?.medication_name} scheduled for {notif.payload?.scheduled_time}.
            </p>
            <button
              onClick={() => dismissNotification(notif.id)}
              style={{ marginTop: 10, background: "var(--accent-red)", color: "white", border: "none", borderRadius: 6, padding: "5px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
            >
              Acknowledge
            </button>
          </div>
        </div>
      ))}

      {}
      <button
        onClick={() => setShowConnect(p => !p)}
        style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(57,255,158,0.08)", border: "1px solid var(--border-green)", borderRadius: 12, padding: "10px 14px", marginBottom: 16, cursor: "pointer", color: "var(--accent-green)", fontWeight: 700, fontSize: 13, width: "100%" }}
      >
        <UserPlus size={16} /> Connect a Patient {pendingCount > 0 && <span style={{ marginLeft: "auto", background: "var(--accent-amber)", color: "#0d1a10", borderRadius: 12, padding: "1px 8px", fontSize: 11 }}>{pendingCount} pending</span>}
      </button>

      {showConnect && (
        <form onSubmit={handleConnect} style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            type="email"
            value={connectEmail}
            onChange={e => setConnectEmail(e.target.value)}
            placeholder="Patient's email address..."
            required
            style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", color: "var(--text-primary)", fontSize: 14, outline: "none" }}
          />
          <button
            type="submit"
            disabled={connecting}
            className="btn-green"
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px" }}
          >
            {connecting && <Loader2 size={14} className="animate-spin" />}
            Send Connection Request
          </button>
          {connectMsg && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: connectMsg.ok ? "var(--accent-green)" : "var(--accent-red)" }}>
              {connectMsg.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {connectMsg.text}
            </div>
          )}
        </form>
      )}

      {}
      {patients.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 16, padding: "40px 20px" }}>
          <Users size={56} color="var(--text-muted)" />
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>No Patients Connected</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
            Connect a patient by entering their email above. They'll receive a request to approve.
          </p>
        </div>
      )}

      {/* Patient cards */}
      {patients.map(patient => {
        const allMissed = patient.missed;
        const adherencePct = patient.todayAdherence.percent;
        const adherenceColor = adherencePct >= 80 ? "var(--accent-green)" : adherencePct >= 50 ? "var(--accent-amber)" : "var(--accent-red)";

        return (
          <div key={patient.id} style={{ marginBottom: 24 }}>
            {/* Patient header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 24, background: "linear-gradient(135deg,#e0e7ff,#c7d2fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#3730a3", flexShrink: 0 }}>
                {patient.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>{patient.name}&apos;s Status</h2>
                <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Last updated: just now
                </p>
              </div>
              <div style={{ background: "rgba(57,255,158,0.15)", color: "var(--accent-green)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <ShieldCheck size={14} /> Active
              </div>
            </div>

            {/* Missed dose alerts from live data */}
            {allMissed.length > 0 && allMissed.map(missed => (
              <div key={missed.id} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: 16, display: "flex", gap: 12, marginBottom: 16 }}>
                <AlertTriangle size={22} color="var(--accent-red)" style={{ flexShrink: 0 }} />
                <div>
                  <h3 style={{ color: "var(--accent-red)", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Missed Dose</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.4 }}>
                    {patient.name} missed <strong>{missed.name}</strong> scheduled for {missed.time} ({missed.scheduledMinutesAgo} min ago).
                  </p>
                </div>
              </div>
            ))}

            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px" }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 8 }}>TODAY'S ADHERENCE</p>
                <span style={{ fontSize: 32, fontWeight: 800, color: adherenceColor }}>{adherencePct}%</span>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
                  {patient.todayAdherence.taken} of {patient.todayAdherence.total} taken
                </p>
              </div>
              <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px" }}>
                <p style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, marginBottom: 8 }}>WEEKLY STREAK</p>
                <span style={{ fontSize: 32, fontWeight: 800, color: "var(--text-primary)" }}>{patient.streak}</span>
                <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>Days</p>
              </div>
            </div>

            {}
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: "var(--text-secondary)" }}>Today&apos;s Medications</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {patient.medications.map(med => {
                const statusColor = med.status === "taken" ? "var(--accent-green)" : med.status === "due" ? "var(--accent-amber)" : "var(--text-muted)";
                return (
                  <div key={med.id} className="card-surface" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontWeight: 600, fontSize: 14 }}>{med.name}</p>
                      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{med.time}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: statusColor, textTransform: "uppercase" }}>
                      {med.status === "taken" ? "✓ Taken" : med.status === "due" ? "⚡ Due" : "Upcoming"}
                    </span>
                  </div>
                );
              })}
            </div>

            {}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
              {/* Renders direct telephone call integration if patient has a phone number registered */}
              {patient.phone ? (
                <a
                  href={`tel:${patient.phone}`}
                  className="card-surface"
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: "1px solid var(--border)", textDecoration: "none", color: "var(--text-primary)" }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
                    <Phone size={20} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Call {patient.name.split(" ")[0]}</span>
                </a>
              ) : (
                <div className="card-surface" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: "1px solid var(--border)", opacity: 0.5 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
                    <Phone size={20} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>No phone on file</span>
                </div>
              )}
              {/* Sanitizes non-numeric digits from telephone number to build WhatsApp web-chat link */}
              {patient.phone ? (
                <a
                  href={`https://wa.me/${patient.phone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-surface"
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: "1px solid var(--border)", textDecoration: "none", color: "var(--text-primary)" }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                    <MessageSquare size={20} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>WhatsApp</span>
                </a>
              ) : (
                <div className="card-surface" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, border: "1px solid var(--border)", opacity: 0.5 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
                    <MessageSquare size={20} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>No phone on file</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

