"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";

type Q = { id: string; text: string; likes: number; createdAt: number };
type Toast = {
  id: string;
  text: string;
  variant?: "info" | "success" | "danger";
};

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const refs = useRef(new Map<string, HTMLDivElement | null>());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    refs.current.delete(id);
  }, []);

  const push = useCallback(
    (text: string, variant: Toast["variant"] = "info", ttl = 2600) => {
      const id = crypto.randomUUID();
      const toast: Toast = { id, text, variant };
      setToasts((prev) => [toast, ...prev]);

      // animate in after DOM paint
      setTimeout(() => {
        const el = refs.current.get(id);
        if (!el) return;
        gsap.fromTo(
          el,
          { y: -24, opacity: 0, scale: 0.98, filter: "blur(3px)" },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            filter: "blur(0)",
            duration: 0.3,
            ease: "power2.out",
          }
        );
      }, 0);

      // schedule removal
      setTimeout(() => {
        const el = refs.current.get(id);
        if (!el) return remove(id);
        gsap.to(el, {
          y: -20,
          opacity: 0,
          duration: 0.28,
          ease: "power1.inOut",
          onComplete: () => remove(id),
        });
      }, ttl);

      return id;
    },
    [remove]
  );

  const attachRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) refs.current.set(id, el);
    },
    []
  );

  return { toasts, push, attachRef };
}

export default function Home() {
  const [questions, setQuestions] = useState<Q[]>([]);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  const { toasts, push, attachRef } = useToasts();
  const heroRef = useRef<HTMLDivElement | null>(null);
  const qaListRef = useRef<HTMLUListElement | null>(null);

  // Fetch initial questions
  useEffect(() => {
    fetch("/api/questions")
      .then((r) => r.json())
      .then((res) => setQuestions(res.data ?? []))
      .catch(() => {});
  }, []);

  // Initial hero animation
  useEffect(() => {
    if (!heroRef.current) return;
    const tl = gsap.timeline();
    tl.fromTo(
      heroRef.current.querySelectorAll(".hero-title, .hero-sub, .badge"),
      { y: 12, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: "power2.out", stagger: 0.06 }
    );
  }, []);

  // Animate Q&A items on length change (stagger-in)
  useEffect(() => {
    if (!qaListRef.current) return;
    const items = Array.from(qaListRef.current.querySelectorAll(".qa-item"));
    if (items.length) {
      gsap.fromTo(
        items,
        { y: 10, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.28, stagger: 0.03, ease: "power2.out" }
      );
    }
  }, [questions.length]);

  // Helpers
  const updateQuestion = useCallback((id: string, updater: (q: Q) => Q) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? updater(q) : q)));
  }, []);

  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const addQuestion = useCallback((question: Q) => {
    setQuestions((prev) => {
      if (prev.some((q) => q.id === question.id)) return prev;
      return [question, ...prev];
    });
  }, []);

  // SSE for real-time updates
  useEffect(() => {
    const es = new EventSource("/api/stream");
    es.onopen = () => setConnectionStatus("connected");
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        switch (data.type) {
          case "new-question":
            addQuestion(data.payload);
            break;
          case "question-update":
            updateQuestion(data.payload.id, (q) => ({
              ...q,
              likes: data.payload.likes,
            }));
            break;
          case "question-delete":
            removeQuestion(data.payload.id);
            break;
          case "ping":
            break;
        }
      } catch (error) {
        console.error("Failed to parse SSE message:", error);
      }
    };
    es.onerror = () => {
      setConnectionStatus("disconnected");
      es.close();
    };
    return () => {
      es.close();
      setConnectionStatus("disconnected");
    };
  }, [addQuestion, updateQuestion, removeQuestion]);

  async function submitQuestion() {
    const body = { text: text.trim() };
    if (!body.text || isSubmitting) return;
    setIsSubmitting(true);
    setText("");
    try {
      const res = await fetch("/api/questions/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        push(j?.error || "Failed to post", "danger");
        setText(body.text);
      } else {
        push("Your question was posted", "success");
      }
    } catch {
      push("Failed to post question", "danger");
      setText(body.text);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function like(id: string) {
    if (likingIds.has(id)) return;
    setLikingIds((prev) => new Set(prev).add(id));
    updateQuestion(id, (q) => ({ ...q, likes: q.likes + 1 })); // optimistic
    try {
      const res = await fetch("/actions/like", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        updateQuestion(id, (q) => ({ ...q, likes: Math.max(0, q.likes - 1) }));
        push("Failed to like question", "danger");
      }
    } catch {
      updateQuestion(id, (q) => ({ ...q, likes: Math.max(0, q.likes - 1) }));
      push("Failed to like question", "danger");
    } finally {
      setLikingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }

  async function deleteQuestion(id: string) {
    if (deletingIds.has(id)) return;
    if (!confirm("Are you sure you want to delete this question?")) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    push("Deleting question...", "info", 4000);
    try {
      const res = await fetch("/actions/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        push(j?.error || "Failed to delete question", "danger");
      } else {
        push("Question deleted", "success");
      }
    } catch {
      push("Failed to delete question", "danger");
    } finally {
      setDeletingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion();
    }
  };

  return (
    <main className="container">
      {/* Toasts */}
      <div className="toast-wrap">
        {toasts.map((t) => (
          <div
            key={t.id}
            ref={attachRef(t.id)}
            className={`toast ${t.variant ?? "info"}`}
          >
            <span className="icon" />
            <span>{t.text}</span>
          </div>
        ))}
      </div>

      {/* Hero / Intro */}
      <section ref={heroRef} className="card hero">
        <div
          className="row"
          style={{ justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div>
            <h1 className="hero-title">Live Q&A — Next.js + Redis + Upstash</h1>
            <p className="hero-sub">
              Real-time likes, caching, sessions, and rate limits — all on
              serverless infra.
            </p>
            <div className="hero-badges">
              <span className="badge">Realtime via SSE</span>
              <span className="badge">Redis-backed</span>
              <span className="badge">Serverless ready</span>
              <span className="badge">Dark mode only</span>
            </div>
          </div>
          <div className="status" aria-live="polite">
            <span
              className={`dot ${
                connectionStatus === "connected"
                  ? "c"
                  : connectionStatus === "connecting"
                  ? "y"
                  : "r"
              }`}
            />
            <span style={{ textTransform: "capitalize" }}>
              {connectionStatus}
            </span>
          </div>
        </div>
        <div style={{ height: 14 }} />
        <p className="sub">
          How it works: questions are stored in Redis, listed from a sorted set,
          with cache invalidation on writes. Likes are applied atomically and
          broadcast to all clients. Rate limits protect the endpoints.
        </p>
      </section>

      {/* Ask */}
      <section className="card section" style={{ padding: 20 }}>
        <h2 className="h2">Ask Anything</h2>
        <p className="sub">
          Post a question and watch likes update in real-time.
        </p>
        <div className="row">
          <input
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question (Press Enter to submit)"
            disabled={isSubmitting}
          />
          <button
            className="btn btn-primary"
            onClick={submitQuestion}
            disabled={isSubmitting || !text.trim()}
          >
            {isSubmitting ? "Posting..." : "Ask"}
          </button>
        </div>
        <div style={{ height: 6 }} />
        <p className="sub">Rate limit: 5 posts/min per IP</p>
      </section>

      {/* Live Q&A */}
      <section className="card section" style={{ padding: 20 }}>
        <h2 className="h2">Live Q&A ({questions.length})</h2>
        {questions.length === 0 ? (
          <p className="sub" style={{ textAlign: "center", padding: "20px 0" }}>
            No questions yet. Be the first to ask!
          </p>
        ) : (
          <ul ref={qaListRef} className="qa-list">
            {questions.map((q) => (
              <li key={q.id} className="qa-item">
                <div style={{ flex: 1 }}>
                  <p className="qa-text">{q.text}</p>
                  <div className="qa-meta">
                    <span>❤ {q.likes} likes</span>
                    <span>•</span>
                    <span>{new Date(q.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="row" style={{ flexShrink: 0 }}>
                  <button
                    className="btn btn-like"
                    onClick={() => {
                      const el = document.getElementById(`like-${q.id}`);
                      if (el)
                        gsap.fromTo(
                          el,
                          { scale: 1 },
                          {
                            scale: 1.14,
                            duration: 0.12,
                            yoyo: true,
                            repeat: 1,
                            ease: "power1.inOut",
                          }
                        );
                      like(q.id);
                    }}
                    id={`like-${q.id}`}
                    disabled={likingIds.has(q.id)}
                  >
                    {likingIds.has(q.id) ? "❤ Liking..." : "❤ Like"}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => deleteQuestion(q.id)}
                    disabled={deletingIds.has(q.id)}
                  >
                    {deletingIds.has(q.id) ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Know in depth */}
      <section className="card section" style={{ padding: 20 }}>
        <h2 className="h2">Know In Depth</h2>
        <p className="sub">An 8-post series on Redis, Next.js and Upstash</p>
        <div className="posts-grid">
          <a
            className="post"
            href="https://medium.com/better-dev-nextjs-react/why-redis-matters-for-next-js-developers-b15f644ba6a3"
            target="_blank"
            rel="noreferrer"
          >
            <h4>1. Why Redis Matters for Next.js Developers</h4>
            <p>High-level overview and motivations</p>
          </a>
          <a
            className="post"
            href="https://medium.com/better-dev-nextjs-react/redis-for-api-caching-in-next-js-bc8558e1ee3f"
            target="_blank"
            rel="noreferrer"
          >
            <h4>2. Redis for API Caching in Next.js</h4>
            <p>Speed up with structured caching</p>
          </a>
          <a
            className="post"
            href="https://medium.com/better-dev-nextjs-react/session-storage-with-redis-in-next-js-86b670da7bc7"
            target="_blank"
            rel="noreferrer"
          >
            <h4>3. Session Storage with Redis in Next.js</h4>
            <p>Store sessions securely</p>
          </a>
          <a
            className="post"
            href="https://medium.com/better-dev-nextjs-react/rate-limiting-your-next-js-api-with-redis-b35a6622acba"
            target="_blank"
            rel="noreferrer"
          >
            <h4>4. Rate Limiting Your Next.js API with Redis</h4>
            <p>Protect endpoints with sliding windows</p>
          </a>
          <a
            className="post"
            href="https://blog.melvinprince.io/real-time-pub-sub-with-redis-in-next-js-413c966c3052"
            target="_blank"
            rel="noreferrer"
          >
            <h4>5. Real-time Pub/Sub with Redis in Next.js</h4>
            <p>Patterns for live updates</p>
          </a>
          <a
            className="post"
            href="https://medium.com/better-dev-nextjs-react/server-actions-redis-instant-state-in-next-js-15-5c7dda582cf9"
            target="_blank"
            rel="noreferrer"
          >
            <h4>6. Server Actions + Redis: Instant State</h4>
            <p>Minimize latency with actions</p>
          </a>
          <a
            className="post"
            href="https://medium.com/better-dev-nextjs-react/edge-ready-redis-patterns-using-upstash-for-vercel-deployments-f06d905094a1"
            target="_blank"
            rel="noreferrer"
          >
            <h4>7. Edge-ready Redis Patterns for Vercel</h4>
            <p>Design for the edge</p>
          </a>
          <a
            className="post"
            href="https://medium.com/better-dev-nextjs-react/redis-nextjs-complete-mini-app-for-real-time-q-and-a-final-post-1ed166951835"
            onClick={(e) => e.preventDefault()}
          >
            <h4>8. Putting It All Together: A Mini Next.js App Using Redis</h4>
            <p>The final post of the series</p>
          </a>
        </div>
      </section>

      {/* Footer */}
      <div className="footer">
        <span>Built by </span>
        <a href="https://melvinprince.io" target="_blank" rel="noreferrer">
          Melvin Prince
        </a>
      </div>
    </main>
  );
}
