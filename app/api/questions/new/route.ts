import { NextRequest, NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { bus } from "@/lib/bus";
import { slidingWindowAllow } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body?.text ?? "").trim();
  if (!text)
    return NextResponse.json(
      { ok: false, error: "Text required" },
      { status: 400 }
    );

  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const rateLimitKey = `post:${ip}`;
  const allowed = await slidingWindowAllow({
    key: rateLimitKey,
    windowSeconds: 60,
    max: 5,
  });

  if (!allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Rate limit exceeded. Please wait before posting again.",
      },
      { status: 429 }
    );
  }

  const id = crypto.randomUUID();
  const key = `question:${id}`;
  const now = Date.now();

  // store as a hash
  await redis.hset(key, { text, likes: 0, createdAt: now });
  // index in a sorted set for listing
  await redis.zadd("questions:byTime", { score: now, member: id });
  // invalidate cache
  await redis.del("questions:latest");

  const newQuestion = { id, text, likes: 0, createdAt: now };

  // local dev live event
  bus.emitAsync("questions:new", newQuestion).catch(console.error);

  return NextResponse.json({ ok: true, data: newQuestion });
}
