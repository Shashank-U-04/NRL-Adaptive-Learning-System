"use client";

import { useState } from "react";

interface ScenarioBlockProps {
  title: string;
  situation: string;
  decisions: { label: string; feedback: string; isBest?: boolean }[];
}

export default function ScenarioBlock({ title, situation, decisions }: ScenarioBlockProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="rounded-lg p-4" style={{ border: "1px solid var(--border-glass)", background: "rgba(59,130,246,0.06)" }}>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm leading-6 mb-4" style={{ color: "var(--text-secondary)" }}>{situation}</p>
      <div className="space-y-2">
        {decisions.map((decision, index) => (
          <button
            key={decision.label}
            onClick={() => setSelected(index)}
            className="w-full text-left p-3 rounded-lg transition-colors"
            style={{
              border: `1px solid ${selected === index && decision.isBest ? "var(--success)" : "var(--border-glass)"}`,
              background: selected === index ? "rgba(255,255,255,0.05)" : "transparent",
            }}
          >
            {decision.label}
          </button>
        ))}
      </div>
      {selected !== null && (
        <p className="text-sm mt-3" style={{ color: decisions[selected].isBest ? "var(--success)" : "var(--warning)" }}>
          {decisions[selected].feedback}
        </p>
      )}
    </div>
  );
}
