"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Play } from "lucide-react";
import type { LearningEvent, LearningModule } from "../types";
import ContentBlock from "./ContentBlock";

interface LearningRendererProps {
  module: LearningModule;
  onStartQuiz: () => void;
}

export default function LearningRenderer({ module, onStartQuiz }: LearningRendererProps) {
  const [events, setEvents] = useState<Record<string, LearningEvent>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(localStorage.getItem(`nrl_learning_progress:${module.topicId}`) || "{}");
    } catch {
      return {};
    }
  });

  const track = (blockId: string, type: "mcq_inline" | "lab", correct: boolean) => {
    setEvents((current) => {
      const next = {
        ...current,
        [blockId]: { blockId, type, correct },
      };
      localStorage.setItem(`nrl_learning_progress:${module.topicId}`, JSON.stringify(next));
      return next;
    });
  };

  const requiredBlocks = useMemo(
    () => module.content.filter((block) => block.type === "mcq_inline" || block.type === "lab"),
    [module.content],
  );
  const completedCount = requiredBlocks.filter((block) => events[block.id]).length;
  const score = Object.values(events).filter((event) => event.correct).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      <section className="space-y-5">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-card-static p-6">
          <div className="flex items-center gap-2 text-sm mb-3" style={{ color: "var(--accent-secondary)" }}>
            <BookOpen className="w-4 h-4" />
            <span>{module.difficulty} · {module.estimatedMinutes} min</span>
          </div>
          <h1 className="text-3xl font-bold mb-3">{module.title}</h1>
          <p style={{ color: "var(--text-secondary)" }}>{module.description}</p>
        </motion.div>

        {module.content.map((block, index) => (
          <motion.div
            key={block.id}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.03 }}
            className="glass-card-static p-5"
          >
            <ContentBlock block={block} onComplete={track} />
          </motion.div>
        ))}
      </section>

      <aside className="lg:sticky lg:top-24 h-fit glass-card-static p-5">
        <h2 className="font-semibold mb-3">Learning Progress</h2>
        <div className="h-2 rounded-full mb-3" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${requiredBlocks.length ? (completedCount / requiredBlocks.length) * 100 : 100}%`,
              background: "var(--gradient-primary)",
            }}
          />
        </div>
        <p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
          Checks completed: {completedCount}/{requiredBlocks.length}
        </p>
        <p className="text-sm mb-5" style={{ color: "var(--text-secondary)" }}>
          Correct decisions: {score}/{Object.keys(events).length || 0}
        </p>
        <button onClick={onStartQuiz} className="btn-primary w-full flex items-center justify-center gap-2">
          Start Quiz <Play className="w-4 h-4" />
        </button>
      </aside>
    </div>
  );
}
