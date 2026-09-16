"use client";
import type { GroupMessage } from "../lib/chat-types";
type Props = {
  message: GroupMessage;
  currentUserId: string;
  disabled: boolean;
  onReply: (m: GroupMessage) => void;
  onEdit: (m: GroupMessage) => void;
  onDelete: (m: GroupMessage) => void;
};
export function GroupMessageBubble({
  message,
  currentUserId,
  disabled,
  onReply,
  onEdit,
  onDelete,
}: Props) {
  const own = message.senderId === currentUserId;
  return (
    <article
      className={`message private-message ${own ? "private-message-own" : "private-message-other"}`}
    >
      <div className="group-message-sender">
        <span className="sidebar-contact-avatar">
          {message.senderUsername[0]?.toUpperCase()}
        </span>
        <strong>{own ? "You" : message.senderUsername}</strong>
      </div>
      {message.reply ? (
        <blockquote className="reply-preview">
          <strong>{message.reply.senderUsername}</strong>
          <span>
            {message.reply.deletedAt
              ? "This message was deleted"
              : message.reply.messageText}
          </span>
        </blockquote>
      ) : null}
      <p>
        {message.deletedAt ? "This message was deleted" : message.messageText}
      </p>
      <div className="message-meta">
        <time>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
        {message.editedAt && !message.deletedAt ? <span>(edited)</span> : null}
      </div>
      {!message.deletedAt ? (
        <div className="message-actions">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onReply(message)}
          >
            Reply
          </button>
          {own ? (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onEdit(message)}
              >
                Edit
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onDelete(message)}
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
