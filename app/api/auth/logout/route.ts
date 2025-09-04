import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redis } from "@/lib/redis";

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("sid")?.value;
  if (sid) await redis.del(`session:${sid}`);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("sid", "", { path: "/", maxAge: 0 });
  return res;
}
