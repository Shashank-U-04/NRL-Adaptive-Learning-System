"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { sessionApi, type QuestionPayload } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";
import {
  Play, ChevronRight, Check, X, Sparkles, Flame, Zap,
  Globe, Shield, Lock, Layers, Bug, Database, Trophy, ArrowRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────
type SessionState = "idle" | "loading" | "active" | "feedback" | "summary";

interface SessionSummaryData {
  total_questions: number;
  correct_answers: number;
  accuracy: number;
  total_reward: number;
  xp_earned: number;
  duration_seconds: number;
}

// ── Topic definitions ────────────────────────────────────
const TOPICS = [
  { id: "networking",       name: "Networking",       icon: Globe,    color: "#3B82F6" },
  { id: "web-security",     name: "Web Security",     icon: Shield,   color: "#10B981" },
  { id: "cryptography",     name: "Cryptography",     icon: Lock,     color: "#8B5CF6" },
  { id: "system-security",  name: "System Security",  icon: Layers,   color: "#F59E0B" },
  { id: "ethical-hacking",  name: "Ethical Hacking",  icon: Bug,      color: "#F43F5E" },
  { id: "forensics",        name: "Forensics",        icon: Database, color: "#14B8A6" },
] as const;

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

// ── Page ──────────────────────────────────────────────────
export default function SessionPage() {
  const { isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTopic = searchParams.get("topic") || undefined;

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionPayload | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string>("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState("");
  const [streak, setStreak] = useState(0);
  const [reward, setReward] = useState(0);
  const [totalReward, setTotalReward] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [summary, setSummary] = useState<SessionSummaryData | null>(null);
  const [error, setError] = useState("");
  const [activeTopic, setActiveTopic] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [floatXP, setFloatXP] = useState(false);
  const timerRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ── Auth guard ───────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  // ── Restore pending session from sessionStorage ──────
  useEffect(() => {
    if (authLoading || !isAuthenticated || sessionId) return;
    const pending = sessionStorage.getItem("nrl_pending_session");
    if (!pending) return;

    try {
      const parsed = JSON.parse(pending);
      const res = parsed.session;
      if (res?.session_id && res?.question) {
        setSessionId(res.session_id);
        setQuestion(res.question);
        setAiExplanation(res.explanation || "");
        setActiveTopic(res.question.topic_name || "");
        setStepCount(0);
        setTotalReward(0);
        setStreak(0);
        timerRef.current = 0;
        setElapsedSeconds(0);
        setSessionState("active");
      }
    } finally {
      sessionStorage.removeItem("nrl_pending_session");
    }
  }, [authLoading, isAuthenticated, sessionId]);

  // ── Timer ────────────────────────────────────────────
  useEffect(() => {
    if (sessionState === "active" || sessionState === "feedback") {
      intervalRef.current = setInterval(() => {
        timerRef.current += 1;
        setElapsedSeconds(timerRef.current);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionState]);

  // ── API actions ──────────────────────────────────────
  const startSession = async (topic?: string) => {
    setSessionState("loading");
    setError("");
    try {
      const res = await sessionApi.start(topic);
      setSessionId(res.session_id);
      setQuestion(res.question);
      setActiveTopic(res.question?.topic_name || "");
      setAiExplanation(res.explanation);
      setStepCount(0);
      setTotalReward(0);
      setStreak(0);
      timerRef.current = 0;
      setElapsedSeconds(0);
      setSessionState("active");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to start session");
      setSessionState("idle");
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!sessionId || !question) return;
    setSelectedAnswer(answer);
    setSessionState("loading");

    try {
      const res = await sessionApi.answer({
        session_id: sessionId,
        question_id: question.id,
        selected_answer: answer,
        time_taken_seconds: timerRef.current,
      });

      setIsCorrect(res.is_correct);
      setCorrectAnswer(res.correct_answer);
      setExplanation(res.explanation);
      setReward(res.reward);
      setTotalReward((prev) => prev + res.reward);
      setStreak(res.streak);
      setAiExplanation(res.action_explanation);
      setStepCount((prev) => prev + 1);

      if (res.is_correct) {
        setFloatXP(true);
        setTimeout(() => setFloatXP(false), 1800);
      }

      if (res.session_done) {
        const summaryRes = await sessionApi.end(sessionId);
        setSummary({
          total_questions: summaryRes.total_questions,
          correct_answers: summaryRes.correct_answers,
          accuracy: summaryRes.accuracy,
          total_reward: summaryRes.total_reward,
          xp_earned: summaryRes.xp_earned || 0,
          duration_seconds: timerRef.current,
        });
        setSessionState("summary");
        refreshUser();
      } else {
        setQuestion(res.next_question);
        setActiveTopic(res.next_question?.topic_name || activeTopic);
        setSessionState("feedback");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit answer");
      setSessionState("active");
    }
  };

  const nextQuestion = () => {
    setSelectedAnswer(null);
    setIsCorrect(null);
    setExplanation(null);
    setSessionState("active");
  };

  const endEarly = async () => {
    if (!sessionId) return;
    try {
      const res = await sessionApi.end(sessionId);
      setSummary({
        total_questions: res.total_questions,
        correct_answers: res.correct_answers,
        accuracy: res.accuracy,
        total_reward: res.total_reward,
        xp_earned: res.xp_earned || 0,
        duration_seconds: timerRef.current,
      });
      setSessionState("summary");
      refreshUser();
    } catch {
      /* ignore */
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Idle state ───────────────────────────────────────
  if (sessionState === "idle") {
    return (
      <AppLayout>
        <div className="scroll-y" style={{ height: "100%" }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 32px" }}>

            <h1 className="page-h1" style={{ marginBottom: 6 }}>Start an adaptive session</h1>
            <p className="page-sub" style={{ marginBottom: 28 }}>
              Pick a track, or let the engine choose.
            </p>

            {error && (
              <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontSize: 13, marginBottom: 20 }}>
                {error}
              </div>
            )}

            {/* AI smart-pick card */}
            <div
              className="glass"
              style={{
                padding: "20px 22px",
                marginBottom: 24,
                display: "flex",
                alignItems: "center",
                gap: 16,
                borderLeft: "3px solid var(--accent)",
              }}
            >
              <div
                className="stat-icon"
                style={{ background: "var(--accent-soft)", color: "var(--accent)", flexShrink: 0 }}
              >
                <Sparkles size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Smart pick</div>
                <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>
                  Let the AI engine select the best topic for your current skill level.
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => startSession(selectedTopic)}
                disabled={sessionState === "loading"}
              >
                <Play size={15} />
                Start →
              </button>
            </div>

            {/* Topics grid — 2 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {TOPICS.map(({ id, name, icon: Icon, color }) => (
                <button
                  key={id}
                  className="glass glass-hover"
                  onClick={() => startSession(id)}
                  disabled={sessionState === "loading"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "18px 20px",
                    cursor: "pointer",
                    textAlign: "left",
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.035)",
                    width: "100%",
                    transition: "background 120ms ease, border-color 120ms ease",
                  }}
                >
                  <div
                    className="stat-icon"
                    style={{ background: `${color}22`, color, flexShrink: 0 }}
                  >
                    <Icon size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>10 questions · ~6 min</div>
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                </button>
              ))}
            </div>

          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Loading state (before first question) ───────────
  if (sessionState === "loading" && !question) {
    return (
      <AppLayout>
        <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
          <div className="spinner" style={{ width: 28, height: 28, borderColor: "var(--accent)", borderRightColor: "transparent" }} />
        </div>
      </AppLayout>
    );
  }

  // ── Summary state ────────────────────────────────────
  if (sessionState === "summary" && summary) {
    const scoreLabel = summary.accuracy >= 80 ? "Excellent" : summary.accuracy >= 60 ? "Good" : "Keep going";
    return (
      <AppLayout>
        <div className="scroll-y" style={{ height: "100%" }}>
          <div style={{ maxWidth: 560, margin: "0 auto", padding: "48px 32px" }}>

            <div className="glass slide-up-in" style={{ padding: 36, textAlign: "center" }}>
              <div style={{
                width: 72, height: 72, borderRadius: "50%",
                background: "rgba(245,158,11,0.14)",
                display: "grid", placeItems: "center",
                margin: "0 auto 20px",
              }}>
                <Trophy size={36} style={{ color: "var(--amber)" }} />
              </div>

              <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 4px" }}>
                Session complete
              </h2>
              <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 28px" }}>{scoreLabel}!</p>

              {/* Summary stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
                {[
                  { label: "Score", value: `${summary.correct_answers}/${summary.total_questions}` },
                  { label: "Accuracy", value: `${summary.accuracy}%` },
                  { label: "XP earned", value: `+${summary.xp_earned}` },
                  { label: "Best streak", value: `${streak}` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="glass"
                    style={{ padding: "14px 16px" }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => router.push("/analytics")}
                >
                  View analytics
                </button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => {
                    setSessionState("idle");
                    setSummary(null);
                    setSessionId(null);
                    setQuestion(null);
                  }}
                >
                  <Play size={15} />
                  Play again
                </button>
              </div>
            </div>

          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Active / Feedback state ──────────────────────────
  const isFeedback = sessionState === "feedback";
  const isLoading = sessionState === "loading";
  const optionKeys = question ? Object.keys(question.options) : [];

  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 32px 60px" }}>

          {/* Session header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{activeTopic || "Session"}</span>
              <span style={{ fontSize: 13, color: "var(--text-3)" }}>
                Question {stepCount + 1}/30
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {streak >= 2 && (
                <span className="pill pill-amber" style={{ gap: 4 }}>
                  <Flame size={12} />
                  {streak}x streak
                </span>
              )}
              <button className="btn btn-ghost" style={{ height: 32, fontSize: 12 }} onClick={endEarly}>
                End
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="pbar" style={{ marginBottom: 24 }}>
            <span style={{ width: `${((stepCount + 1) / 30) * 100}%` }} />
          </div>

          {/* Question card */}
          {question && (
            <div className="glass" style={{ padding: 28, position: "relative" }}>

              {/* Top row: AI note + difficulty badge */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
                {aiExplanation && (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1 }}>
                    <Sparkles size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontSize: 12, color: "var(--text-2)", fontStyle: "italic", margin: 0 }}>
                      {aiExplanation}
                    </p>
                  </div>
                )}
                <span
                  className={`pill ${
                    question.difficulty === "easy" ? "pill-easy" :
                    question.difficulty === "medium" ? "pill-medium" :
                    "pill-hard"
                  }`}
                  style={{ flexShrink: 0 }}
                >
                  {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                </span>
              </div>

              {/* Question text */}
              <h2 style={{ fontSize: 19, fontWeight: 500, lineHeight: 1.5, marginBottom: 24 }}>
                {question.text}
              </h2>

              {/* Options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {optionKeys.map((key, idx) => {
                  const value = question.options[key];
                  const letter = OPTION_LETTERS[idx] ?? key;
                  const isSelected = selectedAnswer === key;
                  const isCorrectOpt = isFeedback && key === correctAnswer;
                  const isWrongOpt = isFeedback && isSelected && !isCorrect;

                  const cls = [
                    "qopt",
                    isCorrectOpt ? "correct" : "",
                    isWrongOpt ? "wrong" : "",
                    isSelected && !isFeedback ? "selected" : "",
                    isFeedback || isLoading ? "disabled" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  return (
                    <button
                      key={key}
                      className={cls}
                      onClick={() => {
                        if (!isFeedback && !isLoading) submitAnswer(key);
                      }}
                      disabled={isFeedback || isLoading}
                    >
                      <span className="opt-letter">{letter}</span>
                      <span style={{ flex: 1 }}>{value}</span>
                      {isCorrectOpt && <Check size={16} style={{ color: "var(--green)", flexShrink: 0 }} />}
                      {isWrongOpt && <X size={16} style={{ color: "var(--red)", flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {/* Feedback explanation */}
              {isFeedback && (
                <div
                  className="fade-in"
                  style={{
                    marginTop: 20,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: isCorrect
                      ? "rgba(16,185,129,0.1)"
                      : "rgba(239,68,68,0.1)",
                    border: `1px solid ${isCorrect ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: explanation ? 6 : 0 }}>
                    {isCorrect
                      ? <Check size={16} style={{ color: "var(--green)", flexShrink: 0 }} />
                      : <X size={16} style={{ color: "var(--red)", flexShrink: 0 }} />
                    }
                    <span style={{ fontWeight: 600, color: isCorrect ? "var(--green)" : "var(--red)" }}>
                      {isCorrect ? "Correct." : "Not quite."}
                    </span>
                  </div>
                  {explanation && (
                    <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                      {explanation}
                    </p>
                  )}
                </div>
              )}

              {/* XP float */}
              {floatXP && (
                <div className="xp-float">
                  +{Math.max(1, Math.round(reward * 10))} XP
                </div>
              )}
            </div>
          )}

          {/* No question fallback */}
          {!question && (sessionState === "active" || sessionState === "feedback") && (
            <div className="glass" style={{ padding: 32, textAlign: "center" }}>
              <p style={{ color: "var(--text-2)", marginBottom: 16 }}>No more questions available.</p>
              <button className="btn btn-primary" onClick={endEarly}>End Session</button>
            </div>
          )}

          {/* Submit / Next button row */}
          {question && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, position: "relative" }}>
              {isFeedback && (
                <button className="btn btn-primary btn-lg" onClick={nextQuestion}>
                  Next question
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontSize: 13 }}>
              {error}
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}
