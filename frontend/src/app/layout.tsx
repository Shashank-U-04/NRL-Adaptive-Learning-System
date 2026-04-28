import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "NRL 2.0 — AI-Powered Adaptive Learning",
  description:
    "Personalized learning platform that adapts to your pace using Reinforcement Learning. Master any topic with AI-driven question selection, real-time feedback, and smart analytics.",
  keywords: ["adaptive learning", "AI tutor", "reinforcement learning", "EdTech", "personalized education"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
