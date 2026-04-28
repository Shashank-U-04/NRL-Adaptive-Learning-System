"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { analyticsApi, sessionApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Cell,
} from "recharts";
import { BarChart3, TrendingUp, Target, Clock, CheckCircle2 } from "lucide-react";

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

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

  const { data: sessions } = useQuery({
    queryKey: ["analytics-sessions"],
    queryFn: () => sessionApi.history(50),
    enabled: isAuthenticated,
  });

  const { data: dashboard } = useQuery({
    queryKey: ["analytics-dashboard"],
    queryFn: analyticsApi.dashboard,
    enabled: isAuthenticated,
  });

  if (authLoading) return null;

  const COLORS = ["#6c63ff", "#a78bfa", "#22c55e", "#f59e0b", "#ec4899", "#3b82f6"];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <BarChart3 className="w-8 h-8" style={{ color: "var(--accent-primary)" }} />
            Analytics
          </h1>
          <p style={{ color: "var(--text-secondary)" }}>Deep insights into your learning progress</p>
        </motion.div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: CheckCircle2, label: "Overall Accuracy", value: `${dashboard?.overall_accuracy || 0}%`, color: "#22c55e" },
            { icon: Target, label: "Sessions", value: dashboard?.sessions_completed || 0, color: "#6c63ff" },
            { icon: TrendingUp, label: "Total XP", value: dashboard?.total_xp || 0, color: "#f59e0b" },
            { icon: Clock, label: "Questions Answered", value: dashboard?.total_questions || 0, color: "#3b82f6" },
          ].map((s) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="glass-card p-5">
              <s.icon className="w-5 h-5 mb-2" style={{ color: s.color }} />
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accuracy Over Time */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-static p-6">
            <h3 className="text-lg font-semibold mb-4">Accuracy Over Time</h3>
            {accuracyData && accuracyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={accuracyData}>
                  <defs>
                    <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6c63ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6c63ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="session_number" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} domain={[0, 100]} />
                  <Tooltip contentStyle={{
                    background: "rgba(18,18,26,0.95)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px", color: "#f0f0f5",
                  }} />
                  <Area type="monotone" dataKey="accuracy" stroke="#6c63ff" fill="url(#accGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                No data yet
              </div>
            )}
          </motion.div>

          {/* Reward Trend */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-static p-6">
            <h3 className="text-lg font-semibold mb-4">Reward Progression</h3>
            {accuracyData && accuracyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={accuracyData}>
                  <defs>
                    <linearGradient id="rewGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="session_number" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{
                    background: "rgba(18,18,26,0.95)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px", color: "#f0f0f5",
                  }} />
                  <Area type="monotone" dataKey="reward" stroke="#22c55e" fill="url(#rewGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                No data yet
              </div>
            )}
          </motion.div>

          {/* Topic Mastery Radar */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-static p-6">
            <h3 className="text-lg font-semibold mb-4">Topic Mastery</h3>
            {topicData && topicData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={topicData}>
                  <PolarGrid stroke="rgba(255,255,255,0.08)" />
                  <PolarAngleAxis dataKey="topic_name" stroke="var(--text-muted)" fontSize={12} />
                  <PolarRadiusAxis stroke="var(--text-muted)" fontSize={10} domain={[0, 100]} />
                  <Radar dataKey="mastery_score" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.25} strokeWidth={2} />
                  <Radar dataKey="accuracy" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} strokeWidth={2} strokeDasharray="5 5" />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                No data yet
              </div>
            )}
          </motion.div>

          {/* Per-Topic Bar Chart */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-static p-6">
            <h3 className="text-lg font-semibold mb-4">Questions by Topic</h3>
            {topicData && topicData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topicData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="topic_name" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip contentStyle={{
                    background: "rgba(18,18,26,0.95)", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px", color: "#f0f0f5",
                  }} />
                  <Bar dataKey="questions_attempted" radius={[6, 6, 0, 0]}>
                    {topicData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center" style={{ color: "var(--text-muted)" }}>
                No data yet
              </div>
            )}
          </motion.div>
        </div>

        {/* Session History Table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card-static p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4">All Sessions</h3>
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
                        <span className={`px-2 py-0.5 rounded-full text-xs ${
                          s.status === "completed" ? "badge-easy" : "badge-medium"
                        }`}>{s.status}</span>
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
