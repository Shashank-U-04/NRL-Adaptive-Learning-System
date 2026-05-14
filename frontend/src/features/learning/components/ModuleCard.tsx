"use client";

import GlassCard from "@/components/ui/GlassCard";
import NeumorphicButton from "@/components/ui/NeumorphicButton";
import { ModuleSummary } from "../types";
import { BookOpen, BarChart } from "lucide-react";

interface ModuleCardProps {
  module: ModuleSummary;
  onStart: (id: string) => void;
}

export default function ModuleCard({ module, onStart }: ModuleCardProps) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "advanced": return "text-rose-400 border-rose-400/20 bg-rose-400/10";
      case "intermediate": return "text-amber-400 border-amber-400/20 bg-amber-400/10";
      default: return "text-emerald-400 border-emerald-400/20 bg-emerald-400/10";
    }
  };

  return (
    <GlassCard className="flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <BookOpen className="w-6 h-6 text-indigo-400" />
        </div>
        <span className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md border ${getDifficultyColor(module.difficulty)}`}>
          {module.difficulty}
        </span>
      </div>

      <h3 className="text-xl font-bold mb-2 text-white">{module.title}</h3>
      <p className="text-slate-400 text-sm mb-6 flex-grow line-clamp-2">
        {module.description}
      </p>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
            <BarChart className="w-3 h-3" /> Progress
          </span>
          <span className="text-xs text-indigo-400 font-bold">{module.progress}%</span>
        </div>
        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-teal-400 transition-all duration-500"
            style={{ width: `${module.progress}%` }}
          />
        </div>
      </div>

      <NeumorphicButton 
        onClick={() => onStart(module.id)}
        className="w-full"
      >
        {module.progress > 0 ? "Continue Learning" : "Start Module"}
      </NeumorphicButton>
    </GlassCard>
  );
}
