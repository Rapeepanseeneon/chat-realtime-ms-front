"use client";

import type { VoiceCallView } from "../lib/use-voice-call";
import { UserAvatar } from "./UserAvatar";

type Props = {
  call: VoiceCallView;
  onAccept: () => void;
  onReject: () => void;
  onEnd: () => void;
  onMute: () => void;
  onSpeaker: () => void;
  onDismiss: () => void;
};

const duration = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export function VoiceCallOverlay({
  call,
  onAccept,
  onReject,
  onEnd,
  onMute,
  onSpeaker,
  onDismiss,
}: Props) {
  if (call.phase === "idle" || !call.peer) return null;
  const terminal = ["ended", "rejected", "failed"].includes(call.phase);
  return (
    <div className="voice-call-overlay" role="dialog" aria-modal="true">
      <section
        className={`voice-call-panel voice-call-${call.phase}`}
        aria-labelledby="voice-call-title"
      >
        <div className="voice-call-pulse" aria-hidden="true" />
        <UserAvatar
          username={call.peer.username}
          avatarUrl={call.peer.avatarUrl}
          className="voice-call-avatar"
        />
        <h2 id="voice-call-title">{call.peer.username}</h2>
        {call.phase === "connected" ? (
          <strong className="voice-call-duration">
            {duration(call.durationSeconds)}
          </strong>
        ) : null}
        <p className="voice-call-status" role="status">
          {call.message ||
            (call.phase === "incoming"
              ? "Incoming Voice Call"
              : call.phase === "connected"
                ? "Connected"
                : "Calling…")}
        </p>

        <div className="voice-call-actions">
          {call.phase === "incoming" ? (
            <>
              <button
                className="voice-call-action call-reject"
                type="button"
                onClick={onReject}
              >
                <span aria-hidden="true">✕</span>
                Reject
              </button>
              <button
                className="voice-call-action call-accept"
                type="button"
                onClick={onAccept}
              >
                <span aria-hidden="true">📞</span>
                Accept
              </button>
            </>
          ) : terminal ? (
            <button
              className="voice-call-action call-dismiss"
              type="button"
              onClick={onDismiss}
            >
              Close
            </button>
          ) : (
            <>
              <button
                className={`voice-call-action${call.muted ? " call-control-active" : ""}`}
                type="button"
                onClick={onMute}
                aria-pressed={call.muted}
              >
                <span aria-hidden="true">{call.muted ? "🔇" : "🎙"}</span>
                {call.muted ? "Unmute" : "Mute"}
              </button>
              {call.phase === "connected" ? (
                <button
                  className={`voice-call-action${call.speakerOn ? " call-control-active" : ""}`}
                  type="button"
                  onClick={onSpeaker}
                  aria-pressed={call.speakerOn}
                >
                  <span aria-hidden="true">🔊</span>
                  Speaker
                </button>
              ) : null}
              <button
                className="voice-call-action call-end"
                type="button"
                onClick={onEnd}
              >
                <span aria-hidden="true">●</span>
                End
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
