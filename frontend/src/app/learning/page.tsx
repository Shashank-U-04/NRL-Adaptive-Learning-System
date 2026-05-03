"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { learningApi } from "@/lib/api";
import ModuleCard from "@/features/learning/components/ModuleCard";
import LessonViewer from "@/features/learning/components/LessonViewer";
import LabPanel from "@/features/learning/components/LabPanel";
import QuizEngine from "@/features/learning/components/QuizEngine";
import type { Module, ModuleSummary, Lesson, Lab } from "@/features/learning/types";
import { Loader2, AlertCircle, RefreshCcw, Trophy, CheckCircle2, Terminal, BookOpen } from "lucide-react";

type ViewState = "roadmap" | "module-detail" | "lesson" | "lab" | "quiz";

export default function LearningPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const selectedTopic = searchParams.get("topic");
  
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [activeLab, setActiveLab] = useState<Lab | null>(null);
  const [viewState, setViewState] = useState<ViewState>("roadmap");

  // ── Queries ───────────────────────────────────────────
  
  // Fetch modules list
  const { 
    data: modulesData, 
    isLoading: modulesLoading, 
    error: modulesError,
    refetch: refetchModules
  } = useQuery({
    queryKey: ["learning-modules"],
    queryFn: () => learningApi.getModules(),
    enabled: isAuthenticated && !selectedTopic,
  });

  // Fetch module detail
  const {
    data: detailData,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail
  } = useQuery({
    queryKey: ["learning-module", selectedTopic],
    queryFn: () => learningApi.getModuleDetail(selectedTopic!),
    enabled: isAuthenticated && !!selectedTopic,
  });

  // Fetch user progress
  const {
    data: progressData,
    isLoading: progressLoading,
    refetch: refetchProgress
  } = useQuery({
    queryKey: ["learning-progress", selectedTopic],
    queryFn: () => learningApi.getProgress(selectedTopic!),
    enabled: isAuthenticated && !!selectedTopic,
  });

  // ── Mutations ──────────────────────────────────────────
  
  const updateProgressMutation = useMutation({
    mutationFn: (data: { lesson_id?: string; lab_id?: string; quiz_score?: number; quiz_stats?: any }) => 
      learningApi.updateProgress({ topic_id: selectedTopic!, ...data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learning-progress", selectedTopic] });
    }
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!selectedTopic) {
      setViewState("roadmap");
    } else if (detailData?.success) {
      setViewState("module-detail");
    }
  }, [selectedTopic, detailData]);

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
      quiz_stats: { time_spent_seconds: timeSpent } // Store time spent in stats
    });
    setViewState("module-detail");
  };

  const handleLabComplete = async (labId: string) => {
    await updateProgressMutation.mutateAsync({ lab_id: labId });
    setViewState("module-detail");
  };

  const handleQuizComplete = async (score: number, stats: any) => {
    await updateProgressMutation.mutateAsync({ 
      quiz_score: score, 
      quiz_stats: stats 
    });
    handleBackToRoadmap();
  };

  useEffect(() => {
    if (viewState === "lesson" && activeLesson) {
      sessionStorage.setItem(`lesson_start_${activeLesson.id}`, Date.now().toString());
    }
  }, [viewState, activeLesson]);

  const loading = modulesLoading || detailLoading || authLoading;
  const error = (modulesError || detailError || (detailData && !detailData.success)) ? 
                "Failed to load learning data. Please try again." : null;

  if (authLoading) return null;

  const modules = modulesData?.data?.modules || [];
  const activeModule = detailData?.data?.module;
  const progress = progressData || { completed_lessons: [], completed_labs: [], quiz_scores: [], is_completed: false };

  return (
    <div className="min-h-screen text-slate-200" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {loading && viewState === "roadmap" && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
            <p className="text-slate-400 font-medium animate-pulse">Initializing learning environment...</p>
          </div>
        )}

        {error && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/20">
              <AlertCircle className="w-10 h-10 text-rose-500" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2 text-white">System Error</h3>
              <p className="text-slate-400 leading-relaxed">{error}</p>
            </div>
            <button
              onClick={() => selectedTopic ? refetchDetail() : refetchModules()}
              className="flex items-center gap-2 px-6 py-2 rounded-xl bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" /> Try Again
            </button>
          </div>
        )}

        {!loading && !error && viewState === "roadmap" && (
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
              <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                Learning Roadmap
              </h1>
              <p className="text-slate-400 max-w-2xl text-lg leading-relaxed">
                Master cybersecurity through structured modules, interactive lessons, and hands-on laboratory simulations.
              </p>
            </motion.div>

            {modules.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {modules.map((module: ModuleSummary, index: number) => (
                  <motion.div key={module.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                    <ModuleCard module={module} onStart={openModule} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/20">
                <p className="text-slate-500 text-lg italic">No learning modules available yet. Check back soon!</p>
              </div>
            )}
          </>
        )}

        <AnimatePresence mode="wait">
          {viewState === "module-detail" && activeModule && (
            <motion.div key="module-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ModuleView 
                module={activeModule} 
                progress={progress}
                onBack={handleBackToRoadmap} 
                onStartLesson={(l) => { setActiveLesson(l); setViewState("lesson"); }}
                onStartLab={(lab) => { setActiveLab(lab); setViewState("lab"); }}
                onStartQuiz={() => setViewState("quiz")}
              />
            </motion.div>
          )}

          {viewState === "lesson" && activeLesson && (
            <motion.div key="lesson" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <LessonViewer 
                lesson={activeLesson} 
                onBack={() => setViewState("module-detail")} 
                onComplete={() => handleLessonComplete(activeLesson.id)} 
              />
            </motion.div>
          )}

          {viewState === "lab" && activeLab && (
            <motion.div key="lab" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }}>
              <LabPanel 
                lab={activeLab} 
                onBack={() => setViewState("module-detail")} 
                onComplete={() => handleLabComplete(activeLab.id)} 
              />
            </motion.div>
          )}

          {viewState === "quiz" && activeModule && (
            <motion.div key="quiz" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <QuizEngine 
                questions={activeModule.quizPool} 
                title={`${activeModule.title} - Final Quiz`}
                onBack={() => setViewState("module-detail")}
                onComplete={(score, stats) => handleQuizComplete(score, stats)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// Internal Module View Component
function ModuleView({ 
  module, 
  progress,
  onBack, 
  onStartLesson, 
  onStartLab, 
  onStartQuiz 
}: { 
  module: Module; 
  progress: any;
  onBack: () => void;
  onStartLesson: (l: Lesson) => void;
  onStartLab: (lab: Lab) => void;
  onStartQuiz: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"lessons" | "labs" | "quiz">("lessons");

  const completedLessons = progress?.completed_lessons || [];
  const completedLabs = progress?.completed_labs || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <button 
            onClick={onBack}
            className="text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest"
          >
            ← Back to Roadmap
          </button>
          <h1 className="text-4xl font-bold text-white">{module.title}</h1>
          <p className="text-slate-400 max-w-3xl leading-relaxed">{module.description}</p>
        </div>
        
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-inner flex gap-8">
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-1">Lessons</p>
            <p className="text-xl font-mono text-indigo-400">{completedLessons.length}/{module.lessons.length}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-1">Labs</p>
            <p className="text-xl font-mono text-teal-400">{completedLabs.length}/{module.labs.length}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter mb-1">Status</p>
            <p className={`text-xl font-mono italic ${progress?.is_completed ? "text-emerald-400" : "text-amber-400"}`}>
              {progress?.is_completed ? "MASTERED" : "ACTIVE"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-b border-slate-800 pb-px">
        {["lessons", "labs", "quiz"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-6 py-4 text-sm font-bold uppercase tracking-widest transition-all relative ${
              activeTab === tab ? "text-indigo-400" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]" />
            )}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {activeTab === "lessons" && (
          <div className="grid gap-4">
            {module.lessons.map((lesson, i) => {
              const isDone = completedLessons.includes(lesson.id);
              return (
                <motion.div 
                  key={lesson.id}
                  onClick={() => onStartLesson(lesson)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={`group flex items-center justify-between p-6 rounded-2xl border transition-all cursor-pointer ${
                    isDone 
                      ? "bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10" 
                      : "bg-slate-900/40 border-slate-800 hover:border-indigo-500/30 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-mono border ${
                      isDone ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-slate-800 text-slate-500 border-slate-700"
                    }`}>
                      {isDone ? <CheckCircle2 className="w-5 h-5" /> : String(i + 1).padStart(2, '0')}
                    </div>
                    <h3 className={`text-lg font-semibold transition-colors ${isDone ? "text-emerald-100" : "text-slate-200 group-hover:text-white"}`}>
                      {lesson.title}
                    </h3>
                  </div>
                  <div className="flex items-center gap-4">
                     <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${
                       isDone ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : "text-slate-600 bg-slate-950 border-slate-800"
                     }`}>
                       {lesson.checkpoints.length} Checkpoints
                     </span>
                     <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                       isDone ? "bg-emerald-500 text-white" : "bg-indigo-500/10 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white"
                     }`}>
                       →
                     </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        {activeTab === "labs" && (
          <div className="grid gap-6">
            {module.labs.map((lab, i) => {
              const isDone = completedLabs.includes(lab.id);
              return (
                <motion.div 
                  key={lab.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`p-8 rounded-3xl border relative overflow-hidden group ${
                    isDone ? "bg-emerald-500/5 border-emerald-500/20" : "bg-slate-900 border-slate-800"
                  }`}
                >
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <span className="text-9xl font-black italic">{isDone ? "DONE" : "LAB"}</span>
                  </div>
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-bold text-white">{lab.title}</h3>
                      {isDone && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                    </div>
                    <p className="text-slate-400 max-w-2xl">{lab.description}</p>
                    <button 
                      onClick={() => onStartLab(lab)}
                      className={`px-6 py-2 rounded-xl border font-bold uppercase tracking-widest text-xs transition-all ${
                        isDone 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500 hover:text-white" 
                          : "bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500 hover:text-white"
                      }`}
                    >
                      {isDone ? "Redo Simulation" : "Initialize Simulation"}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        {activeTab === "quiz" && (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center border ${
              progress?.is_completed ? "bg-emerald-500/10 border-emerald-500/20" : "bg-indigo-500/10 border-indigo-500/20"
            }`}>
              <Trophy className={`w-10 h-10 ${progress?.is_completed ? "text-emerald-400" : "text-indigo-400"}`} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white mb-2">
                {progress?.is_completed ? "Module Mastered!" : "Final Module Assessment"}
              </h3>
              <p className="text-slate-400 max-w-sm">
                {progress?.is_completed 
                  ? `Your highest score: ${Math.max(...progress.quiz_scores.map((s:any) => s.score))}%`
                  : `Test your knowledge of ${module.title} through a randomized adaptive assessment.`}
              </p>
            </div>
            <button 
              onClick={onStartQuiz}
              className={`px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs border shadow-lg hover:scale-105 transition-all active:scale-95 ${
                progress?.is_completed 
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20" 
                  : "bg-indigo-600 text-white border-indigo-500 shadow-indigo-500/20"
              }`}
            >
              {progress?.is_completed ? "Retake Quiz" : "Start Quiz"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
