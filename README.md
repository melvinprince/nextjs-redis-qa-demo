# Next.js + Redis Live Q&A (Series Finale)

A small, complete Next.js app that showcases Redis powering caching, sessions, rate limiting, and real‑time updates. This is the final “Putting It All Together” post in the series.

- Live demo: https://redis-nextjs-upstash.melvinprince.io/

**What you get**

- Real‑time Q&A with likes and deletes
- Redis‑backed caching with TTL and invalidation
- Sliding‑window rate limiting on write paths
- Optional session routes (sample login/logout)
- Modern dark UI with GSAP animations and toasts

**How realtime works**

- Uses SSE (`/api/stream`) with Redis‑backed polling to stay consistent across Vercel instances.
- Poll cadence and list size are tunable in `app/api/stream/route.ts` (`POLL_MS`, `LIST_LIMIT`).
- Optimistic UI keeps interactions snappy; server events reconcile state.

Note: Upstash Redis (REST) does not support `SUBSCRIBE`. Polling is reliable and serverless‑friendly. If you need sub‑second push at scale, integrate a provider like Pusher/Ably or Upstash Pub/Sub and keep polling as a fallback.

## Run Locally

Prerequisites

- Node.js 18+ and npm
- Upstash Redis database (free tier works)

Steps

- Install dependencies: `npm install`
- Copy env template: `cp .env.example .env.local`
- Add credentials in `.env.local`(Get it for free just after signing up. No payments required)[https://upstash.com/]:
  - `UPSTASH_REDIS_REST_URL=...`
  - `UPSTASH_REDIS_REST_TOKEN=...`
- Start dev server: `npm run dev`
- Open: http://localhost:3000 (use multiple tabs/devices to see realtime)

## Deploy on Vercel

- Import the repo in Vercel
- Add environment variables:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- Deploy. The SSE endpoint runs on the Node.js runtime and works across regions.

## Environment Variables

- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token

## Endpoints

- `GET /api/questions`: Returns latest 20 questions (cached, TTL 30s)
- `POST /api/questions/new`: Creates a question (rate limited)
- `POST /actions/like`: Likes a question (rate limited, optimistic UI)
- `POST /actions/delete`: Deletes a question (rate limited)
- `GET /api/stream`: Server‑Sent Events stream for realtime updates

## Key Files

- `lib/redis.ts`: Upstash Redis client
- `app/api/questions/route.ts`: Cached list with TTL + cache warm/fill
- `app/api/questions/new/route.ts`: Create + cache invalidation
- `app/actions/like/route.ts`: Atomic like increment + invalidation
- `app/actions/delete/route.ts`: Delete + invalidation
- `app/api/stream/route.ts`: SSE stream with Redis polling across instances
- `middleware.ts`: Example fixed‑window rate limit for posting

## What’s Inside (By Concept)

- Caching with TTL: 30‑second cache for the latest list; invalidated on writes
- Data structures: Hashes (question fields), Sorted sets (time index), Atomic counters (likes)
- Rate limiting: Sliding window helpers (+ fixed window example in middleware)
- Sessions (optional): Sample login/logout routes and helpers present
- Realtime: SSE stream; polling ensures cross‑instance consistency on Vercel

## Optional Integrations

- Pub/Sub provider: If you add Pusher/Ably/Upstash Pub/Sub, publish on writes and subscribe in the SSE route; keep polling as a safety net for consistency.
- Edge runtime: You can move the stream to Edge after removing Node‑only imports; confirm provider compatibility first.

## Series Finale: Putting It All Together

We spent seven posts exploring Redis for Next.js—caching APIs, keeping sessions alive, protecting endpoints with rate limits, pushing real‑time updates, and working with Server Actions. This app ties those ideas together:

- Sessions in Redis: Survive cold starts and cross‑region deployments
- Rate limiting: Fair posting and like limits via Redis counters/sets
- Caching: Fast question lists with TTL and invalidation
- Realtime: Events streamed to clients via SSE
- Server actions: Instant user feedback with optimistic updates

Think of Redis as the shared nervous system and Next.js as the brain and UI. Upstash makes it serverless‑friendly with REST, global edge latency, and no connection pooling.

## Series Navigation

- Post 1: Why Redis Matters for Next.js Developers — https://medium.com/better-dev-nextjs-react/why-redis-matters-for-next-js-developers-b15f644ba6a3
- Post 2: Redis for API Caching in Next.js — https://medium.com/better-dev-nextjs-react/redis-for-api-caching-in-next-js-bc8558e1ee3f
- Post 3: Session Storage with Redis in Next.js — https://medium.com/better-dev-nextjs-react/session-storage-with-redis-in-next-js-86b670da7bc7
- Post 4: Rate Limiting Your Next.js API with Redis — https://medium.com/better-dev-nextjs-react/rate-limiting-your-next-js-api-with-redis-b35a6622acba
- Post 5: Real‑time Pub/Sub with Redis in Next.js — https://blog.melvinprince.io/real-time-pub-sub-with-redis-in-next-js-413c966c3052
- Post 6: Server Actions + Redis: Instant State in Next.js 15 — https://medium.com/better-dev-nextjs-react/server-actions-redis-instant-state-in-next-js-15-5c7dda582cf9
- Post 7: Edge‑ready Redis Patterns for Vercel — https://medium.com/better-dev-nextjs-react/edge-ready-redis-patterns-using-upstash-for-vercel-deployments-f06d905094a1
- Post 8: Putting It All Together: A Mini Next.js App Using Redis — https://medium.com/better-dev-nextjs-react/redis-nextjs-complete-mini-app-for-real-time-q-and-a-final-post-1ed166951835

## Credits

- Built by Melvin Prince — https://melvinprince.io
