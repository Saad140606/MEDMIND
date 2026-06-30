// Tracks connectivity, registers the service worker, and replays cached offline IndexedDB requests upon recovery.
"use client";
import { useEffect, useState } from "react";
import { queueAction, getQueuedActions, clearQueuedAction } from "@/lib/offlineQueue";
import type { QueuedAction } from "@/lib/offlineQueue";

export function SyncManager() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Track browser connectivity so offline actions can be queued.
    setIsOnline(navigator.onLine);

    const handleOnline = async () => {
      setIsOnline(true);
      // Trigger synchronization replay immediately when browser regains internet access.
      await replayQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for custom messages dispatched from the Service Worker (e.g. offline requests intercepted).
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === "QUEUE_ACTION") {
        await queueAction(event.data.payload as QueuedAction);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handleMessage);

    
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("MedMind SW registered:", reg.scope);
        })
        .catch((err) => {
          console.warn("SW registration failed:", err);
        });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleMessage);
    };
  }, []);

  return (
    <>
      {!isOnline && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: 430,
            background: "rgba(245,158,11,0.95)",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            zIndex: 9999,
            fontSize: 13,
            fontWeight: 700,
            color: "#0d0f1a",
            backdropFilter: "blur(10px)",
          }}
        >
          <span>⚡</span> Offline — actions are being queued
        </div>
      )}
    </>
  );
}


export async function replayQueue(): Promise<{ replayed: number; failed: number }> {
  // Replay queued actions when the connection is restored.
  let replayed = 0;
  let failed = 0;

  try {
    const queue = await getQueuedActions();
    if (queue.length === 0) return { replayed: 0, failed: 0 };

    for (const action of queue) {
      try {
        // Dispatch each queued offline action sequentially to the server backend.
        const response = await fetch(action.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action.payload),
        });

        if (response.ok) {
          // Standard HTTP 200/201 success paths, or duplicate no-ops returned as 200, successfully clear the item.
          await clearQueuedAction(action.id);
          replayed++;
        } else if (response.status === 409) {
          // A 409 Conflict indicates the dose or hydration log was already merged; resolve by clearing the queue entry.
          await clearQueuedAction(action.id);
          replayed++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }
  } catch (err) {
    console.error("Replay queue error:", err);
  }

  return { replayed, failed };
}
