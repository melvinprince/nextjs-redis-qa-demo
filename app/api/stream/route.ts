import { NextRequest } from "next/server";
import { bus } from "@/lib/bus";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  let isClosed = false;
  let heartbeat: NodeJS.Timeout | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const send = (data: unknown) => {
        if (isClosed) return;
        try {
          const text = typeof data === "string" ? data : JSON.stringify(data);
          controller.enqueue(enc.encode(`data: ${text}\n\n`));
        } catch (error) {
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
        bus.off("questions:new", onNew);
        bus.off("questions:update", onUpdate);
        bus.off("questions:delete", onDelete);
        try {
          controller.close();
        } catch (error) {
          // Controller already closed
        }
      };

      const onNew = (payload: any) => send({ type: "new-question", payload });
      const onUpdate = (payload: any) =>
        send({ type: "question-update", payload });
      const onDelete = (payload: any) =>
        send({ type: "question-delete", payload });

      bus.on("questions:new", onNew);
      bus.on("questions:update", onUpdate);
      bus.on("questions:delete", onDelete);

      heartbeat = setInterval(() => {
        if (!isClosed) {
          send({ type: "ping", t: Date.now() });
        }
      }, 5000); // Reduced from 15 seconds to 5 seconds

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
