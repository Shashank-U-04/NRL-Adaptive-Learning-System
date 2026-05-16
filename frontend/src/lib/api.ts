/**
 * NRL Adaptive Learning System — API Client
 *
 * Auth contract:
 *  - Every authenticated request attaches the current Supabase access token.
 *  - On 401: refresh the session once, then retry with the new token.
 *  - If refresh also fails: dispatch `nrl:session-expired` and throw so
 *    AuthProvider can sign the user out cleanly.
 *  - On 403: throw immediately — this is a permissions issue, not a token issue.
 */

import { supabase } from "./supabase";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function refreshAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.refreshSession();
  return data.session?.access_token ?? null;
}

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit & { skipAuth?: boolean; _retry?: boolean } = {},
): Promise<T> {
  const { skipAuth = false, _retry = false, headers: custom, ...rest } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(custom as Record<string, string>),
  };

  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${API_PREFIX}${endpoint}`, {
    headers,
    ...rest,
  });

  // ── 401: attempt one token refresh then retry ────────────────────────────
  if (res.status === 401 && !skipAuth && !_retry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return apiFetch<T>(endpoint, { ...options, _retry: true });
    }
    // Refresh also failed — signal AuthProvider to sign the user out
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("nrl:session-expired"));
    }
    throw new ApiError(401, "Session expired. Please sign in again.");
  }

  if (!res.ok) {
    let errorData: { detail?: string } | null = null;
    try {
      errorData = await res.json();
    } catch {
      errorData = null;
    }
    throw new ApiError(
      res.status,
      errorData?.detail ?? `Request failed: ${res.status}`,
      errorData,
    );
  }

  return res.json() as Promise<T>;
}

// ── Auth API ────────────────────────────────────────────────────────────────
export const authApi = {
  me: () =>
    apiFetch<{
      user: {
        id: string;
        name: string;
        email: string;
        role: string;
        is_active: boolean;
        created_at: string;
      };
      profile: {
        knowledge_level: string;
        current_streak: number;
        longest_streak: number;
        total_xp: number;
        sessions_completed: number;
        total_questions_answered: number;
        total_correct: number;
        accuracy: number;
        daily_goal_minutes: number;
        last_active: string | null;
      } | null;
    }>("/auth/me"),

  updateProfile: (data: { daily_goal_minutes?: number; name?: string }) =>
    apiFetch("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),
};

// ── Session API ─────────────────────────────────────────────────────────────
export const sessionApi = {
  start: (topic?: string) =>
    apiFetch<{
      session_id: string;
      question: QuestionPayload;
      explanation: string;
    }>("/sessions/start", {
      method: "POST",
      body: JSON.stringify({ topic: topic || null, topic_id: topic || null }),
    }),

  answer: (data: {
    session_id: string;
    question_id: string;
    selected_answer: string;
    time_taken_seconds: number;
  }) =>
    apiFetch<{
      is_correct: boolean;
      correct_answer: string;
      explanation: string | null;
      reward: number;
      next_action: string;
      action_explanation: string;
      confidence: number;
      next_question: QuestionPayload | null;
      session_done: boolean;
      updated_state: Record<string, number>;
      streak: number;
    }>("/sessions/answer", { method: "POST", body: JSON.stringify(data) }),

  end: (sessionId: string) =>
    apiFetch<{
      session_id: string;
      total_questions: number;
      correct_answers: number;
      accuracy: number;
      total_reward: number;
      duration_seconds: number;
      hints_used: number;
      xp_earned: number;
    }>("/sessions/end", {
      method: "POST",
      body: JSON.stringify({ session_id: sessionId }),
    }),

  history: (limit = 20) =>
    apiFetch<
      Array<{
        session_id: string;
        status: string;
        accuracy: number;
        total_reward: number;
        questions_answered: number;
        duration_seconds: number | null;
        started_at: string;
      }>
    >(`/sessions/history?limit=${limit}`),
};

// ── Analytics API ───────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () =>
    apiFetch<{
      knowledge_level: string;
      current_streak: number;
      longest_streak: number;
      total_xp: number;
      sessions_completed: number;
      overall_accuracy: number;
      total_questions: number;
      recent_sessions: Array<{
        id: string;
        accuracy: number;
        reward: number;
        questions: number;
        date: string;
      }>;
      weak_topics: Array<{
        topic: string;
        mastery: number;
        attempted: number;
      }>;
    }>("/analytics/dashboard"),

  accuracyTrend: (limit = 50) =>
    apiFetch<
      Array<{
        session_number: number;
        accuracy: number;
        reward: number;
        date: string;
      }>
    >(`/analytics/accuracy?limit=${limit}`),

  topicMastery: () =>
    apiFetch<
      Array<{
        topic_name: string;
        mastery_score: number;
        questions_attempted: number;
        accuracy: number;
      }>
    >("/analytics/topics"),
};

// ── Leaderboard API ─────────────────────────────────────────────────────────
export const leaderboardApi = {
  get: (limit = 50) =>
    apiFetch<
      Array<{
        rank: number;
        name: string;
        total_xp: number;
        accuracy: number;
        sessions_completed: number;
        knowledge_level: string;
      }>
    >(`/leaderboard?limit=${limit}`),
};

// ── Learning API ────────────────────────────────────────────────────────────
export interface QuizStats {
  score?: number;
  total?: number;
  accuracy?: number;
  time_spent_seconds?: number;
}

export const learningApi = {
  getModules: () =>
    apiFetch<{
      success: boolean;
      data: { modules: ServerModule[] };
      error?: string;
    }>("/learning/modules"),

  getModuleDetail: (id: string) =>
    apiFetch<{
      success: boolean;
      data: { module: ServerModule };
      error?: string;
    }>(`/learning/modules/${id}`),

  getProgress: (topicId: string) =>
    apiFetch<{
      completed_lessons: string[];
      completed_labs: string[];
      quiz_scores: Array<{ score: number; date?: string }>;
      is_completed: boolean;
    }>(`/learning/progress/${topicId}`),

  updateProgress: (data: {
    topic_id: string;
    lesson_id?: string;
    lab_id?: string;
    quiz_score?: number;
    quiz_stats?: QuizStats;
  }) =>
    apiFetch<{ status: string; progress: Record<string, unknown> }>(
      "/learning/progress/update",
      { method: "POST", body: JSON.stringify(data) },
    ),
};

// ── Shared Types ────────────────────────────────────────────────────────────
export interface QuestionPayload {
  id: string;
  text: string;
  options: Record<string, string>;
  difficulty: string;
  topic_name: string;
  hint_available: boolean;
  source?: string;
}

export interface ServerQuestion {
  id: string;
  type: "mcq" | "short";
  question: string;
  options?: string[];
  answer: string;
  explanation?: string;
  difficulty: number;
}

export interface ServerLesson {
  id: string;
  title: string;
  content: string;
  checkpoints: ServerQuestion[];
  visuals?: string[];
}

export interface ServerLabValidationRule {
  pattern: string;
  flags?: string;
  response: string;
  isWin: boolean;
}

export interface ServerLab {
  id: string;
  title: string;
  description: string;
  instructions: string[];
  expectedOutcome: string;
  validationRules?: ServerLabValidationRule[];
  hints?: string[];
}

export interface ServerModule {
  id: string;
  topic_id?: string;
  title: string;
  description?: string;
  difficulty?: string;
  estimated_minutes?: number;
  progress?: number;
  lessons?: ServerLesson[];
  labs?: ServerLab[];
  quizPool?: ServerQuestion[];
  duration?: number;
  is_active?: boolean;
  content?: Record<string, unknown>;
  type?: string;
  topic?: string;
}
