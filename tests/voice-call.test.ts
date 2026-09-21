import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCallSignal } from "../lib/use-voice-call";

test("voice call signaling parser accepts authenticated server shapes", () => {
  assert.deepEqual(
    parseCallSignal({
      type: "call.offer",
      callId: "4c4c4b74-808a-4b40-b1d3-4107e4f5fb13",
      caller: { id: "2", username: "PP", avatarUrl: null },
      sdp: "offer-sdp",
    }),
    {
      type: "call.offer",
      callId: "4c4c4b74-808a-4b40-b1d3-4107e4f5fb13",
      caller: { id: "2", username: "PP", avatarUrl: null },
      sdp: "offer-sdp",
    },
  );
  assert.equal(
    parseCallSignal({
      type: "call.ice_candidate",
      callId: "4c4c4b74-808a-4b40-b1d3-4107e4f5fb13",
      fromUserId: "2",
      candidate: { candidate: "candidate:test", sdpMid: "0" },
    })?.type,
    "call.ice_candidate",
  );
});

test("voice call signaling parser rejects incomplete or unrelated events", () => {
  assert.equal(parseCallSignal({ type: "call.offer", caller: {} }), null);
  assert.equal(
    parseCallSignal({
      type: "call.unavailable",
      callId: "call",
      calleeId: "2",
      reason: "invented",
    }),
    null,
  );
  assert.equal(parseCallSignal({ type: "message.new" }), null);
});
