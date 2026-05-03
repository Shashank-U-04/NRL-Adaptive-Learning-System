"use client";

import { ReactNode } from "react";

interface SkeuomorphicPanelProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export default function SkeuomorphicPanel({
  children,
  title,
  className = "",
}: SkeuomorphicPanelProps) {
  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05),0_10px_20px_rgba(0,0,0,0.5)] ${className}`}>
      {/* Top Header/Bezel */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-800/50 px-4 py-2 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="h-3 w-3 rounded-full bg-rose-500/80 shadow-[0_0_5px_rgba(244,63,94,0.4)]" />
            <div className="h-3 w-3 rounded-full bg-amber-500/80 shadow-[0_0_5px_rgba(245,158,11,0.4)]" />
            <div className="h-3 w-3 rounded-full bg-emerald-500/80 shadow-[0_0_5px_rgba(16,185,129,0.4)]" />
          </div>
          {title && (
            <span className="ml-2 text-xs font-mono font-medium text-slate-400 uppercase tracking-widest">
              {title}
            </span>
          )}
        </div>
      </div>
      
      {/* Main Content Area (Inlet) */}
      <div className="p-1">
        <div className="rounded-lg bg-[#0b1120] p-4 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]">
          {children}
        </div>
      </div>
    </div>
  );
}
