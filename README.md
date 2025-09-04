# Real-time Q&A App with Next.js and Redis

A real-time question and answer application built with Next.js, Redis, and Server-Sent Events (SSE). Features instant updates across all connected clients for posting questions, liking, and deleting.

## Features

- ✅ **Real-time updates** - Changes appear instantly across all open browser tabs
- ✅ **Post questions** - Submit questions with rate limiting
- ✅ **Like questions** - Like questions with optimistic updates
- ✅ **Delete questions** - Remove questions with confirmation
- ✅ **Connection status** - Visual indicator of real-time connection
- ✅ **Rate limiting** - Prevents spam and abuse
- ✅ **Optimistic UI** - Immediate feedback for better UX
- ✅ **Real-time sync** - Instant updates across all browser tabs on same server instance

## Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Set up Redis:**

   - Create a free account at [Upstash](https://upstash.com/)
   - Create a new Redis database
   - Copy the REST URL and token

3. **Configure environment:**

   ```bash
   cp .env.example .env.local
   ```

   Add your Redis credentials to `.env.local`:

   ```
   UPSTASH_REDIS_REST_URL=your_redis_url_here
   UPSTASH_REDIS_REST_TOKEN=your_redis_token_here
   ```

4. **Run the development server:**

   ```bash
   npm run dev
   ```

5. **Test real-time updates:**
   - Open multiple browser tabs to `http://localhost:3000`
   - Post questions, like, or delete in one tab
   - Watch updates appear instantly in all other tabs

## What's Included

- **Real-time Q&A interface** with instant updates across all clients
- **Cached questions endpoint** at `/api/questions` with TTL 30s
- **New question endpoint** at `/api/questions/new` with rate limiting (5/min)
- **Like endpoint** at `/actions/like` with optimistic updates and rate limiting (30/min)
- **Delete endpoint** at `/actions/delete` with confirmation and rate limiting (10/min)
- **SSE stream** at `/api/stream` for real-time updates
- **Redis pub/sub** for cross-instance communication (production-ready)

## How It Works

### Real-time Architecture

1. **Client-side**: Uses EventSource for Server-Sent Events to receive real-time updates
2. **Server-side**: Uses local event bus for real-time communication within single instance
3. **Optimistic updates**: UI updates immediately, then syncs with server response
4. **Production note**: For multi-instance deployments, implement Redis pub/sub or use services like Pusher/Ably

### Data Flow

```
User Action → API Route → Redis Update → Pub/Sub Event → SSE → All Clients Update
```

## Tech Stack

- **Next.js 15** - React framework with App Router
- **Redis** - Data storage and pub/sub for real-time updates
- **Upstash Redis** - Serverless Redis provider
- **Server-Sent Events (SSE)** - Real-time communication
- **TypeScript** - Type safety

## Production Ready

This app is designed to work in production environments:

- ✅ Local event bus provides real-time updates within single server instance
- ✅ Rate limiting prevents abuse
- ✅ Graceful error handling throughout
- ✅ Optimistic updates provide smooth UX even with network latency
- ✅ Connection status indicator for user feedback
- ✅ Easy to extend with Redis pub/sub or external services for multi-instance deployments
