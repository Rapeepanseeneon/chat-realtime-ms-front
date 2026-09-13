import type {
  ChatFriend,
  PrivateMessage,
  ReadReceipt,
  ServerMessage,
} from "./chat-types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[1-9]\d{0,18}$/.test(value);
const isCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export const parseChatFriend = (value: unknown): ChatFriend | null => {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    typeof value.username !== "string" ||
    typeof value.online !== "boolean" ||
    !isCount(value.unreadCount)
  )
    return null;
  return {
    id: value.id,
    username: value.username,
    online: value.online,
    unreadCount: value.unreadCount,
  };
};

export const parsePrivateMessage = (value: unknown): PrivateMessage | null => {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    !isId(value.senderId) ||
    !isId(value.receiverId) ||
    typeof value.messageText !== "string" ||
    typeof value.createdAt !== "string" ||
    (value.readAt !== null && typeof value.readAt !== "string")
  )
    return null;
  return {
    id: value.id,
    senderId: value.senderId,
    receiverId: value.receiverId,
    messageText: value.messageText,
    createdAt: value.createdAt,
    readAt: value.readAt,
  };
};

export const parseServerMessage = (raw: string): ServerMessage | null => {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (value.type === "message.new") {
      const message = parsePrivateMessage(value.message);
      return message ? { type: "message.new", message } : null;
    }
    if (
      value.type === "error" &&
      isRecord(value.data) &&
      typeof value.data.message === "string"
    )
      return { type: "error", data: { message: value.data.message } };
    if (value.type === "typing.start" || value.type === "typing.stop") {
      return isId(value.userId) && isId(value.receiverId)
        ? {
            type: value.type,
            userId: value.userId,
            receiverId: value.receiverId,
          }
        : null;
    }
    if (value.type === "message.read") {
      return isId(value.readerId) &&
        isId(value.senderId) &&
        isId(value.throughMessageId) &&
        typeof value.readAt === "string"
        ? {
            type: "message.read",
            readerId: value.readerId,
            senderId: value.senderId,
            throughMessageId: value.throughMessageId,
            readAt: value.readAt,
          }
        : null;
    }
    if (value.type === "presence.update") {
      return isId(value.userId) &&
        typeof value.online === "boolean" &&
        isCount(value.revision)
        ? {
            type: "presence.update",
            userId: value.userId,
            online: value.online,
            revision: value.revision,
          }
        : null;
    }
    if (
      value.type === "unread.update" &&
      Array.isArray(value.counts) &&
      isCount(value.revision)
    ) {
      const counts = [];
      for (const count of value.counts) {
        if (
          !isRecord(count) ||
          !isId(count.friendId) ||
          !isCount(count.unreadCount)
        )
          return null;
        counts.push({
          friendId: count.friendId,
          unreadCount: count.unreadCount,
        });
      }
      return { type: "unread.update", counts, revision: value.revision };
    }
    if (
      value.type === "chat.state" &&
      Array.isArray(value.friends) &&
      isCount(value.unreadRevision)
    ) {
      const friends = [];
      for (const friend of value.friends) {
        if (
          !isRecord(friend) ||
          !isId(friend.id) ||
          typeof friend.online !== "boolean" ||
          !isCount(friend.presenceRevision) ||
          !isCount(friend.unreadCount)
        )
          return null;
        friends.push({
          id: friend.id,
          online: friend.online,
          presenceRevision: friend.presenceRevision,
          unreadCount: friend.unreadCount,
        });
      }
      return {
        type: "chat.state",
        friends,
        unreadRevision: value.unreadRevision,
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const mergeMessages = (
  current: PrivateMessage[],
  incoming: PrivateMessage[],
) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) {
    const previous = byId.get(message.id);
    byId.set(message.id, {
      ...message,
      readAt: previous?.readAt ?? message.readAt,
    });
  }
  return [...byId.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.length - right.id.length ||
      left.id.localeCompare(right.id),
  );
};

export const applyReadReceipt = (
  messages: PrivateMessage[],
  receipt: ReadReceipt,
) =>
  messages.map((message) =>
    message.senderId === receipt.senderId &&
    message.receiverId === receipt.readerId &&
    BigInt(message.id) <= BigInt(receipt.throughMessageId)
      ? { ...message, readAt: message.readAt ?? receipt.readAt }
      : message,
  );
