"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { learningApi, type QuizStats, type ServerModule, type ServerLesson, type ServerLab, type ServerQuestion } from "@/lib/api";
import AppLayout from "@/components/AppLayout";
import LessonViewer from "@/features/learning/components/LessonViewer";
import LabPanel from "@/features/learning/components/LabPanel";
import QuizEngine from "@/features/learning/components/QuizEngine";
import type { Difficulty, Module, Lesson, Lab, Question } from "@/features/learning/types";
import {
  Loader2, AlertCircle, RefreshCcw, Trophy, CheckCircle2,
  Terminal, BookOpen, Grid3x3, Clock,
} from "lucide-react";

type ViewState = "roadmap" | "module-detail" | "lesson" | "lab" | "quiz";

// ── Topic colours ────────────────────────────────────────
const TOPIC_COLORS: Record<string, string> = {
  "network-security": "#3B82F6",
  "web-security": "#10B981",
  "cryptography": "#8B5CF6",
  "malware-analysis": "#EF4444",
  "forensics": "#F59E0B",
  "social-engineering": "#F43F5E",
  "osint": "#14B8A6",
};
function topicColor(id: string): string {
  return TOPIC_COLORS[id] ?? "#3B82F6";
}

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

function LearningPageInner() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedTopic = searchParams.get("topic");

  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeLab, setActiveLab] = useState<Lab | null>(null);
  type ViewOverride = "lesson" | "lab" | "quiz" | null;
  const [viewOverride, setViewOverride] = useState<ViewOverride>(null);
  const [topicFilter, setTopicFilter] = useState<string>("all");

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

  const {
    data: progressData,
  } = useQuery({
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
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  // Derive view state from URL + data — user interactions can override via viewOverride
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

  if (authLoading) return null;

  const modules: ServerModule[] = modulesData?.data?.modules ?? [];
  const activeModule = detailData?.data?.module ? serverToModule(detailData.data.module) : undefined;
  const progress = progressData ?? {
    completed_lessons: [],
    completed_labs: [],
    quiz_scores: [],
    is_completed: false,
  };
  const loading = modulesLoading || detailLoading;
  const hasError = !!(modulesError || detailError || (detailData && !detailData.success));

  // Unique topic list for chips
  const allTopics = Array.from(new Set(modules.map((m) => m.topic_id ?? m.id)));
  const visibleModules =
    topicFilter === "all"
      ? modules
      : modules.filter((m) => (m.topic_id ?? m.id) === topicFilter);

  return (
    <AppLayout>
      <div className="scroll-y" style={{ height: "100%" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 32px 40px" }}>

          {/* ── Roadmap view ─────────────────────────── */}
          {viewState === "roadmap" && (
            <>
              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <h1 className="page-h1">Learning modules</h1>
                <p className="page-sub">
                  Master cybersecurity through structured modules, interactive lessons, and hands-on labs.
                </p>
              </div>

              {/* Topic chips */}
              {modules.length > 0 && (
                <div className="scroll-x" style={{ display: "flex", gap: 8, paddingBottom: 8, marginBottom: 16 }}>
                  <button
                    className={`chip${topicFilter === "all" ? " active" : ""}`}
                    onClick={() => setTopicFilter("all")}
                  >
                    All
                  </button>
                  {allTopics.map((t) => (
                    <button
                      key={t}
                      className={`chip${topicFilter === t ? " active" : ""}`}
                      onClick={() => setTopicFilter(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div style={{ minHeight: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                  <Loader2 style={{ width: 32, height: 32, color: "var(--accent)", animation: "spin 0.7s linear infinite" }} />
                  <p style={{ color: "var(--text-3)", fontSize: 13 }}>Initializing learning environment…</p>
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
                    <RefreshCcw style={{ width: 14, height: 14 }} /> Try Again
                  </button>
                </div>
              )}

              {/* Module grid */}
              {!loading && !hasError && (
                visibleModules.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
                    {visibleModules.map((module) => {
                      const color = topicColor(module.topic_id ?? module.id ?? "");
                      const moduleProgress = module.progress ?? 0;
                      const difficulty = module.difficulty ?? "intermediate";
                      const type = module.type ?? "text";
                      const estimatedTime = module.estimated_minutes ?? module.duration ?? 20;

                      const TypeIcon =
                        type === "lab" ? Terminal : type === "text" ? BookOpen : Grid3x3;

                      return (
                        <div key={module.id} className="glass glass-hover" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 0, cursor: "default" }}>
                          {/* Thumbnail */}
                          <div
                            className="mod-thumb"
                            style={{
                              background: `linear-gradient(135deg, ${color}28, ${color}08)`,
                              marginBottom: 12,
                              position: "relative",
                            }}
                          >
                            {/* Topic label */}
                            <span
                              style={{
                                position: "absolute",
                                top: 8,
                                left: 8,
                                fontSize: 10,
                                color: color,
                                background: `${color}22`,
                                padding: "2px 8px",
                                borderRadius: 999,
                                border: `1px solid ${color}44`,
                                fontWeight: 500,
                                zIndex: 1,
                              }}
                            >
                              {module.topic_id ?? module.id}
                            </span>
                            {/* Icon */}
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 10,
                                background: `${color}22`,
                                display: "grid",
                                placeItems: "center",
                                position: "relative",
                                zIndex: 1,
                              }}
                            >
                              <TypeIcon style={{ width: 20, height: 20, color }} />
                            </div>
                          </div>

                          {/* Pills row */}
                          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                            <span className="pill pill-neutral">{type}</span>
                            <span
                              className={`pill ${
                                difficulty === "beginner"
                                  ? "pill-easy"
                                  : difficulty === "advanced"
                                  ? "pill-hard"
                                  : "pill-medium"
                              }`}
                            >
                              {difficulty}
                            </span>
                          </div>

                          {/* Title */}
                          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8, lineHeight: 1.4 }}>
                            {module.title}
                          </div>

                          {/* Time */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-3)", marginBottom: 10 }}>
                            <Clock style={{ width: 12, height: 12 }} />
                            {estimatedTime} min
                          </div>

                          {/* Progress bar */}
                          {moduleProgress > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div className="pbar green">
                                <span style={{ width: `${moduleProgress}%` }} />
                              </div>
                            </div>
                          )}

                          {/* CTA button */}
                          <button
                            className={`btn ${moduleProgress >= 100 ? "btn-ghost" : moduleProgress > 0 ? "btn-primary" : "btn-ghost"}`}
                            style={{ width: "100%", marginTop: "auto" }}
                            onClick={() => openModule(module.id)}
                          >
                            {moduleProgress >= 100 ? "Review" : moduleProgress > 0 ? "Continue" : "Start"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
                    No learning modules available yet. Check back soon!
                  </div>
                )
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
              title={`${activeModule.title} - Final Quiz`}
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

// ── Internal Module View ─────────────────────────────────
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
      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
        <button
          className="btn btn-ghost"
          style={{ alignSelf: "flex-start", height: 32, padding: "0 12px", fontSize: 12 }}
          onClick={onBack}
        >
          ← Back to Roadmap
        </button>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 className="page-h1" style={{ marginBottom: 6 }}>{module.title}</h1>
            <p className="page-sub">{module.description}</p>
          </div>
          {/* Progress summary */}
          <div className="glass" style={{ padding: "12px 20px", display: "flex", gap: 20, flexShrink: 0 }}>
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
                {progress?.is_completed ? "MASTERED" : "ACTIVE"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
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
                      background: isDone ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
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
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {lesson.checkpoints.length} checkpoints
                </span>
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
                  padding: 20,
                  background: isDone ? "rgba(16,185,129,0.05)" : undefined,
                  borderColor: isDone ? "rgba(16,185,129,0.2)" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>{lab.title}</h3>
                  {isDone && <CheckCircle2 style={{ width: 16, height: 16, color: "var(--green)" }} />}
                </div>
                <p style={{ color: "var(--text-2)", fontSize: 13, marginBottom: 14, margin: "0 0 14px" }}>{lab.description}</p>
                <button
                  className={`btn ${isDone ? "btn-ghost" : "btn-primary"}`}
                  onClick={() => onStartLab(lab)}
                >
                  <Terminal style={{ width: 14, height: 14 }} />
                  {isDone ? "Redo Simulation" : "Initialize Simulation"}
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
              {progress?.is_completed ? "Module Mastered!" : "Final Module Assessment"}
            </h3>
            <p style={{ color: "var(--text-2)", fontSize: 13, maxWidth: 340, margin: 0 }}>
              {progress?.is_completed
                ? `Your highest score: ${progress.quiz_scores.length > 0 ? Math.max(...progress.quiz_scores.map((s) => s.score)) : 0}%`
                : `Test your knowledge of ${module.title} through a randomised adaptive assessment.`}
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onStartQuiz}>
            {progress?.is_completed ? "Retake Quiz" : "Start Quiz"}
          </button>
        </div>
      )}
    </div>
  );
}
