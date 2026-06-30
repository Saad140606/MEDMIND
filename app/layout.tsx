// Next.js root layout defining metadata, PWA icons, manifest declarations, global styles, and viewport settings.
import type { Metadata } from "next";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

import { SyncManager } from "@/components/SyncManager";

export const metadata: Metadata = {
  title: "MedMind — Smart Medication Tracker",
  description: "Stay on top of your medications with smart reminders, puzzle locks, voice control and caregiver support.",

  // Defines application parameters for Progressive Web App (PWA) installation.
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MedMind",
  },
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#39ff9e" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <div className="app-container">
          <SyncManager />
          <main style={{ paddingBottom: "88px", minHeight: "100dvh" }}>
            {children}
          </main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
