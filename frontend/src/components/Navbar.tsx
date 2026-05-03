"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { motion } from "framer-motion";
import { Brain, LogOut, LayoutDashboard, BarChart3, Trophy, User, Menu, X, Play, BookOpen } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => { logout(); router.push("/"); };

  const navLinks = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/learning", icon: BookOpen, label: "Learning" },
    { href: "/session", icon: Play, label: "Quiz" },
    { href: "/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/leaderboard", icon: Trophy, label: "Leaderboard" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <motion.nav initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      className="fixed top-0 left-0 right-0 z-50 glass-card-static"
      style={{ borderRadius: 0, borderTop: "none", borderLeft: "none", borderRight: "none" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--gradient-primary)" }}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold">NRL Adaptive Learning System</span>
          </Link>

          <div className="hidden md:flex items-center gap-5">
            {isAuthenticated ? (
              <>
                {navLinks.map((l) => (
                  <Link key={l.href} href={l.href}
                    className="flex items-center gap-1.5 text-sm transition-colors hover:text-white"
                    style={{ color: "var(--text-secondary)" }}>
                    <l.icon className="w-4 h-4" /> {l.label}
                  </Link>
                ))}
                <div className="flex items-center gap-3 ml-3 pl-3" style={{ borderLeft: "1px solid var(--border-glass)" }}>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{user?.name}</span>
                  <button onClick={handleLogout} className="hover:text-red-400 transition-colors" style={{ color: "var(--text-muted)" }}>
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm" style={{ color: "var(--text-secondary)" }}>Sign In</Link>
                <Link href="/register" className="btn-primary text-sm !py-2 !px-5">Get Started</Link>
              </>
            )}
          </div>

          <button className="md:hidden" onClick={() => setMobileOpen(!mobileOpen)} style={{ color: "var(--text-secondary)" }}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="md:hidden px-4 pb-4 space-y-2" style={{ borderTop: "1px solid var(--border-glass)" }}>
          {isAuthenticated ? (
            <>
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href} className="block py-2 text-sm" style={{ color: "var(--text-secondary)" }}
                  onClick={() => setMobileOpen(false)}>{l.label}</Link>
              ))}
              <button onClick={handleLogout} className="block py-2 text-sm text-red-400">Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="block py-2 text-sm" style={{ color: "var(--text-secondary)" }} onClick={() => setMobileOpen(false)}>Sign In</Link>
              <Link href="/register" className="block btn-primary text-sm text-center" onClick={() => setMobileOpen(false)}>Get Started</Link>
            </>
          )}
        </motion.div>
      )}
    </motion.nav>
  );
}
