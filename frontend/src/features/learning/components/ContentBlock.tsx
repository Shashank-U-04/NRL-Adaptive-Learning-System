"use client";

import Image from "next/image";
import type { LearningBlock } from "../types";
import InlineMCQ from "./InlineMCQ";
import LabSimulator from "./LabSimulator";
import ScenarioBlock from "./ScenarioBlock";
import SummaryCard from "./SummaryCard";

interface ContentBlockProps {
  block: LearningBlock;
  onComplete: (blockId: string, type: "mcq_inline" | "lab", correct: boolean) => void;
}

export default function ContentBlock({ block, onComplete }: ContentBlockProps) {
  switch (block.type) {
    case "text":
      return <p className="leading-7" style={{ color: "var(--text-secondary)" }}>{block.value}</p>;
    case "image":
      return (
        <figure>
          <div className="relative w-full aspect-[16/6] overflow-hidden rounded-lg" style={{ border: "1px solid var(--border-glass)" }}>
            <Image src={block.url} alt={block.alt} fill className="object-cover" />
          </div>
          {block.caption && <figcaption className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>{block.caption}</figcaption>}
        </figure>
      );
    case "diagram":
      return (
        <div className="rounded-lg p-4" style={{ border: "1px solid var(--border-glass)" }}>
          <h3 className="font-semibold mb-3">{block.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {block.steps.map((step, index) => (
              <div key={step} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="text-xs mb-1" style={{ color: "var(--accent-secondary)" }}>Step {index + 1}</div>
                <div className="text-sm">{step}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case "mcq_inline":
      return (
        <InlineMCQ
          blockId={block.id}
          question={block.question}
          options={block.options}
          answer={block.answer}
          explanation={block.explanation}
          onComplete={(blockId, correct) => onComplete(blockId, "mcq_inline", correct)}
        />
      );
    case "scenario":
      return <ScenarioBlock title={block.title} situation={block.situation} decisions={block.decisions} />;
    case "lab":
      return (
        <LabSimulator
          blockId={block.id}
          title={block.title}
          instructions={block.instructions}
          expectedOutput={block.expectedOutput}
          validationLogic={block.validationLogic}
          successMessage={block.successMessage}
          failureMessage={block.failureMessage}
          onComplete={(blockId, correct) => onComplete(blockId, "lab", correct)}
        />
      );
    case "summary":
      return <SummaryCard title={block.title} bullets={block.bullets} />;
  }
}
