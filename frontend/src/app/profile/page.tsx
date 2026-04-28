"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { sessionApi, authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import {
  User, Trophy, Target, Flame, BookOpen, Zap, Clock, Edit3, Save, X,
} from "lucide-react";

export default function ProfilePage() {
  const { isAuthenticated, isLoading: authLoading, user, profile, refreshUser } = useAuth();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState(30);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (user) setEditName(user.name);
    if (profile) setEditGoal(profile.daily_goal_minutes);
  }, [user, profile]);

  const { data: sessions } = useQuery({
    queryKey: ["profile-sessions"],
    queryFn: () => sessionApi.history(100),
    enabled: isAuthenticated,
  });

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

  const stats = [
    { icon: Trophy, label: "Level", value: (profile?.knowledge_level || "beginner").charAt(0).toUpperCase() + (profile?.knowledge_level || "beginner").slice(1), color: "#a78bfa" },
    { icon: Flame, label: "Current Streak", value: profile?.current_streak || 0, color: "#f59e0b" },
    { icon: Flame, label: "Longest Streak", value: profile?.longest_streak || 0, color: "#ef4444" },
    { icon: Target, label: "Accuracy", value: `${profile?.accuracy || 0}%`, color: "#22c55e" },
    { icon: Zap, label: "Total XP", value: profile?.total_xp || 0, color: "#6c63ff" },
    { icon: BookOpen, label: "Sessions", value: profile?.sessions_completed || 0, color: "#3b82f6" },
    { icon: Target, label: "Questions", value: profile?.total_questions_answered || 0, color: "#ec4899" },
    { icon: Clock, label: "Daily Goal", value: `${profile?.daily_goal_minutes || 30} min`, color: "#14b8a6" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 pt-24 pb-12">
        {/* Profile Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card-static p-6 md:p-8 mb-8">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold"
                style={{ background: "var(--gradient-primary)" }}>
                {(user?.name || "U").charAt(0).toUpperCase()}
              </div>
              <div>
                {editing ? (
                  <input value={editName} onChange={(e) => setEditName(e.target.value)}
                    className="input-field !py-2 !px-3 text-lg font-bold" style={{ maxWidth: "250px" }} />
                ) : (
                  <h1 className="text-2xl font-bold">{user?.name}</h1>
                )}
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{user?.email}</p>
                <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : ""}
                </p>
              </div>
            </div>
            <div>
              {editing ? (
                <div className="flex gap-2">
                  <button onClick={handleSave} className="btn-primary !py-2 !px-4 flex items-center gap-1 text-sm" disabled={saving}>
                    <Save className="w-4 h-4" /> Save
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-secondary !py-2 !px-4 text-sm">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setEditing(true)} className="btn-secondary !py-2 !px-4 flex items-center gap-1 text-sm">
                  <Edit3 className="w-4 h-4" /> Edit
                </button>
              )}
            </div>
          </div>

          {editing && (
            <div className="mb-4">
              <label className="block text-sm mb-1" style={{ color: "var(--text-secondary)" }}>Daily Goal (minutes)</label>
              <input type="number" value={editGoal} onChange={(e) => setEditGoal(Number(e.target.value))}
                className="input-field !py-2 !px-3" style={{ maxWidth: "150px" }} min={5} max={240} />
            </div>
          )}
        </motion.div>

        {/* Stats Grid */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="glass-card p-4 text-center">
              <s.icon className="w-5 h-5 mx-auto mb-2" style={{ color: s.color }} />
              <div className="text-xl font-bold">{s.value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
            </div>
          ))}
        </motion.div>

        {/* Session History */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-static p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" style={{ color: "var(--info)" }} />
            Full Session History
          </h3>
          {sessions && sessions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="text-left pb-3 font-medium">#</th>
                    <th className="text-left pb-3 font-medium">Date</th>
                    <th className="text-left pb-3 font-medium">Status</th>
                    <th className="text-left pb-3 font-medium">Questions</th>
                    <th className="text-left pb-3 font-medium">Accuracy</th>
                    <th className="text-left pb-3 font-medium">Reward</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s, i) => (
                    <tr key={s.session_id} style={{ borderTop: "1px solid var(--border-glass)" }}>
                      <td className="py-3" style={{ color: "var(--text-muted)" }}>{i + 1}</td>
                      <td className="py-3">{new Date(s.started_at).toLocaleDateString()}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${s.status === "completed" ? "badge-easy" : "badge-medium"}`}>{s.status}</span>
                      </td>
                      <td className="py-3">{s.questions_answered}</td>
                      <td className="py-3">{s.accuracy}%</td>
                      <td className="py-3" style={{ color: s.total_reward >= 0 ? "var(--success)" : "var(--error)" }}>
                        {s.total_reward >= 0 ? "+" : ""}{s.total_reward.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No sessions yet</p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
