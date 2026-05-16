"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast";
import AppLayout from "@/components/AppLayout";
import {
  Zap, Flame, Target, BookOpen, Edit3, Save, X, Lock,
} from "lucide-react";

type NotifKey = "daily" | "streak" | "weekly" | "leaderboard";
type NotifPrefs = Record<NotifKey, boolean>;

const DEFAULT_NOTIFS: NotifPrefs = {
  daily: true,
  streak: true,
  weekly: false,
  leaderboard: false,
};

const NOTIF_ROWS: { key: NotifKey; label: string; desc: string }[] = [
  { key: "daily", label: "Daily reminders", desc: "Get notified at your preferred study time" },
  { key: "streak", label: "Streak alerts", desc: "Reminders to keep your streak alive" },
  { key: "weekly", label: "Weekly digest", desc: "Summary of your progress every Sunday" },
  { key: "leaderboard", label: "Leaderboard updates", desc: "When your rank changes" },
];

function initials(name?: string): string {
  return (name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function isValidNotifs(value: unknown): value is NotifPrefs {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (["daily", "streak", "weekly", "leaderboard"] as NotifKey[]).every(
    (k) => typeof v[k] === "boolean",
  );
}

export default function ProfilePage() {
  const { isAuthenticated, isLoading: authLoading, user, profile, refreshUser } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState(30);
  const [saving, setSaving] = useState(false);

  // Password state
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [updatingPw, setUpdatingPw] = useState(false);

  // Notification toggles
  const [notifs, setNotifs] = useState<NotifPrefs>(DEFAULT_NOTIFS);
  const [savingNotif, setSavingNotif] = useState<NotifKey | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  // Load saved notification prefs from Supabase user_metadata on mount
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const stored = data.user?.user_metadata?.notif_prefs;
      if (isValidNotifs(stored)) {
        setNotifs(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startEditing = () => {
    setEditName(user?.name ?? "");
    setEditGoal(profile?.daily_goal_minutes ?? 30);
    setEditing(true);
  };

  const handleSave = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Display name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      await authApi.updateProfile({ name: trimmed, daily_goal_minutes: editGoal });
      // Also sync the name into Supabase user_metadata so the UI is consistent across sessions
      await supabase.auth.updateUser({ data: { full_name: trimmed, name: trimmed } });
      await refreshUser();
      toast.success("Profile updated");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleNotifToggle = async (key: NotifKey) => {
    const next: NotifPrefs = { ...notifs, [key]: !notifs[key] };
    const previous = notifs;
    setNotifs(next);                  // optimistic
    setSavingNotif(key);
    const { error } = await supabase.auth.updateUser({ data: { notif_prefs: next } });
    setSavingNotif(null);
    if (error) {
      setNotifs(previous);            // rollback
      toast.error(error.message || "Could not save notification preference");
    }
  };

  const handlePasswordUpdate = async () => {
    if (newPw.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Passwords do not match");
      return;
    }
    setUpdatingPw(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setUpdatingPw(false);
    if (error) {
      toast.error(error.message || "Could not update password");
      return;
    }
    setNewPw("");
    setConfirmPw("");
    toast.success("Password updated");
  };

  if (authLoading) return null;

  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "";
  const level = profile?.knowledge_level ?? "beginner";
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

              <div style={{ flex: 1 }}>
                {editing ? (
                  <div className="field" style={{ maxWidth: 360 }}>
                    <label className="field-label">Display name</label>
                    <input
                      className="input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Your name"
                      maxLength={64}
                      autoFocus
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

              <div style={{ display: "flex", gap: 8 }}>
                {editing ? (
                  <>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                      <Save style={{ width: 14, height: 14 }} />
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                      aria-label="Cancel editing"
                    >
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

            {editing && (
              <div className="field" style={{ marginTop: 16, maxWidth: 220 }}>
                <label className="field-label">Daily goal (minutes)</label>
                <input
                  className="input"
                  type="number"
                  min={5}
                  max={240}
                  value={editGoal}
                  onChange={(e) => setEditGoal(Math.max(5, Math.min(240, Number(e.target.value) || 30)))}
                />
              </div>
            )}
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
              {NOTIF_ROWS.map((row, i) => (
                <div
                  key={row.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: i < NOTIF_ROWS.length - 1 ? "1px solid var(--line)" : undefined,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{row.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{row.desc}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifs[row.key]}
                    aria-label={row.label}
                    disabled={savingNotif === row.key}
                    onClick={() => handleNotifToggle(row.key)}
                    className={`switch${notifs[row.key] ? " on" : ""}`}
                    style={{
                      border: "none",
                      padding: 0,
                      opacity: savingNotif === row.key ? 0.6 : 1,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Password card */}
          <div className="glass" style={{ padding: 20, marginBottom: 12 }}>
            <p className="section-h" style={{ marginBottom: 14 }}>Change password</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div className="field">
                <label className="field-label">New password</label>
                <input
                  className="input"
                  type="password"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="field">
                <label className="field-label">Confirm new password</label>
                <input
                  className="input"
                  type="password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                className="btn btn-primary"
                onClick={handlePasswordUpdate}
                disabled={updatingPw || !newPw || !confirmPw}
              >
                <Lock style={{ width: 14, height: 14 }} />
                {updatingPw ? "Updating…" : "Update password"}
              </button>
            </div>
          </div>

          {/* Danger zone */}
          <div className="glass" style={{ padding: 20, borderColor: "rgba(239,68,68,0.2)" }}>
            <p className="section-h" style={{ color: "var(--red)", marginBottom: 8 }}>Danger zone</p>
            <p style={{ color: "var(--text-2)", fontSize: 13, marginBottom: 16 }}>
              Account deletion is handled by support. Email us if you need to permanently remove your account
              and all associated learning data.
            </p>
            <a
              className="btn btn-danger"
              href="mailto:support@nrl.dev?subject=Account%20deletion%20request"
              style={{ textDecoration: "none" }}
            >
              Request account deletion
            </a>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
