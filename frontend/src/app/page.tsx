"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Zap,
  BarChart3,
  Globe,
  Shield,
  Lock,
  Layers,
  Bug,
  Database,
  Brain,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Adaptation",
    description:
      "Our Deep Q-Network engine observes every response and reshapes question difficulty in real-time, keeping you inside your optimal learning zone.",
    tag: "RL-powered",
    highlight: true,
  },
  {
    icon: Zap,
    title: "Gamification",
    description:
      "Streaks, XP, leaderboards, and instant explanations keep engagement high and make progress feel tangible every session.",
    tag: "Engagement",
    highlight: false,
  },
  {
    icon: BarChart3,
    title: "Real Analytics",
    description:
      "Track accuracy trends, topic mastery curves, and weak-spot heatmaps. Know exactly where to focus before your next session.",
    tag: "Insights",
    highlight: false,
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

const steps = [
  {
    step: "01",
    title: "Pick a topic",
    desc: "Choose from 52 cybersecurity topics or let the AI recommend the best starting point for your current level.",
  },
  {
    step: "02",
    title: "Answer questions",
    desc: "The DQN agent selects optimal difficulty. Every answer triggers a real-time state update.",
  },
  {
    step: "03",
    title: "The engine adapts",
    desc: "Based on streaks, accuracy, and engagement, the system reshapes the next question before you even submit.",
  },
  {
    step: "04",
    title: "Track mastery",
    desc: "Detailed analytics show topic curves, weak spots, and projected growth — updated after every session.",
  },
];

const containerStagger = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemUp = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function LandingPage() {
  return (
    <div style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
      {/* ── Sticky nav (light glass) ───────────────────── */}
      <motion.nav
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          background: "rgba(255,255,255,0.85)",
          borderBottom: "1px solid var(--line)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          boxShadow: "0 1px 0 rgba(15,23,42,0.04), 0 6px 24px -16px rgba(15,23,42,0.12)",
        }}
      >
        {/* Brand */}
        <Link href="/" style={{ textDecoration: "none", color: "inherit" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                boxShadow: "0 6px 18px -6px rgba(59,130,246,0.55)",
                flexShrink: 0,
              }}
            >
              N
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: "-0.01em", color: "var(--text)" }}>
                NRL Adaptive
              </span>
              <span style={{ fontSize: 10, color: "var(--text-3)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Cybersecurity Learning
              </span>
            </div>
          </div>
        </Link>

        {/* Center links in a pill container */}
        <div
          className="hidden md:flex"
          style={{
            alignItems: "center",
            gap: 2,
            background: "rgba(15,23,42,0.04)",
            border: "1px solid var(--line)",
            borderRadius: 999,
            padding: "4px 6px",
          }}
        >
          {[
            { href: "#how-it-works", label: "How it works" },
            { href: "#topics", label: "Topics" },
            { href: "#features", label: "Features" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              style={{
                color: "var(--text-2)",
                fontSize: 13,
                fontWeight: 500,
                padding: "6px 14px",
                display: "inline-flex",
                alignItems: "center",
                textDecoration: "none",
                borderRadius: 999,
                transition: "color 150ms, background 150ms",
              }}
              onMouseOver={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.color = "var(--text)";
                el.style.background = "rgba(15,23,42,0.06)";
              }}
              onMouseOut={(e) => {
                const el = e.currentTarget as HTMLAnchorElement;
                el.style.color = "var(--text-2)";
                el.style.background = "transparent";
              }}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* Auth actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Link
            href="/login"
            style={{
              color: "var(--text-2)",
              fontSize: 13,
              fontWeight: 500,
              padding: "7px 16px",
              textDecoration: "none",
              borderRadius: 8,
              border: "1px solid var(--line)",
              transition: "color 150ms, border-color 150ms, background 150ms",
              display: "inline-flex",
              alignItems: "center",
              background: "transparent",
            }}
            onMouseOver={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = "var(--text)";
              el.style.borderColor = "var(--line-2)";
              el.style.background = "rgba(15,23,42,0.04)";
            }}
            onMouseOut={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.color = "var(--text-2)";
              el.style.borderColor = "var(--line)";
              el.style.background = "transparent";
            }}
          >
            Sign in
          </Link>
          <Link
            href="/register"
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "7px 18px",
              textDecoration: "none",
              borderRadius: 8,
              background: "linear-gradient(135deg, #3B82F6 0%, #6366f1 100%)",
              color: "#fff",
              boxShadow: "0 6px 18px -6px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
              transition: "opacity 150ms, box-shadow 150ms, transform 150ms",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            onMouseOver={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.opacity = "0.95";
              el.style.transform = "translateY(-1px)";
              el.style.boxShadow = "0 10px 22px -8px rgba(99,102,241,0.6), inset 0 1px 0 rgba(255,255,255,0.18)";
            }}
            onMouseOut={(e) => {
              const el = e.currentTarget as HTMLAnchorElement;
              el.style.opacity = "1";
              el.style.transform = "translateY(0)";
              el.style.boxShadow = "0 6px 18px -6px rgba(99,102,241,0.55), inset 0 1px 0 rgba(255,255,255,0.18)";
            }}
          >
            Start free
            <ArrowRight size={13} />
          </Link>
        </div>
      </motion.nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          minHeight: "calc(100vh - 64px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          padding: "80px 24px 0",
        }}
      >
        {/* Background effects */}
        <div className="mesh-bg" />
        <div className="aurora" />
        <div className="grid-fade" />
        <div className="dot-grid" />

        {/* AI orb — only on wide screens */}
        <motion.div
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "absolute",
            right: "-160px",
            top: "18%",
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.9), transparent 40%), conic-gradient(from 220deg, rgba(59,130,246,0.45), rgba(139,92,246,0.35), rgba(20,184,166,0.30), rgba(59,130,246,0.45))",
            filter: "blur(20px)",
            opacity: 0.55,
            pointerEvents: "none",
            display: "none",
          }}
          className="animate-float lg:block"
        />

        {/* Content */}
        <motion.div
          variants={containerStagger}
          initial="hidden"
          animate="show"
          style={{
            position: "relative",
            zIndex: 1,
            textAlign: "center",
            maxWidth: 760,
            width: "100%",
          }}
        >
          {/* Status badge */}
          <motion.div
            variants={itemUp}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              border: "1px solid var(--line-2)",
              borderRadius: 999,
              background: "rgba(255,255,255,0.85)",
              padding: "5px 14px",
              fontSize: 13,
              color: "var(--text-2)",
              marginBottom: 28,
              boxShadow: "var(--shadow-sm)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          >
            <span className="live-dot" />
            Q-Learning engine v2.4 · live adaptation
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={itemUp}
            style={{
              fontSize: "clamp(44px, 6vw, 76px)",
              fontWeight: 600,
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
              margin: "0 0 20px",
            }}
          >
            Learn cybersecurity.
            <br />
            <span
              style={{
                background: "var(--gradient-cyber)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Adapt. Master.
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            variants={itemUp}
            style={{
              fontSize: 18,
              color: "var(--text-2)",
              maxWidth: 540,
              margin: "0 auto 36px",
              lineHeight: 1.6,
            }}
          >
            An RL quiz engine that watches how you learn and reshapes every
            session in real-time — no two learners get the same path.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            variants={itemUp}
            style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}
          >
            <Link href="/register" className="btn btn-primary btn-lg">
              Start learning free
              <ArrowRight size={16} />
            </Link>
            <a href="#how-it-works" className="btn btn-ghost btn-lg">
              See how it works
            </a>
          </motion.div>

          {/* Trust strip */}
          <motion.div
            variants={itemUp}
            style={{
              marginTop: 24,
              fontSize: 12,
              color: "var(--text-3)",
              letterSpacing: "0.02em",
            }}
          >
            Personalised paths · Real analytics · Free forever
          </motion.div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "relative",
            zIndex: 1,
            width: "100%",
            maxWidth: 760,
            borderTop: "1px solid var(--line)",
            marginTop: 72,
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {[
            { value: "Adaptive", label: "Personalised paths" },
            { value: "52", label: "Topics covered" },
            { value: "Real-time", label: "Engine feedback" },
            { value: "Free", label: "Forever, no card" },
          ].map((s) => (
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
                  fontSize: 22,
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

          {/* Live engine pulse */}
          <div style={{ width: "100%", padding: "0 24px 18px" }}>
            <div className="shimmer-line" />
            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                color: "var(--text-3)",
                textAlign: "center",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              Engine pulse · learning in flight
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Feature cards ──────────────────────────────── */}
      <section id="features" style={{ padding: "96px 24px", maxWidth: 1080, margin: "0 auto" }}>
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: 52 }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "var(--accent)",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            <Sparkles size={13} />
            Built around your brain
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 12px" }}>
            Why NRL Adaptive?
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-2)", margin: 0 }}>
            Every feature is built to maximise long-term knowledge retention.
          </p>
        </motion.div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -3 }}
              className={f.highlight ? "glass glass-hover cyber-border" : "glass glass-hover"}
              style={{ padding: 28 }}
            >
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
                  border: "1px solid var(--accent-line)",
                }}
              >
                <f.icon size={20} color="var(--accent)" />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 8px" }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.6, margin: "0 0 16px" }}>
                {f.description}
              </p>
              <span className="pill pill-blue">{f.tag}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────── */}
      <section id="how-it-works" style={{ padding: "96px 24px", background: "var(--bg-2)", position: "relative", overflow: "hidden" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative", zIndex: 1 }}>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              margin: "0 0 52px",
              textAlign: "center",
            }}
          >
            How it works
          </motion.h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -2 }}
                className="glass glass-hover"
                style={{
                  display: "flex",
                  gap: 20,
                  alignItems: "flex-start",
                  padding: "22px 26px",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    background: "var(--gradient-cyber)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    lineHeight: 1,
                    flexShrink: 0,
                    minWidth: 40,
                  }}
                >
                  {item.step}
                </span>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>{item.title}</p>
                  <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.55 }}>{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Topic strip ────────────────────────────────── */}
      <section id="topics" style={{ padding: "96px 24px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <motion.h2
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              textAlign: "center",
              margin: "0 0 40px",
            }}
          >
            52 topics, one engine
          </motion.h2>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="glass"
            style={{
              padding: "28px 32px",
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "center",
            }}
          >
            {topics.map((t, i) => (
              <motion.span
                key={t.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                whileHover={{ y: -2, boxShadow: "0 8px 22px -10px rgba(59,130,246,0.45)" }}
                className="chip"
                style={{ cursor: "default" }}
              >
                <t.icon size={13} />
                {t.label}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────── */}
      <section
        style={{
          padding: "96px 24px",
          textAlign: "center",
          background: "var(--bg-2)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div className="aurora" />
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          style={{ position: "relative", zIndex: 1 }}
        >
          <h2 style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.02em", margin: "0 0 14px" }}>
            Ready to learn smarter?
          </h2>
          <p style={{ fontSize: 16, color: "var(--text-2)", margin: "0 0 32px" }}>
            Free forever. No credit card required.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/register" className="btn btn-primary btn-lg">
              Create free account
              <ArrowRight size={16} />
            </Link>
            <Link href="/login" className="btn btn-ghost btn-lg">
              Sign in
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "28px 24px",
          textAlign: "center",
          fontSize: 13,
          color: "var(--text-3)",
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        <div>
          © 2026 NRL Adaptive Learning System ·{" "}
          <a
            href="mailto:support@nrl.dev"
            style={{ color: "var(--text-2)", textDecoration: "none" }}
          >
            support@nrl.dev
          </a>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>
          Built with FastAPI + Next.js · Powered by Reinforcement Learning
        </div>
      </footer>
    </div>
  );
}
