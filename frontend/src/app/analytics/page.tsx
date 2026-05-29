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
import { LineChart } from "@/components/Charts";
import {
  Activity, Target, BookOpen, Zap, AlertTriangle, ArrowRight,
} from "lucide-react";
import Link from "next/link";

// Slugify a topic title for fallback when the backend doesn't return topic_slug.
// Mirrors backend `_normalize_topic`: lowercase, collapse whitespace/underscore
// runs to single hyphens, trim leading/trailing hyphens.
function slugify(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface AnalyticsKpiProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  tint: string;
  index: number;
}

function AnalyticsKpi({ icon: Icon, label, value, color, tint, index }: AnalyticsKpiProps) {
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
            style={{
              fontSize: 26, fontWeight: 600, lineHeight: 1.1,
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

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const { data: accuracyData, error: accuracyError } = useQuery({
    queryKey: ["analytics-accuracy"],
    queryFn: () => analyticsApi.accuracyTrend(50),
    enabled: isAuthenticated,
  });

  const { data: topicData, error: topicError } = useQuery({
    queryKey: ["analytics-topics"],
    queryFn: analyticsApi.topicMastery,
    enabled: isAuthenticated,
  });

  const { data: dashboard, error: dashboardError } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: analyticsApi.dashboard,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (accuracyError) toast.error("Failed to load accuracy data");
    if (topicError) toast.error("Failed to load topic data");
    if (dashboardError) toast.error("Failed to load analytics");
  }, [accuracyError, topicError, dashboardError, toast]);

  if (authLoading) return null;

  // ── Derived ─────────────────────────────────────────
  const lineData = (accuracyData ?? []).map((item) => ({
    d: item.session_number,
    acc: item.accuracy,
  }));

  const sortedTopics = (topicData ?? [])
    .slice()
    .sort((a, b) => (b.mastery_score ?? 0) - (a.mastery_score ?? 0));

  const weakTopics = (dashboard?.weak_topics ?? []).slice(0, 3);

  const kpis = [
    {
      icon: BookOpen,
      label: "Total questions",
      value: dashboard?.total_questions ?? 0,
      color: "#3B82F6",
      tint: "rgba(59,130,246,0.12)",
    },
    {
      icon: Target,
      label: "Overall accuracy",
      value: `${dashboard?.overall_accuracy ?? 0}%`,
      color: "#10B981",
      tint: "rgba(16,185,129,0.12)",
    },
    {
      icon: Activity,
      label: "Sessions completed",
      value: dashboard?.sessions_completed ?? 0,
      color: "#8B5CF6",
      tint: "rgba(139,92,246,0.14)",
    },
    {
      icon: Zap,
      label: "Current level",
      value: dashboard?.knowledge_level ?? "—",
      color: "#F59E0B",
      tint: "rgba(245,158,11,0.15)",
    },
  ];

  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%", position: "relative" }}>
        <div className="aurora" aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0 }} />
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 40px", position: "relative", zIndex: 1 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
            <div>
              <h1 className="page-h1">Analytics</h1>
              <p className="page-sub" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                Detailed performance breakdown
                <span style={{ color: "var(--text-3)" }}>·</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <span className="live-dot" /> Updated in real time
                </span>
              </p>
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
            {kpis.map((k, i) => (
              <AnalyticsKpi
                key={k.label}
                index={i}
                icon={k.icon}
                label={k.label}
                value={k.value}
                color={k.color}
                tint={k.tint}
              />
            ))}
          </div>

          {/* Main accuracy chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4 }}
            className="glass"
            style={{ padding: 22, marginBottom: 14 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Activity size={16} style={{ color: "var(--accent)" }} />
              <div>
                <h2 className="section-h">Accuracy over time</h2>
                <p style={{ fontSize: 12, color: "var(--text-3)", margin: "2px 0 0" }}>
                  {lineData.length > 0
                    ? `${lineData.length} session${lineData.length === 1 ? "" : "s"} tracked`
                    : "No data yet"}
                </p>
              </div>
            </div>
            {lineData.length >= 2 ? (
              <LineChart
                data={lineData}
                xKey="d"
                yKey="acc"
                color="#3B82F6"
                height={300}
                yMin={0}
                yMax={100}
                yFormat={(v) => `${v}%`}
              />
            ) : (
              <div style={{
                height: 300, display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-3)", fontSize: 13, textAlign: "center",
              }}>
                Complete at least 2 sessions to see your accuracy trend
              </div>
            )}
          </motion.div>

          {/* Weak topics callout */}
          {weakTopics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
              style={{ marginBottom: 14 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <AlertTriangle size={16} style={{ color: "var(--amber)" }} />
                <h2 className="section-h">Focus areas</h2>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  Topics where you can improve fastest
                </span>
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${weakTopics.length}, 1fr)`,
                gap: 14,
              }}>
                {weakTopics.map((wt) => (
                  <div
                    key={wt.topic}
                    className="glass glass-hover"
                    style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span className="pill pill-amber" style={{ gap: 6 }}>
                        <AlertTriangle size={11} />
                        Weak
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {wt.attempted} attempted
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
                        {wt.topic}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="pbar amber" style={{ flex: 1, height: 5 }}>
                          <span style={{ width: `${Math.max(0, Math.min(100, Math.round(wt.mastery)))}%` }} />
                        </div>
                        <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {Math.round(wt.mastery)}%
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/session?topic=${encodeURIComponent(
                        wt.topic_slug ?? slugify(wt.topic),
                      )}`}
                      className="btn btn-ghost"
                      style={{ height: 34, fontSize: 13 }}
                    >
                      Focus <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Topic mastery bar list */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.35 }}
            className="glass"
            style={{ padding: 22 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <Target size={16} style={{ color: "var(--violet)" }} />
              <h2 className="section-h">Topic mastery</h2>
              <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: "auto" }}>
                Sorted by mastery
              </span>
            </div>
            {sortedTopics.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {sortedTopics.map((t) => {
                  const score = Math.round(t.mastery_score ?? 0);
                  const acc = Math.round(t.accuracy ?? 0);
                  const pbarClass =
                    score >= 80 ? "pbar green" :
                    score >= 60 ? "pbar amber" :
                    "pbar";
                  const scoreColor =
                    score >= 80 ? "var(--green)" :
                    score >= 60 ? "var(--amber)" :
                    "var(--red)";
                  return (
                    <div
                      key={t.topic_name}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(140px, 1.2fr) 2fr 80px",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>
                        {t.topic_name}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className={pbarClass} style={{ flex: 1, height: 6 }}>
                          <span style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                        </div>
                        <span
                          style={{
                            fontSize: 12, fontWeight: 600, color: scoreColor,
                            minWidth: 38, textAlign: "right", fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {score}%
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 12, color: "var(--text-2)", textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {acc}% acc
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                height: 200, display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--text-3)", fontSize: 13, textAlign: "center",
              }}>
                Practice topics to build mastery data
              </div>
            )}
          </motion.div>

        </div>
      </div>
    </AppLayout>
  );
}
