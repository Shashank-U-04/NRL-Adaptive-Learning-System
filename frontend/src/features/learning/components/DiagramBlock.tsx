"use client";

import { motion } from "framer-motion";
import { Activity, Share2, ShieldAlert } from "lucide-react";

interface DiagramBlockProps {
  type: string;
}

export default function DiagramBlock({ type }: DiagramBlockProps) {
  const getDiagramInfo = () => {
    switch (type) {
      case "sql-injection-flow":
        return {
          title: "SQL Injection Data Flow",
          description: "Visualizing how malicious payload bypasses application logic to reach the database.",
          icon: ShieldAlert,
          color: "text-rose-400",
          bgColor: "bg-rose-400/10",
        };
      case "web-app-architecture":
        return {
          title: "Modern Web Architecture",
          description: "Overview of client, server, and database interactions in a secure environment.",
          icon: Share2,
          color: "text-indigo-400",
          bgColor: "bg-indigo-400/10",
        };
      default:
        return {
          title: "Technical Diagram",
          description: "Structural representation of the current topic.",
          icon: Activity,
          color: "text-teal-400",
          bgColor: "bg-teal-400/10",
        };
    }
  };

  const info = getDiagramInfo();

  return (
    <div className="my-10 p-1 rounded-3xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-2xl">
      <div className="bg-[#0f172a] rounded-[calc(1.5rem-4px)] overflow-hidden">
        {/* Diagram Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-lg ${info.bgColor} ${info.color}`}>
              <info.icon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm uppercase tracking-widest">{info.title}</h4>
              <p className="text-xs text-slate-500 mt-1">{info.description}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-800" />
            <div className="w-2 h-2 rounded-full bg-slate-800" />
          </div>
        </div>

        {/* Diagram Content Area (Skeuomorphic placeholder) */}
        <div className="aspect-video relative flex items-center justify-center p-12 overflow-hidden bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black">
          {/* Grid Background */}
          <div className="absolute inset-0 opacity-10" 
               style={{ backgroundImage: 'radial-gradient(circle, #4f46e5 1px, transparent 1px)', backgroundSize: '32px 32px' }} 
          />
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 w-full h-full border border-dashed border-indigo-500/20 rounded-2xl flex flex-col items-center justify-center text-center p-8"
          >
            <div className="w-16 h-16 rounded-full bg-indigo-500/5 border border-indigo-500/10 flex items-center justify-center mb-4">
               <Activity className="w-8 h-8 text-indigo-500/40 animate-pulse" />
            </div>
            <p className="text-slate-600 font-mono text-xs uppercase tracking-widest">
              [ Interactive Visualization Layer ]
            </p>
            <p className="text-[10px] text-slate-700 mt-2">
              DIAGRAM_TYPE: {type.toUpperCase()}
            </p>
          </motion.div>

          {/* Decorative corner accents */}
          <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-slate-800" />
          <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-slate-800" />
          <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-slate-800" />
          <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-slate-800" />
        </div>
      </div>
    </div>
  );
}
