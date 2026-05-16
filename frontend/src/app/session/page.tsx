"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { sessionApi, type QuestionPayload } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";
import AppLayout from "@/components/AppLayout";
import {
  Play, ChevronRight, Check, X, Sparkles, Flame, Brain,
  Globe, Shield, Lock, Layers, Bug, Database, Trophy, ArrowRight,
  Clock, Zap,
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
  { id: "networking",       name: "Networking",       icon: Globe,    color: "#3B82F6", subtitle: "Protocols, ports & packets" },
  { id: "web-security",     name: "Web Security",     icon: Shield,   color: "#10B981", subtitle: "OWASP, XSS, CSRF" },
  { id: "cryptography",     name: "Cryptography",     icon: Lock,     color: "#8B5CF6", subtitle: "Ciphers, hashing & keys" },
  { id: "system-security",  name: "System Security",  icon: Layers,   color: "#F59E0B", subtitle: "OS hardening & privileges" },
  { id: "ethical-hacking",  name: "Ethical Hacking",  icon: Bug,      color: "#F43F5E", subtitle: "Recon, exploitation & reporting" },
  { id: "forensics",        name: "Forensics",        icon: Database, color: "#14B8A6", subtitle: "Evidence, IOCs & timelines" },
] as const;

const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
};

// ── Page ──────────────────────────────────────────────────
function SessionPageInner() {
  const { isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
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
  const [stepCount, setStepCount] = useState(0);
  const [summary, setSummary] = useState<SessionSummaryData | null>(null);
  const [activeTopic, setActiveTopic] = useState("");
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
        setStreak(0);
        timerRef.current = 0;
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
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sessionState]);

  // ── API actions ──────────────────────────────────────
  const startSession = async (topic?: string) => {
    setSessionState("loading");
    try {
      const res = await sessionApi.start(topic);
      setSessionId(res.session_id);
      setQuestion(res.question);
      setActiveTopic(res.question?.topic_name || "");
      setAiExplanation(res.explanation);
      setStepCount(0);
      setStreak(0);
      timerRef.current = 0;
      setSessionState("active");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to start session");
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
      toast.error(err instanceof Error ? err.message : "Failed to submit answer");
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to end session");
    }
  };

  const isSessionLoading = sessionState === "loading";

  // ── Idle state (topic picker) ────────────────────────
  if (sessionState === "idle") {
    return (
      <AppLayout>
        <div className="scroll-y" style={{ height: "100%", position: "relative" }}>
          <div className="aurora" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
          <div style={{ maxWidth: 880, margin: "0 auto", padding: "48px 32px 60px", position: "relative" }}>

            {/* Hero */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{ marginBottom: 32 }}
            >
              <h1 className="page-h1" style={{ marginBottom: 6 }}>Start an adaptive session</h1>
              <p className="page-sub">
                Pick a track, or let the engine choose the perfect topic for your current level.
              </p>
            </motion.div>

            {/* Smart-pick — cyber-border hero card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="cyber-border"
              style={{
                padding: "24px 26px",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                gap: 20,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "var(--gradient-cyber)",
                  display: "grid",
                  placeItems: "center",
                  color: "#fff",
                  flexShrink: 0,
                  boxShadow: "0 8px 24px -8px rgba(59,130,246,0.55)",
                }}
              >
                <Brain size={26} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>Smart pick</span>
                  <span className="pill pill-blue" style={{ gap: 4 }}>
                    <Sparkles size={11} /> AI selected
                  </span>
                </div>
                <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.5 }}>
                  Let the adaptive engine choose the optimal topic and difficulty based on your recent activity.
                </div>
              </div>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => startSession(selectedTopic)}
                disabled={isSessionLoading}
                style={{ flexShrink: 0 }}
              >
                {isSessionLoading ? <span className="spinner" /> : <Play size={15} />}
                Start
                <ArrowRight size={15} />
              </button>
            </motion.div>

            {/* Section label */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                Or pick a track
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>

            {/* Topics grid — 2 columns */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {TOPICS.map(({ id, name, icon: Icon, color, subtitle }) => (
                <motion.button
                  key={id}
                  variants={cardVariants}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.99 }}
                  className="glass glass-hover"
                  onClick={() => startSession(id)}
                  disabled={isSessionLoading}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "18px 20px",
                    cursor: "pointer",
                    textAlign: "left",
                    width: "100%",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: `linear-gradient(135deg, ${color}22, ${color}10)`,
                      border: `1px solid ${color}33`,
                      color,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{subtitle}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>10 questions · ~6 min</div>
                  </div>
                  <ChevronRight size={16} style={{ color: "var(--text-3)", flexShrink: 0 }} />
                </motion.button>
              ))}
            </motion.div>

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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div className="spinner" style={{ width: 32, height: 32, borderColor: "var(--accent)", borderRightColor: "transparent" }} />
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>Initializing adaptive engine…</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── Summary state ────────────────────────────────────
  if (sessionState === "summary" && summary) {
    const scoreLabel = summary.accuracy >= 80 ? "Excellent work" : summary.accuracy >= 60 ? "Good progress" : "Keep going";
    return (
      <AppLayout>
        <div className="scroll-y" style={{ height: "100%", position: "relative" }}>
          <div className="aurora" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
          <div style={{ maxWidth: 600, margin: "0 auto", padding: "56px 32px", position: "relative" }}>

            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="cyber-border"
              style={{ padding: 40, textAlign: "center", position: "relative" }}
            >
              {/* Sparkle accents */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: [0, 12, -8, 0] }}
                transition={{ delay: 0.25, duration: 0.7 }}
                style={{ position: "absolute", top: 18, left: 28, color: "var(--amber)" }}
              >
                <Sparkles size={18} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1, rotate: [0, -12, 8, 0] }}
                transition={{ delay: 0.4, duration: 0.7 }}
                style={{ position: "absolute", top: 32, right: 36, color: "var(--violet)" }}
              >
                <Sparkles size={14} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                style={{ position: "absolute", bottom: 60, right: 30, color: "var(--accent)" }}
              >
                <Sparkles size={12} />
              </motion.div>

              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 18 }}
                style={{
                  width: 84, height: 84, borderRadius: "50%",
                  background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(245,158,11,0.08))",
                  border: "1px solid rgba(245,158,11,0.35)",
                  display: "grid", placeItems: "center",
                  margin: "0 auto 22px",
                }}
              >
                <Trophy size={40} style={{ color: "var(--amber)" }} />
              </motion.div>

              <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", margin: "0 0 6px" }}>
                Session complete
              </h2>
              <p style={{ color: "var(--text-2)", fontSize: 14, margin: "0 0 28px" }}>{scoreLabel}.</p>

              {/* Summary stats grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 28 }}>
                {[
                  { label: "Score", value: `${summary.correct_answers}/${summary.total_questions}`, color: "var(--accent)" },
                  { label: "Accuracy", value: `${summary.accuracy}%`, color: "var(--green)" },
                  { label: "XP earned", value: `+${summary.xp_earned}`, color: "var(--amber)" },
                  { label: "Time", value: formatDuration(summary.duration_seconds), color: "var(--violet)" },
                ].map(({ label, value, color }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.06 }}
                    className="glass"
                    style={{ padding: "16px 14px" }}
                  >
                    <div style={{ fontSize: 24, fontWeight: 700, color, marginBottom: 2, letterSpacing: "-0.02em" }}>
                      {value}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                      {label}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="btn btn-ghost"
                  style={{ flex: 1 }}
                  onClick={() => router.push("/dashboard")}
                >
                  Back to dashboard
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
                  Start another
                </button>
              </div>
            </motion.div>

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
        <div style={{ maxWidth: 780, margin: "0 auto", padding: "32px 32px 60px" }}>

          {/* Session header bar */}
          <div className="glass" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 18px", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)", fontWeight: 500 }}>
                <span className="live-dot" />
                Session active
              </span>
              <span style={{ width: 1, height: 16, background: "var(--line)" }} />
              <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                Question {stepCount + 1}
              </span>
              {activeTopic && (
                <span className="pill pill-neutral">{activeTopic}</span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {streak >= 2 && (
                <span className="pill pill-amber" style={{ gap: 4 }}>
                  <Flame size={12} />
                  {streak}x streak
                </span>
              )}
              <button className="btn btn-ghost" style={{ height: 32, fontSize: 12 }} onClick={endEarly}>
                Exit
              </button>
            </div>
          </div>

          {/* Question card */}
          {question && (
            <AnimatePresence mode="wait">
              <motion.div
                key={`q-${question.id}-${stepCount}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="glass"
                style={{ padding: 28, position: "relative" }}
              >

                {/* Top row: AI note + difficulty badge */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
                  {aiExplanation ? (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flex: 1 }}>
                      <Sparkles size={14} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
                      <p style={{ fontSize: 12, color: "var(--text-2)", fontStyle: "italic", margin: 0, lineHeight: 1.5 }}>
                        {aiExplanation}
                      </p>
                    </div>
                  ) : (
                    <div style={{ flex: 1 }} />
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
                <h2 style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.5, margin: "0 0 24px", letterSpacing: "-0.01em" }}>
                  {question.text}
                </h2>

                {/* Options */}
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
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
                      <motion.button
                        key={key}
                        variants={cardVariants}
                        whileHover={!isFeedback && !isLoading ? { x: 2 } : {}}
                        whileTap={!isFeedback && !isLoading ? { scale: 0.99 } : {}}
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
                      </motion.button>
                    );
                  })}
                </motion.div>

                {/* Feedback explanation — animated */}
                <AnimatePresence>
                  {isFeedback && (
                    <motion.div
                      key="explanation"
                      initial={{ opacity: 0, y: 8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -4, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div
                        style={{
                          marginTop: 20,
                          padding: "14px 16px",
                          borderRadius: 12,
                          background: isCorrect ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                          border: `1px solid ${isCorrect ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: explanation ? 6 : 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {isCorrect
                              ? <Check size={16} style={{ color: "var(--green)", flexShrink: 0 }} />
                              : <X size={16} style={{ color: "var(--red)", flexShrink: 0 }} />
                            }
                            <span style={{ fontWeight: 600, color: isCorrect ? "var(--green)" : "var(--red)", fontSize: 14 }}>
                              {isCorrect ? "Correct" : "Not quite"}
                            </span>
                          </div>
                          {isCorrect && reward > 0 && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.7 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.1, type: "spring", stiffness: 280, damping: 14 }}
                              className="pill pill-amber"
                              style={{ gap: 4 }}
                            >
                              <Zap size={11} /> Reward +{Math.max(1, Math.round(reward * 10))}
                            </motion.span>
                          )}
                        </div>
                        {explanation && (
                          <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.55 }}>
                            {explanation}
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* XP float */}
                {floatXP && (
                  <div className="xp-float">
                    +{Math.max(1, Math.round(reward * 10))} XP
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* No question fallback */}
          {!question && (sessionState === "active" || sessionState === "feedback") && (
            <div className="glass" style={{ padding: 32, textAlign: "center" }}>
              <p style={{ color: "var(--text-2)", marginBottom: 16 }}>No more questions available.</p>
              <button className="btn btn-primary" onClick={endEarly}>End session</button>
            </div>
          )}

          {/* Next button row */}
          {question && isFeedback && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 10 }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-3)" }}>
                <Clock size={12} />
                Adaptive engine selecting next question…
              </span>
              <button className="btn btn-primary btn-lg" onClick={nextQuestion}>
                Next question
                <ArrowRight size={17} />
              </button>
            </motion.div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}

export default function SessionPage() {
  return (
    <Suspense>
      <SessionPageInner />
    </Suspense>
  );
}
