"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Question } from "../types";
import GlassCard from "@/components/ui/GlassCard";
import NeumorphicButton from "@/components/ui/NeumorphicButton";
import { Trophy, ArrowRight, CheckCircle2, XCircle, Timer, BarChart3, ChevronLeft } from "lucide-react";

interface QuizEngineProps {
  questions: Question[];
  title: string;
  onComplete: (score: number, stats: any) => void;
  onBack: () => void;
  userWeaknesses?: string[]; // Topics user is struggling with
}

export default function QuizEngine({ questions, title, onComplete, onBack, userWeaknesses = [] }: QuizEngineProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, { selected: string, isCorrect: boolean, timeTaken: number }>>({});
  const [showResult, setShowResult] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [startTime, setStartTime] = useState(Date.now());

  // 🤖 PRE-RL ADAPTIVE LOGIC: Weighted Random Selection
  // If this is a 'Mixed' quiz, we prioritize questions from userWeaknesses
  const adaptivePool = useMemo(() => {
    if (userWeaknesses.length === 0) return questions;
    
    // Sort questions: those in weak topics come first (simple weight)
    return [...questions].sort((a, b) => {
      const aWeak = userWeaknesses.some(w => a.question.toLowerCase().includes(w.toLowerCase())) ? 1 : 0;
      const bWeak = userWeaknesses.some(w => b.question.toLowerCase().includes(w.toLowerCase())) ? 1 : 0;
      return bWeak - aWeak;
    });
  }, [questions, userWeaknesses]);

  const currentQuestion = adaptivePool[currentIdx];

  const handleNext = () => {
    if (currentIdx < adaptivePool.length - 1) {
      setCurrentIdx(currentIdx + 1);
      setSelectedOption(null);
      setIsSubmitted(false);
      setStartTime(Date.now());
    } else {
      setShowResult(true);
    }
  };

  const handleSubmit = () => {
    if (!selectedOption) return;
    const timeTaken = Math.round((Date.now() - startTime) / 1000);
    const isCorrect = selectedOption === currentQuestion.answer;
    
    setAnswers(prev => ({ 
      ...prev, 
      [currentQuestion.id]: { selected: selectedOption, isCorrect, timeTaken } 
    }));
    setIsSubmitted(true);
  };

  const calculateStats = () => {
    const total = adaptivePool.length;
    let correct = 0;
    let totalTime = 0;
    const weakAreas = new Set<string>();

    Object.entries(answers).forEach(([id, data]) => {
      if (data.isCorrect) correct++;
      else {
        // Find question topic (mocking topic extraction from question text/id for now)
        const q = questions.find(q => q.id === id);
        if (q) weakAreas.add(q.id.split('-')[0]); // e.g., 'sql' from 'sql-injection-1'
      }
      totalTime += data.timeTaken;
    });

    return {
      score: Math.round((correct / total) * 100),
      avgTime: Math.round(totalTime / total),
      weakAreas: Array.from(weakAreas),
      correctCount: correct,
      totalCount: total
    };
  };

  const stats = calculateStats();

  if (showResult) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <GlassCard className="text-center p-12">
          <motion.div 
            initial={{ scale: 0 }} 
            animate={{ scale: 1 }} 
            className="w-24 h-24 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 mx-auto mb-8"
          >
            <Trophy className="w-12 h-12 text-indigo-400" />
          </motion.div>
          
          <h2 className="text-4xl font-bold text-white mb-2">Quiz Complete!</h2>
          <p className="text-slate-400 mb-8 font-medium">Detailed performance analytics ready.</p>
          
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Score</p>
              <p className="text-4xl font-black text-indigo-400">{stats.score}%</p>
            </div>
            <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Avg Time</p>
              <p className="text-4xl font-black text-teal-400">{stats.avgTime}s</p>
            </div>
          </div>

          {stats.weakAreas.length > 0 && (
            <div className="mb-10 text-left p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10">
              <p className="text-xs font-bold text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Recommended Review Areas
              </p>
              <div className="flex flex-wrap gap-2">
                {stats.weakAreas.map(area => (
                  <span key={area} className="px-3 py-1 rounded-lg bg-rose-500/10 text-rose-300 text-[10px] font-bold uppercase border border-rose-500/20">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
             <NeumorphicButton onClick={() => onComplete(stats.score, stats)} className="w-full !py-4 text-lg">
               Save Progress & Continue
             </NeumorphicButton>
             <button onClick={onBack} className="text-slate-500 text-sm font-bold uppercase tracking-widest hover:text-slate-300 transition-colors">
               Review Answers
             </button>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <button 
            onClick={onBack}
            className="text-slate-500 hover:text-indigo-400 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-2"
          >
            <ChevronLeft className="w-4 h-4" /> Cancel Quiz
          </button>
          <h1 className="text-2xl font-bold text-white">{title}</h1>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-slate-400">
             <Timer className="w-4 h-4" />
             <span className="text-xs font-mono font-bold tracking-widest">04:59</span>
           </div>
           <div className="flex items-center gap-2">
             <span className="text-xs font-bold text-slate-500">Q{currentIdx + 1}/{questions.length}</span>
             <div className="w-32 h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
               <div className="h-full bg-indigo-500" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
             </div>
           </div>
        </div>
      </div>

      {/* Question Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
        >
          <GlassCard className="p-10 !bg-slate-900/40">
            <div className="mb-10">
              <span className="inline-block px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-widest mb-4">
                Difficulty: {currentQuestion.difficulty * 10}
              </span>
              <h3 className="text-2xl font-bold text-slate-100 leading-tight">
                {currentQuestion.question}
              </h3>
            </div>

            <div className="space-y-4 mb-10">
              {currentQuestion.options?.map((option) => {
                const isSelected = selectedOption === option;
                const isCorrect = isSubmitted && option === currentQuestion.answer;
                const isWrong = isSubmitted && isSelected && option !== currentQuestion.answer;

                return (
                  <button
                    key={option}
                    disabled={isSubmitted}
                    onClick={() => setSelectedOption(option)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all relative overflow-hidden group ${
                      isSelected 
                        ? "bg-indigo-500/10 border-indigo-500/40 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]" 
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-600"
                    } ${isCorrect ? "border-emerald-500/50 bg-emerald-500/10" : ""} ${
                      isWrong ? "border-rose-500/50 bg-rose-500/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between relative z-10">
                      <span className={`text-lg font-medium transition-colors ${isSelected ? "text-white" : "text-slate-400 group-hover:text-slate-300"}`}>
                        {option}
                      </span>
                      {isCorrect && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
                      {isWrong && <XCircle className="w-6 h-6 text-rose-500" />}
                    </div>
                    {isSelected && !isSubmitted && (
                      <motion.div 
                        layoutId="activeOption" 
                        className="absolute inset-0 bg-indigo-500/5" 
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex justify-end">
              {!isSubmitted ? (
                <NeumorphicButton 
                  onClick={handleSubmit} 
                  disabled={!selectedOption}
                  className="!px-12 !py-4"
                >
                  Submit Answer
                </NeumorphicButton>
              ) : (
                <NeumorphicButton 
                  onClick={handleNext}
                  className="!px-12 !py-4 group"
                >
                  {currentIdx < questions.length - 1 ? "Next Question" : "Finish Assessment"} 
                  <ArrowRight className="w-5 h-5 ml-2 inline transition-transform group-hover:translate-x-1" />
                </NeumorphicButton>
              )}
            </div>
          </GlassCard>
        </motion.div>
      </AnimatePresence>

      {/* Footer Info */}
      <div className="flex justify-center gap-12 text-slate-600">
        <div className="flex items-center gap-2">
           <BarChart3 className="w-4 h-4" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Adaptive Engine Active</span>
        </div>
        <div className="flex items-center gap-2">
           <Trophy className="w-4 h-4" />
           <span className="text-[10px] font-bold uppercase tracking-widest">Mastery Level: 1.0</span>
        </div>
      </div>
    </div>
  );
}
