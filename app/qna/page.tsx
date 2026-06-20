"use client";
import { useState } from "react";
import { ArrowLeft, Send, Sparkles } from "lucide-react";
import Link from "next/link";

export default function QnAPage() {
  const [messages, setMessages] = useState([
    { id: 1, type: "ai", text: "Hi Ahmed! I'm your MedMind AI assistant. I can help you with drug interactions, side effects, or what to do if you miss a dose. What's on your mind?" }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(p => [...p, { id: Date.now(), type: "user", text: input }]);
    const currentInput = input;
    setInput("");
    
    setTimeout(() => {
      setMessages(p => [...p, { id: Date.now()+1, type: "ai", text: `Here is a simulated response to your question about "${currentInput}". Always consult your doctor for real medical advice.` }]);
    }, 1000);
  };

  return (
    <div style={{ padding: "16px", height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}><ArrowLeft size={24} /></Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkles size={16} color="var(--accent-green)" /> AI Assistant
        </h1>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "16px", flexShrink: 0 }}>
        {["Missed Dose?", "Interactions?", "Side Effects"].map(tag => (
          <button key={tag} onClick={() => setInput(tag)} style={{ background: "rgba(57,255,158,0.1)", border: "1px solid rgba(57,255,158,0.2)", borderRadius: "16px", padding: "6px 12px", color: "var(--accent-green)", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap" }}>
            {tag}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "20px" }}>
        {messages.map(msg => (
          <div key={msg.id} style={{ alignSelf: msg.type === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
            <div className={msg.type === "user" ? "bubble-user" : "bubble-ai"} style={{ fontSize: "14px", lineHeight: 1.5 }}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--bg-surface)", borderRadius: "24px", padding: "6px 6px 6px 16px", display: "flex", alignItems: "center", gap: "8px", border: "1px solid var(--border)" }}>
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask anything..."
          style={{ flex: 1, background: "transparent", border: "none", color: "var(--text-primary)", fontSize: "14px", outline: "none" }}
        />
        <button onClick={handleSend} style={{ width: 40, height: 40, borderRadius: 20, background: "var(--accent-green)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "#0d1a10" }}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
