import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { bus } from "@/lib/bus";
import { slidingWindowAllow } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id)
    return NextResponse.json(
      { ok: false, error: "Missing id" },
      { status: 400 }
    );

  // Rate limiting for deletes
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitKey = `delete:${ip}`;
  const allowed = await slidingWindowAllow({
    key: rateLimitKey,
    windowSeconds: 60,
    max: 10, // Allow reasonable number of deletes
  });

  if (!allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Rate limit exceeded. Please slow down.",
      },
      { status: 429 }
    );
  }

  const key = `question:${id}`;

  // Check if question exists
  const exists = await redis.exists(key);
  if (!exists) {
    return NextResponse.json(
      { ok: false, error: "Question not found" },
      { status: 404 }
    );
  }

  // Delete the question hash
  await redis.del(key);

  // Remove from sorted set index
  await redis.zrem("questions:byTime", id);

  // Invalidate cache
  await redis.del("questions:latest");

  // Emit the delete event (for real-time updates)
  await bus.emitAsync("questions:delete", { id });

  return NextResponse.json({ ok: true, id });
}
