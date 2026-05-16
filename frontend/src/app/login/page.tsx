"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff, Check, Sparkles, BarChart3, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast";

const trustPoints = [
  { icon: Sparkles, label: "AI-adaptive sessions, tuned in real time" },
  { icon: BarChart3, label: "Honest analytics — track real progress" },
  { icon: Shield, label: "Free forever, no card required" },
];

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const isReady = email.length > 0 && password.length > 0;

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(message);
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady) return;
    setLoading(true);

    try {
      await login(email, password);
      toast.success("Welcome back");
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      toast.error(message);
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
      {/* Background mesh + grid */}
      <div className="mesh-bg" />
      <div className="grid-fade" />

      {/* Shell — two-column on lg */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 980,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 32,
          alignItems: "center",
        }}
        className="lg:[grid-template-columns:1fr_440px]"
      >
        {/* Trust panel — hidden on mobile, shown on lg */}
        <div className="hidden lg:block" style={{ padding: "24px 8px" }}>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              textDecoration: "none",
              color: "inherit",
              marginBottom: 28,
            }}
          >
            <div className="brand-mark">N</div>
            <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: "-0.01em" }}>NRL Adaptive</span>
          </Link>
          <h2
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              lineHeight: 1.15,
              margin: "0 0 14px",
            }}
          >
            Pick up where the{" "}
            <span
              style={{
                background: "var(--gradient-cyber)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              engine
            </span>{" "}
            left off.
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 24px", maxWidth: 380 }}>
            Sign in to resume your adaptive learning path. Your sessions, streaks, and topic mastery curves are
            waiting.
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {trustPoints.map((tp) => (
              <li key={tp.label} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 13.5, color: "var(--text-2)" }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 8,
                    background: "var(--accent-soft)",
                    border: "1px solid var(--accent-line)",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--accent)",
                    flexShrink: 0,
                  }}
                >
                  <Check size={14} />
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <tp.icon size={14} style={{ color: "var(--text-3)" }} />
                  {tp.label}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Auth card */}
        <div style={{ width: "100%", maxWidth: 440, margin: "0 auto" }}>
          {/* Brand + heading */}
          <div style={{ textAlign: "center", marginBottom: 22 }}>
            <Link
              href="/"
              className="lg:hidden"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div className="brand-mark">N</div>
              <span style={{ fontWeight: 700, fontSize: 15 }}>NRL Adaptive</span>
            </Link>
            <h1 style={{ fontSize: 26, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              Welcome back
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-2)", margin: 0 }}>
              Sign in to continue your streak
            </p>
          </div>

          {/* Card */}
          <div
            className="glass"
            style={{
              padding: 28,
              background: "rgba(255,255,255,0.95)",
              borderRadius: 16,
              boxShadow: "var(--shadow-md)",
            }}
          >
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                    placeholder="Enter your password"
                    required
                    style={{ paddingRight: 44 }}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
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
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading || !isReady}
                className="btn btn-primary btn-lg"
                style={{ width: "100%", marginTop: 8 }}
              >
                {loading && <span className="spinner" style={{ marginRight: 6 }} />}
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "22px 0 4px" }}>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              <span style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap" }}>or continue with</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>

            {/* Google */}
            <motion.button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              whileHover={!googleLoading && !loading ? { y: -1 } : undefined}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "11px 16px",
                marginTop: 12,
                background: "#fff",
                border: "1px solid var(--line-2)",
                borderRadius: 10,
                color: "var(--text)",
                fontSize: 14,
                fontWeight: 500,
                cursor: googleLoading || loading ? "not-allowed" : "pointer",
                opacity: googleLoading || loading ? 0.6 : 1,
                transition: "background 150ms, box-shadow 150ms, border-color 150ms",
                boxShadow: "var(--shadow-sm)",
              }}
              onMouseEnter={(e) => {
                if (googleLoading || loading) return;
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "rgba(15,23,42,0.03)";
                el.style.borderColor = "rgba(15,23,42,0.22)";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = "#fff";
                el.style.borderColor = "var(--line-2)";
              }}
            >
              {googleLoading ? (
                <span className="spinner" />
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                  <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05" />
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335" />
                </svg>
              )}
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </motion.button>

            {/* Register link */}
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-3)", marginTop: 20, marginBottom: 0 }}>
              Don&apos;t have an account?{" "}
              <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
                Create one
              </Link>
            </p>
          </div>

          {/* Back link */}
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 13 }}>
            <Link href="/" style={{ color: "var(--text-3)", textDecoration: "none" }}>
              ← Back to home
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
