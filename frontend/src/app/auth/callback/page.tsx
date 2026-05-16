"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // Listen for the SIGNED_IN event Supabase fires after it exchanges
    // the OAuth code (PKCE flow) for a session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        subscription.unsubscribe();
        router.replace("/dashboard");
      }
    });

    // Also check if a session already exists (e.g. implicit flow or re-visit)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        subscription.unsubscribe();
        router.replace("/dashboard");
      }
    });

    // Safety fallback: if nothing resolves in 8 s, send back to login
    const timeout = setTimeout(() => {
      subscription.unsubscribe();
      router.replace("/login");
    }, 8000);

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        position: "relative",
        overflow: "hidden",
        padding: 24,
      }}
    >
      <div className="mesh-bg" />
      <div className="grid-fade" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="glass"
        style={{
          position: "relative",
          zIndex: 1,
          padding: "32px 36px",
          textAlign: "center",
          background: "rgba(255,255,255,0.95)",
          borderRadius: 16,
          boxShadow: "var(--shadow-md)",
          maxWidth: 380,
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
          <div className="brand-mark">N</div>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>NRL Adaptive</span>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-line)",
            margin: "0 auto 18px",
            color: "var(--accent)",
          }}
        >
          <span
            className="spinner"
            style={{
              width: 22,
              height: 22,
              borderColor: "var(--accent)",
              borderRightColor: "transparent",
            }}
          />
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 6px", letterSpacing: "-0.01em" }}>
          Signing you in…
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-2)", margin: 0, lineHeight: 1.5 }}>
          Hang tight — completing the secure handshake with the engine.
        </p>
      </motion.div>
    </div>
  );
}
