"use client";

import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { TypingEvent } from "./chat-types";

export function useChatTyping(
  socketRef: RefObject<WebSocket | null>,
  currentUserId: string,
) {
  const [typingByUser, setTypingByUser] = useState<Record<string, boolean>>({});
  const incomingTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoing = useRef<{ receiverId: string; lastSentAt: number } | null>(
    null,
  );

  const stopTyping = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
    const active = outgoing.current;
    outgoing.current = null;
    if (active && socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: "typing.stop", receiverId: active.receiverId }),
      );
    }
  }, [socketRef]);

  const updateTyping = useCallback(
    (receiverId: string, text: string) => {
      if (outgoing.current?.receiverId !== receiverId) stopTyping();
      if (!text.trim() || socketRef.current?.readyState !== WebSocket.OPEN) {
        stopTyping();
        return;
      }
      const now = Date.now();
      if (!outgoing.current || now - outgoing.current.lastSentAt >= 1_000) {
        socketRef.current.send(
          JSON.stringify({ type: "typing.start", receiverId }),
        );
        outgoing.current = { receiverId, lastSentAt: now };
      }
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(stopTyping, 1_500);
    },
    [socketRef, stopTyping],
  );

  const handleTyping = useCallback(
    (event: TypingEvent) => {
      if (event.receiverId !== currentUserId || event.userId === currentUserId)
        return;
      const previous = incomingTimers.current.get(event.userId);
      if (previous) clearTimeout(previous);
      incomingTimers.current.delete(event.userId);
      const active = event.type === "typing.start";
      setTypingByUser((current) => ({ ...current, [event.userId]: active }));
      if (active) {
        incomingTimers.current.set(
          event.userId,
          setTimeout(() => {
            incomingTimers.current.delete(event.userId);
            setTypingByUser((current) => ({
              ...current,
              [event.userId]: false,
            }));
          }, 4_000),
        );
      }
    },
    [currentUserId],
  );

  const clearTyping = useCallback(() => {
    stopTyping();
    for (const timer of incomingTimers.current.values()) clearTimeout(timer);
    incomingTimers.current.clear();
    setTypingByUser({});
  }, [stopTyping]);

  useEffect(() => {
    const timers = incomingTimers.current;
    const handleHidden = () => {
      if (document.visibilityState !== "visible" || !document.hasFocus())
        stopTyping();
    };
    window.addEventListener("blur", stopTyping);
    document.addEventListener("visibilitychange", handleHidden);
    return () => {
      stopTyping();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      window.removeEventListener("blur", stopTyping);
      document.removeEventListener("visibilitychange", handleHidden);
    };
  }, [stopTyping]);

  return { typingByUser, updateTyping, stopTyping, handleTyping, clearTyping };
}
