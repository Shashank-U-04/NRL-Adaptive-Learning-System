"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface InlineMCQProps {
  blockId: string;
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  onComplete: (blockId: string, correct: boolean) => void;
}

export default function InlineMCQ({ blockId, question, options, answer, explanation, onComplete }: InlineMCQProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const isAnswered = selected !== null;
  const isCorrect = selected === answer;

  const choose = (option: string) => {
    if (isAnswered) return;
    setSelected(option);
    onComplete(blockId, option === answer);
  };

  return (
    <div className="rounded-lg p-4" style={{ border: "1px solid var(--border-glass)", background: "rgba(255,255,255,0.035)" }}>
      <p className="font-semibold mb-3">{question}</p>
      <div className="space-y-2">
        {options.map((option) => {
          const selectedOption = selected === option;
          const correctOption = isAnswered && option === answer;
          return (
            <button
              key={option}
              onClick={() => choose(option)}
              disabled={isAnswered}
              className="w-full text-left p-3 rounded-lg flex items-center gap-3 transition-colors"
              style={{
                border: `1px solid ${correctOption ? "var(--success)" : selectedOption ? "var(--error)" : "var(--border-glass)"}`,
                background: correctOption ? "var(--success-glow)" : selectedOption ? "var(--error-glow)" : "transparent",
              }}
            >
              <span className="text-sm">{option}</span>
              {correctOption && <CheckCircle2 className="w-4 h-4 ml-auto text-green-400" />}
              {selectedOption && !isCorrect && <XCircle className="w-4 h-4 ml-auto text-red-400" />}
            </button>
          );
        })}
      </div>
      {isAnswered && (
        <p className="text-sm mt-3" style={{ color: "var(--text-secondary)" }}>
          {explanation}
        </p>
      )}
    </div>
  );
}
