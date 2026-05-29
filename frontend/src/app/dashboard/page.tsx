"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { analyticsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";
import AppLayout from "@/components/AppLayout";
import { LineChart, RadarChart } from "@/components/Charts";
import {
  Play, Zap, Flame, Target, BookOpen,
  TrendingUp, TrendingDown, Sparkles, Activity,
} from "lucide-react";
import Link from "next/link";

// Mirrors backend ``_normalize_topic``: lowercase, collapse runs of whitespace
// or underscores into a single hyphen, trim leading/trailing hyphens. Used as
// a fallback when the backend response predates the ``topic_slug`` field.
function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  tint: string;
  glow?: boolean;
  index: number;
}

function KpiCard({ icon: Icon, label, value, color, tint, glow = false, index }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.4, 0, 0.2, 1] }}
      className="kpi-card"
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div
          style={{
            width: 40, height: 40, borderRadius: 12,
            display: "grid", placeItems: "center",
            background: tint, color, flexShrink: 0,
            boxShadow: glow ? `0 0 18px ${tint}` : "none",
          }}
        >
          <Icon size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 11, fontWeight: 600, color: "var(--text-3)",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
            }}
          >
            {label}
          </div>
          <div
            className={glow ? "streak-fire" : undefined}
            style={{
              fontSize: 28, fontWeight: 600, lineHeight: 1.1,
              letterSpacing: "-0.02em", color: "var(--text)",
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ─────────────────────────────────────────────────
export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const { data: dashboard, isLoading, error: dashboardError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: analyticsApi.dashboard,
    enabled: isAuthenticated,
  });

  const { data: accuracyData, error: accuracyError } = useQuery({
    queryKey: ["accuracy-trend"],
    queryFn: () => analyticsApi.accuracyTrend(30),
    enabled: isAuthenticated,
  });

  const { data: topicData, error: topicError } = useQuery({
    queryKey: ["topic-mastery"],
    queryFn: analyticsApi.topicMastery,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (dashboardError) toast.error("Failed to load dashboard");
    if (accuracyError) toast.error("Failed to load accuracy trend");
    if (topicError) toast.error("Failed to load topic mastery");
  }, [dashboardError, accuracyError, topicError, toast]);

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

  const chartAccuracyData = (accuracyData ?? []).map((item) => ({
    d: item.session_number,
    acc: item.accuracy,
  }));

  const radarData = (topicData ?? []).map((t) => ({
    topic: t.topic_name,
    mastery: t.mastery_score,
  }));

  // Compute trend over last 7 sessions
  const last7 = (accuracyData ?? []).slice(-7);
  const trendDelta = last7.length >= 2
    ? Math.round(last7[last7.length - 1].accuracy - last7[0].accuracy)
    : null;

  const weakestEntry = dashboard?.weak_topics?.[0];
  const weakestRadar = radarData.length > 0
    ? radarData.reduce((a, b) => (a.mastery < b.mastery ? a : b))
    : null;

  // Title is for display, slug is for routing. Backend now returns topic_slug;
  // fall back to slugify(title) for older payloads.
  const weakestTitle: string | null =
    weakestEntry?.topic ?? weakestRadar?.topic ?? null;
  const weakestSlug: string | null = weakestTitle
    ? (weakestEntry?.topic_slug ?? slugify(weakestTitle))
    : null;

  const trackHref = weakestSlug
    ? `/session?topic=${encodeURIComponent(weakestSlug)}`
    : "/session";

  // ── Render ───────────────────────────────────────────
  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%", position: "relative" }}>
        <div className="aurora" aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0 }} />
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 40px", position: "relative", zIndex: 1 }}>

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
            <div>
              <h1 className="page-h1">Welcome back, {firstName}</h1>
              <p className="page-sub">
                {streak > 0
                  ? `${streak}-day streak — keep it up.`
                  : "Start a session to build your streak."}
              </p>
            </div>
            <Link href="/session" className="btn btn-primary">
              <Play size={16} />
              Start new session
            </Link>
          </div>

          {/* KPI grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 18 }}>
            <KpiCard
              index={0}
              icon={Zap}
              label="Total XP"
              color="#3B82F6"
              tint="rgba(59,130,246,0.12)"
              value={dashboard?.total_xp ?? 0}
            />
            <KpiCard
              index={1}
              icon={Flame}
              label="Current Streak"
              color="#F59E0B"
              tint="rgba(245,158,11,0.15)"
              glow={streak > 0}
              value={`${streak} ${streak === 1 ? "day" : "days"}`}
            />
            <KpiCard
              index={2}
              icon={Target}
              label="Avg Accuracy"
              color="#10B981"
              tint="rgba(16,185,129,0.12)"
              value={`${dashboard?.overall_accuracy ?? 0}%`}
            />
            <KpiCard
              index={3}
              icon={BookOpen}
              label="Sessions"
              color="#8B5CF6"
              tint="rgba(139,92,246,0.14)"
              value={dashboard?.sessions_completed ?? 0}
            />
          </div>

          {/* Charts row */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 14 }}
          >
            {/* Accuracy trend */}
            <div className="glass" style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Activity size={16} style={{ color: "var(--accent)" }} />
                  <div>
                    <h2 className="section-h">Accuracy trend</h2>
                    <p style={{ fontSize: 12, color: "var(--text-3)", margin: "2px 0 0" }}>
                      Last {Math.min(7, last7.length) || 0} sessions
                    </p>
                  </div>
                </div>
                {trendDelta !== null && (
                  <span
                    className={`pill ${trendDelta >= 0 ? "pill-blue" : "pill-hard"}`}
                    style={{ marginLeft: "auto", gap: 4 }}
                  >
                    {trendDelta >= 0
                      ? <TrendingUp size={11} />
                      : <TrendingDown size={11} />
                    }
                    {trendDelta >= 0 ? `+${trendDelta} pts` : `${trendDelta} pts`}
                  </span>
                )}
              </div>
              {chartAccuracyData.length > 0 ? (
                <LineChart
                  data={chartAccuracyData}
                  xKey="d"
                  yKey="acc"
                  color="#3B82F6"
                  height={220}
                  yMin={40}
                  yMax={100}
                />
              ) : (
                <div style={{
                  height: 220, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "0 20px",
                }}>
                  No sessions yet — start one to see your trend
                </div>
              )}
            </div>

            {/* Topic mastery radar */}
            <div className="glass" style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <Target size={16} style={{ color: "var(--violet)" }} />
                <h2 className="section-h">Topic mastery</h2>
              </div>
              {radarData.length > 0 ? (
                <RadarChart
                  data={radarData}
                  valueKey="mastery"
                  labelKey="topic"
                  size={240}
                  color="#3B82F6"
                />
              ) : (
                <div style={{
                  height: 240, display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "0 20px",
                }}>
                  Practice topics to build mastery
                </div>
              )}
            </div>
          </motion.div>

          {/* AI recommendation banner */}
          {weakestTitle && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
              className="cyber-border"
              style={{
                padding: 18,
                marginBottom: 14,
                display: "flex",
                gap: 14,
                alignItems: "center",
              }}
            >
              <div
                style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  display: "grid", placeItems: "center",
                  background: "var(--accent-soft)", color: "var(--accent)",
                  animation: "pulse-glow 3s ease-in-out infinite",
                }}
              >
                <Sparkles size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: "var(--text)" }}>
                  The AI engine recommends focusing on <strong>{weakestTitle}</strong> next.
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>
                  Personalized path based on your recent performance.
                </div>
              </div>
              <Link href={trackHref} className="btn btn-primary" style={{ height: 36, whiteSpace: "nowrap" }}>
                Start track →
              </Link>
            </motion.div>
          )}

          {/* Recent sessions table */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35 }}
            className="glass"
            style={{ padding: 0, overflow: "hidden" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className="live-dot" />
                <h2 className="section-h">Recent sessions</h2>
              </div>
              <Link href="/analytics" className="btn btn-ghost" style={{ height: 30, fontSize: 12 }}>
                View all
              </Link>
            </div>

            {dashboard?.recent_sessions && dashboard.recent_sessions.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Score</th>
                    <th>Difficulty</th>
                    <th style={{ textAlign: "right" }}>XP</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent_sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{new Date(s.date).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ minWidth: 36, fontVariantNumeric: "tabular-nums" }}>{s.accuracy}%</span>
                          <div
                            className={s.accuracy >= 80 ? "pbar green" : s.accuracy >= 50 ? "pbar amber" : "pbar"}
                            style={{ width: 90, height: 5 }}
                          >
                            <span style={{ width: `${Math.max(0, Math.min(100, s.accuracy))}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <DifficultyBadge level={s.accuracy >= 80 ? "Easy" : s.accuracy >= 50 ? "Medium" : "Hard"} />
                      </td>
                      <td style={{ color: "var(--amber)", fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        +{Math.round(s.reward * 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "32px 20px", color: "var(--text-3)", fontSize: 14, textAlign: "center" }}>
                No sessions yet. Start your first one!
              </div>
            )}
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
