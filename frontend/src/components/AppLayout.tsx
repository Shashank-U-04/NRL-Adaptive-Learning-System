"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push("/login");
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div style={{ height: "100vh", display: "grid", placeItems: "center", background: "var(--bg)" }}>
        <div className="spinner" style={{ width: 24, height: 24, borderColor: "var(--accent)", borderRightColor: "transparent" }} />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <main style={{ flex: 1, height: "100%", overflow: "hidden", position: "relative" }}>
        {children}
      </main>
    </div>
  );
}
