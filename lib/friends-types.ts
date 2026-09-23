import type { ChatFriend, ProfileLink } from "./chat-types";

export type RelationshipState =
  "none" | "outgoing_pending" | "incoming_pending" | "friends";

export type ProfileIdentity = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type FriendSearchUser = ProfileIdentity & {
  bio?: string;
  relationship: RelationshipState;
  requestId: string | null;
};

export type FriendSuggestion = ProfileIdentity & {
  relationship: RelationshipState;
  mutualFriendCount: number | null;
};

export type ReceivedRequest = {
  id: string;
  sender: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  createdAt: string;
};

export type SentRequest = {
  id: string;
  receiver: ProfileIdentity;
  createdAt: string;
};

export type FriendPageFriend = ChatFriend & { displayName?: string };

export type ProfilePrivacy = {
  profileVisibility: "public" | "friends" | "private";
  friendListVisibility: "everyone" | "friends" | "only_me";
  mutualFriendsVisibility: "everyone" | "friends" | "only_me";
  onlineStatusVisibility: "everyone" | "friends" | "nobody";
};

export type ProfileView = ProfileIdentity & {
  bio: string | null;
  links: ProfileLink[];
  relationship: RelationshipState;
  requestId: string | null;
  isOwner: boolean;
  isPrivate: boolean;
  friendCount: number | null;
  mutualFriendCount: number | null;
  privacy: ProfilePrivacy | null;
  online: boolean;
  status: "online" | "away" | "dnd" | "offline";
  customStatus: string;
};
