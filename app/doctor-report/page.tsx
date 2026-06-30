// Clinician portal rendering patient adherence history charts, medication performance metrics, and PDF report downloads.
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Download, Calendar, Loader2, ChevronDown, FileText } from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { isSupabaseConfigured } from "@/lib/supabaseClient";

interface Patient {
  id: string;
  name: string;
}

interface ChartEntry {
  day: string;
  adherence: number;
}

interface MedBreakdown {
  name: string;
  percent: number;
  taken: number;
  total: number;
}

interface ReportData {
  patientName: string;
  streak: number;
  chartData: ChartEntry[];
  medicationBreakdown: MedBreakdown[];
  days: number;
}

export default function DoctorReport() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [days, setDays] = useState(7);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const notConfigured = !isSupabaseConfigured;

  
  useEffect(() => {
    if (notConfigured) { setLoading(false); setError("requiresSupabase"); return; }
    fetch("/api/doctor/patients")
      .then(r => {
        if (r.status === 503) { setError("requiresSupabase"); return null; }
        if (!r.ok) throw new Error("Failed to fetch patients");
        return r.json();
      })
      .then(data => {
        if (!data) return;
        const pts: Patient[] = data.patients || [];
        setPatients(pts);
        if (pts.length > 0) setSelectedPatient(pts[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [notConfigured]);

  
  const fetchReport = useCallback(async () => {
    if (!selectedPatient) return;
    setReportLoading(true);
    try {
      const res = await fetch(`/api/doctor/report?patientId=${selectedPatient}&days=${days}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      const data = await res.json();
      setReportData(data);
    } catch (e: any) {
      console.error(e);
    } finally {
      setReportLoading(false);
    }
  }, [selectedPatient, days]);

  useEffect(() => {
    if (selectedPatient) fetchReport();
  }, [fetchReport, selectedPatient]);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      // Lazy load heavy PDF/image libraries (jsPDF, html2canvas) to optimize initial page loading.
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");

      // Capture the target DOM node as a canvas, specifying background color and high resolution scaling.
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#0d0f1a",
        scale: 2,
        useCORS: true,
      });

      // Convert captured canvas to raw base64 PNG data, then insert it into a standard A4 PDF document.
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`medmind-report-${reportData?.patientName || "patient"}-${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (e) {
      console.error("PDF export failed:", e);
      alert("PDF export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 16 }}>
        <Loader2 size={40} className="animate-spin" style={{ color: "var(--accent-green)" }} />
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading report...</p>
      </div>
    );
  }

  if (error === "requiresSupabase") {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <FileText size={48} color="var(--text-muted)" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Doctor Report</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Doctor reports require Supabase. Add the required environment variables to enable multi-user features.
        </p>
        <Link href="/" className="btn-green" style={{ display: "inline-block", maxWidth: 200, textDecoration: "none", textAlign: "center", padding: "12px 24px" }}>
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <FileText size={56} color="var(--text-muted)" />
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>No Patients Connected</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6 }}>
          No patients have accepted your connection request yet.
        </p>
        <Link href="/" style={{ color: "var(--accent-green)", fontWeight: 700 }}>← Back to Dashboard</Link>
      </div>
    );
  }

  const dateRangeLabel = `Last ${days} day${days > 1 ? "s" : ""}`;

  return (
    <div style={{ padding: "16px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}><ArrowLeft size={24} /></Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700 }}>Doctor Report</h1>
        <div style={{ width: 24 }} />
      </div>

      {}
      {patients.length > 1 && (
        <div style={{ position: "relative", marginBottom: 16 }}>
          <select
            value={selectedPatient}
            onChange={e => setSelectedPatient(e.target.value)}
            style={{
              width: "100%", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12,
              padding: "12px 40px 12px 16px", color: "var(--text-primary)", fontSize: 14, outline: "none",
              appearance: "none", cursor: "pointer",
            }}
          >
            {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <ChevronDown size={16} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
        </div>
      )}

      {}
      <div className="card-surface" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Calendar size={18} color="var(--text-muted)" />
          <span style={{ fontSize: "13px", fontWeight: 600 }}>{dateRangeLabel}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[7, 14, 30].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              style={{
                padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                background: days === d ? "var(--accent-green)" : "var(--bg-surface2)",
                color: days === d ? "#0d1a10" : "var(--text-muted)",
                fontSize: 12, fontWeight: 700, transition: "all 0.2s",
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {}
      <div ref={reportRef}>
        {}
        <div className="card" style={{ marginBottom: "24px", paddingBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-secondary)" }}>
              Adherence Overview
              {reportData && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> — {reportData.patientName}</span>}
            </h3>
            {reportLoading && <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent-green)" }} />}
          </div>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportData?.chartData || []}>
                <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-primary)", fontSize: 12 }}
                  formatter={(value: any) => [`${value}%`, "Adherence"]}
                />
                <Bar dataKey="adherence" radius={[4, 4, 0, 0]}>
                  {(reportData?.chartData || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.adherence >= 80 ? "var(--accent-green)" : entry.adherence >= 50 ? "var(--accent-amber)" : "var(--accent-red)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {}
        <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text-secondary)" }}>Medication Breakdown</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "28px" }}>
          {reportLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 20 }}>
              <Loader2 size={24} className="animate-spin" style={{ color: "var(--accent-green)" }} />
            </div>
          ) : (reportData?.medicationBreakdown || []).map((med, i) => {
            const color = med.percent >= 80 ? "var(--accent-green)" : med.percent >= 50 ? "var(--accent-amber)" : "var(--accent-red)";
            return (
              <div key={i} className="card-surface">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{med.name}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color }}>{med.percent}%</span>
                </div>
                <div style={{ height: 4, background: "var(--bg-surface2)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${med.percent}%`, height: "100%", background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
                </div>
                <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                  {med.taken} of {med.total} days logged
                </p>
              </div>
            );
          })}
          {!reportLoading && (!reportData || reportData.medicationBreakdown.length === 0) && (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>No medication data available for this period.</p>
          )}
        </div>
      </div>

      {}
      <button
        onClick={handleExportPDF}
        disabled={exporting || !reportData}
        className="btn-green"
        style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "auto" }}
      >
        {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={18} />}
        {exporting ? "Generating PDF..." : "Export as PDF"}
      </button>
    </div>
  );
}





