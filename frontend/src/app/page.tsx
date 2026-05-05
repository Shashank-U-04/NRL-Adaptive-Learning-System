"use client";

import Link from "next/link";
import { Zap, BarChart3, Globe, Shield, Lock, Layers, Bug, Database, Brain } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Adaptation",
    description:
      "Our Deep Q-Network engine observes every response and reshapes question difficulty in real-time, keeping you inside your optimal learning zone.",
    tag: "RL-powered",
  },
  {
    icon: Zap,
    title: "Gamification",
    description:
      "Streaks, XP, leaderboards, and instant explanations keep engagement high and make progress feel tangible every session.",
    tag: "Engagement",
  },
  {
    icon: BarChart3,
    title: "Real Analytics",
    description:
      "Track accuracy trends, topic mastery curves, and weak-spot heatmaps. Know exactly where to focus before your next session.",
    tag: "Insights",
  },
];

const topics = [
  { label: "Networking", icon: Globe },
  { label: "Web Security", icon: Shield },
  { label: "Cryptography", icon: Lock },
  { label: "System Security", icon: Layers },
  { label: "Ethical Hacking", icon: Bug },
  { label: "Forensics", icon: Database },
];

const stats = [
  { value: "10,400+", label: "Active learners" },
  { value: "52", label: "Topics covered" },
  { value: "95%", label: "Would recommend" },
  { value: "1.2M", label: "Questions answered" },
];

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      {/* ── Sticky nav ─────────────────────────────────── */}
      <nav
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          background: "rgba(13,15,20,0.85)",
          borderBottom: "1px solid var(--line)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="brand-mark">N</div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>NRL Adaptive</span>
        </div>

        {/* Nav links + actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a
            href="#how-it-works"
            style={{
              color: "var(--text-2)",
              fontSize: 14,
              padding: "0 12px",
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              borderRadius: 8,
              transition: "color 120ms",
            }}
            onMouseOver={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text)")}
            onMouseOut={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-2)")}
          >
            How it works
          </a>
          <a
            href="#topics"
            style={{
              color: "var(--text-2)",
              fontSize: 14,
              padding: "0 12px",
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              textDecoration: "none",
              borderRadius: 8,
              transition: "color 120ms",
            }}
            onMouseOver={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text)")}
            onMouseOut={(e) => ((e.currentTarget as HTMLAnchorElement).style.color = "var(--text-2)")}
          >
            Topics
          </a>
          <Link href="/login" className="btn btn-ghost" style={{ marginLeft: 4 }}>
            Sign in
          </Link>
          <Link href="/register" className="btn btn-primary">
            Start free
          </Link>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          minHeight: "calc(100vh - 56px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: "80px 24px 0",
        }}
      >
        {/* Background effects */}
        <div className="aurora" />
        <div className="dot-grid" />

        {/* Content */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            maxWidth: 720,
            width: "100%",
          }}
          className="slide-up-in"
        >
          {/* Status badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--line-2)",
              borderRadius: 999,
              background: "rgba(255,255,255,0.03)",
              padding: "5px 14px",
              fontSize: 13,
              color: "var(--text-2)",
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "var(--green)",
                display: "inline-block",
                boxShadow: "0 0 6px var(--green)",
              }}
            />
            Q-Learning engine v2.4 · live adaptation
          </div>

          {/* Headline */}
          <h1
            style={{
              fontSize: "clamp(44px, 6vw, 76px)",
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              margin: "0 0 20px",
            }}
          >
            Learn cybersecurity.
            <br />
            <span style={{ color: "var(--text-2)" }}>Adapt. Master.</span>
          </h1>

          {/* Subtext */}
          <p
            style={{
              fontSize: 18,
              color: "var(--text-2)",
              maxWidth: 520,
              margin: "0 auto 36px",
              lineHeight: 1.6,
            }}
          >
            An RL quiz engine that watches how you learn and reshapes every
            session in real-time — no two learners get the same path.
          </p>

          {/* CTA buttons */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              Start learning free
            </Link>
            <a href="#how-it-works" className="btn btn-ghost btn-lg">
              See how it works
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 720,
            borderTop: "1px solid var(--line)",
            marginTop: 72,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {stats.map((s) => (
            <div
              key={s.label}
              style={{
                flex: "1 1 140px",
                textAlign: "center",
                padding: "24px 12px",
              }}
            >
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--text)",
                  letterSpacing: "-0.02em",
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature cards ──────────────────────────────── */}
      <section style={{ padding: "96px 24px", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 52 }}>
          <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
            Why NRL Adaptive?
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-2)", margin: 0 }}>
            Every feature is built to maximise long-term knowledge retention.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {features.map((f) => (
            <div key={f.title} className="glass glass-hover" style={{ padding: 28 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "var(--accent-soft)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 18,
                }}
              >
                <f.icon size={20} color="var(--accent)" />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 16px" }}>
                {f.description}
              </p>
              <span className="pill pill-blue">{f.tag}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "96px 24px", background: "var(--bg-2)" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 52px" }}>
            How it works
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { step: "01", title: "Pick a topic", desc: "Choose from 52 cybersecurity topics or let the AI recommend the best starting point for your current level." },
              { step: "02", title: "Answer questions", desc: "The DQN agent selects optimal difficulty. Every answer triggers a real-time state update." },
              { step: "03", title: "The engine adapts", desc: "Based on streaks, accuracy, and engagement, the system reshapes the next question before you even submit." },
              { step: "04", title: "Track mastery", desc: "Detailed analytics show topic curves, weak spots, and projected growth — updated after every session." },
            ].map((item) => (
              <div
                key={item.step}
                className="glass"
                style={{ display: "flex", gap: 20, alignItems: "flex-start", padding: "20px 24px", textAlign: "left" }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: "var(--accent)",
                    lineHeight: 1,
                    flexShrink: 0,
                    minWidth: 36,
                  }}
                >
                  {item.step}
                </span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.55 }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Topic strip ────────────────────────────────── */}
      <section id="topics" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2
            style={{
              fontSize: 34,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              textAlign: "center",
              margin: "0 0 40px",
            }}
          >
            52 topics, one engine
          </h2>
          <div
            className="glass"
            style={{
              padding: "28px 32px",
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
            }}
          >
            {topics.map((t) => (
              <span
                key={t.label}
                className="chip"
                style={{ cursor: "default" }}
              >
                <t.icon size={13} />
                {t.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section
        style={{
          padding: "96px 24px",
          textAlign: "center",
          background: "var(--bg-2)",
        }}
      >
        <h2 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
          Ready to learn smarter?
        </h2>
        <p style={{ fontSize: 16, color: "var(--text-2)", margin: "0 0 32px" }}>
          Free forever. No credit card required.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register" className="btn btn-primary btn-lg">
            Create free account
          </Link>
          <Link href="/login" className="btn btn-ghost btn-lg">
            Sign in
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "24px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-3)",
        }}
      >
        © 2026 NRL Adaptive Learning System — Built with Reinforcement Learning
      </footer>
    </div>
  );
}
