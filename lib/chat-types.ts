export type ChatUser = {
  id: string;
  username: string;
};

export type ChatFriend = ChatUser & { online: boolean; unreadCount: number };

export type ReadReceipt = {
  type: "message.read";
  readerId: string;
  senderId: string;
  throughMessageId: string;
  readAt: string;
};

export type TypingEvent = {
  type: "typing.start" | "typing.stop";
  userId: string;
  receiverId: string;
};

export type ServerMessage =
  | { type: "message.new"; message: PrivateMessage }
  | ReadReceipt
  | TypingEvent
  | {
      type: "presence.update";
      userId: string;
      online: boolean;
      revision: number;
    }
  | {
      type: "unread.update";
      counts: { friendId: string; unreadCount: number }[];
      revision: number;
    }
  | {
      type: "chat.state";
      friends: {
        id: string;
        online: boolean;
        presenceRevision: number;
        unreadCount: number;
      }[];
      unreadRevision: number;
    }
  | { type: "error"; data: { message: string } };

export type FriendSearchResult = ChatUser & {
  relationship: "none" | "outgoing_pending" | "incoming_pending" | "friends";
};

export type FriendRequest = {
  id: string;
  sender: ChatUser;
  createdAt: string;
};

export type PrivateMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  messageText: string;
  createdAt: string;
  readAt: string | null;
};
