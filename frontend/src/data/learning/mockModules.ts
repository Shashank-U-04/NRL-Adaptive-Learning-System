import { Module } from "@/features/learning/types";

export const mockModules: Module[] = [
  {
    id: "web-security-101",
    title: "Web Security Fundamentals",
    description: "Learn the basics of web security, including the OWASP Top 10 and common attack vectors.",
    difficulty: "beginner",
    progress: 45,
    lessons: [
      {
        id: "intro-to-web-security",
        title: "Introduction to Web Security",
        content: `
# What is Web Security?
Web security refers to the protective measures and protocols that organizations adopt to protect their websites and web services from cyberattacks.

## Why it matters
In today's digital world, web applications are the primary target for hackers. A single vulnerability can lead to massive data breaches and financial loss.
        `,
        checkpoints: [
          {
            id: "cp-1",
            type: "mcq",
            question: "What is the primary goal of web security?",
            options: [
              "To make websites faster",
              "To protect web applications from cyberattacks",
              "To improve SEO rankings",
              "To reduce hosting costs"
            ],
            answer: "To protect web applications from cyberattacks",
            explanation: "Web security is focused on protecting the confidentiality, integrity, and availability of web applications.",
            difficulty: 0.2
          }
        ],
        visuals: ["web-app-architecture"]
      },
      {
        id: "sql-injection-basics",
        title: "Understanding SQL Injection",
        content: `
# SQL Injection (SQLi)
SQL Injection is a type of vulnerability where an attacker can interfere with the queries that an application makes to its database.

## How it works
Attackers inject malicious SQL code into input fields, which is then executed by the database server.
        `,
        checkpoints: [
          {
            id: "cp-2",
            type: "mcq",
            question: "Which of these is a common defense against SQLi?",
            options: [
              "Using stronger passwords",
              "Prepared statements and parameterized queries",
              "Adding more CPU to the database",
              "Using a faster network"
            ],
            answer: "Prepared statements and parameterized queries",
            explanation: "Prepared statements ensure that user input is treated as data, not as executable code.",
            difficulty: 0.4
          }
        ],
        visuals: ["sql-injection-flow"]
      }
    ],
    labs: [
      {
        id: "lab-sqli-login",
        title: "Bypass Login with SQLi",
        description: "Practice a simple SQL injection attack to bypass a login form.",
        instructions: [
          "Enter `' OR 1=1 --` into the username field.",
          "Leave the password field blank.",
          "Click the 'Login' button."
        ],
        expectedOutcome: "Successfully logged in as 'admin'."
      }
    ],
    quizPool: [
      {
        id: "q-1",
        type: "mcq",
        question: "What does OWASP stand for?",
        options: [
          "Open Web Application Security Project",
          "Official Web App Safety Protocol",
          "Online Web Attack Security Platform",
          "Open Website Authentication Security Program"
        ],
        answer: "Open Web Application Security Project",
        difficulty: 0.3
      }
    ]
  },
  {
    id: "network-defense",
    title: "Network Defense & Hardening",
    description: "Master the art of securing network infrastructure and mitigating network-based attacks.",
    difficulty: "intermediate",
    progress: 10,
    lessons: [],
    labs: [],
    quizPool: []
  }
];
