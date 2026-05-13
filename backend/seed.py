"""
NRL Adaptive Learning System — Database Seeder

Seeds cybersecurity topics + a starter question bank.
Run:  python -m backend.seed
"""

import asyncio

from sqlalchemy import select, func

from app.core.database import init_db, AsyncSessionLocal
from app.models.models import LearningModule, Question, Topic
from app.services.module_service import build_static_module


# (id, title, description, order_index)
TOPICS = [
    (
        "web-security",
        "Web Security",
        "OWASP Top 10, XSS, CSRF, SQL injection, secure HTTP headers.",
        0,
    ),
    (
        "network-security",
        "Network Security",
        "TLS, segmentation, firewalls, intrusion detection, VPNs.",
        1,
    ),
    (
        "cryptography",
        "Cryptography",
        "Symmetric/asymmetric keys, hashing, signing, key management.",
        2,
    ),
    (
        "auth-and-iam",
        "Authentication & IAM",
        "MFA, SSO, OAuth, JWTs, role-based access control.",
        3,
    ),
    (
        "secure-coding",
        "Secure Coding",
        "Input validation, dependency scanning, secrets handling, OWASP ASVS.",
        4,
    ),
]


# (topic_id, difficulty, text, options, correct_answer, explanation, hint)
QUESTIONS = [
    # ── web-security ─────────────────────────────────────
    (
        "web-security",
        "easy",
        "Which HTTP header instructs browsers to only load resources over HTTPS?",
        {"A": "Content-Type", "B": "Strict-Transport-Security", "C": "Cache-Control", "D": "X-Frame-Options"},
        "B",
        "HSTS forces HTTPS-only loading, defeating downgrade attacks.",
        "It starts with 'Strict'.",
    ),
    (
        "web-security",
        "medium",
        "What kind of XSS persists in the database and is rendered to other users later?",
        {"A": "Reflected XSS", "B": "DOM-based XSS", "C": "Stored XSS", "D": "Self-XSS"},
        "C",
        "Stored XSS is saved server-side and replayed to anyone visiting the affected page.",
        "Think about persistence vs. one-shot.",
    ),
    (
        "web-security",
        "hard",
        "Which mitigation alone is NOT sufficient to fully prevent CSRF on a sensitive POST endpoint?",
        {"A": "Same-origin CSRF token", "B": "SameSite=Strict cookie", "C": "Checking the Referer header", "D": "Double-submit cookie pattern"},
        "C",
        "Referer checks are easily bypassed/spoofed and unreliable across browsers; tokens or SameSite cookies are required.",
        "Headers a client can omit shouldn't be your only defense.",
    ),
    # ── network-security ─────────────────────────────────
    (
        "network-security",
        "easy",
        "Which protocol provides encrypted DNS lookups end-to-end?",
        {"A": "DNS over UDP", "B": "DNS over TLS", "C": "ICMP", "D": "ARP"},
        "B",
        "DNS-over-TLS (DoT) and DNS-over-HTTPS (DoH) encrypt resolver traffic.",
        "Add TLS to DNS.",
    ),
    (
        "network-security",
        "medium",
        "Which approach minimises lateral movement after a host is compromised?",
        {"A": "Flat network", "B": "Network segmentation", "C": "Disable logging", "D": "Open all ports"},
        "B",
        "Segmentation limits the blast radius — attackers must cross controlled boundaries.",
        "Think 'walls between zones'.",
    ),
    (
        "network-security",
        "hard",
        "What is the primary purpose of a SIEM?",
        {"A": "Block malware in real time", "B": "Aggregate and correlate security events", "C": "Encrypt files at rest", "D": "Replace a WAF"},
        "B",
        "SIEMs ingest logs from multiple sources and correlate alerts for analyst investigation.",
        "It's a centralised visibility tool.",
    ),
    # ── cryptography ─────────────────────────────────────
    (
        "cryptography",
        "easy",
        "Which is a one-way cryptographic primitive?",
        {"A": "AES", "B": "RSA", "C": "SHA-256", "D": "Diffie-Hellman"},
        "C",
        "Hash functions like SHA-256 are designed to be one-way.",
        "Hashes can't be reversed.",
    ),
    (
        "cryptography",
        "medium",
        "What is a key benefit of authenticated encryption (e.g. AES-GCM) over CBC + HMAC?",
        {"A": "Faster on tiny payloads only", "B": "Built-in integrity, harder to misuse", "C": "Skips the IV", "D": "Removes the need for keys"},
        "B",
        "AEAD modes pair encryption with integrity in a single primitive that's harder to misuse.",
        "Think 'one operation, two guarantees'.",
    ),
    (
        "cryptography",
        "hard",
        "Why is reusing a nonce with AES-GCM catastrophic?",
        {"A": "Nothing happens", "B": "It leaks the plaintext via XOR", "C": "It only weakens the MAC slightly", "D": "It rotates the key"},
        "B",
        "Nonce reuse in GCM lets an attacker derive XOR of plaintexts and forge messages.",
        "GCM's confidentiality and authenticity rely on nonce uniqueness.",
    ),
    # ── auth-and-iam ─────────────────────────────────────
    (
        "auth-and-iam",
        "easy",
        "Which factor combination satisfies multi-factor authentication?",
        {"A": "Password + secret question", "B": "Password + hardware token", "C": "Two passwords", "D": "Username + email"},
        "B",
        "MFA requires two distinct factor categories (knowledge, possession, inherence).",
        "Different categories — not two of the same.",
    ),
    (
        "auth-and-iam",
        "medium",
        "What is the safest way to store a JWT in a SPA used in a browser?",
        {"A": "localStorage", "B": "httpOnly Secure cookie", "C": "URL fragment", "D": "Plain cookie"},
        "B",
        "httpOnly Secure cookies are inaccessible to JavaScript, mitigating XSS token theft.",
        "Hide it from JavaScript.",
    ),
    (
        "auth-and-iam",
        "hard",
        "In OAuth 2.0 Authorization Code with PKCE, what does PKCE protect against?",
        {"A": "Server outages", "B": "Authorization code interception", "C": "Database leaks", "D": "Brute-force passwords"},
        "B",
        "PKCE binds the auth code to the original requester via code_verifier / code_challenge.",
        "It prevents code-stealing attacks on public clients.",
    ),
    # ── secure-coding ────────────────────────────────────
    (
        "secure-coding",
        "easy",
        "What is the safest way to build a SQL query with user input?",
        {"A": "String concatenation", "B": "Format strings", "C": "Parameterised queries", "D": "Escaping quotes manually"},
        "C",
        "Parameterised queries / prepared statements separate code from data.",
        "Let the driver bind the values.",
    ),
    (
        "secure-coding",
        "medium",
        "Which dependency-related practice reduces supply-chain risk the most?",
        {"A": "Pinning exact versions and reviewing updates", "B": "Always installing latest", "C": "Disabling lockfiles", "D": "Using random forks"},
        "A",
        "Pinned, reviewed dependencies prevent silent malicious updates.",
        "Reproducible builds are safer.",
    ),
    (
        "secure-coding",
        "hard",
        "What's the main risk of logging entire request bodies?",
        {"A": "Storage cost only", "B": "Leaking secrets/PII into log stores", "C": "It improves debugging always", "D": "Slow logs"},
        "B",
        "Bodies often contain credentials, tokens, or PII that then get stored beyond the app's protection boundary.",
        "Logs are a privacy boundary too.",
    ),
]


async def seed() -> None:
    await init_db()

    async with AsyncSessionLocal() as session:
        existing = (await session.execute(select(func.count(Topic.id)))).scalar() or 0
        if existing >= len(TOPICS):
            print(f"[OK] Database already has {existing} topics. Adding any missing questions only.")
        else:
            for tid, title, desc, order in TOPICS:
                exists = (
                    await session.execute(select(Topic).where(Topic.id == tid))
                ).scalar_one_or_none()
                if exists:
                    continue
                session.add(
                    Topic(
                        id=tid,
                        title=title,
                        description=desc,
                        order_index=order,
                        is_active=True,
                    )
                )
            await session.flush()
            print(f"[OK] Seeded {len(TOPICS)} topics.")

        # Insert questions if not already present (by text + topic)
        added = 0
        for topic_id, difficulty, text, options, correct, explanation, hint in QUESTIONS:
            already = (
                await session.execute(
                    select(Question).where(
                        Question.topic_id == topic_id,
                        Question.text == text,
                    )
                )
            ).scalar_one_or_none()
            if already:
                continue
            session.add(
                Question(
                    topic_id=topic_id,
                    difficulty=difficulty,
                    text=text,
                    options=options,
                    correct_answer=correct,
                    explanation=explanation,
                    hint=hint,
                    source="dataset",
                )
            )
            added += 1

        await session.commit()
        print(f"[OK] Added {added} new questions.")

        # Seed learning modules (static content for each topic)
        modules_added = 0
        for tid, title, _desc, _order in TOPICS:
            already = (
                await session.execute(
                    select(LearningModule).where(
                        LearningModule.topic_id == tid,
                        LearningModule.is_active == True,  # noqa: E712
                    )
                )
            ).scalar_one_or_none()
            if already:
                continue
            content = build_static_module(tid, title)
            session.add(
                LearningModule(
                    topic_id=tid,
                    content=content,
                    is_ai_generated=False,
                )
            )
            modules_added += 1

        await session.commit()
        print(f"[OK] Added {modules_added} new learning modules.")


if __name__ == "__main__":
    asyncio.run(seed())
