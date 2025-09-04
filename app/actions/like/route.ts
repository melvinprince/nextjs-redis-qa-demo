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

  // Rate limiting for likes
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitKey = `like:${ip}`;
  const allowed = await slidingWindowAllow({
    key: rateLimitKey,
    windowSeconds: 60,
    max: 30, // Allow more likes than posts
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
  await redis.hsetnx(key, "likes", 0);
  const likes = await redis.hincrby(key, "likes", 1);

  await redis.del("questions:latest");

  // Emit the update event (for other clients)
  await bus.emitAsync("questions:update", { id, likes });

  return NextResponse.json({ ok: true, id, likes });
}
