"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { peerConnectionConfig } from "./webrtc-config";

export type CallPhase =
  | "idle"
  | "calling"
  | "incoming"
  | "connecting"
  | "connected"
  | "ended"
  | "rejected"
  | "failed";

export type CallPeer = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export type CallType = "voice" | "video";

export type VoiceCallView = {
  phase: CallPhase;
  callId: string | null;
  peer: CallPeer | null;
  direction: "outgoing" | "incoming" | null;
  callType: CallType;
  message: string;
  muted: boolean;
  cameraOff: boolean;
  speakerOn: boolean;
  durationSeconds: number;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
};

type CallContext = {
  callId: string;
  peer: CallPeer;
  direction: "outgoing" | "incoming";
  callType: CallType;
  remoteOffer: string | null;
};

type CallSignal =
  | {
      type: "call.offer";
      callId: string;
      caller: CallPeer;
      sdp: string;
      callType: CallType;
    }
  | {
      type: "call.answer";
      callId: string;
      fromUserId: string;
      sdp: string;
    }
  | {
      type: "call.ice_candidate";
      callId: string;
      fromUserId: string;
      candidate: RTCIceCandidateInit;
    }
  | {
      type: "call.reject";
      callId: string;
      fromUserId: string;
      reason?: string;
    }
  | {
      type: "call.end";
      callId: string;
      fromUserId: string;
      reason?: string;
    }
  | {
      type: "call.unavailable";
      callId: string;
      calleeId: string;
      reason: "offline" | "busy" | "not_friends";
    };

const initialView: VoiceCallView = {
  phase: "idle",
  callId: null,
  peer: null,
  direction: null,
  callType: "voice",
  message: "",
  muted: false,
  cameraOff: false,
  speakerOn: true,
  durationSeconds: 0,
  localStream: null,
  remoteStream: null,
};

const voiceDebugEnabled = process.env.NEXT_PUBLIC_WEBRTC_DEBUG === "true";

const voiceDebug = (event: string, details: Record<string, unknown>) => {
  if (voiceDebugEnabled) console.info(`[voice-call] ${event}`, details);
};

export const audioDirectionFromSdp = (sdp: string | null | undefined) => {
  const audioSection = sdp
    ?.split(/\r?\nm=/)
    .find((section) => section.startsWith("audio "));
  return (
    audioSection?.match(
      /(?:^|\r?\n)a=(sendrecv|sendonly|recvonly|inactive)/,
    )?.[1] ?? null
  );
};

const trackDetails = (track: MediaStreamTrack) => ({
  kind: track.kind,
  enabled: track.enabled,
  muted: track.muted,
  readyState: track.readyState,
});

const addLocalTracks = (connection: RTCPeerConnection, stream: MediaStream) => {
  for (const track of stream.getTracks()) {
    const sender = connection.addTrack(track, stream);
    const transceiver = connection
      .getTransceivers()
      .find((entry) => entry.sender === sender);
    voiceDebug("local-track-added", {
      track: trackDetails(track),
      transceiverDirection: transceiver?.direction ?? null,
    });
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const parseCallSignal = (value: unknown): CallSignal | null => {
  if (!isRecord(value) || typeof value.type !== "string") return null;
  if (
    value.type === "call.offer" &&
    typeof value.callId === "string" &&
    typeof value.sdp === "string" &&
    isRecord(value.caller) &&
    typeof value.caller.id === "string" &&
    typeof value.caller.username === "string" &&
    (value.caller.avatarUrl === null ||
      typeof value.caller.avatarUrl === "string") &&
    (value.callType === undefined ||
      value.callType === "voice" ||
      value.callType === "video")
  )
    return {
      type: value.type,
      callId: value.callId,
      sdp: value.sdp,
      callType: value.callType === "video" ? "video" : "voice",
      caller: {
        id: value.caller.id,
        username: value.caller.username,
        avatarUrl: value.caller.avatarUrl,
      },
    };
  if (
    value.type === "call.answer" &&
    typeof value.callId === "string" &&
    typeof value.fromUserId === "string" &&
    typeof value.sdp === "string"
  )
    return value as CallSignal;
  if (
    value.type === "call.ice_candidate" &&
    typeof value.callId === "string" &&
    typeof value.fromUserId === "string" &&
    isRecord(value.candidate) &&
    typeof value.candidate.candidate === "string"
  )
    return value as CallSignal;
  if (
    (value.type === "call.reject" || value.type === "call.end") &&
    typeof value.callId === "string" &&
    typeof value.fromUserId === "string" &&
    (value.reason === undefined || typeof value.reason === "string")
  )
    return value as CallSignal;
  if (
    value.type === "call.unavailable" &&
    typeof value.callId === "string" &&
    typeof value.calleeId === "string" &&
    ["offline", "busy", "not_friends"].includes(String(value.reason))
  )
    return value as CallSignal;
  return null;
};

export const microphoneError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "SecurityError")
    return "Voice calls require HTTPS on mobile or LAN connections.";
  if (error instanceof DOMException && error.name === "NotAllowedError")
    return "Microphone permission was denied. Allow microphone access and try again.";
  if (error instanceof DOMException && error.name === "NotFoundError")
    return "No microphone was found on this device.";
  if (error instanceof Error && error.message === "Signaling is disconnected")
    return "The call could not start because realtime signaling is disconnected.";
  return "The microphone could not be started. Please try again.";
};

export const mediaPermissionError = (error: unknown, callType: CallType) => {
  if (callType === "voice") return microphoneError(error);
  if (error instanceof DOMException && error.name === "SecurityError")
    return "Video calls require HTTPS on mobile or LAN connections.";
  if (error instanceof DOMException && error.name === "NotAllowedError")
    return "Camera or microphone permission was denied. Allow both and try again.";
  if (error instanceof DOMException && error.name === "NotFoundError")
    return "A camera or microphone was not found on this device.";
  if (error instanceof DOMException && error.name === "NotReadableError")
    return "The camera or microphone is already in use by another application.";
  if (error instanceof Error && error.message === "Signaling is disconnected")
    return "The call could not start because realtime signaling is disconnected.";
  return "The camera or microphone could not be started. Please try again.";
};

export const mediaConstraintsForCall = (
  callType: CallType,
): MediaStreamConstraints => ({
  audio: true,
  video:
    callType === "video"
      ? {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        }
      : false,
});

export function useVoiceCall(
  socketRef: React.RefObject<WebSocket | null>,
  currentUserId: string,
) {
  const [view, setView] = useState<VoiceCallView>(initialView);
  const callRef = useRef<CallContext | null>(null);
  const phaseRef = useRef<CallPhase>("idle");
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const queuedCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const acceptedLocallyRef = useRef(false);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    voiceDebug("diagnostics-enabled", {
      origin: window.location.origin,
      secureContext: window.isSecureContext,
      currentUserId,
    });
  }, [currentUserId]);

  const updateView = useCallback(
    (update: (current: VoiceCallView) => VoiceCallView) =>
      setView((current) => {
        const next = update(current);
        phaseRef.current = next.phase;
        return next;
      }),
    [],
  );

  const sendSignal = useCallback(
    (signal: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (socket?.readyState !== WebSocket.OPEN) return false;
      socket.send(JSON.stringify(signal));
      return true;
    },
    [socketRef],
  );

  const releaseMedia = useCallback(() => {
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
    const connection = peerConnectionRef.current;
    if (connection) {
      connection.onicecandidate = null;
      connection.ontrack = null;
      connection.oniceconnectionstatechange = null;
      connection.onconnectionstatechange = null;
      connection.close();
      peerConnectionRef.current = null;
    }
    for (const track of localStreamRef.current?.getTracks() ?? []) track.stop();
    for (const track of remoteStreamRef.current?.getTracks() ?? [])
      track.stop();
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }
    queuedCandidatesRef.current = [];
    acceptedLocallyRef.current = false;
    setView((current) => ({
      ...current,
      localStream: null,
      remoteStream: null,
    }));
  }, []);

  const finishLocally = useCallback(
    (
      phase: Extract<CallPhase, "ended" | "rejected" | "failed">,
      message: string,
    ) => {
      const current = callRef.current;
      releaseMedia();
      callRef.current = null;
      updateView((viewState) => ({
        ...viewState,
        phase,
        callId: current?.callId ?? viewState.callId,
        peer: current?.peer ?? viewState.peer,
        direction: current?.direction ?? viewState.direction,
        message,
        muted: false,
        cameraOff: false,
        speakerOn: true,
      }));
    },
    [releaseMedia, updateView],
  );

  const requestMedia = useCallback(
    async (callType: CallType) => {
      if (!window.isSecureContext && window.location.hostname !== "localhost")
        throw new DOMException("Secure context required", "SecurityError");
      if (!navigator.mediaDevices?.getUserMedia)
        throw new DOMException("Microphone is unavailable", "NotFoundError");
      const stream = await navigator.mediaDevices.getUserMedia(
        mediaConstraintsForCall(callType),
      );
      voiceDebug("microphone-ready", {
        audioTracks: stream.getAudioTracks().map(trackDetails),
        videoTracks: stream.getVideoTracks().map(trackDetails),
      });
      localStreamRef.current = stream;
      updateView((current) => ({ ...current, localStream: stream }));
      return stream;
    },
    [updateView],
  );

  const createConnection = useCallback(
    (call: CallContext) => {
      if (peerConnectionRef.current) return peerConnectionRef.current;
      const connection = new RTCPeerConnection(peerConnectionConfig);
      peerConnectionRef.current = connection;
      voiceDebug("peer-connection-created", {
        direction: call.direction,
        signalingState: connection.signalingState,
      });
      connection.onicecandidate = (event) => {
        if (!event.candidate || callRef.current?.callId !== call.callId) return;
        sendSignal({
          type: "call.ice_candidate",
          callId: call.callId,
          candidate: event.candidate.toJSON(),
        });
      };
      connection.ontrack = (event) => {
        const stream = event.streams[0] ?? new MediaStream([event.track]);
        remoteStreamRef.current = stream;
        updateView((current) => ({ ...current, remoteStream: stream }));
        voiceDebug("remote-track", {
          track: trackDetails(event.track),
          streamAudioTracks: stream.getAudioTracks().map(trackDetails),
        });
        if (call.callType === "voice" && !remoteAudioRef.current) {
          const audio = new Audio();
          audio.autoplay = true;
          audio.setAttribute("playsinline", "");
          remoteAudioRef.current = audio;
        }
        if (call.callType === "voice" && remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.muted = false;
          void remoteAudioRef.current
            .play()
            .then(() => voiceDebug("remote-audio-playing", { paused: false }))
            .catch((error: unknown) =>
              voiceDebug("remote-audio-play-failed", {
                error: error instanceof Error ? error.message : String(error),
              }),
            );
        }
      };
      connection.oniceconnectionstatechange = () =>
        voiceDebug("ice-state", {
          iceConnectionState: connection.iceConnectionState,
          connectionState: connection.connectionState,
          signalingState: connection.signalingState,
        });
      connection.onconnectionstatechange = () => {
        voiceDebug("connection-state", {
          connectionState: connection.connectionState,
          iceConnectionState: connection.iceConnectionState,
        });
        if (callRef.current?.callId !== call.callId) return;
        if (connection.connectionState === "connected") {
          if (disconnectTimerRef.current)
            clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
          updateView((current) => ({
            ...current,
            phase: "connected",
            message: "Connected",
            durationSeconds: 0,
          }));
        } else if (connection.connectionState === "failed") {
          sendSignal({ type: "call.end", callId: call.callId });
          finishLocally("failed", "The voice connection failed.");
        } else if (connection.connectionState === "disconnected") {
          if (disconnectTimerRef.current)
            clearTimeout(disconnectTimerRef.current);
          disconnectTimerRef.current = setTimeout(() => {
            if (connection.connectionState === "disconnected") {
              sendSignal({ type: "call.end", callId: call.callId });
              finishLocally("ended", "The other person disconnected.");
            }
          }, 5000);
        }
      };
      return connection;
    },
    [finishLocally, sendSignal, updateView],
  );

  const flushCandidates = useCallback(async () => {
    const connection = peerConnectionRef.current;
    if (!connection?.remoteDescription) return;
    const queued = queuedCandidatesRef.current.splice(0);
    for (const candidate of queued)
      await connection.addIceCandidate(candidate).catch(() => undefined);
  }, []);

  const startCall = useCallback(
    async (
      peer: CallPeer,
      peerOnline: boolean,
      callType: CallType = "voice",
    ) => {
      if (!["idle", "ended", "rejected", "failed"].includes(phaseRef.current))
        return;
      if (!peerOnline) {
        updateView(() => ({
          ...initialView,
          phase: "failed",
          peer,
          direction: "outgoing",
          message: `${peer.username} is currently offline.`,
        }));
        return;
      }
      releaseMedia();
      const call: CallContext = {
        callId: crypto.randomUUID(),
        peer,
        direction: "outgoing",
        callType,
        remoteOffer: null,
      };
      callRef.current = call;
      updateView(() => ({
        ...initialView,
        phase: "calling",
        callId: call.callId,
        peer,
        direction: "outgoing",
        callType,
        message:
          callType === "video"
            ? "Requesting camera and microphone…"
            : "Requesting microphone…",
      }));
      try {
        const stream = await requestMedia(callType);
        if (callRef.current?.callId !== call.callId) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        const connection = createConnection(call);
        addLocalTracks(connection, stream);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        voiceDebug("local-offer", {
          audioDirection: audioDirectionFromSdp(offer.sdp),
        });
        if (
          !sendSignal({
            type: "call.offer",
            callId: call.callId,
            calleeId: peer.id,
            sdp: offer.sdp ?? "",
            callType,
          })
        )
          throw new Error("Signaling is disconnected");
        updateView((current) => ({
          ...current,
          phase: "calling",
          message: "Calling…",
        }));
      } catch (error) {
        if (callRef.current?.callId !== call.callId) return;
        finishLocally("failed", mediaPermissionError(error, callType));
      }
    },
    [
      createConnection,
      finishLocally,
      releaseMedia,
      requestMedia,
      sendSignal,
      updateView,
    ],
  );

  const acceptCall = useCallback(async () => {
    const call = callRef.current;
    if (
      !call ||
      call.direction !== "incoming" ||
      phaseRef.current !== "incoming"
    )
      return;
    acceptedLocallyRef.current = true;
    updateView((current) => ({
      ...current,
      phase: "connecting",
      message: "Connecting…",
    }));
    try {
      const stream = await requestMedia(call.callType);
      if (callRef.current?.callId !== call.callId) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      const connection = createConnection(call);
      await connection.setRemoteDescription({
        type: "offer",
        sdp: call.remoteOffer ?? "",
      });
      voiceDebug("remote-offer", {
        audioDirection: audioDirectionFromSdp(call.remoteOffer),
      });
      await flushCandidates();
      // Apply the offer before adding the callee microphone so Firefox and
      // Chromium reuse the negotiated audio transceiver consistently.
      addLocalTracks(connection, stream);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      voiceDebug("local-answer", {
        audioDirection: audioDirectionFromSdp(answer.sdp),
      });
      if (
        !sendSignal({
          type: "call.answer",
          callId: call.callId,
          sdp: answer.sdp ?? "",
        })
      )
        throw new Error("Signaling is disconnected");
    } catch (error) {
      if (callRef.current?.callId !== call.callId) return;
      sendSignal({ type: "call.reject", callId: call.callId });
      finishLocally("failed", mediaPermissionError(error, call.callType));
    }
  }, [
    createConnection,
    finishLocally,
    flushCandidates,
    requestMedia,
    sendSignal,
    updateView,
  ]);

  const rejectCall = useCallback(() => {
    const call = callRef.current;
    if (!call || phaseRef.current !== "incoming") return;
    sendSignal({ type: "call.reject", callId: call.callId });
    finishLocally("rejected", "Call rejected");
  }, [finishLocally, sendSignal]);

  const endCall = useCallback(() => {
    const call = callRef.current;
    if (!call) return;
    sendSignal({ type: "call.end", callId: call.callId });
    finishLocally("ended", "Call ended");
  }, [finishLocally, sendSignal]);

  const toggleMute = useCallback(() => {
    const tracks = localStreamRef.current?.getAudioTracks() ?? [];
    if (!tracks.length) return;
    const muted = tracks.some((track) => track.enabled);
    for (const track of tracks) track.enabled = !muted;
    updateView((current) => ({ ...current, muted }));
  }, [updateView]);

  const toggleSpeaker = useCallback(() => {
    updateView((current) => {
      const speakerOn = !current.speakerOn;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = !speakerOn;
        if (speakerOn)
          void remoteAudioRef.current.play().catch(() => undefined);
      }
      return { ...current, speakerOn };
    });
  }, [updateView]);

  const toggleCamera = useCallback(() => {
    const tracks = localStreamRef.current?.getVideoTracks() ?? [];
    if (!tracks.length) return;
    const cameraOff = tracks.some((track) => track.enabled);
    for (const track of tracks) track.enabled = !cameraOff;
    updateView((current) => ({ ...current, cameraOff }));
  }, [updateView]);

  const dismissCall = useCallback(() => {
    if (!["ended", "rejected", "failed"].includes(phaseRef.current)) return;
    setView(initialView);
    phaseRef.current = "idle";
  }, []);

  const handleSignal = useCallback(
    async (rawValue: unknown) => {
      const signal = parseCallSignal(rawValue);
      if (!signal) return false;
      if (signal.type === "call.offer") {
        if (!["idle", "ended", "rejected", "failed"].includes(phaseRef.current))
          return true;
        releaseMedia();
        const call: CallContext = {
          callId: signal.callId,
          peer: signal.caller,
          direction: "incoming",
          callType: signal.callType,
          remoteOffer: signal.sdp,
        };
        callRef.current = call;
        updateView(() => ({
          ...initialView,
          phase: "incoming",
          callId: call.callId,
          peer: call.peer,
          direction: "incoming",
          callType: signal.callType,
          message:
            signal.callType === "video"
              ? "Incoming Video Call"
              : "Incoming Voice Call",
        }));
        return true;
      }
      const call = callRef.current;
      if (!call || signal.callId !== call.callId) return true;
      if (signal.type === "call.unavailable") {
        const message =
          signal.reason === "offline"
            ? `${call.peer.username} is currently offline.`
            : signal.reason === "busy"
              ? `${call.peer.username} is busy on another call.`
              : `${call.callType === "video" ? "Video" : "Voice"} calls are only available between friends.`;
        finishLocally("failed", message);
        return true;
      }
      if (signal.type === "call.reject") {
        finishLocally("rejected", `${call.peer.username} rejected the call.`);
        return true;
      }
      if (signal.type === "call.end") {
        const message =
          signal.reason === "no_answer"
            ? `${call.peer.username} did not answer.`
            : signal.reason === "disconnected"
              ? `${call.peer.username} disconnected.`
              : "Call ended";
        finishLocally("ended", message);
        return true;
      }
      if (signal.type === "call.answer") {
        if (signal.fromUserId === currentUserId) {
          if (call.direction === "incoming" && !acceptedLocallyRef.current)
            finishLocally("ended", "Call answered on another tab.");
          return true;
        }
        if (call.direction !== "outgoing") return true;
        const connection = peerConnectionRef.current;
        if (!connection || connection.remoteDescription) return true;
        updateView((current) => ({
          ...current,
          phase: "connecting",
          message: "Connecting…",
        }));
        try {
          await connection.setRemoteDescription({
            type: "answer",
            sdp: signal.sdp,
          });
          voiceDebug("remote-answer", {
            audioDirection: audioDirectionFromSdp(signal.sdp),
            transceivers: connection.getTransceivers().map((transceiver) => ({
              direction: transceiver.direction,
              currentDirection: transceiver.currentDirection,
              senderTrack: transceiver.sender.track
                ? trackDetails(transceiver.sender.track)
                : null,
              receiverTrack: trackDetails(transceiver.receiver.track),
            })),
          });
          await flushCandidates();
        } catch {
          sendSignal({ type: "call.end", callId: call.callId });
          finishLocally("failed", "The voice connection failed.");
        }
        return true;
      }
      if (signal.fromUserId === currentUserId) return true;
      const connection = peerConnectionRef.current;
      if (!connection?.remoteDescription)
        queuedCandidatesRef.current.push(signal.candidate);
      else
        await connection
          .addIceCandidate(signal.candidate)
          .catch(() => undefined);
      return true;
    },
    [
      currentUserId,
      finishLocally,
      flushCandidates,
      releaseMedia,
      sendSignal,
      updateView,
    ],
  );

  const handleSignalingDisconnect = useCallback(() => {
    if (callRef.current)
      finishLocally("failed", "The signaling connection was lost.");
  }, [finishLocally]);

  useEffect(() => {
    if (view.phase !== "connected") return;
    const startedAt = Date.now() - view.durationSeconds * 1000;
    const timer = setInterval(
      () =>
        setView((current) => ({
          ...current,
          durationSeconds: Math.floor((Date.now() - startedAt) / 1000),
        })),
      1000,
    );
    return () => clearInterval(timer);
  }, [view.phase]);

  useEffect(
    () => () => {
      const call = callRef.current;
      if (call) sendSignal({ type: "call.end", callId: call.callId });
      releaseMedia();
      callRef.current = null;
    },
    [releaseMedia, sendSignal],
  );

  return {
    view,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    dismissCall,
    handleSignal,
    handleSignalingDisconnect,
    active: !["idle", "ended", "rejected", "failed"].includes(view.phase),
  };
}
