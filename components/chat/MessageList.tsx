"use client";

import type { ReactNode, Ref, UIEventHandler } from "react";

type Props = {
  children: ReactNode;
  containerRef: Ref<HTMLDivElement>;
  label: string;
  hasNewMessages: boolean;
  onScroll: UIEventHandler<HTMLDivElement>;
  onJumpToLatest: () => void;
};

export function MessageList({
  children,
  containerRef,
  label,
  hasNewMessages,
  onScroll,
  onJumpToLatest,
}: Props) {
  return (
    <>
      <div
        ref={containerRef}
        className="messages private-messages"
        aria-live="polite"
        aria-label={label}
        onScroll={onScroll}
      >
        {children}
      </div>
      {hasNewMessages ? (
        <button
          className="new-message-button"
          type="button"
          onClick={onJumpToLatest}
        >
          New messages ↓
        </button>
      ) : null}
    </>
  );
}
