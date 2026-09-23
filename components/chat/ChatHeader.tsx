"use client";

import type { ChatFriend, ChatGroup, ChatUser } from "../../lib/chat-types";
import type { CallType } from "../../lib/use-voice-call";
import { BrandLogo } from "../BrandLogo";
import { UserAvatar } from "../UserAvatar";

type ConnectionStatus = "Connecting" | "Connected" | "Disconnected";

type Props = {
  selectedUser: ChatUser | null;
  selectedGroup: ChatGroup | null;
  selectedStatus: ChatFriend["status"];
  selectedCustomStatus: string;
  connectionStatus: ConnectionStatus;
  callActive: boolean;
  onBack: () => void;
  onOpenGroup: (group: ChatGroup) => void;
  onViewProfile: (user: ChatUser) => void;
  onStartCall: (type: CallType) => void;
};

export function ChatHeader({
  selectedUser,
  selectedGroup,
  selectedStatus,
  selectedCustomStatus,
  connectionStatus,
  callActive,
  onBack,
  onOpenGroup,
  onViewProfile,
  onStartCall,
}: Props) {
  const hasConversation = selectedUser !== null || selectedGroup !== null;
  return (
    <header className="chat-header">
      <div className="chat-title-block">
        {hasConversation ? (
          <button
            className="mobile-conversation-back"
            type="button"
            aria-label="Back to chats"
            onClick={onBack}
          >
            ←
          </button>
        ) : null}
        <div className="chat-brand">
          <BrandLogo decorative />
          <p className="eyebrow">Pb Messenger</p>
        </div>
        <div className="chat-title-line">
          {selectedUser ? (
            <UserAvatar
              username={selectedUser.username}
              avatarUrl={selectedUser.avatarUrl}
              className="chat-header-avatar"
            />
          ) : null}
          <h1
            id="chat-title"
            className={selectedGroup ? "group-header-action" : ""}
            onClick={() => selectedGroup && onOpenGroup(selectedGroup)}
          >
            {selectedGroup?.name ?? selectedUser?.username ?? "Pb Messenger"}
          </h1>
        </div>
        {selectedGroup ? (
          <button
            className="group-info-button"
            type="button"
            onClick={() => onOpenGroup(selectedGroup)}
          >
            👥 {selectedGroup.memberCount} members · Group info
          </button>
        ) : null}
        {selectedUser ? (
          <div className="chat-person-meta">
            <p className="chat-presence">
              <span
                className={`presence-dot presence-dot-${selectedStatus}`}
                aria-hidden="true"
              />
              <span>
                {selectedStatus === "dnd"
                  ? "Do Not Disturb"
                  : selectedStatus.charAt(0).toUpperCase() +
                    selectedStatus.slice(1)}
                {selectedCustomStatus ? ` · ${selectedCustomStatus}` : ""}
              </span>
            </p>
            <button type="button" onClick={() => onViewProfile(selectedUser)}>
              View profile
            </button>
          </div>
        ) : null}
      </div>
      <div className="chat-header-actions">
        {selectedUser ? (
          <div className="call-header-buttons">
            <button
              className="voice-call-button"
              type="button"
              onClick={() => onStartCall("voice")}
              disabled={connectionStatus !== "Connected" || callActive}
              aria-label={`Voice call ${selectedUser.username}`}
            >
              <span aria-hidden="true">📞</span>
              Voice Call
            </button>
            <button
              className="voice-call-button video-call-button"
              type="button"
              onClick={() => onStartCall("video")}
              disabled={connectionStatus !== "Connected" || callActive}
              aria-label={`Video call ${selectedUser.username}`}
            >
              <span aria-hidden="true">📹</span>
              Video Call
            </button>
          </div>
        ) : null}
        <div
          className={`status status-${connectionStatus.toLowerCase()}`}
          role="status"
        >
          <span aria-hidden="true" />
          {connectionStatus}
        </div>
      </div>
    </header>
  );
}
