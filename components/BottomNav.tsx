// Renders the persistent bottom navigation bar showing active status and linking core MedMind screens.
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PuzzleIcon,
  Mic,
  WifiOff,
  Users,
  FileText,
  MessageCircleQuestion,
} from "lucide-react";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/puzzle-lock", icon: PuzzleIcon, label: "Puzzle" },
  { href: "/voice-control", icon: Mic, label: "Voice" },
  { href: "/offline", icon: WifiOff, label: "Offline" },
  { href: "/caregiver", icon: Users, label: "Caregiver" },
  { href: "/doctor-report", icon: FileText, label: "Report" },
  { href: "/qna", icon: MessageCircleQuestion, label: "Q&A" },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="bottom-nav">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 2px" }}>
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "3px",
                padding: "4px 6px",
                borderRadius: "12px",
                textDecoration: "none",
                transition: "all 0.2s ease",
                position: "relative",
                flex: 1,
              }}
            >
              {active && (
                /* Renders a top-centered green indicator bar for the active navigation tab */
                <span
                  style={{
                    position: "absolute",
                    top: "-6px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: "28px",
                    height: "3px",
                    background: "var(--accent-green)",
                    borderRadius: "0 0 4px 4px",
                    boxShadow: "0 0 8px var(--accent-green)",
                  }}
                />
              )}
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: active ? "rgba(57, 255, 158, 0.15)" : "transparent",
                  transition: "all 0.2s",
                }}
              >
                <Icon
                  size={18}
                  style={{
                    color: active ? "var(--accent-green)" : "var(--text-muted)",
                    transition: "color 0.2s",
                    filter: active ? "drop-shadow(0 0 4px var(--accent-green))" : "none",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: active ? 700 : 500,
                  color: active ? "var(--accent-green)" : "var(--text-muted)",
                  transition: "color 0.2s",
                }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
