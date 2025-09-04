import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const WINDOW_SECONDS = 60; // 1 minute window
const MAX_ACTIONS = 5; // Allow 5 questions per minute for testing

function isWritePath(url: URL) {
  return url.pathname === "/api/questions/new";
}

function getIdentity(req: NextRequest) {
  const uid = req.headers.get("x-user-id");
  if (uid) return `u:${uid}`;
  const xff = req.headers.get("x-forwarded-for") || "";
  const ip = xff.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

export async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  if (!isWritePath(url)) return NextResponse.next();

  const id = getIdentity(req);
  const key = `rl:${id}:newq`;

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SECONDS);
  }
  if (count > MAX_ACTIONS) {
    const ttl = await redis.ttl(key);
    return new NextResponse(
      JSON.stringify({
        ok: false,
        error: "Slow down. Try again soon.",
        retryAfterSeconds: Math.max(ttl, 1),
      }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": String(Math.max(ttl, 1)),
        },
      }
    );
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
