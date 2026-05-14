"use client";

export const dynamic = "force-dynamic";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
        gap: 16,
        background: "var(--bg)",
      }}
    >
      <div
        className="spinner"
        style={{
          width: 28,
          height: 28,
          borderColor: "var(--accent)",
          borderRightColor: "transparent",
        }}
      />
      <p style={{ fontSize: 14, color: "var(--text-2)", margin: 0 }}>
        Completing sign-in…
      </p>
    </div>
  );
}
