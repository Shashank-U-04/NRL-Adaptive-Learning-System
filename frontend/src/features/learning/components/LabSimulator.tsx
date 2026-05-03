"use client";

import { useState } from "react";
import { Terminal, CheckCircle2, XCircle } from "lucide-react";

interface LabSimulatorProps {
  blockId: string;
  title: string;
  instructions: string;
  expectedOutput: string;
  validationLogic: string;
  successMessage: string;
  failureMessage: string;
  onComplete: (blockId: string, correct: boolean) => void;
}

function validateInput(value: string, validationLogic: string) {
  if (validationLogic.startsWith("contains:")) {
    return value.toLowerCase().includes(validationLogic.replace("contains:", "").toLowerCase());
  }
  if (validationLogic.startsWith("regex:")) {
    return new RegExp(validationLogic.replace("regex:", ""), "i").test(value);
  }
  return false;
}

export default function LabSimulator({
  blockId,
  title,
  instructions,
  expectedOutput,
  validationLogic,
  successMessage,
  failureMessage,
  onComplete,
}: LabSimulatorProps) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<"success" | "failure" | null>(null);

  const run = () => {
    const passed = validateInput(input, validationLogic);
    setResult(passed ? "success" : "failure");
    onComplete(blockId, passed);
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: "1px solid var(--border-glass)", background: "#090d14" }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border-glass)" }}>
        <Terminal className="w-4 h-4" style={{ color: "var(--accent-primary)" }} />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div className="p-4">
        <p className="text-sm leading-6 mb-4" style={{ color: "var(--text-secondary)" }}>{instructions}</p>
        <div className="font-mono text-sm rounded-lg p-3 mb-3" style={{ background: "rgba(255,255,255,0.05)" }}>
          <span style={{ color: "var(--success)" }}>$</span> simulated-input --value
        </div>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="input-field mb-3"
          placeholder="Enter safe test payload"
        />
        <button onClick={run} className="btn-primary !py-2 !px-5">Run Simulation</button>
        {result && (
          <div className="mt-4 flex items-start gap-2 text-sm">
            {result === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            )}
            <div>
              <p className="font-medium">{result === "success" ? expectedOutput : "Simulation did not pass"}</p>
              <p style={{ color: "var(--text-secondary)" }}>
                {result === "success" ? successMessage : failureMessage}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
