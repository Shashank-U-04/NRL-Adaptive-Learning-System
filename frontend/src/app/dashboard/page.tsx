"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { analyticsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import {
  Flame, Trophy, Target, BookOpen, Zap, TrendingUp, Play,
  Brain, AlertTriangle, Clock,
} from "lucide-react";
import Link from "next/link";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, profile } = useAuth();
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
             style={{ borderColor: "var(--accent-primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const stats = [
    {
      icon: Trophy, label: "Level",
      value: (dashboard?.knowledge_level || "beginner").charAt(0).toUpperCase() +
             (dashboard?.knowledge_level || "beginner").slice(1),
      color: "#a78bfa",
    },
    { icon: Flame, label: "Streak", value: dashboard?.current_streak || 0, color: "#f59e0b", fire: true },
    { icon: Target, label: "Accuracy", value: `${dashboard?.overall_accuracy || 0}%`, color: "#22c55e" },
    { icon: Zap, label: "XP", value: dashboard?.total_xp || 0, color: "#6c63ff" },
    { icon: BookOpen, label: "Sessions", value: dashboard?.sessions_completed || 0, color: "#3b82f6" },
    { icon: TrendingUp, label: "Questions", value: dashboard?.total_questions || 0, color: "#ec4899" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Dashboard</h1>
            <p style={{ color: "var(--text-secondary)" }}>Your learning progress at a glance</p>
          </div>
          <Link href="/session" className="btn-primary flex items-center gap-2">
            <Play className="w-5 h-5" /> Start Session
          </Link>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={stagger} initial="hidden" animate="show"
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {stats.map((s) => (
            <motion.div key={s.label} variants={fadeUp}
                        className="glass-card p-4 text-center">
              <s.icon className="w-5 h-5 mx-auto mb-2" style={{ color: s.color }} />
              <div className={`text-2xl font-bold mb-1 ${s.fire ? "streak-fire" : ""}`}>
                {s.fire && (dashboard?.current_streak || 0) > 0 ? "🔥 " : ""}
                {s.value}
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Accuracy Trend Chart */}
          <motion.div variants={fadeUp} initial="hidden" animate="show"
                      className="glass-card-static p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: "var(--accent-primary)" }} />
              Accuracy Trend
            </h3>
            {accuracyData && accuracyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={accuracyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="session_number" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(18,18,26,0.95)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "12px",
                      color: "#f0f0f5",
                    }}
                  />
                  <Line type="monotone" dataKey="accuracy" stroke="#6c63ff" strokeWidth={2}
                        dot={{ fill: "#6c63ff", r: 3 }} activeDot={{ r: 5, fill: "#a78bfa" }} />
                  <Line type="monotone" dataKey="reward" stroke="#22c55e" strokeWidth={2}
                        dot={{ fill: "#22c55e", r: 3 }} strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center"
                   style={{ color: "var(--text-muted)" }}>
                <p>Complete sessions to see your progress</p>
              </div>
            )}
          </motion.div>

          {/* Weak Topics */}
          <motion.div variants={fadeUp} initial="hidden" animate="show"
                      className="glass-card-static p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" style={{ color: "var(--warning)" }} />
              Focus Areas
            </h3>
            {dashboard?.weak_topics && dashboard.weak_topics.length > 0 ? (
              <div className="space-y-4">
                {dashboard.weak_topics.map((topic) => (
                  <div key={topic.topic}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{topic.topic}</span>
                      <span style={{ color: "var(--text-muted)" }}>{topic.mastery}%</span>
                    </div>
                    <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all duration-500"
                           style={{
                             width: `${topic.mastery}%`,
                             background: topic.mastery < 40 ? "var(--error)" :
                                        topic.mastery < 70 ? "var(--warning)" : "var(--success)",
                           }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Start sessions to discover your weak areas
              </p>
            )}

            {/* Topic Mastery Radar */}
            {topicData && topicData.length > 0 && (
              <div className="mt-6">
                <ResponsiveContainer width="100%" height={200}>
                  <RadarChart data={topicData}>
                    <PolarGrid stroke="rgba(255,255,255,0.08)" />
                    <PolarAngleAxis dataKey="topic_name" stroke="var(--text-muted)" fontSize={11} />
                    <PolarRadiusAxis stroke="var(--text-muted)" fontSize={10} />
                    <Radar dataKey="mastery_score" stroke="#6c63ff" fill="#6c63ff" fillOpacity={0.2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        </div>

        {/* Recent Sessions */}
        <motion.div variants={fadeUp} initial="hidden" animate="show"
                    className="glass-card-static p-6 mt-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" style={{ color: "var(--info)" }} />
            Recent Sessions
          </h3>
          {dashboard?.recent_sessions && dashboard.recent_sessions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--text-muted)" }}>
                    <th className="text-left pb-3 font-medium">Date</th>
                    <th className="text-left pb-3 font-medium">Questions</th>
                    <th className="text-left pb-3 font-medium">Accuracy</th>
                    <th className="text-left pb-3 font-medium">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border-glass)" }}>
                  {dashboard.recent_sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="py-3">{new Date(s.date).toLocaleDateString()}</td>
                      <td className="py-3">{s.questions}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.accuracy >= 80 ? "badge-easy" : s.accuracy >= 50 ? "badge-medium" : "badge-hard"
                        }`}>
                          {s.accuracy}%
                        </span>
                      </td>
                      <td className="py-3" style={{ color: s.reward >= 0 ? "var(--success)" : "var(--error)" }}>
                        {s.reward >= 0 ? "+" : ""}{s.reward.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>No sessions yet. Start your first one!</p>
          )}
        </motion.div>
      </main>
    </div>
  );
}
