// Voice interface using the Web Speech API to capture speech, command actions, and provide text-to-speech audio feedback.
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, ArrowLeft, Settings, MicOff, Volume2 } from "lucide-react";
import Link from "next/link";

interface LogEntry {
  id: number;
  text: string;
  type: "user" | "ai";
  time: string;
}

const SUGGESTION_CHIPS = ["Log my Metformin", "Did I take Aspirin?", "Remind me in 1 hour"];


declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function VoiceControl() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([
    { id: 1, text: "Tap the mic and say a command like 'Log my Metformin' or 'Did I take Aspirin?'", type: "ai", time: "" },
  ]);
  const [supported, setSupported] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const recognitionRef = useRef<any>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const getTime = () =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      // Loop over speech recognition results buffer starting from the current index.
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }
      setTranscript(interim || final);
      // Dispatch final transcribed text to the backend parsing API.
      if (final) {
        handleFinalTranscript(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        setPermissionDenied(true);
      }
      setIsListening(false);
      setTranscript("");
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.abort();
    };
  
  }, []);

  const handleFinalTranscript = useCallback(async (text: string) => {
    setIsListening(false);
    setTranscript("");
    setIsProcessing(true);

    const userEntry: LogEntry = { id: Date.now(), text, type: "user", time: getTime() };
    setLogs((p) => [...p, userEntry]);

    try {
      const res = await fetch("/api/voice/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });

      const data = await res.json();
      const responseText = data.responseText || "I understood your command but couldn't process it.";

      setLogs((p) => [...p, { id: Date.now() + 1, text: responseText, type: "ai", time: getTime() }]);

      
      // Trigger browser SpeechSynthesis to speak the returned API response text back to the user.
      if ("speechSynthesis" in window && responseText) {
        const utterance = new SpeechSynthesisUtterance(responseText);
        utterance.rate = 1.1;
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
      }
    } catch {
      setLogs((p) => [...p, { id: Date.now() + 1, text: "Network error. Please try again.", type: "ai", time: getTime() }]);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const toggleListen = () => {
    if (!supported) return;
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
      setTranscript("");
    } else {
      try {
        recognition.start();
        setIsListening(true);
        setTranscript("Listening...");
      } catch {
        
      }
    }
  };

  return (
    <div style={{ padding: "16px", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      {}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}>
          <ArrowLeft size={24} />
        </Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700 }}>Voice Assistant</h1>
        <Settings size={20} color="var(--text-muted)" />
      </div>

      {}
      {!supported && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 13, color: "var(--accent-red)" }}>
          ⚠️ Your browser does not support the Web Speech API. Try Chrome or Edge on desktop/Android.
        </div>
      )}

      {permissionDenied && (
        <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "14px 16px", marginBottom: 20, fontSize: 13, color: "var(--accent-amber)" }}>
          🎤 Microphone access was denied. Please allow microphone permission in your browser settings and refresh.
        </div>
      )}

      {}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "20px" }}>
        {logs.map((log) => (
          <div key={log.id} style={{ alignSelf: log.type === "user" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
            <div className={log.type === "user" ? "bubble-user" : "bubble-ai"} style={{ fontSize: 14 }}>
              {log.text}
            </div>
            {log.time && (
              <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", textAlign: log.type === "user" ? "right" : "left" }}>
                {log.time}
              </p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {}
      <div style={{ padding: "16px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
        {}
        <p style={{ color: "var(--accent-green)", fontSize: "14px", fontWeight: 600, minHeight: "20px", textAlign: "center" }}>
          {isProcessing ? "Processing..." : transcript}
        </p>

        {}
        <div
          className={isListening ? "mic-orb animate-pulse-ring" : "mic-orb"}
          onClick={supported && !isProcessing ? toggleListen : undefined}
          style={{
            cursor: supported && !isProcessing ? "pointer" : "not-allowed",
            opacity: isProcessing ? 0.6 : 1,
            background: isListening ? "linear-gradient(135deg,#39ff9e,#1aae6a)" : "linear-gradient(135deg,#39ff9e,#1aae6a)",
          }}
        >
          {isListening ? <MicOff size={40} color="#0d1a10" /> : <Mic size={40} color="#0d1a10" />}
        </div>

        <p style={{ color: "var(--text-muted)", fontSize: "12px", textAlign: "center" }}>
          {isListening ? "Tap to stop" : isProcessing ? "Processing your command..." : "Tap to speak"}
        </p>

        {}
        <div style={{ display: "flex", gap: "8px", overflowX: "auto", width: "100%", paddingBottom: "8px" }}>
          {SUGGESTION_CHIPS.map((cmd) => (
            <button
              key={cmd}
              onClick={() => !isProcessing && handleFinalTranscript(cmd)}
              disabled={isProcessing}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "20px",
                padding: "8px 16px",
                color: "var(--text-primary)",
                fontSize: "12px",
                whiteSpace: "nowrap",
                flexShrink: 0,
                cursor: isProcessing ? "not-allowed" : "pointer",
                opacity: isProcessing ? 0.5 : 1,
              }}
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

