"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import { LineChart, StackedBar, Donut } from "@/components/Charts";

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<"7d" | "30d" | "all">("all");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const { data: accuracyData } = useQuery({
    queryKey: ["analytics-accuracy"],
    queryFn: () => analyticsApi.accuracyTrend(50),
    enabled: isAuthenticated,
  });

  const { data: topicData } = useQuery({
    queryKey: ["analytics-topics"],
    queryFn: analyticsApi.topicMastery,
    enabled: isAuthenticated,
  });

  const { data: dashboard } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: analyticsApi.dashboard,
    enabled: isAuthenticated,
  });

  if (authLoading) return null;

  // KPI calculations
  const totalSessions = dashboard?.sessions_completed || accuracyData?.length || 0;
  const avgAccuracy = topicData && topicData.length > 0
    ? Math.round(topicData.reduce((s: number, t: any) => s + (t.mastery_score ?? t.accuracy ?? 0), 0) / topicData.length)
    : (dashboard?.overall_accuracy ?? "--");
  const hardestTopic = topicData && topicData.length > 0
    ? [...topicData].sort((a: any, b: any) => (a.mastery_score ?? 0) - (b.mastery_score ?? 0))[0]?.topic_name ?? "--"
    : "--";

  const lineData = (accuracyData ?? []).map((item: any) => ({
    d: item.session_number,
    acc: item.accuracy,
  }));

  const topicBarData = topicData
    ? topicData.map((t: any) => ({
        topic: t.topic_name?.slice(0, 8) ?? "",
        mastery: t.mastery_score ?? 0,
        accuracy: t.accuracy ?? 0,
      }))
    : [];

  const donutData = [
    { name: "Easy", value: 38, color: "#10B981" },
    { name: "Medium", value: 44, color: "#F59E0B" },
    { name: "Hard", value: 18, color: "#EF4444" },
  ];

  const kpis = [
    { label: "Questions answered", value: dashboard?.total_questions ?? 0 },
    { label: "Avg accuracy", value: typeof avgAccuracy === "number" ? `${avgAccuracy}%` : avgAccuracy },
    { label: "Avg time / question", value: "38s" },
    { label: "Hardest topic", value: hardestTopic },
  ];

  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 40px" }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
            <div>
              <h1 className="page-h1">Analytics</h1>
              <p className="page-sub">Deep insights into your learning progress</p>
            </div>
            <div className="tabs">
              {(["7d", "30d", "all"] as const).map((t) => (
                <button key={t} className={`tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                  {t === "all" ? "All time" : t}
                </button>
              ))}
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 12 }}>
            {kpis.map((k) => (
              <div key={k.label} className="glass" style={{ padding: "18px 20px" }}>
                <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 4 }}>{k.value}</div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Charts row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            {/* Accuracy over time */}
            <div className="glass" style={{ padding: 20 }}>
              <p className="section-h" style={{ marginBottom: 16 }}>Accuracy over time</p>
              {lineData.length >= 2 ? (
                <LineChart
                  data={lineData}
                  xKey="d"
                  yKey="acc"
                  height={240}
                  yMin={0}
                  yMax={100}
                  yFormat={(v) => `${v}%`}
                />
              ) : (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 13 }}>
                  No data yet
                </div>
              )}
            </div>

            {/* Topic mastery bars */}
            <div className="glass" style={{ padding: 20 }}>
              <p className="section-h" style={{ marginBottom: 16 }}>Topic mastery</p>
              {topicData && topicData.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {topicData.map((t: any) => {
                    const score = Math.round(t.mastery_score ?? t.accuracy ?? 0);
                    const color = score >= 80 ? "var(--green)" : score >= 60 ? "var(--amber)" : "var(--red)";
                    const pbarClass = score >= 80 ? "pbar green" : score >= 60 ? "pbar amber" : "pbar";
                    return (
                      <div key={t.topic_name}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                          <span style={{ color: "var(--text-2)" }}>{t.topic_name}</span>
                          <span style={{ color, fontWeight: 600 }}>{score}%</span>
                        </div>
                        <div className={pbarClass}>
                          <span style={{ width: `${score}%`, ...(score < 60 ? { background: `linear-gradient(90deg, ${color}, #f87171)` } : {}) }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ height: 240, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 13 }}>
                  No data yet
                </div>
              )}
            </div>
          </div>

          {/* Charts row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
            {/* Topic breakdown stacked bar */}
            <div className="glass" style={{ padding: 20 }}>
              <p className="section-h" style={{ marginBottom: 16 }}>Topic breakdown</p>
              {topicBarData.length >= 2 ? (
                <StackedBar
                  data={topicBarData}
                  keys={["mastery", "accuracy"]}
                  colors={["#3B82F6", "#8B5CF6"]}
                  xKey="topic"
                  height={220}
                />
              ) : topicData && topicData.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {topicData.map((t: any) => {
                    const score = Math.round(t.mastery_score ?? t.accuracy ?? 0);
                    return (
                      <div key={t.topic_name}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                          <span style={{ color: "var(--text-2)" }}>{t.topic_name}</span>
                          <span style={{ color: "var(--text)", fontWeight: 600 }}>{score}%</span>
                        </div>
                        <div className="pbar"><span style={{ width: `${score}%` }} /></div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 13 }}>
                  No data yet
                </div>
              )}
            </div>

            {/* Difficulty distribution donut */}
            <div className="glass" style={{ padding: 20 }}>
              <p className="section-h" style={{ marginBottom: 16 }}>Difficulty distribution</p>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div style={{ flex: "0 0 160px" }}>
                  <Donut data={donutData} size={160} thickness={28} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {donutData.map((d) => (
                    <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 999, background: d.color, flexShrink: 0 }} />
                      <span style={{ color: "var(--text-2)", minWidth: 56 }}>{d.name}</span>
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>{d.value}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
