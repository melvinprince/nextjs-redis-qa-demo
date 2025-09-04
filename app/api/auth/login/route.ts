import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redis } from "@/lib/redis";
import { randomUUID } from "crypto";

const SESSION_TTL = 60 * 60 * 24 * 7;

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = await fakeAuth(email, password);
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Invalid credentials" },
      { status: 401 }
    );
  }

  const sid = randomUUID();
  const session = { uid: user.id, email: user.email, createdAt: Date.now() };
  await redis.set(`session:${sid}`, session, { ex: SESSION_TTL });

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "sid",
    value: sid,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL,
  });
  return res;
}

async function fakeAuth(email: string, password: string) {
  if (email && password) {
    return { id: "u1", email };
  }
  return null;
}
