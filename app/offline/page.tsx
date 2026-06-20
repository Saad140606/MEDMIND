"use client";
import { ArrowLeft, WifiOff, RefreshCw, Server, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function OfflineMode() {
  return (
    <div style={{ padding: "16px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}><ArrowLeft size={24} /></Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700 }}>Offline Status</h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "12px", padding: "16px", display: "flex", gap: "12px", marginBottom: "24px" }}>
        <WifiOff size={24} color="var(--accent-amber)" />
        <div>
          <h3 style={{ color: "var(--accent-amber)", fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>You are currently offline</h3>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.4 }}>MedMind is running in offline mode. Your logs are saved locally and will sync when connection is restored.</p>
        </div>
      </div>

      <h2 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text-secondary)" }}>Pending Sync Queue (3)</h2>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "32px" }}>
        {[
          { text: "Logged Metformin 500mg", time: "2:05 PM" },
          { text: "Updated Profile Settings", time: "1:45 PM" },
          { text: "Logged Hydration (0.5L)", time: "1:30 PM" }
        ].map((item, i) => (
          <div key={i} className="card-surface" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent-amber)" }} />
              <span style={{ fontSize: "13px", fontWeight: 500 }}>{item.text}</span>
            </div>
            <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{item.time}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Server size={18} color="var(--text-muted)" />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Local Storage Usage</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>1.2 MB / 50 MB</span>
        </div>
        <div style={{ height: "4px", background: "var(--bg-surface2)", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ width: "2%", height: "100%", background: "var(--accent-green)", borderRadius: "4px" }} />
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "4px", alignItems: "center" }}>
          <AlertCircle size={12} /> Plenty of space available for offline logs.
        </p>
      </div>

      <button style={{ marginTop: "auto", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px", color: "var(--text-primary)", fontWeight: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: "8px" }}>
        <RefreshCw size={18} /> Force Sync Attempt
      </button>
    </div>
  );
}
