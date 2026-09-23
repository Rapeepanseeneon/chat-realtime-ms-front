import { test } from "node:test";
import assert from "node:assert/strict";
import {
  audioDirectionFromSdp,
  mediaConstraintsForCall,
  parseCallSignal,
} from "../lib/use-voice-call";

test("voice call signaling parser accepts authenticated server shapes", () => {
  assert.deepEqual(
    parseCallSignal({
      type: "call.offer",
      callId: "4c4c4b74-808a-4b40-b1d3-4107e4f5fb13",
      caller: { id: "2", username: "PP", avatarUrl: null },
      sdp: "offer-sdp",
      callType: "voice",
    }),
    {
      type: "call.offer",
      callId: "4c4c4b74-808a-4b40-b1d3-4107e4f5fb13",
      caller: { id: "2", username: "PP", avatarUrl: null },
      sdp: "offer-sdp",
      callType: "voice",
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

test("call signaling distinguishes video offers and keeps legacy offers voice-only", () => {
  const base = {
    type: "call.offer",
    callId: "4c4c4b74-808a-4b40-b1d3-4107e4f5fb13",
    caller: { id: "2", username: "PP", avatarUrl: null },
    sdp: "offer-sdp",
  };
  const video = parseCallSignal({ ...base, callType: "video" });
  const legacy = parseCallSignal(base);
  assert.equal(video?.type, "call.offer");
  assert.equal(video?.type === "call.offer" ? video.callType : null, "video");
  assert.equal(legacy?.type, "call.offer");
  assert.equal(legacy?.type === "call.offer" ? legacy.callType : null, "voice");
  assert.equal(parseCallSignal({ ...base, callType: "screen" }), null);
});

test("voice calls never request a camera while video calls request audio and video", () => {
  assert.deepEqual(mediaConstraintsForCall("voice"), {
    audio: true,
    video: false,
  });
  const video = mediaConstraintsForCall("video");
  assert.equal(video.audio, true);
  assert.equal(typeof video.video, "object");
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

test("voice call diagnostics read the negotiated audio direction", () => {
  assert.equal(
    audioDirectionFromSdp(
      "v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=sendrecv\r\nm=video 0 UDP/TLS/RTP/SAVPF 96\r\na=inactive\r\n",
    ),
    "sendrecv",
  );
  assert.equal(audioDirectionFromSdp("v=0\r\nm=video 0 RTP/AVP 96"), null);
});
