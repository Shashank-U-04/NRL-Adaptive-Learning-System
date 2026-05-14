"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff } from "lucide-react";

/* ── Password strength helpers ─────────────────────────── */
type StrengthLevel = "empty" | "weak" | "okay" | "strong" | "excellent";

function getStrengthLevel(pwd: string): StrengthLevel {
  if (pwd.length === 0) return "empty";
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);

  if (hasDigit && hasSpecial && hasUpper && hasLower && pwd.length >= 10) return "excellent";
  if (hasUpper && hasLower && pwd.length >= 10) return "strong";
  if (pwd.length >= 10) return "okay";
  if (pwd.length >= 6) return "weak";
  return "weak";
}

const STRENGTH_COLORS: Record<StrengthLevel, string> = {
  empty: "#3F3F46",
  weak: "#EF4444",
  okay: "#F59E0B",
  strong: "#10B981",
  excellent: "#10B981",
};

const STRENGTH_LABELS: Record<StrengthLevel, string> = {
  empty: "",
  weak: "Weak",
  okay: "Okay",
  strong: "Strong",
  excellent: "Excellent",
};

const STRENGTH_FILL: Record<StrengthLevel, number> = {
  empty: 0,
  weak: 1,
  okay: 2,
  strong: 3,
  excellent: 4,
};

function StrengthBar({ password }: { password: string }) {
  const level = getStrengthLevel(password);
  const fill = STRENGTH_FILL[level];
  const color = STRENGTH_COLORS[level];
  const label = STRENGTH_LABELS[level];

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 4 }}>
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 999,
              background: n <= fill ? color : "#3F3F46",
              transition: "background 200ms ease",
            }}
          />
        ))}
      </div>
      {label && (
        <p style={{ fontSize: 11, color, margin: "5px 0 0", fontWeight: 500 }}>{label}</p>
      )}
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────── */
export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;
  const isReady =
    name.length >= 2 &&
    email.length > 0 &&
    password.length >= 6 &&
    password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);

    try {
      await register(name, email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: "var(--bg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background glow blobs */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          right: "12%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.16) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "8%",
          left: "8%",
          width: 360,
          height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Shell */}
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          padding: 24,
          position: "relative",
          zIndex: 1,
        }}
        className="slide-up-in"
      >
        {/* Brand + heading */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}
          >
            <div className="brand-mark">N</div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>NRL Adaptive</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Create your account
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", margin: 0 }}>
            Free forever · no credit card
          </p>
        </div>

        {/* Card */}
        <div className="glass" style={{ padding: 28 }}>
          {/* Error banner */}
          {error && (
            <div
              className="fade-in"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: "#fca5a5",
                marginBottom: 20,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Full name */}
            <div className="field">
              <label className="field-label" htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
                placeholder="Your name"
                required
                minLength={2}
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div className="field">
              <label className="field-label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div className="field">
              <label className="field-label" htmlFor="password">Password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: 44 }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: 4,
                    cursor: "pointer",
                    color: "var(--text-3)",
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password.length > 0 && <StrengthBar password={password} />}
            </div>

            {/* Confirm password */}
            <div className="field">
              <label className="field-label" htmlFor="confirmPassword">Confirm password</label>
              <div style={{ position: "relative" }}>
                <input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`input${!passwordsMatch ? " error" : ""}`}
                  placeholder="••••••••"
                  required
                  style={{ paddingRight: 44 }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    padding: 4,
                    cursor: "pointer",
                    color: "var(--text-3)",
                    display: "flex",
                    alignItems: "center",
                  }}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {!passwordsMatch && (
                <span className="field-error">Passwords do not match</span>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !isReady}
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading && <span className="spinner" style={{ marginRight: 4 }} />}
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          {/* Sign in link */}
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-3)", marginTop: 18, marginBottom: 0 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>

        {/* Back link */}
        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
          <Link
            href="/"
            style={{ color: "var(--text-3)", textDecoration: "none" }}
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
