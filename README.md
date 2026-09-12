# chat-realtime-ms-front

Realtime chat frontend built with Next.js App Router and TypeScript.

## Run locally

Copy `.env.example` to `.env.local`, then run:

```bash
bun install
bun run dev
```

Open `http://localhost:3000`. The local environment example connects to the
backend WebSocket at `ws://localhost:3001/ws` and loads persisted message
history from `http://localhost:3001/api/messages`.

## Checks

```bash
bun run format:check
bun run typecheck
bun run build
```
