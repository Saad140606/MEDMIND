// Conversational interface for interacting with the generative MedMind AI Assistant for medication Q&A.
"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send, Sparkles, Loader2 } from "lucide-react";
import Link from "next/link";

interface Message {
  id: number;
  type: "ai" | "user";
  text: string;
  loading?: boolean;
}

const CHIPS = ["Missed Dose?", "Any interactions?", "Side effects?"];

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { id: Date.now(), type: "user", text };
    // Add a temporary AI message block displaying a loading spinner to indicate request processing status.
    const loadingMsg: Message = { id: Date.now() + 1, type: "ai", text: "", loading: true };

    setMessages((p) => [...p, userMsg, loadingMsg]);
    setInput("");
    setIsLoading(true);

    // Save current conversational dialogue turns to build historical context variables for the prompt query.
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
        p.map((m) => (m.loading ? { ...m, text: responseText, loading: false } : m))
      );
      setHistory([...newHistory, { type: "ai", text: responseText }]);
    } catch {
      setMessages((p) =>
        p.map((m) =>
          m.loading
            ? { ...m, text: "Connection error. Please check your network and try again.", loading: false }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: "16px", height: "100dvh", display: "flex", flexDirection: "column" }}>
      {}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexShrink: 0 }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}>
          <ArrowLeft size={24} />
        </Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkles size={16} color="var(--accent-green)" />
          AI Assistant
        </h1>
        <div style={{ width: 24 }} />
      </div>

      {}
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

      {}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "20px" }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{ alignSelf: msg.type === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}
          >
            <div
              className={msg.type === "user" ? "bubble-user" : "bubble-ai"}
              style={{ fontSize: "14px", lineHeight: 1.5 }}
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
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {}
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
          placeholder="Ask anything about your medications..."
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

    





