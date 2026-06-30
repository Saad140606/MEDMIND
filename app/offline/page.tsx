// Status page displaying current browser network connectivity, pending sync queues, and IndexedDB storage usage stats.
"use client";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, WifiOff, RefreshCw, Server, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { getQueuedActions } from "@/lib/offlineQueue";
import type { QueuedAction } from "@/lib/offlineQueue";
import { replayQueue } from "@/components/SyncManager";

export default function OfflineMode() {
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [storageEstimate, setStorageEstimate] = useState<{ used: number; quota: number } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ replayed: number; failed: number } | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const q = await getQueuedActions();
      setQueue(q);
    } catch {
      
    }
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    loadQueue();

    // Query sandboxed browser storage telemetry to extract the total capacity vs usage bounds.
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(est => {
        setStorageEstimate({ used: est.usage || 0, quota: est.quota || 0 });
      }).catch(() => null);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadQueue]);

  const handleForcSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const result = await replayQueue();
      setSyncResult(result);
      await loadQueue(); 
    } catch {
      setSyncResult({ replayed: 0, failed: 1 });
    } finally {
      setSyncing(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const storagePercent = storageEstimate && storageEstimate.quota > 0
    ? Math.round((storageEstimate.used / storageEstimate.quota) * 100)
    : 0;

  return (
    <div style={{ padding: "16px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}><ArrowLeft size={24} /></Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700 }}>Offline Status</h1>
        <div style={{ width: 24 }} />
      </div>

      {}
      <div style={{
        background: isOnline ? "rgba(57,255,158,0.1)" : "rgba(245,158,11,0.1)",
        border: `1px solid ${isOnline ? "var(--border-green)" : "rgba(245,158,11,0.3)"}`,
        borderRadius: "12px",
        padding: "16px",
        display: "flex",
        gap: "12px",
        marginBottom: "24px",
      }}>
        {isOnline
          ? <CheckCircle2 size={24} color="var(--accent-green)" />
          : <WifiOff size={24} color="var(--accent-amber)" />
        }
        <div>
          <h3 style={{ color: isOnline ? "var(--accent-green)" : "var(--accent-amber)", fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>
            {isOnline ? "You are online" : "You are currently offline"}
          </h3>
          <p style={{ color: "var(--text-muted)", fontSize: "12px", lineHeight: 1.4 }}>
            {isOnline
              ? "MedMind is connected. All actions sync in real time."
              : "MedMind is running in offline mode. Your logs are saved locally and will sync when connection is restored."
            }
          </p>
        </div>
      </div>

      {}
      <h2 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text-secondary)" }}>
        Pending Sync Queue ({queue.length})
      </h2>

      {queue.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: 13, marginBottom: 24 }}>
          <CheckCircle2 size={32} style={{ marginBottom: 8, display: "block", margin: "0 auto 8px" }} color="var(--accent-green)" />
          All actions are synced. Nothing pending.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
          {queue.map(item => {
            const time = new Date(item.queuedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const label = item.type === "LOG_DOSE"
              ? `Logged dose (med #${(item.payload as any)?.medicationId})`
              : `Updated hydration (+${(item.payload as any)?.amount}L)`;
            return (
              <div key={item.id} className="card-surface" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: "var(--accent-amber)", flexShrink: 0 }} />
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 500 }}>{label}</span>
                    <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Queued at {time}</p>
                  </div>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>{time}</span>
              </div>
            );
          })}
        </div>
      )}

      {}
      {syncResult && (
        <div style={{
          background: syncResult.failed === 0 ? "rgba(57,255,158,0.1)" : "rgba(245,158,11,0.1)",
          border: `1px solid ${syncResult.failed === 0 ? "var(--border-green)" : "rgba(245,158,11,0.3)"}`,
          borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 13,
          color: syncResult.failed === 0 ? "var(--accent-green)" : "var(--accent-amber)",
        }}>
          {syncResult.failed === 0
            ? `✓ Synced ${syncResult.replayed} action(s) successfully.`
            : `Synced ${syncResult.replayed}, failed ${syncResult.failed}. Check your connection.`
          }
        </div>
      )}

      {}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Server size={18} color="var(--text-muted)" />
            <span style={{ fontSize: "14px", fontWeight: 600 }}>Local Storage Usage</span>
          </div>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            {storageEstimate
              ? `${formatBytes(storageEstimate.used)} / ${formatBytes(storageEstimate.quota)}`
              : "Calculating..."}
          </span>
        </div>
        <div style={{ height: "4px", background: "var(--bg-surface2)", borderRadius: "4px", overflow: "hidden" }}>
          <div style={{ width: `${storagePercent}%`, height: "100%", background: "var(--accent-green)", borderRadius: "4px" }} />
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", gap: "4px", alignItems: "center" }}>
          <AlertCircle size={12} />
          {storagePercent < 80 ? "Plenty of space available for offline logs." : "Storage is nearly full — consider freeing space."}
        </p>
      </div>

      {}
      <button
        onClick={handleForcSync}
        disabled={syncing || !isOnline}
        style={{
          marginTop: "auto",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "14px",
          color: isOnline ? "var(--text-primary)" : "var(--text-muted)",
          fontWeight: 700,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "8px",
          cursor: isOnline ? "pointer" : "not-allowed",
          opacity: isOnline ? 1 : 0.5,
          fontSize: 15,
        }}
      >
        {syncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
        {syncing ? "Syncing..." : !isOnline ? "Offline — Cannot Sync" : "Force Sync Attempt"}
      </button>
    </div>
  );
}


