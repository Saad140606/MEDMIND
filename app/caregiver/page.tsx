"use client";
import { ArrowLeft, Phone, MessageSquare, AlertTriangle, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function CaregiverDashboard() {
  return (
    <div style={{ padding: "16px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}><ArrowLeft size={24} /></Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700 }}>Caregiver Mode</h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <div style={{ width: 48, height: 48, borderRadius: 24, background: "linear-gradient(135deg, #e0e7ff, #c7d2fe)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: 800, color: "#3730a3" }}>
          SF
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700 }}>Sarah's Status</h2>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Last updated: 5 mins ago</p>
        </div>
        <button style={{ background: "rgba(57,255,158,0.15)", color: "var(--accent-green)", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "11px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
          <ShieldCheck size={14} /> Active
        </button>
      </div>

      {/* Alerts */}
      <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "12px", padding: "16px", display: "flex", gap: "12px", marginBottom: "24px" }}>
        <AlertTriangle size={24} color="var(--accent-red)" style={{ flexShrink: 0 }} />
        <div>
          <h3 style={{ color: "var(--accent-red)", fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>Missed Dose Alert</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.4 }}>Sarah missed her Lisinopril 10mg scheduled for 8:00 AM today.</p>
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button style={{ background: "var(--accent-red)", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "11px", fontWeight: 600 }}>Acknowledge</button>
            <button style={{ background: "transparent", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 12px", fontSize: "11px", fontWeight: 600 }}>Remind Her</button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px" }}>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>TODAY'S ADHERENCE</p>
          <span style={{ fontSize: "32px", fontWeight: 800, color: "var(--accent-amber)" }}>33%</span>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>1 of 3 taken</p>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px" }}>
          <p style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 700, marginBottom: "8px" }}>WEEKLY STREAK</p>
          <span style={{ fontSize: "32px", fontWeight: 800, color: "var(--text-primary)" }}>4</span>
          <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>Days</p>
        </div>
      </div>

      <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text-secondary)" }}>Quick Actions</h3>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <button className="card-surface" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(59,130,246,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#3b82f6" }}>
            <Phone size={20} />
          </div>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Call Sarah</span>
        </button>
        <button className="card-surface" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", border: "1px solid var(--border)", background: "var(--bg-surface)", color: "var(--text-primary)" }}>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: "rgba(16,185,129,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#10b981" }}>
            <MessageSquare size={20} />
          </div>
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Send Message</span>
        </button>
      </div>
    </div>
  );
}
