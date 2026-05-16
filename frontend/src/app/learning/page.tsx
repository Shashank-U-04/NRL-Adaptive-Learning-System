"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { learningApi, type QuizStats, type ServerModule, type ServerLesson, type ServerLab, type ServerQuestion } from "@/lib/api";
import AppLayout from "@/components/AppLayout";
import LessonViewer from "@/features/learning/components/LessonViewer";
import LabPanel from "@/features/learning/components/LabPanel";
import QuizEngine from "@/features/learning/components/QuizEngine";
import type { Difficulty, Module, Lesson, Lab, Question } from "@/features/learning/types";
import {
  Loader2, AlertCircle, RefreshCcw, Trophy, CheckCircle2,
  Terminal, BookOpen, Clock, ChevronRight, Sparkles, Layers,
} from "lucide-react";

type ViewState = "roadmap" | "module-detail" | "lesson" | "lab" | "quiz";
type DifficultyFilter = "all" | "beginner" | "intermediate" | "advanced";

// ── Per-topic theming (hash → palette) ────────────────────
const THEME_PALETTE = [
  { from: "#3B82F6", to: "#6aa6ff", label: "accent" },
  { from: "#8B5CF6", to: "#a78bfa", label: "violet" },
  { from: "#14B8A6", to: "#5eead4", label: "teal" },
  { from: "#F59E0B", to: "#fbbf24", label: "amber" },
  { from: "#10B981", to: "#34d399", label: "green" },
  { from: "#F43F5E", to: "#fb7185", label: "rose" },
] as const;

function themeForTitle(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return THEME_PALETTE[hash % THEME_PALETTE.length];
}

// ── Mapping ───────────────────────────────────────────────
function serverToModule(s: ServerModule): Module {
  return {
    id: s.id,
    title: s.title,
    description: s.description ?? "",
    difficulty: (s.difficulty as Difficulty) ?? "beginner",
    estimated_minutes: s.estimated_minutes,
    lessons: (s.lessons ?? []).map((l: ServerLesson): Lesson => ({
      id: l.id,
      title: l.title,
      content: l.content,
      checkpoints: (l.checkpoints ?? []).map((q: ServerQuestion): Question => ({
        id: q.id,
        type: q.type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })),
      visuals: l.visuals,
    })),
    labs: (s.labs ?? []).map((lab: ServerLab): Lab => ({
      id: lab.id,
      title: lab.title,
      description: lab.description,
      instructions: lab.instructions,
      expectedOutcome: lab.expectedOutcome,
      validationRules: lab.validationRules,
      hints: lab.hints,
    })),
    quizPool: (s.quizPool ?? []).map((q: ServerQuestion): Question => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
    })),
    progress: s.progress ?? 0,
  };
}

// ── Stagger variants ──────────────────────────────────────
const gridVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

// ── Page ──────────────────────────────────────────────────
function LearningPageInner() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const toast = useToast();
  const selectedTopic = searchParams.get("topic");

  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeLab, setActiveLab] = useState<Lab | null>(null);
  type ViewOverride = "lesson" | "lab" | "quiz" | null;
  const [viewOverride, setViewOverride] = useState<ViewOverride>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");

  // ── Queries ───────────────────────────────────────────
  const {
    data: modulesData,
    isLoading: modulesLoading,
    error: modulesError,
    refetch: refetchModules,
  } = useQuery({
    queryKey: ["learning-modules"],
    queryFn: () => learningApi.getModules(),
    enabled: isAuthenticated && !selectedTopic,
  });

  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailError,
  } = useQuery({
    queryKey: ["learning-module", selectedTopic],
    queryFn: () => learningApi.getModuleDetail(selectedTopic!),
    enabled: isAuthenticated && !!selectedTopic,
  });

  const { data: progressData } = useQuery({
    queryKey: ["learning-progress", selectedTopic],
    queryFn: () => learningApi.getProgress(selectedTopic!),
    enabled: isAuthenticated && !!selectedTopic,
  });

  // ── Mutations ──────────────────────────────────────────
  const updateProgressMutation = useMutation({
    mutationFn: (data: { lesson_id?: string; lab_id?: string; quiz_score?: number; quiz_stats?: QuizStats }) =>
      learningApi.updateProgress({ topic_id: selectedTopic!, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-progress", selectedTopic] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Failed to update progress");
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  // Derive view state
  const viewState: ViewState = (() => {
    if (viewOverride) return viewOverride;
    if (!selectedTopic) return "roadmap";
    if (detailData?.success) return "module-detail";
    return "roadmap";
  })();

  const openModule = (id: string) => {
    router.push(`/learning?topic=${encodeURIComponent(id)}`);
  };

  const handleBackToRoadmap = () => {
    router.push("/learning");
  };

  const handleLessonComplete = async (lessonId: string) => {
    const startTime = sessionStorage.getItem(`lesson_start_${lessonId}`);
    const timeSpent = startTime ? Math.round((Date.now() - parseInt(startTime)) / 1000) : 0;
    await updateProgressMutation.mutateAsync({
      lesson_id: lessonId,
      quiz_stats: { time_spent_seconds: timeSpent },
    });
    setViewOverride(null);
  };

  const handleLabComplete = async (labId: string) => {
    await updateProgressMutation.mutateAsync({ lab_id: labId });
    setViewOverride(null);
  };

  const handleQuizComplete = async (score: number, stats: QuizStats) => {
    await updateProgressMutation.mutateAsync({ quiz_score: score, quiz_stats: stats });
    handleBackToRoadmap();
  };

  useEffect(() => {
    if (viewState === "lesson" && activeLesson) {
      sessionStorage.setItem(`lesson_start_${activeLesson.id}`, Date.now().toString());
    }
  }, [viewState, activeLesson]);

  // Surface fetch errors via toast (don't render static error blocks for transient issues)
  useEffect(() => {
    if (detailError) {
      toast.error(detailError instanceof Error ? detailError.message : "Failed to load module");
    }
  }, [detailError, toast]);

  const modules: ServerModule[] = useMemo(() => modulesData?.data?.modules ?? [], [modulesData]);
  const activeModule = detailData?.data?.module ? serverToModule(detailData.data.module) : undefined;
  const progress = progressData ?? {
    completed_lessons: [],
    completed_labs: [],
    quiz_scores: [],
    is_completed: false,
  };
  const loading = modulesLoading || detailLoading;
  const hasError = !!(modulesError || (detailData && !detailData.success));

  // Map difficulty values to filter buckets
  const normalizeDifficulty = (d?: string): DifficultyFilter => {
    if (!d) return "intermediate";
    const lower = d.toLowerCase();
    if (lower === "easy" || lower === "beginner") return "beginner";
    if (lower === "hard" || lower === "advanced") return "advanced";
    return "intermediate";
  };

  const visibleModules = useMemo(() => {
    if (difficultyFilter === "all") return modules;
    return modules.filter((m) => normalizeDifficulty(m.difficulty) === difficultyFilter);
  }, [modules, difficultyFilter]);

  if (authLoading) return null;

  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%", position: "relative" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 60px" }}>

          {/* ── Roadmap view ─────────────────────────── */}
          {viewState === "roadmap" && (
            <>
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                style={{ marginBottom: 22 }}
              >
                <h1 className="page-h1">Learning library</h1>
                <p className="page-sub">
                  Structured modules with lessons, hands-on labs, and adaptive quizzes.
                </p>
              </motion.div>

              {/* Filter row */}
              {!loading && modules.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                  <div className="tabs">
                    {(["all", "beginner", "intermediate", "advanced"] as const).map((d) => (
                      <button
                        key={d}
                        className={`tab${difficultyFilter === d ? " active" : ""}`}
                        onClick={() => setDifficultyFilter(d)}
                      >
                        {d === "all" ? "All" : d === "beginner" ? "Easy" : d === "intermediate" ? "Medium" : "Hard"}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                    {visibleModules.length} {visibleModules.length === 1 ? "module" : "modules"}
                  </span>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div style={{ minHeight: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <Loader2 style={{ width: 32, height: 32, color: "var(--accent)", animation: "spin 0.7s linear infinite" }} />
                  <p style={{ color: "var(--text-3)", fontSize: 13 }}>Loading modules…</p>
                </div>
              )}

              {/* Error */}
              {!loading && hasError && (
                <div style={{ minHeight: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, textAlign: "center" }}>
                  <div style={{ width: 64, height: 64, borderRadius: 999, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", display: "grid", placeItems: "center" }}>
                    <AlertCircle style={{ width: 28, height: 28, color: "var(--red)" }} />
                  </div>
                  <p style={{ color: "var(--text-2)", fontSize: 14 }}>Failed to load learning data. Please try again.</p>
                  <button className="btn btn-ghost" onClick={() => refetchModules()}>
                    <RefreshCcw style={{ width: 14, height: 14 }} /> Try again
                  </button>
                </div>
              )}

              {/* Empty (no modules at all) */}
              {!loading && !hasError && modules.length === 0 && (
                <div style={{ display: "grid", placeItems: "center", minHeight: 360 }}>
                  <div className="glass" style={{ padding: "40px 36px", textAlign: "center", maxWidth: 420 }}>
                    <div
                      style={{
                        width: 60, height: 60, borderRadius: 16,
                        background: "var(--accent-soft)", border: "1px solid var(--accent-line)",
                        display: "grid", placeItems: "center", margin: "0 auto 16px",
                        color: "var(--accent)",
                      }}
                    >
                      <BookOpen size={26} />
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px" }}>No modules available yet</h3>
                    <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
                      Curated learning content is being prepared. Check back soon.
                    </p>
                  </div>
                </div>
              )}

              {/* Empty (filter narrowed) */}
              {!loading && !hasError && modules.length > 0 && visibleModules.length === 0 && (
                <div style={{ display: "grid", placeItems: "center", minHeight: 240 }}>
                  <div className="glass" style={{ padding: "32px 28px", textAlign: "center", maxWidth: 380 }}>
                    <Layers size={22} style={{ color: "var(--text-3)", marginBottom: 10 }} />
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>No modules match this filter</h3>
                    <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 14px" }}>
                      Try a different difficulty level.
                    </p>
                    <button className="btn btn-ghost" onClick={() => setDifficultyFilter("all")}>
                      Show all modules
                    </button>
                  </div>
                </div>
              )}

              {/* Module grid */}
              {!loading && !hasError && visibleModules.length > 0 && (
                <motion.div
                  variants={gridVariants}
                  initial="hidden"
                  animate="visible"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                    gap: 16,
                  }}
                >
                  {visibleModules.map((module) => {
                    const theme = themeForTitle(module.title || module.id);
                    const moduleProgress = Math.min(100, Math.max(0, module.progress ?? 0));
                    const difficulty = normalizeDifficulty(module.difficulty);
                    const difficultyLabel = difficulty === "beginner" ? "Easy" : difficulty === "advanced" ? "Hard" : "Medium";
                    const estimatedTime = module.estimated_minutes ?? module.duration ?? 20;

                    const pillClass =
                      difficulty === "beginner" ? "pill pill-easy" :
                      difficulty === "advanced" ? "pill pill-hard" :
                      "pill pill-medium";

                    return (
                      <motion.button
                        key={module.id}
                        variants={itemVariants}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => openModule(module.id)}
                        className="glass glass-hover"
                        style={{
                          padding: 0,
                          display: "flex",
                          flexDirection: "column",
                          textAlign: "left",
                          cursor: "pointer",
                          overflow: "hidden",
                          minHeight: 280,
                          border: "1px solid var(--line)",
                        }}
                      >
                        {/* Thumbnail */}
                        <div
                          className="mod-thumb"
                          style={{
                            background: `linear-gradient(135deg, ${theme.from} 0%, ${theme.to} 100%)`,
                            margin: 0,
                            borderRadius: 0,
                            borderTopLeftRadius: 14,
                            borderTopRightRadius: 14,
                            height: 110,
                          }}
                        >
                          {/* Subtle pattern */}
                          <div
                            style={{
                              position: "absolute", inset: 0,
                              backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.18) 1px, transparent 1px)`,
                              backgroundSize: "16px 16px",
                              opacity: 0.5,
                            }}
                          />
                          <div
                            style={{
                              width: 52, height: 52, borderRadius: 14,
                              background: "rgba(255,255,255,0.22)",
                              backdropFilter: "blur(8px)",
                              border: "1px solid rgba(255,255,255,0.35)",
                              display: "grid", placeItems: "center",
                              position: "relative", zIndex: 1,
                            }}
                          >
                            <Sparkles size={22} style={{ color: "#fff" }} />
                          </div>
                        </div>

                        {/* Body */}
                        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", flex: 1, gap: 10 }}>
                          {/* Title */}
                          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.01em" }}>
                            {module.title}
                          </div>

                          {/* Description — truncated to 2 lines */}
                          {module.description && (
                            <p
                              style={{
                                fontSize: 12.5,
                                color: "var(--text-2)",
                                margin: 0,
                                lineHeight: 1.5,
                                display: "-webkit-box",
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {module.description}
                            </p>
                          )}

                          {/* Meta row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                            <span className={pillClass}>{difficultyLabel}</span>
                            <span className="pill pill-neutral" style={{ gap: 4 }}>
                              <Clock size={11} /> {estimatedTime} min
                            </span>
                          </div>

                          {/* Spacer */}
                          <div style={{ flex: 1 }} />

                          {/* Progress */}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                                Progress
                              </span>
                              <span style={{ fontSize: 11, color: moduleProgress > 0 ? "var(--accent)" : "var(--text-3)", fontWeight: 600 }}>
                                {moduleProgress}%
                              </span>
                            </div>
                            <div className={`pbar${moduleProgress >= 100 ? " green" : ""}`}>
                              <span style={{ width: `${moduleProgress}%` }} />
                            </div>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </motion.div>
              )}
            </>
          )}

          {/* ── Module detail ─────────────────────────── */}
          {viewState === "module-detail" && activeModule && (
            <ModuleView
              module={activeModule}
              progress={progress}
              onBack={handleBackToRoadmap}
              onStartLesson={(l) => { setActiveLesson(l); setViewOverride("lesson"); }}
              onStartLab={(lab) => { setActiveLab(lab); setViewOverride("lab"); }}
              onStartQuiz={() => setViewOverride("quiz")}
            />
          )}

          {/* ── Lesson viewer ─────────────────────────── */}
          {viewState === "lesson" && activeLesson && (
            <LessonViewer
              lesson={activeLesson}
              onBack={() => setViewOverride(null)}
              onComplete={() => handleLessonComplete(activeLesson.id)}
            />
          )}

          {/* ── Lab panel ─────────────────────────────── */}
          {viewState === "lab" && activeLab && (
            <LabPanel
              lab={activeLab}
              onBack={() => setViewOverride(null)}
              onComplete={() => handleLabComplete(activeLab.id)}
            />
          )}

          {/* ── Quiz engine ───────────────────────────── */}
          {viewState === "quiz" && activeModule && (
            <QuizEngine
              questions={activeModule.quizPool}
              title={`${activeModule.title} — Final quiz`}
              onBack={() => setViewOverride(null)}
              onComplete={(score, stats) => handleQuizComplete(score, stats)}
            />
          )}

        </div>
      </div>
    </AppLayout>
  );
}

export default function LearningPage() {
  return (
    <Suspense>
      <LearningPageInner />
    </Suspense>
  );
}

// ── Internal Module Detail View ──────────────────────────
function ModuleView({
  module,
  progress,
  onBack,
  onStartLesson,
  onStartLab,
  onStartQuiz,
}: {
  module: Module;
  progress: { completed_lessons: string[]; completed_labs: string[]; quiz_scores: Array<{ score: number }>; is_completed: boolean } | null;
  onBack: () => void;
  onStartLesson: (l: Lesson) => void;
  onStartLab: (lab: Lab) => void;
  onStartQuiz: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"lessons" | "labs" | "quiz">("lessons");
  const completedLessons: string[] = progress?.completed_lessons ?? [];
  const completedLabs: string[] = progress?.completed_labs ?? [];

  return (
    <div>
      {/* Back + header */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 26 }}>
        <button
          className="btn btn-ghost"
          style={{ alignSelf: "flex-start", height: 32, padding: "0 12px", fontSize: 12 }}
          onClick={onBack}
        >
          ← Back to library
        </button>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 360px", minWidth: 0 }}>
            <h1 className="page-h1" style={{ marginBottom: 6 }}>{module.title}</h1>
            <p className="page-sub" style={{ marginTop: 0 }}>{module.description}</p>
          </div>
          {/* Progress summary */}
          <div className="glass" style={{ padding: "14px 22px", display: "flex", gap: 24, flexShrink: 0 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Lessons</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--accent)" }}>{completedLessons.length}/{module.lessons.length}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Labs</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "var(--teal)" }}>{completedLabs.length}/{module.labs.length}</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", fontWeight: 600, marginBottom: 2 }}>Status</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: progress?.is_completed ? "var(--green)" : "var(--amber)" }}>
                {progress?.is_completed ? "Mastered" : "Active"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 22 }}>
        {(["lessons", "labs", "quiz"] as const).map((t) => (
          <button key={t} className={`tab${activeTab === t ? " active" : ""}`} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Lessons tab */}
      {activeTab === "lessons" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {module.lessons.map((lesson, i) => {
            const isDone = completedLessons.includes(lesson.id);
            return (
              <div
                key={lesson.id}
                className="glass glass-hover"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "14px 18px",
                  cursor: "pointer",
                  background: isDone ? "rgba(16,185,129,0.06)" : undefined,
                  borderColor: isDone ? "rgba(16,185,129,0.25)" : undefined,
                }}
                onClick={() => onStartLesson(lesson)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      border: `1px solid ${isDone ? "rgba(16,185,129,0.35)" : "var(--line)"}`,
                      background: isDone ? "rgba(16,185,129,0.15)" : "rgba(0,0,0,0.03)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 12,
                      fontWeight: 600,
                      color: isDone ? "var(--green)" : "var(--text-3)",
                      flexShrink: 0,
                    }}
                  >
                    {isDone ? <CheckCircle2 style={{ width: 16, height: 16 }} /> : String(i + 1).padStart(2, "0")}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: isDone ? "var(--green)" : "var(--text)" }}>
                    {lesson.title}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {lesson.checkpoints.length} checkpoints
                  </span>
                  <ChevronRight size={14} style={{ color: "var(--text-3)" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Labs tab */}
      {activeTab === "labs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {module.labs.map((lab) => {
            const isDone = completedLabs.includes(lab.id);
            return (
              <div
                key={lab.id}
                className="glass"
                style={{
                  padding: 22,
                  background: isDone ? "rgba(16,185,129,0.05)" : undefined,
                  borderColor: isDone ? "rgba(16,185,129,0.2)" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{lab.title}</h3>
                  {isDone && <CheckCircle2 style={{ width: 16, height: 16, color: "var(--green)" }} />}
                </div>
                <p style={{ color: "var(--text-2)", fontSize: 13, margin: "0 0 14px", lineHeight: 1.55 }}>{lab.description}</p>
                <button
                  className={`btn ${isDone ? "btn-ghost" : "btn-primary"}`}
                  onClick={() => onStartLab(lab)}
                >
                  <Terminal style={{ width: 14, height: 14 }} />
                  {isDone ? "Redo lab" : "Start lab"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Quiz tab */}
      {activeTab === "quiz" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 20, textAlign: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              border: `1px solid ${progress?.is_completed ? "rgba(16,185,129,0.3)" : "rgba(59,130,246,0.3)"}`,
              background: progress?.is_completed ? "rgba(16,185,129,0.08)" : "rgba(59,130,246,0.08)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Trophy style={{ width: 32, height: 32, color: progress?.is_completed ? "var(--green)" : "var(--accent)" }} />
          </div>
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 600, margin: "0 0 6px" }}>
              {progress?.is_completed ? "Module mastered" : "Final module assessment"}
            </h3>
            <p style={{ color: "var(--text-2)", fontSize: 13, maxWidth: 360, margin: 0, lineHeight: 1.5 }}>
              {progress?.is_completed
                ? `Your highest score: ${progress.quiz_scores.length > 0 ? Math.max(...progress.quiz_scores.map((s) => s.score)) : 0}%`
                : `Test your knowledge of ${module.title} through an adaptive assessment.`}
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onStartQuiz}>
            {progress?.is_completed ? "Retake quiz" : "Start quiz"}
          </button>
        </div>
      )}
    </div>
  );
}
