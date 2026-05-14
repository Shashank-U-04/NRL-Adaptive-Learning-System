"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
