/**
 * NRL 2.0 — API Client
 *
 * Centralized fetch wrapper with JWT auto-refresh.
 * No Redis, no Docker — connects to local FastAPI on port 8000.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("refresh_token");
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens(): void {
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

async function refreshAccessToken(): Promise<boolean> {
  const rt = getRefreshToken();
  if (!rt) return false;
  try {
    const res = await fetch(`${API_BASE}${API_PREFIX}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

async function apiFetch<T>(endpoint: string, options: RequestInit & { skipAuth?: boolean } = {}): Promise<T> {
  const { skipAuth = false, headers: custom, ...rest } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(custom as Record<string, string>) };

  if (!skipAuth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res = await fetch(`${API_BASE}${API_PREFIX}${endpoint}`, { headers, ...rest });

  if (res.status === 401 && !skipAuth) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = getAccessToken();
      if (newToken) headers["Authorization"] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${API_PREFIX}${endpoint}`, { headers, ...rest });
    }
  }

  if (!res.ok) {
    let errorData;
    try { errorData = await res.json(); } catch { errorData = null; }
    throw new ApiError(res.status, errorData?.detail || `Request failed: ${res.status}`, errorData);
  }

  return res.json();
}

// ── Auth API ────────────────────────────────────────────
export const authApi = {
  register: (data: { name: string; email: string; password: string }) =>
    apiFetch<{ access_token: string; refresh_token: string; expires_in: number }>("/auth/register", { method: "POST", body: JSON.stringify(data), skipAuth: true }),

  login: (data: { email: string; password: string }) =>
    apiFetch<{ access_token: string; refresh_token: string; expires_in: number }>("/auth/login", { method: "POST", body: JSON.stringify(data), skipAuth: true }),

  me: () => apiFetch<{
    user: { id: string; name: string; email: string; role: string; is_active: boolean; created_at: string };
    profile: {
      knowledge_level: string; current_streak: number; longest_streak: number;
      total_xp: number; sessions_completed: number; total_questions_answered: number;
      total_correct: number; accuracy: number; daily_goal_minutes: number; last_active: string | null;
    } | null;
  }>("/auth/me"),

  updateProfile: (data: { daily_goal_minutes?: number; name?: string }) =>
    apiFetch("/auth/profile", { method: "PUT", body: JSON.stringify(data) }),
};

// ── Session API ─────────────────────────────────────────
export const sessionApi = {
  start: (topicId?: string) =>
    apiFetch<{
      session_id: string; initial_state: Record<string, number>;
      first_action: string; explanation: string; confidence: number;
      question: QuestionPayload | null;
    }>("/sessions/start", { method: "POST", body: JSON.stringify({ topic_id: topicId || null }) }),

  answer: (data: { session_id: string; question_id: string; selected_answer: string; time_taken_seconds: number }) =>
    apiFetch<{
      is_correct: boolean; correct_answer: string; explanation: string | null;
      reward: number; next_action: string; action_explanation: string;
      confidence: number; next_question: QuestionPayload | null;
      session_done: boolean; updated_state: Record<string, number>; streak: number;
    }>("/sessions/answer", { method: "POST", body: JSON.stringify(data) }),

  end: (sessionId: string) =>
    apiFetch<{
      session_id: string; total_questions: number; correct_answers: number;
      accuracy: number; total_reward: number; duration_seconds: number;
      hints_used: number; xp_earned: number;
    }>("/sessions/end", { method: "POST", body: JSON.stringify({ session_id: sessionId }) }),

  history: (limit = 20) =>
    apiFetch<Array<{
      session_id: string; status: string; accuracy: number; total_reward: number;
      questions_answered: number; duration_seconds: number | null; started_at: string;
    }>>(`/sessions/history?limit=${limit}`),
};

// ── Analytics API ───────────────────────────────────────
export const analyticsApi = {
  dashboard: () => apiFetch<{
    knowledge_level: string; current_streak: number; longest_streak: number;
    total_xp: number; sessions_completed: number; overall_accuracy: number;
    total_questions: number;
    recent_sessions: Array<{ id: string; accuracy: number; reward: number; questions: number; date: string }>;
    weak_topics: Array<{ topic: string; mastery: number; attempted: number }>;
  }>("/analytics/dashboard"),

  accuracyTrend: (limit = 50) => apiFetch<Array<{
    session_number: number; accuracy: number; reward: number; date: string;
  }>>(`/analytics/accuracy?limit=${limit}`),

  topicMastery: () => apiFetch<Array<{
    topic_name: string; mastery_score: number; questions_attempted: number; accuracy: number;
  }>>("/analytics/topics"),
};

// ── Leaderboard API ─────────────────────────────────────
export const leaderboardApi = {
  get: (limit = 50) => apiFetch<Array<{
    rank: number; name: string; total_xp: number; accuracy: number;
    sessions_completed: number; knowledge_level: string;
  }>>(`/leaderboard?limit=${limit}`),
};

// ── Types ───────────────────────────────────────────────
export interface QuestionPayload {
  id: string; text: string; options: Record<string, string>;
  difficulty: string; topic_name: string; hint_available: boolean;
}

export { ApiError };
