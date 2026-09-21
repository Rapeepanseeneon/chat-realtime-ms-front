export type ChatUser = {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string;
};

export type ChatFriend = ChatUser & {
  online: boolean;
  status: "online" | "away" | "dnd" | "offline";
  customStatus: string;
  unreadCount: number;
  favorite: boolean;
  recentAt: string | null;
};
export type UserSettings = {
  presenceStatus: "online" | "away" | "dnd" | "invisible";
  customStatus: string;
  showOnlineStatus: boolean;
  sendReadReceipts: boolean;
  showTypingIndicator: boolean;
  confirmGhostRelease: boolean;
  enterToSend: boolean;
  messageTextSize: "small" | "default" | "large";
  updatedAt: string;
};
export type ProfileLink = {
  id?: string;
  platform: string;
  label: string;
  url: string;
};
export type PublicProfile = ChatUser & { links: ProfileLink[] };
export type ChatGroup = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  role: "owner" | "member";
  memberCount: number;
  unreadCount: number;
};
export type GroupMember = ChatUser & {
  role: "owner" | "member";
  joinedAt: string;
};
export type GroupInfo = ChatGroup & { members: GroupMember[] };
export type GroupMessage = {
  id: string;
  groupId: string;
  senderId: string;
  senderUsername: string;
  senderAvatarUrl: string | null;
  messageText: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  replyToMessageId: string | null;
  reply: {
    id: string;
    senderId: string;
    senderUsername: string;
    messageText: string;
    editedAt: string | null;
    deletedAt: string | null;
  } | null;
};

export type ReadReceipt = {
  type: "message.read";
  readerId: string;
  senderId: string;
  throughMessageId: string;
  throughDeliveryId?: string;
  readAt: string;
};

export type TypingEvent = {
  type: "typing.start" | "typing.stop";
  userId: string;
  receiverId: string;
};

export type ServerMessage =
  | {
      type:
        "message.new" | "message.edited" | "message.deleted" | "ghost.updated";
      message: PrivateMessage;
    }
  | ReadReceipt
  | TypingEvent
  | {
      type: "presence.update";
      userId: string;
      online: boolean;
      status: ChatFriend["status"];
      customStatus: string;
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
        status: ChatFriend["status"];
        customStatus: string;
        presenceRevision: number;
        unreadCount: number;
      }[];
      unreadRevision: number;
    }
  | { type: "settings.updated"; settings: UserSettings }
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
  messageStatus: "ghost" | "scheduled" | "sent" | "cancelled";
  scheduledAt: string | null;
  releasedAt: string | null;
  stateUpdatedAt: string | null;
  deliveryId: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  replyToMessageId: string | null;
  reply: {
    id: string;
    senderId: string;
    messageText: string;
    editedAt: string | null;
    deletedAt: string | null;
  } | null;
};
