"use client";
import { useState, useEffect, Suspense } from "react";
import { ArrowLeft, Bell, Delete, CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

interface Medication {
  id: number;
  name: string;
  icon: string;
  color: string;
  time: string;
  status: 'taken' | 'due' | 'upcoming';
  iconBg: string;
  requiresLock: boolean;
}

function PuzzleLockContent() {
  const [input, setInput] = useState("");
  const [medication, setMedication] = useState<Medication | null>(null);
  const [loading, setLoading] = useState(true);
  const [num1, setNum1] = useState(5);
  const [num2, setNum2] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const medId = searchParams ? searchParams.get("medId") : null;

  // Generate dynamic puzzle on mount
  useEffect(() => {
    const n1 = Math.floor(Math.random() * 6) + 3; // 3 to 8
    const n2 = Math.floor(Math.random() * 6) + 2; // 2 to 7
    setNum1(n1);
    setNum2(n2);
  }, []);

  const correctAnswer = (num1 + num2).toString();

  useEffect(() => {
    const fetchMedicationDetails = async () => {
      if (!medId) {
        // Fallback default med
        setMedication({
          id: 3,
          name: "Metformin 500mg",
          icon: "🔵",
          color: "#3b82f6",
          time: "02:00 PM",
          status: "due",
          iconBg: "#0a1530",
          requiresLock: true
        });
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/dashboard');
        if (!res.ok) throw new Error('Failed to fetch details');
        const data = await res.json();
        const found = data.medications.find((m: Medication) => m.id === Number(medId));
        if (found) {
          setMedication(found);
        } else {
          // Fallback if not found
          setMedication({
            id: Number(medId),
            name: "Unknown Medication",
            icon: "💊",
            color: "#39ff9e",
            time: "12:00 PM",
            status: "due",
            iconBg: "#0d1a10",
            requiresLock: true
          });
        }
      } catch (err) {
        console.error('Error fetching medication details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMedicationDetails();
  }, [medId]);

  const handleKey = (key: string) => {
    if (isSubmitting) return;

    if (key === "del") {
      setInput((prev) => prev.slice(0, -1));
    } else if (key === "enter") {
      if (input === correctAnswer) {
        triggerConfirm();
      } else {
        // Reset on wrong input
        setInput("");
      }
    } else {
      if (input.length < 2) setInput((prev) => prev + key);
    }
  };

  const triggerConfirm = async () => {
    if (!medication) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/dashboard/log-dose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medicationId: medication.id }),
      });
      if (!res.ok) throw new Error('Failed to log dose');
      
      // Success checkmark animation wait
      setTimeout(() => router.push("/"), 800);
    } catch (err) {
      alert('Failed to save log to backend. Try again.');
      setIsSubmitting(false);
    }
  };

  const isCorrect = input === correctAnswer;

  if (loading || !medication) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: "16px" }}>
        <Loader2 size={40} className="animate-spin" style={{ color: "var(--accent-green)" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 600 }}>Loading medication details...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "16px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent-green)", fontWeight: 700 }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: "rgba(57,255,158,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ArrowLeft size={18} />
          </div>
          Puzzle Lock
        </Link>
        <button style={{ background: "none", border: "none", color: "var(--accent-green)" }}>
          <Bell size={20} />
        </button>
      </div>

      <h1 style={{ fontSize: "22px", fontWeight: 800, marginBottom: "8px" }}>Puzzle Lock</h1>
      <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "24px", lineHeight: 1.5 }}>
        Solve to confirm medication intake — no mindless tapping
      </p>

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div className="card-surface" style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "30px", border: "1px solid var(--border)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: medication.iconBg, border: `1px solid ${medication.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>
            {medication.icon}
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "2px" }}>{medication.name}</h3>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span style={{ color: "var(--accent-green)", fontSize: "11px", fontWeight: 700 }}>{medication.time} reminder</span>
              <span style={{ color: "var(--accent-amber)", fontSize: "11px", fontWeight: 700 }}>Due Soon</span>
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "16px" }}>VERIFY CALCULATION</p>
        
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", marginBottom: "40px" }}>
          <span style={{ fontSize: "48px", fontWeight: 800 }}>{num1} + {num2} =</span>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--bg-surface)", border: isCorrect ? "2px solid var(--accent-green)" : "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", fontWeight: 800, color: isCorrect ? "var(--accent-green)" : "var(--accent-green)", transition: "all 0.3s ease", boxShadow: isCorrect ? "0 0 20px var(--accent-green-glow)" : "none" }}>
            {input || "?"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "auto" }}>
          {["1","2","3","4","5","6","7","8","9"].map((n) => (
            <button key={n} disabled={isSubmitting} className="keypad-btn" onClick={() => handleKey(n)}>{n}</button>
          ))}
          <button className="keypad-btn" disabled={isSubmitting} onClick={() => handleKey("del")} style={{ display: "flex", justifyContent: "center", alignItems: "center" }}><Delete size={24} /></button>
          <button className="keypad-btn" disabled={isSubmitting} onClick={() => handleKey("0")}>0</button>
          <button className="keypad-btn" disabled={isSubmitting} onClick={() => handleKey("enter")} style={{ display: "flex", justifyContent: "center", alignItems: "center", color: "var(--accent-green)" }}><CheckCircle2 size={24} /></button>
        </div>

        <button 
          className="btn-green" 
          disabled={!isCorrect || isSubmitting} 
          onClick={triggerConfirm}
          style={{ marginTop: "24px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          {isSubmitting ? "Logging Intake..." : "Confirm Taken"}
        </button>
      </div>
    </div>
  );
}

export default function PuzzleLock() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: "16px" }}>
        <Loader2 size={40} className="animate-spin" style={{ color: "var(--accent-green)" }} />
        <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: 600 }}>Loading verification...</p>
      </div>
    }>
      <PuzzleLockContent />
    </Suspense>
  );
}
