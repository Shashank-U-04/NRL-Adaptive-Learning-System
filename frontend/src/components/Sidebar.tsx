"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { learningApi } from "@/lib/api";
import {
  LayoutDashboard, Play, BarChart2, Trophy, BookOpen, User, LogOut,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Main" },
  { href: "/session",   label: "Start Session", icon: Play,             section: "Main" },
  { href: "/analytics", label: "Analytics",     icon: BarChart2,        section: "Insights" },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy,           section: "Insights" },
  { href: "/learning",  label: "Learning",      icon: BookOpen,         section: "Library" },
  { href: "/profile",   label: "Profile",       icon: User,             section: "Library" },
];

const SECTIONS = ["Main", "Insights", "Library"] as const;

function initials(name: string) {
  return name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();
}

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();

  const { data: modulesResp, isSuccess: modulesLoaded } = useQuery({
    queryKey: ["sidebar-modules-count"],
    queryFn: learningApi.getModules,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const learningBadge =
    modulesLoaded && modulesResp?.success && modulesResp.data?.modules
      ? String(modulesResp.data.modules.length)
      : null;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-mark">N</div>
        <div>
          <div className="brand-name">NRL</div>
          <div className="brand-sub">Adaptive Learning</div>
        </div>
      </div>

      {/* Nav */}
      {SECTIONS.map(section => (
        <div key={section}>
          <div className="nav-section">{section}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV.filter(n => n.section === section).map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              const badge = item.href === "/learning" ? learningBadge : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? "active" : ""}`}
                >
                  <item.icon size={16} />
                  <span>{item.label}</span>
                  {badge && (
                    <span className="badge-num">{badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* User footer */}
      <div style={{ marginTop: "auto" }}>
        <div className="divider" style={{ margin: "12px 0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px" }}>
          <div
            className="avatar"
            style={{
              background: "linear-gradient(135deg, #3B82F6, #6aa6ff)",
              fontSize: 12,
            }}
          >
            {user ? initials(user.name) : "?"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.name ?? "Guest"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user?.email ?? ""}
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            style={{ background: "transparent", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 6, borderRadius: 6 }}
            className="focusable"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
