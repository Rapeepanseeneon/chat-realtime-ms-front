import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveRuntimeUrl } from "../lib/runtime-config";

test("runtime API and WebSocket URLs follow the browser host when enabled", () => {
  assert.equal(
    resolveRuntimeUrl("http://192.168.1.46:3001", {
      useCurrentHost: true,
      hostname: "localhost",
      pageProtocol: "http:",
      websocket: false,
    }),
    "http://localhost:3001",
  );
  assert.equal(
    resolveRuntimeUrl("ws://localhost:3001/ws", {
      useCurrentHost: true,
      hostname: "192.168.1.46",
      pageProtocol: "http:",
      websocket: true,
    }),
    "ws://192.168.1.46:3001/ws",
  );
});

test("runtime URL resolution upgrades secure pages and respects opt-out", () => {
  assert.equal(
    resolveRuntimeUrl("http://localhost:3001", {
      useCurrentHost: true,
      hostname: "192.168.1.46",
      pageProtocol: "https:",
      websocket: false,
    }),
    "https://192.168.1.46:3001",
  );
  assert.equal(
    resolveRuntimeUrl("ws://localhost:3001/ws", {
      useCurrentHost: true,
      hostname: "chat.example.com",
      pageProtocol: "https:",
      websocket: true,
    }),
    "wss://chat.example.com:3001/ws",
  );
  assert.equal(
    resolveRuntimeUrl("http://api.example.com:3001", {
      useCurrentHost: false,
      hostname: "chat.example.com",
      pageProtocol: "https:",
      websocket: false,
    }),
    "http://api.example.com:3001",
  );
});
