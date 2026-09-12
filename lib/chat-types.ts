export type ChatUser = {
  id: string;
  username: string;
};

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
};
