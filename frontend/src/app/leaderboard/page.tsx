"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { leaderboardApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import { Trophy, Crown, Medal, Award } from "lucide-react";

export default function LeaderboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => leaderboardApi.get(50),
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent-primary)", borderTopColor: "transparent" }} />
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-mono" style={{ color: "var(--text-muted)" }}>{rank}</span>;
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "advanced": return "#a78bfa";
      case "intermediate": return "#f59e0b";
      default: return "#22c55e";
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Trophy className="w-8 h-8" style={{ color: "var(--warning)" }} />
            Leaderboard
          </h1>
          <p className="mt-1" style={{ color: "var(--text-secondary)" }}>Top learners ranked by XP</p>
        </motion.div>

        {/* Top 3 Podium */}
        {leaderboard && leaderboard.length >= 3 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-3 gap-4 mb-8">
            {[leaderboard[1], leaderboard[0], leaderboard[2]].map((entry, i) => {
              const isCenter = i === 1;
              return (
                <div key={entry.rank} className={`glass-card p-4 text-center ${isCenter ? "ring-2" : ""}`}
                  style={isCenter ? { borderColor: "var(--warning)", boxShadow: "0 0 20px rgba(245,158,11,0.15)" } : {}}>
                  <div className={`mx-auto mb-2 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${isCenter ? "bg-yellow-500/20" : "bg-white/5"}`}>
                    {getRankIcon(entry.rank)}
                  </div>
                  <div className="font-semibold text-sm truncate">{entry.name}</div>
                  <div className="text-xl font-bold mt-1" style={{ color: "var(--accent-primary)" }}>{entry.total_xp} XP</div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{entry.accuracy}% accuracy</div>
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{ color: getLevelColor(entry.knowledge_level), background: `${getLevelColor(entry.knowledge_level)}20`, border: `1px solid ${getLevelColor(entry.knowledge_level)}40` }}>
                    {entry.knowledge_level}
                  </span>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Full List */}
        <div className="glass-card-static overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: "var(--text-muted)", borderBottom: "1px solid var(--border-glass)" }}>
                <th className="text-left p-4 font-medium">Rank</th>
                <th className="text-left p-4 font-medium">Name</th>
                <th className="text-left p-4 font-medium">XP</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Accuracy</th>
                <th className="text-left p-4 font-medium hidden sm:table-cell">Sessions</th>
                <th className="text-left p-4 font-medium">Level</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard?.map((entry) => {
                const isMe = user?.name === entry.name;
                return (
                  <motion.tr key={entry.rank} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className={isMe ? "ring-1 ring-inset" : ""}
                    style={{
                      borderBottom: "1px solid var(--border-glass)",
                      background: isMe ? "rgba(108,99,255,0.08)" : "transparent",
                      ...(isMe ? { borderColor: "var(--accent-primary)" } : {}),
                    }}>
                    <td className="p-4">
                      <div className="w-8 h-8 flex items-center justify-center">{getRankIcon(entry.rank)}</div>
                    </td>
                    <td className="p-4 font-medium">{entry.name} {isMe && <span className="text-xs ml-1" style={{ color: "var(--accent-primary)" }}>(you)</span>}</td>
                    <td className="p-4 font-bold" style={{ color: "var(--accent-primary)" }}>{entry.total_xp}</td>
                    <td className="p-4 hidden sm:table-cell">{entry.accuracy}%</td>
                    <td className="p-4 hidden sm:table-cell">{entry.sessions_completed}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ color: getLevelColor(entry.knowledge_level), background: `${getLevelColor(entry.knowledge_level)}20` }}>
                        {entry.knowledge_level}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
          {(!leaderboard || leaderboard.length === 0) && (
            <div className="p-8 text-center" style={{ color: "var(--text-muted)" }}>No players yet. Be the first!</div>
          )}
        </div>
      </main>
    </div>
  );
}
