"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lab } from "../types";
import SkeuomorphicPanel from "@/components/ui/SkeuomorphicPanel";
import NeumorphicButton from "@/components/ui/NeumorphicButton";
import { Terminal, Play, CheckCircle2, AlertTriangle, ChevronLeft } from "lucide-react";
import { learningApi, ApiError } from "@/lib/api";

interface LabPanelProps {
  lab: Lab;
  topicId?: string; // When set, validation is delegated to backend /learning/lab.
  onComplete: () => void;
  onBack: () => void;
}

export default function LabPanel({ lab, topicId, onComplete, onBack }: LabPanelProps) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string[]>(["[SYSTEM] Ready for simulation...", "[SYSTEM] Waiting for input..."]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [hintIndex, setHintIndex] = useState(0);

  // Local pattern-based validation: only used when backend validation is not
  // wired (no topicId) AND the lab ships explicit validationRules. The old
  // "any non-empty answer wins" fallback is gone — empty rules now fail
  // closed to prevent trivial passes on seeded modules.
  const validationRules = useMemo(() => {
    if (lab.validationRules && lab.validationRules.length > 0) {
      return lab.validationRules.map((r) => ({
        pattern: new RegExp(r.pattern, r.flags ?? "i"),
        response: r.response,
        isWin: r.isWin,
      }));
    }
    // Last-resort derivation from expectedOutcome: case-insensitive contains.
    if (lab.expectedOutcome && lab.expectedOutcome.trim()) {
      const literal = lab.expectedOutcome.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return [
        {
          pattern: new RegExp(literal, "i"),
          response: "Expected outcome matched.",
          isWin: true,
        },
      ];
    }
    return [];
  }, [lab.validationRules, lab.expectedOutcome]);

  const runSimulation = async () => {
    if (!input.trim()) return;

    setIsRunning(true);
    setOutput(prev => [
      ...prev,
      `> ${input}`,
      "[SIM] Analyzing input patterns...",
      "[SIM] Executing payload against mock target...",
    ]);

    // Prefer backend validation when a topicId is supplied.
    if (topicId) {
      try {
        const result = await learningApi.submitLab({
          topic_id: topicId,
          lab_id: lab.id,
          payload: input,
        });
        setOutput(prev => [
          ...prev,
          `[SIM] ${result.message}`,
          result.is_correct
            ? "[SUCCESS] Security objective achieved."
            : "[ERROR] Submission did not match expected pattern. Try again.",
        ]);
        setIsSuccess(result.is_correct);
      } catch (err) {
        const msg =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Validation failed.";
        setOutput(prev => [...prev, `[ERROR] ${msg}`]);
        setIsSuccess(false);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // Fallback: local pattern matching (test/standalone usage).
    setTimeout(() => {
      setIsRunning(false);

      if (validationRules.length === 0) {
        setOutput(prev => [
          ...prev,
          "[ERROR] This lab has no validation rules configured.",
          "[SIM] Contact the module author or open this lab through the learning page.",
        ]);
        setIsSuccess(false);
        return;
      }

      const matchedRule = validationRules.find(rule => rule.pattern.test(input));
      if (matchedRule) {
        setOutput(prev => [...prev, `[SIM] ${matchedRule.response}`]);
        if (matchedRule.isWin) {
          setOutput(prev => [...prev, "[SUCCESS] Security objective achieved."]);
          setIsSuccess(true);
        }
      } else {
        setOutput(prev => [
          ...prev,
          "[ERROR] Submission did not match expected pattern.",
          "[SIM] Review the lab instructions and try a different approach.",
        ]);
        setIsSuccess(false);
      }
    }, 1200);
  };

  const hints = lab.hints && lab.hints.length > 0
    ? lab.hints
    : ["Read the lab description and instructions carefully."];

  const getNextHint = () => {
    setShowHint(true);
    if (hintIndex < hints.length - 1) {
      setHintIndex(prev => prev + 1);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <button 
            onClick={onBack}
            className="text-slate-500 hover:text-teal-400 transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest mb-2"
          >
            <ChevronLeft className="w-4 h-4" /> Exit Lab
          </button>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Terminal className="w-8 h-8 text-teal-400" /> {lab.title}
          </h1>
        </div>
        
        {isSuccess && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-bold"
          >
            <CheckCircle2 className="w-4 h-4" /> LAB COMPLETED
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Instructions Side */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" /> Objective
            </h3>
            <p className="text-slate-300 leading-relaxed mb-6">
              {lab.description}
            </p>
            
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Instructions</h3>
            <ul className="space-y-4">
              {lab.instructions.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    {i + 1}
                  </span>
                  <span className="text-slate-400 text-sm">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest">Hint System</h3>
                <button 
                  onClick={getNextHint}
                  className="text-[10px] font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                >
                  {showHint ? "Need another?" : "Reveal Hint"}
                </button>
              </div>
              <AnimatePresence>
                {showHint && (
                  <motion.p 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-indigo-300/80 font-medium italic leading-relaxed"
                  >
                    💡 {hints[hintIndex]}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Interactive Terminal Side */}
        <SkeuomorphicPanel title="NRL-SIMULATOR-V1.0" className="h-full min-h-[500px] flex flex-col">
          <div className="flex-grow flex flex-col space-y-4">
            {/* Simulation Terminal Display */}
            <div className="flex-grow font-mono text-sm space-y-1 overflow-y-auto max-h-[300px] scrollbar-thin scrollbar-thumb-slate-800 p-2">
              {output.map((line, i) => (
                <div key={i} className={
                  line.startsWith('[SUCCESS]') ? "text-emerald-400" :
                  line.startsWith('[ERROR]') ? "text-rose-400" :
                  line.startsWith('>') ? "text-indigo-400" :
                  "text-slate-500"
                }>
                  {line}
                </div>
              ))}
              {isRunning && <motion.span animate={{ opacity: [0, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} className="text-indigo-400">_</motion.span>}
            </div>

            {/* Input Area */}
            <div className="space-y-4 pt-4 border-t border-slate-800/50">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-500 font-mono font-bold">$</span>
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter simulation payload..."
                  className="w-full bg-black/50 border border-slate-800 rounded-lg pl-8 pr-4 py-3 text-indigo-300 font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                  onKeyDown={(e) => e.key === 'Enter' && runSimulation()}
                />
              </div>
              
              <div className="flex gap-4">
                <NeumorphicButton 
                  onClick={runSimulation}
                  disabled={isRunning || !input.trim()}
                  className="flex-grow flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> Run Simulation
                </NeumorphicButton>
                
                <button 
                  onClick={() => { setInput(""); setOutput(["[SYSTEM] Environment reset."]); setIsSuccess(false); }}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold uppercase tracking-widest border border-slate-700"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </SkeuomorphicPanel>
      </div>

      {/* Completion Action */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center pt-8"
          >
            <NeumorphicButton 
              onClick={onComplete}
              className="!px-12 !py-4 text-lg !bg-emerald-600/10 !text-emerald-400 border border-emerald-500/20"
            >
              Finish Lab & Return
            </NeumorphicButton>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
