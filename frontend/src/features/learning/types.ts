export type Difficulty = "beginner" | "intermediate" | "advanced";

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

export interface Lab {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  expectedOutcome: string;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
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
  progress: number;
}
