export type ChatUser = {
  id: string;
  username: string;
};

export type PrivateMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  messageText: string;
  createdAt: string;
};
