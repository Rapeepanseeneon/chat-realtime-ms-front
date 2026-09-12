# chat-realtime-ms-front

Realtime chat frontend built with Next.js App Router and TypeScript.

## Run locally

Copy `.env.example` to `.env.local`, then run:

```bash
bun install
bun run dev
```

Open `http://localhost:3000`. The local environment example connects to the
backend at `http://localhost:3001`. Register or log in before opening `/chat`;
the backend authenticates both message history and the WebSocket connection.

## Checks

```bash
bun run format:check
bun run typecheck
bun run build
```
