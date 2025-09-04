"use client";

import { useEffect, useState, useCallback } from "react";

type Q = { id: string; text: string; likes: number; createdAt: number };

export default function Home() {
  const [questions, setQuestions] = useState<Q[]>([]);
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected"
  >("connecting");

  // Fetch initial questions
  useEffect(() => {
    fetch("/api/questions")
      .then((r) => r.json())
      .then((res) => setQuestions(res.data ?? []))
      .catch(() => {});
  }, []);

  // Helper function to update questions in both lists
  const updateQuestion = useCallback((id: string, updater: (q: Q) => Q) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? updater(q) : q)));
  }, []);

  // Helper function to remove question from both lists
  const removeQuestion = useCallback((id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  // Helper function to add new question
  const addQuestion = useCallback((question: Q) => {
    setQuestions((prev) => {
      // Check if question already exists to avoid duplicates
      if (prev.some((q) => q.id === question.id)) {
        return prev;
      }
      return [question, ...prev];
    });
  }, []);

  // SSE for real-time updates
  useEffect(() => {
    const es = new EventSource("/api/stream");

    es.onopen = () => {
      setConnectionStatus("connected");
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);

        switch (data.type) {
          case "new-question":
            addQuestion(data.payload);
            break;

          case "question-update":
            // Update likes from server (real-time sync across clients)
            updateQuestion(data.payload.id, (q) => ({
              ...q,
              likes: data.payload.likes,
            }));
            break;

          case "question-delete":
            removeQuestion(data.payload.id);
            break;

          case "ping":
            // Keep connection alive
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
        alert(j?.error || "Failed to post");
        setText(body.text); // Restore text on error
      }
    } catch (error) {
      alert("Failed to post question");
      setText(body.text); // Restore text on error
    } finally {
      setIsSubmitting(false);
    }
  }

  async function like(id: string) {
    if (likingIds.has(id)) return;

    setLikingIds((prev) => new Set(prev).add(id));

    // Optimistic update - update UI immediately
    updateQuestion(id, (q) => ({ ...q, likes: q.likes + 1 }));

    try {
      const res = await fetch("/actions/like", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        // Revert optimistic update on error
        updateQuestion(id, (q) => ({ ...q, likes: Math.max(0, q.likes - 1) }));
        alert("Failed to like question");
      }
      // Note: We don't need to update on success because SSE will handle it
    } catch (error) {
      // Revert optimistic update on error
      updateQuestion(id, (q) => ({ ...q, likes: Math.max(0, q.likes - 1) }));
      alert("Failed to like question");
    } finally {
      setLikingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }

  async function deleteQuestion(id: string) {
    if (deletingIds.has(id)) return;

    if (!confirm("Are you sure you want to delete this question?")) return;

    setDeletingIds((prev) => new Set(prev).add(id));

    try {
      const res = await fetch("/actions/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || "Failed to delete question");
      }
      // Note: We don't need to update on success because SSE will handle it
    } catch (error) {
      alert("Failed to delete question");
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
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
    <main className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Live Q and A</h1>
        <div className="flex items-center gap-2 text-sm">
          <div
            className={`w-2 h-2 rounded-full ${
              connectionStatus === "connected"
                ? "bg-green-500"
                : connectionStatus === "connecting"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`}
          />
          <span className="text-gray-600 capitalize">{connectionStatus}</span>
        </div>
      </div>

      <section className="space-y-2">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask a question (Press Enter to submit)"
            className="flex-1 rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isSubmitting}
          />
          <button
            onClick={submitQuestion}
            disabled={isSubmitting || !text.trim()}
            className="rounded border px-4 py-2 bg-blue-500 text-white disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-600 transition-colors"
          >
            {isSubmitting ? "Posting..." : "Ask"}
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Rate limit: 5 posts per minute per user or IP
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Questions ({questions.length})</h2>
        {questions.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No questions yet. Be the first to ask!
          </p>
        ) : (
          <ul className="space-y-3">
            {questions.map((q) => (
              <li
                key={q.id}
                className="rounded border p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-gray-900 mb-2">{q.text}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>❤ {q.likes} likes</span>
                      <span>•</span>
                      <span>{new Date(q.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => like(q.id)}
                      disabled={likingIds.has(q.id)}
                      className="rounded border px-3 py-1 text-sm hover:bg-red-50 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {likingIds.has(q.id) ? "❤ Liking..." : "❤ Like"}
                    </button>
                    <button
                      onClick={() => deleteQuestion(q.id)}
                      disabled={deletingIds.has(q.id)}
                      className="rounded border px-3 py-1 text-sm text-red-600 border-red-300 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingIds.has(q.id) ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
