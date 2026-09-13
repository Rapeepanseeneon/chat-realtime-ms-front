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
const isNullableDate = (value: unknown) =>
  value == null ||
  (typeof value === "string" && Number.isFinite(Date.parse(value)));

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
    (value.readAt !== null && typeof value.readAt !== "string") ||
    !isNullableDate(value.editedAt) ||
    !isNullableDate(value.deletedAt) ||
    !isNullableDate(value.scheduledAt) ||
    !isNullableDate(value.releasedAt) ||
    !isNullableDate(value.stateUpdatedAt) ||
    (value.messageStatus != null &&
      !["ghost", "scheduled", "sent", "cancelled"].includes(
        String(value.messageStatus),
      )) ||
    (value.deliveryId != null && !isId(value.deliveryId)) ||
    (value.replyToMessageId != null && !isId(value.replyToMessageId))
  )
    return null;
  let reply: PrivateMessage["reply"] = null;
  if (value.reply != null) {
    const original = value.reply;
    if (
      !isRecord(original) ||
      !isId(original.id) ||
      !isId(original.senderId) ||
      original.id !== value.replyToMessageId ||
      typeof original.messageText !== "string" ||
      !isNullableDate(original.editedAt) ||
      !isNullableDate(original.deletedAt)
    )
      return null;
    reply = {
      id: original.id,
      senderId: original.senderId,
      messageText: original.deletedAt ? "" : original.messageText,
      editedAt:
        typeof original.editedAt === "string" ? original.editedAt : null,
      deletedAt:
        typeof original.deletedAt === "string" ? original.deletedAt : null,
    };
  }
  return {
    id: value.id,
    senderId: value.senderId,
    receiverId: value.receiverId,
    messageText: value.deletedAt ? "" : value.messageText,
    createdAt: value.createdAt,
    readAt: value.readAt,
    messageStatus: (value.messageStatus ??
      "sent") as PrivateMessage["messageStatus"],
    scheduledAt:
      typeof value.scheduledAt === "string" ? value.scheduledAt : null,
    releasedAt: typeof value.releasedAt === "string" ? value.releasedAt : null,
    stateUpdatedAt:
      typeof value.stateUpdatedAt === "string" ? value.stateUpdatedAt : null,
    deliveryId:
      value.messageStatus == null || value.messageStatus === "sent"
        ? typeof value.deliveryId === "string"
          ? value.deliveryId
          : value.id
        : null,
    editedAt: typeof value.editedAt === "string" ? value.editedAt : null,
    deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : null,
    replyToMessageId:
      typeof value.replyToMessageId === "string"
        ? value.replyToMessageId
        : null,
    reply,
  };
};

export const parseServerMessage = (raw: string): ServerMessage | null => {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value)) return null;
    if (
      value.type === "message.new" ||
      value.type === "message.edited" ||
      value.type === "message.deleted" ||
      value.type === "ghost.updated"
    ) {
      const message = parsePrivateMessage(value.message);
      return message ? { type: value.type, message } : null;
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
        (value.throughDeliveryId == null || isId(value.throughDeliveryId)) &&
        typeof value.readAt === "string"
        ? {
            type: "message.read",
            readerId: value.readerId,
            senderId: value.senderId,
            throughMessageId: value.throughMessageId,
            throughDeliveryId:
              typeof value.throughDeliveryId === "string"
                ? value.throughDeliveryId
                : undefined,
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
    const latest = newerMessage(previous, message);
    byId.set(message.id, {
      ...latest,
      readAt: previous?.readAt ?? message.readAt,
      reply: newerReply(previous?.reply ?? null, message.reply),
    });
  }
  const updated = [...byId.values()].map((message) => {
    const original = message.replyToMessageId
      ? byId.get(message.replyToMessageId)
      : null;
    return original
      ? {
          ...message,
          reply: newerReply(message.reply, {
            id: original.id,
            senderId: original.senderId,
            messageText: original.messageText,
            editedAt: original.editedAt,
            deletedAt: original.deletedAt,
          }),
        }
      : message;
  });
  return updated
    .filter((message) => message.messageStatus !== "cancelled")
    .sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) ||
        left.id.length - right.id.length ||
        left.id.localeCompare(right.id),
    );
};

export const newerMessage = (
  previous: PrivateMessage | undefined,
  message: PrivateMessage,
) => {
  if (previous?.deletedAt) return previous;
  // Release is terminal: even same-millisecond/stale schedule snapshots cannot
  // make a delivered message look private again.
  if (previous?.messageStatus === "sent" && message.messageStatus !== "sent")
    return previous;
  if (
    previous &&
    previous.messageStatus !== "sent" &&
    message.messageStatus === "sent"
  )
    return message;
  return previous &&
    ((previous.stateUpdatedAt ?? "") > (message.stateUpdatedAt ?? "") ||
      (previous.editedAt ?? "") > (message.editedAt ?? ""))
    ? previous
    : message;
};

const newerReply = (
  left: PrivateMessage["reply"],
  right: PrivateMessage["reply"],
) =>
  left && (left.deletedAt || (left.editedAt ?? "") > (right?.editedAt ?? ""))
    ? left
    : (right ?? left);

// Update quotations too, including originals outside the latest history page.
export const applyMessageMutation = (
  messages: PrivateMessage[],
  updated: PrivateMessage,
) =>
  mergeMessages(
    messages.map((message) =>
      message.replyToMessageId === updated.id
        ? {
            ...message,
            reply: newerReply(message.reply, {
              id: updated.id,
              senderId: updated.senderId,
              messageText: updated.messageText,
              editedAt: updated.editedAt,
              deletedAt: updated.deletedAt,
            }),
          }
        : message,
    ),
    messages.some((message) => message.id === updated.id) ? [updated] : [],
  );

export const applyReadReceipt = (
  messages: PrivateMessage[],
  receipt: ReadReceipt,
) =>
  messages.map((message) =>
    message.senderId === receipt.senderId &&
    message.receiverId === receipt.readerId &&
    message.messageStatus === "sent" &&
    BigInt(message.deliveryId ?? message.id) <=
      BigInt(receipt.throughDeliveryId ?? receipt.throughMessageId)
      ? { ...message, readAt: message.readAt ?? receipt.readAt }
      : message,
  );
