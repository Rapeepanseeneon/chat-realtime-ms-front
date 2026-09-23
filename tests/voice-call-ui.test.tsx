import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { VoiceCallOverlay } from "../components/VoiceCallOverlay";
import {
  mediaPermissionError,
  microphoneError,
  type VoiceCallView,
} from "../lib/use-voice-call";

const actions = {
  onAccept() {},
  onReject() {},
  onEnd() {},
  onMute() {},
  onCamera() {},
  onSpeaker() {},
  onDismiss() {},
};

const baseCall: VoiceCallView = {
  phase: "incoming",
  callId: "call-id",
  peer: { id: "2", username: "PP", avatarUrl: null },
  direction: "incoming",
  callType: "voice",
  message: "Incoming Voice Call",
  muted: false,
  cameraOff: false,
  speakerOn: true,
  durationSeconds: 0,
  localStream: null,
  remoteStream: null,
};

test("incoming and connected voice call UI expose the required actions", () => {
  const incoming = renderToStaticMarkup(
    <VoiceCallOverlay call={baseCall} {...actions} />,
  );
  assert.match(incoming, /Incoming Voice Call/);
  assert.match(incoming, /Reject/);
  assert.match(incoming, /Accept/);

  const connected = renderToStaticMarkup(
    <VoiceCallOverlay
      call={{
        ...baseCall,
        phase: "connected",
        direction: "outgoing",
        message: "Connected",
        durationSeconds: 35,
      }}
      {...actions}
    />,
  );
  assert.match(connected, /00:35/);
  assert.match(connected, /Mute/);
  assert.match(connected, /Speaker/);
  assert.match(connected, /End/);
});

test("video calls are labeled clearly and expose camera controls", () => {
  const incoming = renderToStaticMarkup(
    <VoiceCallOverlay
      call={{
        ...baseCall,
        callType: "video",
        message: "Incoming Video Call",
      }}
      {...actions}
    />,
  );
  assert.match(incoming, /Incoming Video Call/);

  const active = renderToStaticMarkup(
    <VoiceCallOverlay
      call={{
        ...baseCall,
        callType: "video",
        phase: "connected",
        message: "Connected",
      }}
      {...actions}
    />,
  );
  assert.match(active, /Camera off/);
  assert.match(active, /Mute/);
  assert.match(active, /End/);
});

test("microphone permission errors are understandable", () => {
  assert.equal(
    microphoneError(new DOMException("Denied", "NotAllowedError")),
    "Microphone permission was denied. Allow microphone access and try again.",
  );
  assert.equal(
    microphoneError(new DOMException("Missing", "NotFoundError")),
    "No microphone was found on this device.",
  );
  assert.equal(
    microphoneError(new DOMException("Insecure", "SecurityError")),
    "Voice calls require HTTPS on mobile or LAN connections.",
  );
});

test("video permission errors mention both camera and microphone", () => {
  assert.equal(
    mediaPermissionError(
      new DOMException("Denied", "NotAllowedError"),
      "video",
    ),
    "Camera or microphone permission was denied. Allow both and try again.",
  );
  assert.equal(
    mediaPermissionError(new DOMException("Missing", "NotFoundError"), "video"),
    "A camera or microphone was not found on this device.",
  );
});
