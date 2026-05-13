"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import { Sparkline, LineChart, RadarChart } from "@/components/Charts";
import {
  Play, Zap, Flame, Target, BookOpen,
  TrendingUp, TrendingDown, Sparkles,
} from "lucide-react";
import Link from "next/link";

// ── Helpers ──────────────────────────────────────────────
function DifficultyBadge({ level }: { level: string }) {
  const l = (level || "").toLowerCase();
  const cls =
    l === "easy" ? "pill pill-easy" :
    l === "medium" ? "pill pill-medium" :
    l === "hard" ? "pill pill-hard" :
    "pill pill-neutral";
  return <span className={cls}>{level}</span>;
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  sparkData: number[];
  trend?: number | null;
}

function StatCard({ icon: Icon, label, value, color, sparkData, trend = null }: StatCardProps) {
  const isPositive = trend !== null && trend >= 0;
  return (
    <div className="glass glass-hover stat-card" style={{ cursor: "default" }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div className="stat-icon" style={{ background: `${color}22`, color, flexShrink: 0 }}>
          <Icon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
            {label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            {value}
          </div>
          {trend !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
              {isPositive
                ? <TrendingUp size={12} style={{ color: "var(--green)" }} />
                : <TrendingDown size={12} style={{ color: "var(--red)" }} />
              }
              <span style={{ fontSize: 11, color: isPositive ? "var(--green)" : "var(--red)", fontWeight: 500 }}>
                {isPositive ? "+" : ""}{trend}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>vs last week</span>
            </div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <Sparkline data={sparkData} color={color} height={32} />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────
export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: analyticsApi.dashboard,
    enabled: isAuthenticated,
  });

  const { data: accuracyData } = useQuery({
    queryKey: ["accuracy-trend"],
    queryFn: () => analyticsApi.accuracyTrend(30),
    enabled: isAuthenticated,
  });

  const { data: topicData } = useQuery({
    queryKey: ["topic-mastery"],
    queryFn: analyticsApi.topicMastery,
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <div className="spinner" style={{ width: 24, height: 24, borderColor: "var(--accent)", borderRightColor: "transparent" }} />
      </div>
    );
  }

  // ── Derived data ─────────────────────────────────────
  const firstName = (user?.name || "there").split(" ")[0];
  const streak = dashboard?.current_streak || 0;

  const chartAccuracyData = accuracyData && accuracyData.length > 0
    ? accuracyData.map((item) => ({ d: item.session_number, acc: item.accuracy }))
    : [
        { d: 1, acc: 52 }, { d: 2, acc: 58 }, { d: 3, acc: 55 },
        { d: 4, acc: 63 }, { d: 5, acc: 70 }, { d: 6, acc: 74 },
        { d: 7, acc: 80 },
      ];

  const radarData = topicData && topicData.length > 0
    ? topicData.map((t) => ({ topic: t.topic_name, mastery: t.mastery_score }))
    : [
        { topic: "Networking", mastery: 72 },
        { topic: "Web Sec", mastery: 58 },
        { topic: "Crypto", mastery: 45 },
        { topic: "Sys Sec", mastery: 64 },
        { topic: "Hacking", mastery: 35 },
        { topic: "Forensics", mastery: 50 },
      ];

  const weakestTopic =
    dashboard?.weak_topics?.[0]?.topic ||
    (radarData.length > 0
      ? radarData.reduce((a, b) => (a.mastery < b.mastery ? a : b)).topic
      : "Cryptography");

  // ── Render ───────────────────────────────────────────
  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 40px" }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
            <div>
              <h1 className="page-h1">Welcome back, {firstName}</h1>
              <p className="page-sub">
                {streak > 0
                  ? `${streak}-day streak — keep it up!`
                  : "Start a session to build your streak."}
              </p>
            </div>
            <Link href="/session" className="btn btn-primary">
              <Play size={16} />
              Start new session
            </Link>
          </div>

          {/* Stats grid — 4 columns */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
            <StatCard
              icon={Zap}
              label="Total XP"
              color="#3B82F6"
              value={dashboard?.total_xp ?? 0}
              sparkData={accuracyData ? accuracyData.map((d) => d.reward) : []}
            />
            <StatCard
              icon={Flame}
              label="Current Streak"
              color="#F59E0B"
              value={`${streak} days`}
              sparkData={accuracyData ? accuracyData.slice(-8).map((_, i) => i + 1) : []}
            />
            <StatCard
              icon={Target}
              label="Avg Accuracy"
              color="#10B981"
              value={`${dashboard?.overall_accuracy ?? 0}%`}
              sparkData={accuracyData ? accuracyData.map((d) => d.accuracy) : []}
            />
            <StatCard
              icon={BookOpen}
              label="Sessions"
              color="#8B5CF6"
              value={dashboard?.sessions_completed ?? 0}
              sparkData={accuracyData ? accuracyData.map((d) => d.session_number) : []}
            />
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 12 }}>
            {/* Accuracy trend */}
            <div className="glass" style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div>
                  <h2 className="section-h">Accuracy trend</h2>
                  <p style={{ fontSize: 13, color: "var(--text-2)", margin: "2px 0 0" }}>Last 7 sessions</p>
                </div>
                <span className="pill pill-blue" style={{ marginLeft: "auto" }}>+17 pts</span>
              </div>
              <LineChart
                data={chartAccuracyData}
                xKey="d"
                yKey="acc"
                color="#3B82F6"
                height={220}
                yMin={40}
                yMax={100}
              />
            </div>

            {/* Topic mastery radar */}
            <div className="glass" style={{ padding: 20 }}>
              <h2 className="section-h" style={{ marginBottom: 16 }}>Topic mastery</h2>
              <RadarChart
                data={radarData}
                valueKey="mastery"
                labelKey="topic"
                size={240}
                color="#3B82F6"
              />
            </div>
          </div>

          {/* AI recommendation banner */}
          <div
            className="glass"
            style={{
              padding: 18,
              marginBottom: 12,
              display: "flex",
              gap: 14,
              alignItems: "center",
              borderLeft: "3px solid var(--accent)",
            }}
          >
            <div
              className="stat-icon"
              style={{ background: "var(--accent-soft)", color: "var(--accent)", flexShrink: 0 }}
            >
              <Sparkles size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>
                The AI engine recommends focusing on <strong>{weakestTopic}</strong> next.
              </div>
              <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                Personalized path based on your recent performance.
              </div>
            </div>
            <Link href="/session" className="btn btn-ghost" style={{ height: 36, whiteSpace: "nowrap" }}>
              Start track →
            </Link>
          </div>

          {/* Recent sessions table */}
          <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px 12px" }}>
              <h2 className="section-h">Recent sessions</h2>
              <Link href="/analytics" className="btn btn-ghost" style={{ height: 30, fontSize: 12 }}>
                View all
              </Link>
            </div>

            {dashboard?.recent_sessions && dashboard.recent_sessions.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Topic</th>
                    <th>Score</th>
                    <th>Difficulty</th>
                    <th>XP</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent_sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.date).toLocaleDateString()}</td>
                      <td style={{ color: "var(--text-2)" }}>—</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ minWidth: 36 }}>{s.accuracy}%</span>
                          <div className="pbar" style={{ width: 80 }}>
                            <span style={{ width: `${s.accuracy}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <DifficultyBadge level={s.accuracy >= 80 ? "Easy" : s.accuracy >= 50 ? "Medium" : "Hard"} />
                      </td>
                      <td style={{ color: "var(--amber)", fontWeight: 600 }}>
                        +{Math.round(s.reward * 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "24px 20px", color: "var(--text-3)", fontSize: 14 }}>
                No sessions yet. Start your first one!
              </div>
            )}
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
