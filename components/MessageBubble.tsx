"use client";

import type { PrivateMessage } from "../lib/chat-types";
import { GhostMessage, type GhostCommand } from "./GhostMessage";
import { MessageContent } from "./MessageContent";

type Props = {
  message: PrivateMessage;
  currentUserId: string;
  friendName: string;
  showReceipt: boolean;
  disabled: boolean;
  onReply: (message: PrivateMessage) => void;
  onEdit: (message: PrivateMessage) => void;
  onDelete: (message: PrivateMessage) => void;
  onGhostCommand: (command: GhostCommand) => void;
};

export function MessageBubble({
  message,
  currentUserId,
  friendName,
  showReceipt,
  disabled,
  onReply,
  onEdit,
  onDelete,
  onGhostCommand,
}: Props) {
  const own = message.senderId === currentUserId;
  if (message.messageStatus !== "sent")
    return own && message.messageStatus !== "cancelled" ? (
      <GhostMessage
        message={message}
        disabled={disabled}
        onCommand={onGhostCommand}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    ) : null;
  return (
    <article
      className={`message private-message direct-message ${own ? "private-message-own" : "private-message-other"}`}
    >
      <div className="message-bubble-body">
        <div className="message-meta">
          <strong>{own ? "You" : friendName}</strong>
          <time dateTime={message.createdAt}>
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </div>
        {message.deletedAt ? (
          <p className="message-deleted">This message was deleted</p>
        ) : (
          <>
            {message.replyToMessageId ? (
              <blockquote className="message-reply">
                <strong>
                  {message.reply?.senderId === currentUserId
                    ? "You"
                    : friendName}
                </strong>
                <span>
                  {message.reply?.deletedAt
                    ? "This message was deleted"
                    : (message.reply?.messageText ??
                      "Original message unavailable")}
                </span>
              </blockquote>
            ) : null}
            <MessageContent
              text={message.messageText}
              attachment={message.attachment}
            />
            {message.editedAt ? (
              <span className="message-edited">(edited)</span>
            ) : null}
            {own && showReceipt ? (
              <span className="message-receipt">
                {message.readAt ? "Seen" : "Sent"}
              </span>
            ) : null}
          </>
        )}
      </div>
      {!message.deletedAt ? (
        <div className="message-actions" aria-label="Message actions">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onReply(message)}
            aria-label={`Reply to ${own ? "your" : friendName + "'s"} message`}
          >
            Reply
          </button>
          {own ? (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onEdit(message)}
                aria-label="Edit your message"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDelete(message)}
                aria-label="Delete your message for everyone"
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
