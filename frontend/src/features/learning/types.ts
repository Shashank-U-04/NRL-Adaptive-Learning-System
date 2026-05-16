export type Difficulty = "beginner" | "intermediate" | "advanced";

// ── Learning block types for LearningRenderer / ContentBlock ──
export type LearningBlock =
  | { id: string; type: "text"; value: string }
  | { id: string; type: "image"; url: string; alt: string; caption?: string }
  | { id: string; type: "diagram"; title: string; steps: string[] }
  | { id: string; type: "mcq_inline"; question: string; options: string[]; answer: string; explanation: string }
  | { id: string; type: "scenario"; title: string; situation: string; decisions: { label: string; feedback: string; isBest?: boolean }[] }
  | { id: string; type: "lab"; title: string; instructions: string; expectedOutput: string; validationLogic: string; successMessage: string; failureMessage: string }
  | { id: string; type: "summary"; title: string; bullets: string[] };

export interface LearningEvent {
  blockId: string;
  type: "mcq_inline" | "lab";
  correct: boolean;
}

export interface LearningModule {
  topicId: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
  content: LearningBlock[];
}

export type QuestionType = "mcq" | "short";

export interface Question {
  id: string;
  type: QuestionType;
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  difficulty: number; // Used for future RL (e.g., 0.1 to 1.0)
}

export interface Lesson {
  id: string;
  title: string;
  content: string; // Markdown supported
  checkpoints: Question[]; // Inline Q&A
  visuals?: string[]; // Diagram placeholders (e.g., "sql-injection-flow")
}

export interface LabValidationRule {
  pattern: string; // serialized regex source
  flags?: string;
  response: string;
  isWin: boolean;
}

export interface Lab {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  expectedOutcome: string;
  validationRules?: LabValidationRule[];
  hints?: string[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimated_minutes?: number;
  lessons: Lesson[];
  labs: Lab[];
  quizPool: Question[];
  progress?: number; // Mock progress (0-100)
}

export interface ModuleSummary {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimated_minutes?: number;
  progress: number;
}
