import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";

const CACHE_KEY = "questions:latest";
const TTL_SECONDS = 30;

export async function GET() {
  const cached = await redis.get(CACHE_KEY);
  if (cached) {
    return NextResponse.json({ source: "cache", data: cached });
  }

  // "DB" read simulated using Redis sorted set
  const ids = await redis.zrange<string[]>("questions:byTime", 0, 19, {
    rev: true,
  });
  const items = await Promise.all(
    ids.map(async (id) => {
      const q = await redis.hgetall<{
        text: string;
        likes: number;
        createdAt: number;
      }>(`question:${id}`);
      return {
        id,
        text: q?.text ?? "Untitled",
        likes: Number(q?.likes ?? 0),
        createdAt: Number(q?.createdAt ?? 0),
      };
    })
  );

  await redis.set(CACHE_KEY, items, { ex: TTL_SECONDS });
  return NextResponse.json({ source: "origin", data: items });
}
