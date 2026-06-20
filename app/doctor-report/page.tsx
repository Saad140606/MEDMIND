"use client";
import { ArrowLeft, Download, Share2, Calendar } from "lucide-react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

const data = [
  { name: 'Mon', adherence: 100 },
  { name: 'Tue', adherence: 80 },
  { name: 'Wed', adherence: 100 },
  { name: 'Thu', adherence: 50 },
  { name: 'Fri', adherence: 100 },
  { name: 'Sat', adherence: 90 },
  { name: 'Sun', adherence: 100 },
];

export default function DoctorReport() {
  return (
    <div style={{ padding: "16px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <Link href="/" style={{ color: "var(--text-primary)" }}><ArrowLeft size={24} /></Link>
        <h1 style={{ fontSize: "16px", fontWeight: 700 }}>Doctor Report</h1>
        <Share2 size={20} color="var(--accent-green)" />
      </div>

      <div className="card-surface" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Calendar size={18} color="var(--text-muted)" />
          <span style={{ fontSize: "13px", fontWeight: 600 }}>Oct 16 - Oct 22, 2023</span>
        </div>
        <span style={{ color: "var(--accent-green)", fontSize: "12px", fontWeight: 700 }}>Weekly</span>
      </div>

      <div className="card" style={{ marginBottom: "24px", height: "240px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "16px", color: "var(--text-secondary)" }}>Adherence Overview</h3>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}%`} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--text-primary)", fontSize: "12px" }} />
            <Bar dataKey="adherence" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.adherence >= 80 ? "var(--accent-green)" : "var(--accent-amber)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px", color: "var(--text-secondary)" }}>Medication Breakdown</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "32px" }}>
        {[
          { name: "Aspirin 81mg", adherence: "100%", color: "var(--accent-green)" },
          { name: "Vitamin D 1000IU", adherence: "85%", color: "var(--accent-green)" },
          { name: "Metformin 500mg", adherence: "40%", color: "var(--accent-amber)" },
        ].map((med, i) => (
          <div key={i} className="card-surface" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>{med.name}</span>
            <span style={{ fontSize: "14px", fontWeight: 800, color: med.color }}>{med.adherence}</span>
          </div>
        ))}
      </div>

      <button className="btn-green" style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "auto" }}>
        <Download size={18} /> Export as PDF
      </button>
    </div>
  );
}
