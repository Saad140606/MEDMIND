// Conversational interface for interacting with the generative MedMind AI Assistant for medication Q&A.
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Sparkles, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";

interface Message {
  id: number;
  type: "ai" | "user";
  text: string;
  loading?: boolean;
}

type SpeechRecognitionType = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: (event: Event & { results?: SpeechRecognitionResultList }) => void;
  onerror: (event: Event & { error?: string }) => void;
  onend: (event: Event) => void;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

const CHIPS = ["Missed Dose?", "Any interactions?", "Side effects?"];

const checkSpeechRecognitionSupport = (): boolean => {
  if (typeof window === "undefined") return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
};

export default function QnAPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: "ai",
      text: "Hi! I'm your MedMind AI assistant. I can help with drug interactions, side effects, or what to do if you miss a dose. Ask me anything about your medications!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<Array<{ type: string; text: string }>>([]);
  const [supported] = useState(checkSpeechRecognitionSupport());
  const [isListening, setIsListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [nextId, setNextId] = useState(2);
  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!supported) return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: Event & { results?: SpeechRecognitionResultList }) => {
      const results = event.results as SpeechRecognitionResultList;
      if (results && results[0]) {
        const text = results[0][0].transcript;
        if (text) {
          setInput(text);
        }
      }
    };

    recognition.onerror = (event: Event & { error?: string }) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [supported]);

  const toggleListen = () => {
    if (!supported) return;
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
      setIsListening(false);
    } else {
      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        console.error("Failed to start speech recognition", err);
      }
    }
  };

  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      if (!text) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.volume = 0.9;
      window.speechSynthesis.speak(utterance);
    }
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Stop speaking if the user enters a new query
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    // Also stop listening if it's currently dictating
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const currentId = nextId;
    const userMsgId = currentId;
    const loadingMsgId = currentId + 1;

    setNextId(currentId + 2);

    const userMsg: Message = { id: userMsgId, type: "user", text };
    const loadingMsg: Message = { id: loadingMsgId, type: "ai", text: "", loading: true };

    setMessages((p) => [...p, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    const newHistory = [...history, { type: "user", text }];

    try {
      const res = await fetch("/api/qna", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();
      const responseText = data.response || "I couldn't get a response. Please try again.";

      setMessages((p) =>
        p.map((m) => (m.id === loadingMsgId ? { ...m, text: responseText, loading: false } : m))
      );
      setHistory([...newHistory, { type: "ai", text: responseText }]);

      if (autoSpeak) {
        speakText(responseText);
      }
    } catch {
      setMessages((p) =>
        p.map((m) =>
          m.id === loadingMsgId
            ? { ...m, text: "Connection error. Please check your network and try again.", loading: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [nextId, isLoading, isListening, history, autoSpeak]);

  return (
    <div style={{ padding: "16px", height: "100dvh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexShrink: 0 }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}>
          <ArrowLeft size={24} />
        </Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkles size={16} color="var(--accent-green)" />
          AI Assistant
        </h1>
        <button
          onClick={() => {
            const nextVal = !autoSpeak;
            setAutoSpeak(nextVal);
            if (!nextVal && typeof window !== "undefined") {
              window.speechSynthesis.cancel();
            }
          }}
          style={{
            background: "none",
            border: "none",
            color: autoSpeak ? "var(--accent-green)" : "var(--text-muted)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "4px",
            borderRadius: "50%",
            transition: "all 0.2s"
          }}
          title={autoSpeak ? "Disable auto read aloud" : "Enable auto read aloud"}
        >
          {autoSpeak ? <Volume2 size={20} style={{ filter: "drop-shadow(0 0 4px var(--accent-green))" }} /> : <VolumeX size={20} />}
        </button>
      </div>

      {/* Suggestion Chips */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "12px", flexShrink: 0 }}>
        {CHIPS.map((tag) => (
          <button
            key={tag}
            onClick={() => sendMessage(tag)}
            disabled={isLoading}
            style={{
              background: "rgba(57,255,158,0.1)",
              border: "1px solid rgba(57,255,158,0.2)",
              borderRadius: "16px",
              padding: "6px 12px",
              color: "var(--accent-green)",
              fontSize: "12px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              cursor: "pointer",
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "20px" }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.type === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              display: "flex",
              alignItems: "flex-end",
              gap: "8px"
            }}
          >
            <div
              className={msg.type === "user" ? "bubble-user" : "bubble-ai"}
              style={{ fontSize: "14px", lineHeight: 1.5, flex: 1 }}
            >
              {msg.loading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent-green)" }} />
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Thinking...</span>
                </div>
              ) : (
                msg.text
              )}
            </div>
            {msg.type === "ai" && !msg.loading && (
              <button
                onClick={() => speakText(msg.text)}
                style={{
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "50%",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  flexShrink: 0,
                  transition: "all 0.2s",
                }}
                title="Read aloud"
              >
                <Volume2 size={14} />
              </button>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div
        style={{
          background: "var(--bg-surface)",
          borderRadius: "24px",
          padding: "6px 6px 6px 16px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          border: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
          placeholder={isListening ? "Listening... Speak clearly" : "Ask anything about your medications..."}
          disabled={isLoading}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            color: "var(--text-primary)",
            fontSize: "14px",
            outline: "none",
          }}
        />
        {supported && (
          <button
            onClick={toggleListen}
            disabled={isLoading}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: isListening ? "var(--accent-green)" : "var(--bg-surface2)",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isListening ? "#0d1a10" : "var(--text-primary)",
              cursor: "pointer",
              transition: "all 0.2s",
              flexShrink: 0,
              boxShadow: isListening ? "0 0 10px var(--accent-green)" : "none",
            }}
            title={isListening ? "Listening... Click to stop" : "Start voice input"}
          >
            {isListening ? (
              <MicOff size={18} className="animate-pulse" />
            ) : (
              <Mic size={18} />
            )}
          </button>
        )}
        <button
          onClick={() => sendMessage(input)}
          disabled={isLoading || !input.trim()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            background: input.trim() && !isLoading ? "var(--accent-green)" : "var(--bg-surface2)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0d1a10",
            cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
            transition: "all 0.2s",
            flexShrink: 0,
          }}
        >
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent-green)" }} />
          ) : (
            <Send size={18} />
          )}
        </button>
      </div>
    </div>
  );
}

    





