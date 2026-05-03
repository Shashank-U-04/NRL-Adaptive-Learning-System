"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface NeumorphicButtonProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}

export default function NeumorphicButton({
  children,
  onClick,
  className = "",
  variant = "primary",
  disabled = false,
}: NeumorphicButtonProps) {
  const getColors = () => {
    switch (variant) {
      case "danger":
        return "bg-rose-500/10 text-rose-500 shadow-[4px_4px_8px_rgba(0,0,0,0.4),-4px_-4px_8px_rgba(255,255,255,0.02)]";
      case "secondary":
        return "bg-slate-800 text-slate-300 shadow-[4px_4px_8px_rgba(0,0,0,0.4),-4px_-4px_8px_rgba(255,255,255,0.02)]";
      default:
        return "bg-indigo-600/10 text-indigo-400 shadow-[4px_4px_8px_rgba(0,0,0,0.4),-4px_-4px_8px_rgba(255,255,255,0.02)]";
    }
  };

  return (
    <motion.button
      whileHover={!disabled ? { scale: 1.02, boxShadow: "6px_6px_12px_rgba(0,0,0,0.5),-4px_-4px_8px_rgba(255,255,255,0.03)" } : {}}
      whileTap={!disabled ? { scale: 0.98, boxShadow: "inset_2px_2px_5px_rgba(0,0,0,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.01)" } : {}}
      onClick={onClick}
      disabled={disabled}
      className={`px-6 py-2.5 rounded-xl font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${getColors()} ${className}`}
    >
      {children}
    </motion.button>
  );
}
