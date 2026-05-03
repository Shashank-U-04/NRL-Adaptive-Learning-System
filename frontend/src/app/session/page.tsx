"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { sessionApi, type QuestionPayload } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Navbar from "@/components/Navbar";
import {
  Brain, CheckCircle2, XCircle, Zap, Timer,
  ArrowRight, Trophy, Flame, Loader2, LogOut,
} from "lucide-react";

type SessionState = "idle" | "loading" | "active" | "feedback" | "summary";

interface SessionSummaryData {
  total_questions: number;
  correct_answers: number;
  accuracy: number;
  total_reward: number;
  xp_earned: number;
  duration_seconds: number;
}

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
  const timerRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

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

  // Timer
  useEffect(() => {
    if (sessionState === "active" || sessionState === "feedback") {
      intervalRef.current = setInterval(() => {
        timerRef.current += 1;
        setElapsedSeconds(timerRef.current);
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [sessionState]);

  const startSession = async () => {
    setSessionState("loading");
    setError("");
    try {
      const res = await sessionApi.start(selectedTopic);
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

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // ── Idle Screen ──────────────────────────────────────
  if (sessionState === "idle") {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <Navbar />
        <div className="max-w-2xl mx-auto px-4 pt-32 text-center">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center animate-float"
                 style={{ background: "var(--gradient-primary)" }}>
              <Brain className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-3">Adaptive Learning Session</h1>
            <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
              The AI will select questions based on your knowledge level and performance.
              Each action is explainable — you&apos;ll see why every decision is made.
            </p>
            {error && (
              <div className="mb-4 p-3 rounded-lg text-sm text-red-300"
                   style={{ background: "var(--error-glow)" }}>{error}</div>
            )}
            {selectedTopic && (
              <p className="text-sm mb-4 capitalize" style={{ color: "var(--accent-secondary)" }}>
                Selected bundle: {selectedTopic.replace(/-/g, " ")}
              </p>
            )}
            <button onClick={startSession} className="btn-primary text-lg !py-4 !px-12 animate-pulse-glow">
              Start Session
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Summary Screen ───────────────────────────────────
  if (sessionState === "summary" && summary) {
    return (
      <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <Navbar />
        <div className="max-w-lg mx-auto px-4 pt-28">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="glass-card-static p-8 text-center">
            <Trophy className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--warning)" }} />
            <h2 className="text-2xl font-bold mb-6">Session Complete!</h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { label: "Questions", value: summary.total_questions },
                { label: "Correct", value: summary.correct_answers },
                { label: "Accuracy", value: `${summary.accuracy}%` },
                { label: "XP Earned", value: `+${summary.xp_earned}` },
                { label: "Total Reward", value: summary.total_reward.toFixed(1) },
                { label: "Duration", value: formatTime(summary.duration_seconds) },
              ].map((item) => (
                <div key={item.label} className="glass-card p-3">
                  <div className="text-xl font-bold" style={{ color: "var(--accent-primary)" }}>
                    {item.value}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-muted)" }}>{item.label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setSessionState("idle"); setSummary(null); }}
                      className="btn-primary flex-1">New Session</button>
              <button onClick={() => router.push("/dashboard")}
                      className="btn-secondary flex-1">Dashboard</button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Loading State ────────────────────────────────────
  if (sessionState === "loading" && !question) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-primary)" }}>
        <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--accent-primary)" }} />
      </div>
    );
  }

  // ── Active / Feedback State ──────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 pt-24 pb-12">
        {/* Session Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {activeTopic && (
              <span className="text-sm font-medium" style={{ color: "var(--accent-secondary)" }}>
                {activeTopic}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <Timer className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
                {formatTime(elapsedSeconds)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4" style={{ color: "var(--warning)" }} />
              <span className="text-sm font-medium"
                    style={{ color: totalReward >= 0 ? "var(--success)" : "var(--error)" }}>
                {totalReward >= 0 ? "+" : ""}{totalReward.toFixed(0)} pts
              </span>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1 streak-fire">
                <Flame className="w-4 h-4" style={{ color: "var(--warning)" }} />
                <span className="text-sm font-bold" style={{ color: "var(--warning)" }}>
                  {streak}🔥
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              Q{stepCount + 1} / 30
            </span>
            <button onClick={endEarly} className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.04)" }}>
              <LogOut className="w-3.5 h-3.5 inline mr-1" /> End
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 rounded-full mb-6" style={{ background: "rgba(255,255,255,0.06)" }}>
          <motion.div className="h-full rounded-full"
                      style={{ background: "var(--gradient-primary)" }}
                      animate={{ width: `${((stepCount + 1) / 30) * 100}%` }}
                      transition={{ duration: 0.3 }} />
        </div>

        {/* AI Explanation Banner */}
        <motion.div key={aiExplanation} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3 p-3 rounded-xl mb-6"
                    style={{ background: "rgba(108, 99, 255, 0.08)", border: "1px solid rgba(108, 99, 255, 0.2)" }}>
          <Brain className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "var(--accent-primary)" }} />
          <p className="text-sm" style={{ color: "var(--accent-secondary)" }}>{aiExplanation}</p>
        </motion.div>

        {/* Question Card */}
        {question && (
          <AnimatePresence mode="wait">
            <motion.div key={question.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }} className="glass-card-static p-6 md:p-8">
              {/* Difficulty Badge */}
              <div className="flex items-center justify-between mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-medium badge-${question.difficulty}`}>
                  {question.difficulty.charAt(0).toUpperCase() + question.difficulty.slice(1)}
                </span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{question.topic_name}</span>
              </div>

              <h2 className="text-lg md:text-xl font-semibold mb-6 leading-relaxed">
                {question.text}
              </h2>

              {/* Options */}
              <div className="space-y-3">
                {Object.entries(question.options).map(([key, value]) => {
                  const isSelected = selectedAnswer === key;
                  const showResult = sessionState === "feedback";
                  const isCorrectOption = key === correctAnswer;

                  let borderColor = "var(--border-glass)";
                  let bgColor = "transparent";
                  if (showResult && isCorrectOption) {
                    borderColor = "var(--success)";
                    bgColor = "var(--success-glow)";
                  } else if (showResult && isSelected && !isCorrect) {
                    borderColor = "var(--error)";
                    bgColor = "var(--error-glow)";
                  } else if (isSelected && !showResult) {
                    borderColor = "var(--accent-primary)";
                    bgColor = "var(--accent-glow)";
                  }

                  return (
                    <motion.button
                      key={key}
                      whileHover={!showResult ? { scale: 1.01 } : {}}
                      whileTap={!showResult ? { scale: 0.99 } : {}}
                      onClick={() => !showResult && sessionState === "active" && submitAnswer(key)}
                      disabled={showResult || sessionState === "loading"}
                      className="w-full text-left p-4 rounded-xl flex items-center gap-3 transition-all duration-200"
                      style={{ border: `1px solid ${borderColor}`, background: bgColor }}
                    >
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0"
                            style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" }}>
                        {key}
                      </span>
                      <span className="text-sm">{value}</span>
                      {showResult && isCorrectOption && <CheckCircle2 className="w-5 h-5 ml-auto text-green-400" />}
                      {showResult && isSelected && !isCorrect && !isCorrectOption && (
                        <XCircle className="w-5 h-5 ml-auto text-red-400" />
                      )}
                    </motion.button>
                  );
                })}
              </div>

              {/* Feedback Section */}
              {sessionState === "feedback" && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
                  <div className={`p-4 rounded-xl mb-4 ${isCorrect ? "badge-easy" : "badge-hard"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {isCorrect ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                      <span className="font-semibold">
                        {isCorrect ? "Correct!" : "Incorrect"}
                      </span>
                      <span className="ml-auto text-sm font-medium">
                        {reward >= 0 ? "+" : ""}{reward.toFixed(0)} pts
                      </span>
                    </div>
                    {explanation && <p className="text-sm mt-2 opacity-90">{explanation}</p>}
                  </div>
                  <button onClick={nextQuestion}
                          className="btn-primary w-full flex items-center justify-center gap-2">
                    Next Question <ArrowRight className="w-5 h-5" />
                  </button>
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* No question available */}
        {!question && sessionState === "active" && (
          <div className="glass-card-static p-8 text-center">
            <p style={{ color: "var(--text-secondary)" }}>No more questions available. </p>
            <button onClick={endEarly} className="btn-primary mt-4">End Session</button>
          </div>
        )}
      </main>
    </div>
  );
}
