import { redis } from "./redis";

export async function slidingWindowAllow({
  key,
  windowSeconds,
  max
}: {
  key: string;
  windowSeconds: number;
  max: number;
}) {
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;
  const zkey = `sw:${key}`;

  await redis.zadd(zkey, { score: now, member: String(now) });
  await redis.zremrangebyscore(zkey, 0, windowStart);
  const count = await redis.zcard(zkey);
  await redis.expire(zkey, windowSeconds + 5);

  return count <= max;
}
