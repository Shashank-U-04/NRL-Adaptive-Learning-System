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
  const { register, loginWithGoogle, isAuthenticated } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleGoogle = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      setError(message);
      setGoogleLoading(false);
    }
  };

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
      if (isAuthenticated) {
        router.push("/dashboard");
      } else {
        // Email confirmation is enabled — user must verify before logging in
        setNeedsConfirmation(true);
      }
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

        {/* Confirmation screen */}
        {needsConfirmation && (
          <div className="glass" style={{ padding: 28, textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>📧</div>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 10px" }}>Check your email</h2>
            <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 20px" }}>
              We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back to sign in.
            </p>
            <Link href="/login" className="btn btn-primary" style={{ display: "inline-block" }}>
              Go to Sign In
            </Link>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 14, marginBottom: 0 }}>
              Tip: check your spam folder if you don't see it within a minute.
            </p>
          </div>
        )}

        {/* Card */}
        {!needsConfirmation && <div className="glass" style={{ padding: 28 }}>
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

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 4px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap" }}>or sign up with</span>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "10px 16px",
              marginTop: 12,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 10,
              color: "var(--text-1)",
              fontSize: 14,
              fontWeight: 500,
              cursor: googleLoading || loading ? "not-allowed" : "pointer",
              opacity: googleLoading || loading ? 0.6 : 1,
              transition: "background 150ms",
            }}
            onMouseEnter={e => { if (!googleLoading && !loading) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.09)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)"; }}
          >
            {googleLoading ? (
              <span className="spinner" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
            )}
            {googleLoading ? "Redirecting…" : "Sign up with Google"}
          </button>

          {/* Sign in link */}
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-3)", marginTop: 18, marginBottom: 0 }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>}

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
