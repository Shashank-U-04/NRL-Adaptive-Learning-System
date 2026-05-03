export type Difficulty = "easy" | "medium" | "hard";

export type LearningBlock =
  | { id: string; type: "text"; value: string }
  | { id: string; type: "image"; url: string; alt: string; caption?: string }
  | { id: string; type: "diagram"; title: string; steps: string[] }
  | {
      id: string;
      type: "mcq_inline";
      question: string;
      options: string[];
      answer: string;
      explanation: string;
    }
  | {
      id: string;
      type: "scenario";
      title: string;
      situation: string;
      decisions: { label: string; feedback: string; isBest?: boolean }[];
    }
  | {
      id: string;
      type: "lab";
      labType: "sql_injection" | "xss" | "command_injection" | "auth_bypass";
      title: string;
      instructions: string;
      input: string;
      expectedOutput: string;
      validationLogic: string;
      successMessage: string;
      failureMessage: string;
    }
  | { id: string; type: "summary"; title: string; bullets: string[] };

export interface LearningModule {
  topicId: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  content: LearningBlock[];
  quiz: {
    question: string;
    options: string[];
    answer: string;
    difficulty: Difficulty;
    topic: string;
  }[];
}

export interface ModuleSummary {
  topicId: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
}

export interface LearningEvent {
  blockId: string;
  type: "mcq_inline" | "lab";
  correct: boolean;
}
