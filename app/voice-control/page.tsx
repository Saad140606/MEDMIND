"use client";
import { useState, useEffect } from "react";
import { Mic, ArrowLeft, MoreHorizontal, Settings } from "lucide-react";
import Link from "next/link";

export default function VoiceControl() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [logs, setLogs] = useState([
    { id: 1, text: "Did I take my morning pills?", type: "user", time: "10:05 AM" },
    { id: 2, text: "Yes, you logged Aspirin and Vitamin D at 8:15 AM.", type: "ai", time: "10:05 AM" },
  ]);

  const toggleListen = () => {
    if (!isListening) {
      setIsListening(true);
      setTranscript("Listening...");
      setTimeout(() => {
        setTranscript("Log my afternoon Metformin");
        setTimeout(() => {
          setIsListening(false);
          setTranscript("");
          setLogs(p => [...p, 
            { id: Date.now(), text: "Log my afternoon Metformin", type: "user", time: "Now" },
            { id: Date.now()+1, text: "Got it! Metformin 500mg logged at 2:05 PM.", type: "ai", time: "Now" }
          ]);
        }, 1500);
      }, 2000);
    }
  };

  return (
    <div style={{ padding: "16px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}><ArrowLeft size={24} /></Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700 }}>Voice Assistant</h1>
        <Settings size={20} color="var(--text-muted)" />
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "20px" }}>
        {logs.map(log => (
          <div key={log.id} style={{ alignSelf: log.type === "user" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
            <div className={log.type === "user" ? "bubble-user" : "bubble-ai"}>
              {log.text}
            </div>
            <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", textAlign: log.type === "user" ? "right" : "left" }}>
              {log.time}
            </p>
          </div>
        ))}
      </div>

      <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "24px" }}>
        <p style={{ color: "var(--accent-green)", fontSize: "14px", fontWeight: 600, minHeight: "20px" }}>
          {transcript}
        </p>
        
        <div className={isListening ? "mic-orb animate-pulse-ring" : "mic-orb"} onClick={toggleListen}>
          <Mic size={40} color="#0d1a10" />
        </div>
        
        <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>
          Tap to speak commands like "Log dose" or "Skip"
        </p>

        <div style={{ display: "flex", gap: "8px", overflowX: "auto", width: "100%", paddingBottom: "8px" }}>
          {["Log my Metformin", "Did I take Aspirin?", "Remind me in 1 hour"].map((cmd) => (
            <button key={cmd} style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "20px", padding: "8px 16px", color: "var(--text-primary)", fontSize: "12px", whiteSpace: "nowrap", flexShrink: 0 }}>
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
