import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

export const metadata: Metadata = {
  title: "MedMind — Smart Medication Tracker",
  description: "Stay on top of your medications with smart reminders, puzzle locks, voice control and caregiver support.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>
        <div className="app-container">
          <main style={{ paddingBottom: "88px", minHeight: "100dvh" }}>
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
