"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Brain, Zap, BarChart3, Target, Sparkles, Shield } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Adaptation",
    description: "Our RL engine learns how you learn, adjusting difficulty in real-time for maximum retention.",
    gradient: "from-purple-500 to-indigo-500",
  },
  {
    icon: Zap,
    title: "Instant Feedback",
    description: "Get immediate explanations for every answer. Understand your mistakes before moving forward.",
    gradient: "from-yellow-500 to-orange-500",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    description: "Track accuracy trends, topic mastery, streaks, and engagement with beautiful dashboards.",
    gradient: "from-cyan-500 to-blue-500",
  },
  {
    icon: Target,
    title: "Weak Spot Detection",
    description: "The system identifies struggling areas and automatically schedules review sessions.",
    gradient: "from-pink-500 to-rose-500",
  },
  {
    icon: Sparkles,
    title: "Explainable AI",
    description: "Every recommendation includes a clear reason — no black-box decisions.",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    icon: Shield,
    title: "Smart Guardrails",
    description: "Safety rules prevent frustrating experiences — no hard questions for beginners.",
    gradient: "from-violet-500 to-purple-500",
  },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <Navbar />

      {/* ── Hero Section ──────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[120px]"
             style={{ background: "var(--gradient-primary)" }} />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative max-w-4xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-8 text-sm font-medium"
               style={{ background: "rgba(108, 99, 255, 0.15)", color: "var(--accent-secondary)", border: "1px solid rgba(108, 99, 255, 0.3)" }}>
            <Sparkles className="w-4 h-4" />
            Powered by Reinforcement Learning
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Learn Smarter,{" "}
            <span className="bg-clip-text text-transparent animate-gradient"
                  style={{ backgroundImage: "var(--gradient-primary)", backgroundSize: "200% 200%" }}>
              Not Harder
            </span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
             style={{ color: "var(--text-secondary)" }}>
            NRL 2.0 is an AI-powered adaptive learning platform that personalizes every session
            to your knowledge level, pace, and engagement — just like a private tutor.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register" className="btn-primary text-lg !py-4 !px-10 animate-pulse-glow">
              Start Learning Free
            </Link>
            <Link href="/login" className="btn-secondary text-lg !py-4 !px-10">
              Sign In
            </Link>
          </div>

          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex justify-center gap-12 mt-16"
          >
            {[
              { value: "7", label: "AI Actions" },
              { value: "1,944", label: "State Space" },
              { value: "<300ms", label: "Response Time" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold" style={{ color: "var(--accent-primary)" }}>
                  {stat.value}
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features Grid ─────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why NRL 2.0?
            </h2>
            <p style={{ color: "var(--text-secondary)" }} className="text-lg max-w-xl mx-auto">
              Every feature is designed to maximize learning outcomes.
            </p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="glass-card p-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${f.gradient}`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                  {f.description}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────── */}
      <section className="py-20 px-4" style={{ background: "var(--bg-secondary)" }}>
        <div className="max-w-4xl mx-auto">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
                      className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          </motion.div>

          <div className="space-y-8">
            {[
              { step: "01", title: "Start a Session", desc: "Choose a topic or let the AI pick the best starting point based on your profile." },
              { step: "02", title: "Answer Questions", desc: "The AI selects optimal difficulty. Get instant feedback and explanations." },
              { step: "03", title: "AI Adapts", desc: "Based on your streaks, accuracy, and engagement, the system adjusts in real-time." },
              { step: "04", title: "Track Progress", desc: "View detailed analytics, identify weak spots, and watch your mastery grow." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-card p-6 flex gap-6 items-start"
              >
                <div className="text-3xl font-bold shrink-0" style={{ color: "var(--accent-primary)" }}>
                  {item.step}
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────── */}
      <section className="py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 blur-[100px]"
             style={{ background: "var(--gradient-primary)" }} />
        <div className="relative">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">Ready to learn smarter?</h2>
          <p className="text-lg mb-8" style={{ color: "var(--text-secondary)" }}>
            Join NRL 2.0 and experience AI-powered education.
          </p>
          <Link href="/register" className="btn-primary text-lg !py-4 !px-12">
            Create Free Account
          </Link>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────── */}
      <footer className="py-8 px-4 text-center" style={{ borderTop: "1px solid var(--border-glass)" }}>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          © 2026 NRL 2.0 — Built with Reinforcement Learning & ❤️
        </p>
      </footer>
    </div>
  );
}
