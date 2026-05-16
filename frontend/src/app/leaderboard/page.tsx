"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Crown, Medal, Trophy, Users } from "lucide-react";
import { leaderboardApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";
import AppLayout from "@/components/AppLayout";

const PAGE_SIZE = 10;

function initials(name: string): string {
  return (name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const RANK_META = [
  { color: "#F59E0B", glow: "rgba(245,158,11,0.45)", icon: Crown, label: "Gold" },
  { color: "#A1A1AA", glow: "rgba(161,161,170,0.45)", icon: Trophy, label: "Silver" },
  { color: "#B45309", glow: "rgba(180,83,9,0.45)", icon: Medal, label: "Bronze" },
] as const;

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function LeaderboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const { data: leaderboard, isLoading, error } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => leaderboardApi.get(50),
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (error) {
      toast.error(error instanceof Error ? error.message : "Could not load leaderboard");
    }
  }, [error, toast]);

  if (authLoading) return null;

  const entries = (leaderboard ?? []).map((e, i) => ({
    rank: e.rank ?? i + 1,
    name: e.name ?? "—",
    xp: e.total_xp ?? 0,
    sessions: e.sessions_completed ?? 0,
    accuracy: e.accuracy ?? 0,
    level: e.knowledge_level ?? "beginner",
  }));

  // Podium order: [silver, gold, bronze] → renders with gold in the middle, tallest
  const podium = entries.length >= 3 ? [entries[1], entries[0], entries[2]] : [];
  const paginated = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const startIdx = page * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, entries.length);

  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%", position: "relative" }}>
        <div className="aurora" style={{ height: 360, top: 0 }} />

        <div style={{ maxWidth: 920, margin: "0 auto", padding: "32px 32px 40px", position: "relative" }}>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            style={{ marginBottom: 28, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}
          >
            <div>
              <h1 className="page-h1">Leaderboard</h1>
              <p className="page-sub" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="live-dot" />
                Top learners by total XP · Season ranking
              </p>
            </div>
            <span
              className="pill pill-blue"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 26, padding: "0 12px" }}
            >
              <Users size={12} /> {entries.length} {entries.length === 1 ? "learner" : "learners"}
            </span>
          </motion.div>

          {/* Podium */}
          {podium.length === 3 && (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.15fr 1fr",
                gap: 14,
                alignItems: "flex-end",
                marginBottom: 24,
              }}
            >
              {podium.map((entry, i) => {
                // visual index → real rank index (gold=0, silver=1, bronze=2)
                const rankIndex = i === 1 ? 0 : i === 0 ? 1 : 2;
                const meta = RANK_META[rankIndex];
                const Icon = meta.icon;
                const isMe = entry.name === user?.name;
                const isGold = rankIndex === 0;
                return (
                  <motion.div
                    key={`${entry.rank}-${entry.name}`}
                    variants={item}
                    whileHover={{ y: -4 }}
                    transition={{ y: { duration: 0.18 } }}
                    className={isGold ? "cyber-border" : "glass"}
                    style={{
                      padding: isGold ? 22 : 18,
                      textAlign: "center",
                      position: "relative",
                      minHeight: isGold ? 200 : 180,
                      boxShadow: isGold ? `0 14px 32px -16px ${meta.glow}` : "var(--shadow-sm)",
                    }}
                  >
                    {/* Rank badge */}
                    <div
                      style={{
                        position: "absolute",
                        top: -14,
                        left: "50%",
                        transform: "translateX(-50%)",
                        height: 28,
                        minWidth: 28,
                        padding: "0 8px",
                        borderRadius: 999,
                        background: `linear-gradient(135deg, ${meta.color}, ${meta.color}dd)`,
                        color: "#fff",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        boxShadow: `0 4px 14px -4px ${meta.glow}`,
                      }}
                    >
                      <Icon size={12} />
                      {entry.rank}
                    </div>

                    {/* Avatar */}
                    <div
                      className="avatar"
                      style={{
                        width: isGold ? 60 : 48,
                        height: isGold ? 60 : 48,
                        fontSize: isGold ? 17 : 14,
                        fontWeight: 600,
                        background: `linear-gradient(135deg, ${meta.color}, ${meta.color}88)`,
                        margin: "20px auto 10px",
                        boxShadow: `0 6px 18px -8px ${meta.glow}`,
                      }}
                    >
                      {initials(entry.name)}
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2, color: "var(--text)" }}>
                      {entry.name}
                      {isMe && (
                        <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 6 }}>(you)</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10 }}>
                      {entry.accuracy.toFixed(0)}% accuracy · {entry.sessions} {entry.sessions === 1 ? "session" : "sessions"}
                    </div>
                    <div style={{ fontSize: isGold ? 22 : 18, fontWeight: 700, color: meta.color, letterSpacing: "-0.01em" }}>
                      {entry.xp.toLocaleString()} XP
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}

          {/* Table */}
          <div className="glass" style={{ overflow: "hidden", marginBottom: 12 }}>
            {isLoading ? (
              <div style={{ padding: 48, display: "grid", placeItems: "center" }}>
                <div className="spinner" style={{ width: 22, height: 22, color: "var(--accent)" }} />
              </div>
            ) : entries.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center" }}>
                <Trophy size={28} style={{ color: "var(--text-3)", marginBottom: 10 }} />
                <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 4px", fontWeight: 500 }}>
                  No learners ranked yet
                </p>
                <p style={{ color: "var(--text-3)", fontSize: 12, margin: 0 }}>
                  Be the first — complete a session to claim the top spot.
                </p>
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>#</th>
                    <th>Learner</th>
                    <th>XP</th>
                    <th>Sessions</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((entry) => {
                    const isMe = entry.name === user?.name;
                    return (
                      <tr key={`${entry.rank}-${entry.name}`} className={isMe ? "me" : ""}>
                        <td style={{ color: "var(--text-3)", fontWeight: 600 }}>{entry.rank}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              className="avatar"
                              style={{
                                background: "linear-gradient(135deg, var(--accent), #6aa6ff)",
                                fontSize: 11,
                              }}
                            >
                              {initials(entry.name)}
                            </div>
                            <span style={{ fontWeight: 500 }}>
                              {entry.name}
                              {isMe && (
                                <span style={{ color: "var(--accent)", fontSize: 11, marginLeft: 6 }}>(you)</span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: "var(--accent)" }}>{entry.xp.toLocaleString()}</td>
                        <td style={{ color: "var(--text-2)" }}>{entry.sessions}</td>
                        <td style={{ color: "var(--text-2)" }}>{entry.accuracy.toFixed(0)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {entries.length > PAGE_SIZE && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                Showing {startIdx + 1}–{endIdx} of {entries.length} learners
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn btn-ghost"
                  style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Prev
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ height: 32, padding: "0 12px", fontSize: 12 }}
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
