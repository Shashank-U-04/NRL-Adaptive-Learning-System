"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { leaderboardApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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

export default function LeaderboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => leaderboardApi.get(50),
    enabled: isAuthenticated,
  });

  if (authLoading) return null;

  // Normalise field names — API may return username or name, total_xp or xp, etc.
  const entries = (leaderboard ?? []).map((e: any, i: number) => ({
    rank: e.rank ?? e.id ?? i + 1,
    name: e.username ?? e.name ?? "—",
    xp: e.total_xp ?? e.xp ?? 0,
    sessions: e.sessions_count ?? e.sessions_completed ?? e.sessions ?? 0,
    accuracy: e.accuracy ?? 0,
  }));

  const podium = entries.length >= 3 ? [entries[1], entries[0], entries[2]] : [];
  // Table shows ALL entries paginated (including top 3)
  const paginated = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const startIdx = page * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, entries.length);

  const podiumColors = ["#A1A1AA", "#F59E0B", "#A16207"];
  const podiumSizes = [44, 52, 40];

  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 32px 40px" }}>

          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 className="page-h1">Leaderboard</h1>
            <p className="page-sub">Top learners by total XP · Season ranking</p>
          </div>

          {/* Podium */}
          {podium.length === 3 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1.1fr 1fr",
                gap: 12,
                alignItems: "flex-end",
                marginBottom: 16,
              }}
            >
              {podium.map((entry, i) => {
                const rankIndex = i === 1 ? 0 : i === 0 ? 1 : 2;
                const badgeColor = podiumColors[rankIndex];
                const avatarSize = podiumSizes[rankIndex];
                const rankNum = entry.rank;
                return (
                  <div
                    key={entry.rank}
                    className="glass"
                    style={{ padding: 20, textAlign: "center", position: "relative" }}
                  >
                    {/* Rank badge */}
                    <div
                      style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: badgeColor,
                        color: "#fff",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        zIndex: 1,
                      }}
                    >
                      {rankNum}
                    </div>

                    {/* Avatar */}
                    <div
                      className="avatar"
                      style={{
                        width: avatarSize,
                        height: avatarSize,
                        fontSize: avatarSize > 44 ? 16 : 13,
                        background: `linear-gradient(135deg, ${badgeColor}cc, ${badgeColor}66)`,
                        margin: "12px auto 8px",
                      }}
                    >
                      {initials(entry.name)}
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{entry.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8 }}>
                      {entry.accuracy}% accuracy · {entry.sessions} sessions
                    </div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: badgeColor }}>{entry.xp} XP</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Table */}
          <div className="glass" style={{ overflow: "hidden", marginBottom: 12 }}>
            {isLoading ? (
              <div style={{ padding: 32, textAlign: "center" }}>
                <div className="spinner" style={{ borderColor: "var(--accent)", borderRightColor: "transparent" }} />
              </div>
            ) : entries.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                No players yet. Be the first!
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Learner</th>
                    <th>XP</th>
                    <th>Sessions</th>
                    <th>Accuracy</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((entry: any) => {
                    const isMe = entry.name === user?.name;
                    return (
                      <tr key={entry.rank} className={isMe ? "me" : ""}>
                        <td style={{ color: "var(--text-3)", width: 40 }}>{entry.rank}</td>
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
                        <td style={{ fontWeight: 600, color: "var(--accent)" }}>{entry.xp}</td>
                        <td style={{ color: "var(--text-2)" }}>{entry.sessions}</td>
                        <td style={{ color: "var(--text-2)" }}>{entry.accuracy}%</td>
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
