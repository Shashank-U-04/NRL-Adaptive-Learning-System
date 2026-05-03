"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lesson } from "../types";
import QnABox from "./QnABox";
import DiagramBlock from "./DiagramBlock";
import NeumorphicButton from "@/components/ui/NeumorphicButton";
import { BookOpen, CheckCircle2, ChevronRight, ChevronLeft } from "lucide-react";

interface LessonViewerProps {
  lesson: Lesson;
  onComplete: () => void;
  onBack: () => void;
}

export default function LessonViewer({ lesson, onComplete, onBack }: LessonViewerProps) {
  const [completedCheckpoints, setCompletedCheckpoints] = useState<Set<string>>(new Set());
  
  const handleCheckpointCorrect = (id: string) => {
    setCompletedCheckpoints(prev => new Set([...prev, id]));
  };

  const allCheckpointsDone = lesson.checkpoints.every(cp => completedCheckpoints.has(cp.id));

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      {/* Header */}
      <div className="space-y-6">
        <button 
          onClick={onBack}
          className="text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
        >
          <ChevronLeft className="w-4 h-4" /> Back to Module
        </button>
        
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">{lesson.title}</h1>
        </div>
      </div>

      {/* Progress Bar (Floating) */}
      <div className="sticky top-24 z-20 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800 shadow-lg">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${(completedCheckpoints.size / Math.max(1, lesson.checkpoints.length)) * 100}%` }}
          className="h-full bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
        />
      </div>

      {/* Content Sections */}
      <div className="space-y-12">
        <div className="prose prose-invert prose-slate max-w-none">
          {/* Simple markdown parsing for headers and paragraphs */}
          {lesson.content.split('\n').map((line, i) => {
            if (line.startsWith('# ')) return <h1 key={i} className="text-4xl font-black mb-8 mt-12">{line.replace('# ', '')}</h1>;
            if (line.startsWith('## ')) return <h2 key={i} className="text-2xl font-bold mb-6 mt-10 text-indigo-100">{line.replace('## ', '')}</h2>;
            if (line.trim() === '') return <br key={i} />;
            return <p key={i} className="text-lg text-slate-300 leading-relaxed mb-6">{line}</p>;
          })}
        </div>

        {/* Visuals */}
        {lesson.visuals?.map((visual, i) => (
          <DiagramBlock key={i} type={visual} />
        ))}

        {/* Checkpoints */}
        <div className="space-y-8 pt-8 border-t border-slate-800">
          <h3 className="text-xl font-bold text-white flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-500 border border-slate-700">
              {lesson.checkpoints.length}
            </span>
            Knowledge Checkpoints
          </h3>
          
          {lesson.checkpoints.map((cp) => (
            <QnABox 
              key={cp.id} 
              question={cp} 
              onCorrect={() => handleCheckpointCorrect(cp.id)} 
            />
          ))}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-12 flex justify-end">
        <NeumorphicButton
          disabled={!allCheckpointsDone}
          onClick={onComplete}
          className="group flex items-center gap-3 !px-10 !py-4 text-lg"
        >
          {allCheckpointsDone ? (
            <>
              Complete Lesson <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </>
          ) : (
            "Complete all checkpoints to continue"
          )}
        </NeumorphicButton>
      </div>
    </div>
  );
}
