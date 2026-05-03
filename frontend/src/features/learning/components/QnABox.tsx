"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Question } from "../types";
import NeumorphicButton from "@/components/ui/NeumorphicButton";
import { CheckCircle2, XCircle, Info } from "lucide-react";

interface QnABoxProps {
  question: Question;
  onCorrect: () => void;
}

export default function QnABox({ question, onCorrect }: QnABoxProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const handleSubmit = () => {
    if (!selectedOption) return;
    
    const correct = selectedOption === question.answer;
    setIsCorrect(correct);
    setIsSubmitted(true);
    
    if (correct) {
      onCorrect();
    }
  };

  return (
    <div className="my-8 p-8 rounded-3xl bg-slate-900/80 border border-slate-700 shadow-2xl backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
          <span className="text-xs font-bold text-indigo-400">?</span>
        </div>
        <h4 className="text-lg font-bold text-white">Checkpoint</h4>
      </div>

      <p className="text-slate-200 text-lg mb-8 leading-relaxed">
        {question.question}
      </p>

      <div className="space-y-3 mb-8">
        {question.options?.map((option) => {
          const isSelected = selectedOption === option;
          const showSuccess = isSubmitted && option === question.answer;
          const showError = isSubmitted && isSelected && !isCorrect;

          return (
            <button
              key={option}
              disabled={isSubmitted}
              onClick={() => setSelectedOption(option)}
              className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-center justify-between ${
                isSelected 
                  ? "bg-indigo-500/10 border-indigo-500/50 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" 
                  : "bg-slate-800/40 border-slate-700 hover:border-slate-500"
              } ${showSuccess ? "border-emerald-500/50 bg-emerald-500/5" : ""} ${
                showError ? "border-rose-500/50 bg-rose-500/5" : ""
              }`}
            >
              <span className={`font-medium ${isSelected ? "text-indigo-300" : "text-slate-400"}`}>
                {option}
              </span>
              
              {showSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
              {showError && <XCircle className="w-5 h-5 text-rose-500" />}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {!isSubmitted ? (
          <NeumorphicButton
            onClick={handleSubmit}
            disabled={!selectedOption}
            className="w-full"
          >
            Submit Answer
          </NeumorphicButton>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-xl border flex gap-4 ${
              isCorrect ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
            }`}
          >
            <div className={`mt-1 shrink-0 ${isCorrect ? "text-emerald-500" : "text-rose-500"}`}>
              <Info className="w-5 h-5" />
            </div>
            <div>
              <p className={`font-bold mb-1 ${isCorrect ? "text-emerald-400" : "text-rose-400"}`}>
                {isCorrect ? "Excellent!" : "Not quite right"}
              </p>
              <p className="text-sm text-slate-400 leading-relaxed">
                {question.explanation}
              </p>
              {!isCorrect && (
                <button 
                  onClick={() => { setIsSubmitted(false); setSelectedOption(null); setIsCorrect(null); }}
                  className="mt-3 text-xs font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Try Again
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
