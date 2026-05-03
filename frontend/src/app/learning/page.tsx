"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth-context";
import { sessionApi } from "@/lib/api";
import LearningRenderer from "@/features/learning/components/LearningRenderer";
import type { LearningModule, ModuleSummary } from "@/features/learning/types";
import { ArrowRight, BookOpen, Loader2 } from "lucide-react";

export default function LearningPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedTopic = searchParams.get("topic");
  const [modules, setModules] = useState<ModuleSummary[]>([]);
  const [activeModule, setActiveModule] = useState<LearningModule | null>(null);
  const [startingQuiz, setStartingQuiz] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    fetch("/api/learning/modules")
      .then((res) => res.json())
      .then((data) => setModules(data.modules || []));
  }, []);

  useEffect(() => {
    if (!selectedTopic) {
      return;
    }

    fetch(`/api/learning/modules/${encodeURIComponent(selectedTopic)}`)
      .then((res) => res.json())
      .then((data) => setActiveModule(data.module));
  }, [selectedTopic]);

  const openModule = (topicId: string) => {
    router.push(`/learning?topic=${encodeURIComponent(topicId)}`);
  };

  const startQuiz = async () => {
    if (!activeModule) return;
    setStartingQuiz(true);
    try {
      const session = await sessionApi.start(activeModule.topicId);
      sessionStorage.setItem("nrl_pending_session", JSON.stringify({ topic: activeModule.topicId, session }));
      router.push(`/session?topic=${encodeURIComponent(activeModule.topicId)}`);
    } finally {
      setStartingQuiz(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        {!selectedTopic && (
          <>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
              <h1 className="text-3xl font-bold mb-2">Cyber Security Learning</h1>
              <p style={{ color: "var(--text-secondary)" }}>
                Select a module, complete inline checks and labs, then start an adaptive quiz.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {modules.map((module, index) => (
                <motion.article
                  key={module.topicId}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="glass-card-static p-6"
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: "rgba(108,99,255,0.14)", border: "1px solid rgba(108,99,255,0.35)" }}
                    >
                      <BookOpen className="w-6 h-6" style={{ color: "var(--accent-primary)" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h2 className="text-xl font-semibold">{module.title}</h2>
                        <span className="text-xs px-2 py-0.5 rounded-full badge-medium">{module.difficulty}</span>
                      </div>
                      <p className="text-sm leading-6 mb-5" style={{ color: "var(--text-secondary)" }}>
                        {module.description}
                      </p>
                      <button
                        onClick={() => openModule(module.topicId)}
                        className="btn-primary inline-flex items-center gap-2 !py-2.5 !px-5"
                      >
                        Start Learning <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </motion.article>
              ))}
            </div>
          </>
        )}

        {selectedTopic && activeModule?.topicId !== selectedTopic && (
          <div className="min-h-[50vh] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent-primary)" }} />
          </div>
        )}

        {selectedTopic && activeModule?.topicId === selectedTopic && (
          <LearningRenderer
            key={activeModule.topicId}
            module={activeModule}
            onStartQuiz={startingQuiz ? () => undefined : startQuiz}
          />
        )}
      </main>
    </div>
  );
}
