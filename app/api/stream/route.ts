import { NextRequest } from "next/server";
import { bus } from "@/lib/bus";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

// How often to poll Redis for changes when running in a multi-instance environment
const POLL_MS = 1500;
const LIST_LIMIT = 20;

type Q = { id: string; text: string; likes: number; createdAt: number };

export async function GET(_req: NextRequest) {
  let isClosed = false;
  let heartbeat: NodeJS.Timeout | null = null;
  let poller: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();

      const send = (data: unknown) => {
        if (isClosed) return;
        try {
          const text = typeof data === "string" ? data : JSON.stringify(data);
          controller.enqueue(enc.encode(`data: ${text}\n\n`));
        } catch {
          isClosed = true;
        }
      };

      const cleanup = () => {
        if (isClosed) return;
        isClosed = true;
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        if (poller) {
          clearInterval(poller);
          poller = null;
        }
        bus.off("questions:new", onNew);
        bus.off("questions:update", onUpdate);
        bus.off("questions:delete", onDelete);
        try {
          controller.close();
        } catch {
          // Controller already closed
        }
      };

      const onNew = (payload: any) => send({ type: "new-question", payload });
      const onUpdate = (payload: any) =>
        send({ type: "question-update", payload });
      const onDelete = (payload: any) =>
        send({ type: "question-delete", payload });

      // Local in-memory bus: works in single-instance/dev
      bus.on("questions:new", onNew);
      bus.on("questions:update", onUpdate);
      bus.on("questions:delete", onDelete);

      // Heartbeat for keeping connections alive
      heartbeat = setInterval(() => {
        if (!isClosed) send({ type: "ping", t: Date.now() });
      }, 5000);

      // Cross-instance consistency: poll Redis and forward deltas
      // Maintains a small snapshot of the top questions
      let snapshot = new Map<string, Q>();

      const poll = async () => {
        if (isClosed) return;
        try {
          const ids = await redis.zrange<string[]>("questions:byTime", 0, LIST_LIMIT - 1, {
            rev: true,
          });

          // Fetch all question hashes in a single pipeline
          const pipe = redis.pipeline();
          for (const id of ids) pipe.hgetall(`question:${id}`);
          const results = (await pipe.exec()) as Array<
            | { text?: string; likes?: number; createdAt?: number }
            | null
          >;

          const current = new Map<string, Q>();
          ids.forEach((id, i) => {
            const q = results[i] || {};
            current.set(id, {
              id,
              text: String((q as any)?.text ?? "Untitled"),
              likes: Number((q as any)?.likes ?? 0),
              createdAt: Number((q as any)?.createdAt ?? 0),
            });
          });

          // Detect new questions
          for (const [id, q] of current) {
            if (!snapshot.has(id)) {
              send({ type: "new-question", payload: q });
            }
          }

          // Detect deletions
          for (const [id] of snapshot) {
            if (!current.has(id)) {
              send({ type: "question-delete", payload: { id } });
            }
          }

          // Detect likes updates
          for (const [id, q] of current) {
            const prev = snapshot.get(id);
            if (prev && prev.likes !== q.likes) {
              send({ type: "question-update", payload: { id, likes: q.likes } });
            }
          }

          // Update snapshot
          snapshot = current;
        } catch (err) {
          // Swallow to keep the stream alive; will retry next tick
          console.error("SSE poll error", err);
        }
      };

      // Kick off an initial poll so the snapshot is warm
      await poll();
      poller = setInterval(poll, POLL_MS);

      // Handle client disconnect
      _req.signal?.addEventListener("abort", cleanup);
    },
    cancel() {
      // This is called when the client disconnects
      isClosed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      if (poller) {
        clearInterval(poller);
        poller = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
