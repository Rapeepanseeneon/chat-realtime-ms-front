"use client";

import { useEffect, useId, useState } from "react";
import type { PrivateMessage } from "../lib/chat-types";

export type GhostCommand =
  | { type: "ghost.release"; messageId: string }
  | { type: "ghost.schedule"; messageId: string; scheduledAt: string | null };

type Props = {
  message: PrivateMessage;
  disabled: boolean;
  onCommand: (command: GhostCommand) => void;
  onEdit: (message: PrivateMessage) => void;
  onDelete: (message: PrivateMessage) => void;
};
const localInputTime = (iso: string | null) => {
  const date = iso ? new Date(iso) : new Date(Date.now() + 5 * 60_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

export function GhostMessage({
  message,
  disabled,
  onCommand,
  onEdit,
  onDelete,
}: Props) {
  const [choosingTime, setChoosingTime] = useState(false);
  const [error, setError] = useState("");
  const fieldId = useId();
  useEffect(() => {
    setChoosingTime(false);
  }, [message.scheduledAt, message.stateUpdatedAt]);
  return (
    <article
      className="message private-message private-message-own ghost-message"
      aria-label="Your ghost message"
    >
      <div className="message-meta">
        <strong>👻 Ghost</strong>
        <time dateTime={message.createdAt}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
      <span className="ghost-privacy">Only you can see this</span>
      {message.reply ? (
        <blockquote className="message-reply">
          <span>
            {message.reply.deletedAt
              ? "This message was deleted"
              : message.reply.messageText}
          </span>
        </blockquote>
      ) : null}
      <p>{message.messageText}</p>
      {message.messageStatus === "scheduled" && message.scheduledAt ? (
        <p className="ghost-scheduled">
          ⏰ Scheduled: {new Date(message.scheduledAt).toLocaleString()} (
          {Intl.DateTimeFormat().resolvedOptions().timeZone})
        </p>
      ) : null}
      <div className="message-actions">
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onCommand({ type: "ghost.release", messageId: message.id })
          }
        >
          ➤ Release Now
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setChoosingTime(true);
            setError("");
          }}
        >
          ⏰{" "}
          {message.messageStatus === "scheduled"
            ? "Change Schedule"
            : "Schedule"}
        </button>
        {message.messageStatus === "scheduled" ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onCommand({
                type: "ghost.schedule",
                messageId: message.id,
                scheduledAt: null,
              })
            }
          >
            Cancel Schedule
          </button>
        ) : null}
        <button
          type="button"
          disabled={disabled}
          onClick={() => onEdit(message)}
        >
          ✏️ Edit Ghost
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onDelete(message)}
        >
          🗑️ Delete Ghost
        </button>
      </div>
      {choosingTime ? (
        <form
          className="ghost-schedule-form"
          onSubmit={(event) => {
            event.preventDefault();
            const selectedTime = new FormData(event.currentTarget).get(
              "scheduledAt",
            );
            const timestamp =
              typeof selectedTime === "string"
                ? new Date(selectedTime).getTime()
                : NaN;
            if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
              setError("Choose a date and time in the future.");
              return;
            }
            onCommand({
              type: "ghost.schedule",
              messageId: message.id,
              scheduledAt: new Date(timestamp).toISOString(),
            });
          }}
        >
          <label htmlFor={fieldId}>
            Release date and time (your local timezone)
          </label>
          <input
            id={fieldId}
            name="scheduledAt"
            type="datetime-local"
            defaultValue={localInputTime(message.scheduledAt)}
            required
            disabled={disabled}
          />
          <div className="message-actions">
            <button type="submit" disabled={disabled}>
              Save Schedule
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => setChoosingTime(false)}
            >
              Cancel time selection
            </button>
          </div>
          {error ? <p role="alert">{error}</p> : null}
        </form>
      ) : null}
    </article>
  );
}
