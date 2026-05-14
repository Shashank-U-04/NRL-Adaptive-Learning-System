"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
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
          top: "20%",
          left: "15%",
          width: 480,
          height: 480,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "10%",
          width: 380,
          height: 380,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.14) 0%, transparent 70%)",
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
            Welcome back
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", margin: 0 }}>
            Sign in to continue your streak
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
                  autoComplete="current-password"
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
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-lg"
              style={{ width: "100%", marginTop: 8 }}
            >
              {loading && <span className="spinner" style={{ marginRight: 4 }} />}
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 4px" }}>
            <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            <span style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap" }}>or continue with</span>
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
            {googleLoading ? "Redirecting…" : "Sign in with Google"}
          </button>

          {/* Register link */}
          <p style={{ textAlign: "center", fontSize: 13, color: "var(--text-3)", marginTop: 18, marginBottom: 0 }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 500 }}>
              Create one
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
