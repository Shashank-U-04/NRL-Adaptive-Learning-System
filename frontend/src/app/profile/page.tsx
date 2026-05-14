"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import {
  Zap, Flame, Target, BookOpen, Edit3, Save, X, Lock,
} from "lucide-react";

function initials(name?: string): string {
  return (name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProfilePage() {
  const { isAuthenticated, isLoading: authLoading, user, profile, refreshUser } = useAuth();
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editGoal, setEditGoal] = useState(30);
  const [saving, setSaving] = useState(false);

  // Password state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  // Notification toggles
  const [notifs, setNotifs] = useState({
    daily: true,
    streak: true,
    weekly: false,
    leaderboard: false,
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const startEditing = () => {
    setEditName(user?.name ?? "");
    setEditEmail(user?.email ?? "");
    setEditGoal(profile?.daily_goal_minutes ?? 30);
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await authApi.updateProfile({ name: editName, daily_goal_minutes: editGoal });
      await refreshUser();
      setEditing(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (authLoading) return null;

  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "";
  const level = (profile?.knowledge_level ?? "beginner");
  const levelDisplay = level.charAt(0).toUpperCase() + level.slice(1);

  const stats = [
    {
      icon: Zap,
      color: "var(--accent)",
      bg: "rgba(59,130,246,0.12)",
      label: "TOTAL XP",
      value: profile?.total_xp ?? 0,
    },
    {
      icon: Flame,
      color: "var(--amber)",
      bg: "rgba(245,158,11,0.12)",
      label: "STREAK",
      value: `${profile?.current_streak ?? 0}d`,
    },
    {
      icon: Target,
      color: "var(--green)",
      bg: "rgba(16,185,129,0.12)",
      label: "ACCURACY",
      value: `${(profile?.accuracy ?? 0).toFixed(0)}%`,
    },
    {
      icon: BookOpen,
      color: "var(--violet)",
      bg: "rgba(139,92,246,0.12)",
      label: "SESSIONS",
      value: profile?.sessions_completed ?? 0,
    },
  ];

  const notifRows: { key: keyof typeof notifs; label: string; desc: string }[] = [
    { key: "daily", label: "Daily reminders", desc: "Get notified at your preferred study time" },
    { key: "streak", label: "Streak alerts", desc: "Reminders to keep your streak alive" },
    { key: "weekly", label: "Weekly digest", desc: "Summary of your progress every Sunday" },
    { key: "leaderboard", label: "Leaderboard updates", desc: "When your rank changes" },
  ];

  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 32px 40px" }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 className="page-h1">Profile</h1>
            <p className="page-sub">Manage your account, notifications, and security.</p>
          </div>

          {/* Identity card */}
          <div className="glass" style={{ padding: 24, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              {/* Avatar */}
              <div
                className="avatar"
                style={{
                  width: 64,
                  height: 64,
                  fontSize: 20,
                  fontWeight: 600,
                  background: "linear-gradient(135deg, var(--accent), #6aa6ff)",
                  flexShrink: 0,
                }}
              >
                {initials(user?.name)}
              </div>

              {/* Name / email */}
              <div style={{ flex: 1 }}>
                {editing ? (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <input
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Display name"
                    />
                    <input
                      className="input"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="Email"
                      type="email"
                    />
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>{user?.name}</div>
                    <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 2 }}>{user?.email}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                      {joinDate && `Joined ${joinDate} · `}{levelDisplay}
                    </div>
                  </>
                )}
              </div>

              {/* Edit / save buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                {editing ? (
                  <>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      <Save style={{ width: 14, height: 14 }} />
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setEditing(false)}>
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </>
                ) : (
                  <button className="btn btn-ghost" onClick={startEditing}>
                    <Edit3 style={{ width: 14, height: 14 }} /> Edit
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
            {stats.map((s) => (
              <div key={s.label} className="glass" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: s.bg,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  <s.icon style={{ width: 16, height: 16, color: s.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Notifications card */}
          <div className="glass" style={{ padding: 20, marginBottom: 12 }}>
            <p className="section-h" style={{ marginBottom: 12 }}>Notifications</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              {notifRows.map((row, i) => (
                <div
                  key={row.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: i < notifRows.length - 1 ? "1px solid var(--line)" : undefined,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{row.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{row.desc}</div>
                  </div>
                  <div
                    className={`switch${notifs[row.key] ? " on" : ""}`}
                    onClick={() => setNotifs((n) => ({ ...n, [row.key]: !n[row.key] }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Password card */}
          <div className="glass" style={{ padding: 20, marginBottom: 12 }}>
            <p className="section-h" style={{ marginBottom: 14 }}>Change password</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
              <div className="field">
                <label className="field-label">Current password</label>
                <input
                  className="input"
                  type="password"
                  value={currentPw}
                  onChange={(e) => setCurrentPw(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="field">
                <label className="field-label">New password</label>
                <input
                  className="input"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <div className="field">
                <label className="field-label">Confirm new password</label>
                <input
                  className="input"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-primary">
                <Lock style={{ width: 14, height: 14 }} /> Update password
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="glass" style={{ padding: 20, borderColor: "rgba(239,68,68,0.2)" }}>
            <p className="section-h" style={{ color: "var(--red)", marginBottom: 8 }}>Danger zone</p>
            <p style={{ color: "var(--text-2)", fontSize: 13, marginBottom: 16 }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button className="btn btn-danger">Delete account</button>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
