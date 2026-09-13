"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ChatSidebar } from "../../components/ChatSidebar";
import { FriendManager } from "../../components/FriendManager";
import { MessageBubble } from "../../components/MessageBubble";
import type {
  ChatFriend,
  ChatUser,
  PrivateMessage,
  ReadReceipt,
} from "../../lib/chat-types";
import {
  applyReadReceipt,
  applyMessageMutation,
  isRecord,
  mergeMessages,
  parseChatFriend,
  parsePrivateMessage,
  parseServerMessage,
} from "../../lib/chat-events";
import { useChatTyping } from "../../lib/use-chat-typing";

type ConnectionStatus = "Connecting" | "Connected" | "Disconnected";

type ChatClientProps = {
  currentUser: {
    id: string;
    username: string;
    email: string;
  };
};

const websocketUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
const belongsToPair = (
  message: PrivateMessage,
  ownId: string,
  friendId: string | null,
) =>
  friendId !== null &&
  ((message.senderId === ownId && message.receiverId === friendId) ||
    (message.senderId === friendId && message.receiverId === ownId));

export function ChatClient({ currentUser }: ChatClientProps) {
  const router = useRouter();
  const [friends, setFriends] = useState<ChatFriend[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [text, setText] = useState("");
  const [replyId, setReplyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pendingEditRef = useRef<string | null>(null);
  const pendingDeleteRef = useRef<string | null>(null);
  const mutationCacheRef = useRef(new Map<string, PrivateMessage>());
  const [status, setStatus] = useState<ConnectionStatus>("Connecting");
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isFriendManagerOpen, setIsFriendManagerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [presence, setPresence] = useState<
    Record<string, { online: boolean; revision: number }>
  >({});
  const [unreadState, setUnreadState] = useState<{
    synced: boolean;
    counts: Record<string, number>;
  }>({ synced: false, counts: {} });
  const unreadRevisionRef = useRef(0);
  const readRequestsRef = useRef(new Map<string, string>());
  const readReceiptsRef = useRef(new Map<string, ReadReceipt>());
  const messagesRef = useRef(messages);
  const conversationObscuredRef = useRef(false);
  const socketRef = useRef<WebSocket | null>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { typingByUser, updateTyping, stopTyping, handleTyping, clearTyping } =
    useChatTyping(socketRef, currentUser.id);
  messagesRef.current = messages;
  conversationObscuredRef.current = isSidebarOpen || isFriendManagerOpen;

  const selectedUser =
    friends.find((friend) => friend.id === selectedUserId) ?? null;
  const displayedFriends = friends.map((friend) => ({
    ...friend,
    online: presence[friend.id]?.online ?? friend.online,
    unreadCount: unreadState.synced
      ? (unreadState.counts[friend.id] ?? 0)
      : friend.unreadCount,
  }));
  const selectedOnline = selectedUser
    ? (presence[selectedUser.id]?.online ?? selectedUser.online)
    : false;
  const lastOwnMessageId = messages.findLast(
    (message) => message.senderId === currentUser.id && !message.deletedAt,
  )?.id;
  const replyMessage = messages.find((message) => message.id === replyId);
  const editingMessage = messages.find((message) => message.id === editingId);

  const applyKnownReceipts = useCallback((incoming: PrivateMessage[]) => {
    let updated = incoming;
    for (const receipt of readReceiptsRef.current.values())
      updated = applyReadReceipt(updated, receipt);
    for (const mutation of mutationCacheRef.current.values())
      updated = applyMessageMutation(updated, mutation);
    return updated;
  }, []);

  const markVisibleMessagesRead = useCallback(() => {
    const friendId = selectedUserIdRef.current;
    const socket = socketRef.current;
    if (
      !friendId ||
      conversationObscuredRef.current ||
      document.visibilityState !== "visible" ||
      !document.hasFocus() ||
      socket?.readyState !== WebSocket.OPEN
    )
      return;
    const latestIncoming = messagesRef.current.findLast(
      (message) =>
        message.senderId === friendId &&
        message.receiverId === currentUser.id &&
        !message.deletedAt &&
        !message.readAt,
    );
    if (!latestIncoming) return;
    const previous = readRequestsRef.current.get(friendId);
    if (previous && BigInt(previous) >= BigInt(latestIncoming.id)) return;
    readRequestsRef.current.set(friendId, latestIncoming.id);
    socket.send(
      JSON.stringify({
        type: "message.read",
        friendId,
        throughMessageId: latestIncoming.id,
      }),
    );
  }, [currentUser.id]);

  const loadFriends = useCallback(
    async (signal?: AbortSignal) => {
      if (!apiBaseUrl) {
        setFriendsError("NEXT_PUBLIC_API_URL is not configured.");
        setFriendsLoading(false);
        return;
      }
      setFriendsLoading(true);
      setFriendsError(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/friends`, {
          credentials: "include",
          signal,
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok)
          throw new Error(`Friends request failed: ${response.status}`);
        const value: unknown = await response.json();
        if (!isRecord(value) || !Array.isArray(value.friends)) {
          throw new Error("Invalid friends response");
        }
        const parsedFriends = value.friends.map(parseChatFriend);
        if (parsedFriends.some((friend) => friend === null)) {
          throw new Error("Invalid friend in response");
        }
        if (signal?.aborted) return;
        setFriends(parsedFriends as ChatFriend[]);
        if (socketRef.current?.readyState === WebSocket.OPEN)
          socketRef.current.send(JSON.stringify({ type: "chat.sync" }));
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError")
          return;
        setFriendsError("Friends could not be loaded.");
      } finally {
        if (!signal?.aborted) setFriendsLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadFriends(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadFriends]);

  useEffect(() => {
    if (!websocketUrl) {
      setStatus("Disconnected");
      setConnectionError("NEXT_PUBLIC_WS_URL is not configured.");
      return;
    }
    const socket = new WebSocket(websocketUrl);
    socketRef.current = socket;
    socket.onopen = () => {
      unreadRevisionRef.current = 0;
      readRequestsRef.current.clear();
      setPresence({});
      setUnreadState({ synced: false, counts: {} });
      setStatus("Connected");
      setConnectionError(null);
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      const serverMessage = parseServerMessage(event.data);
      if (!serverMessage) return;
      if (serverMessage.type === "error") {
        readRequestsRef.current.clear();
        pendingEditRef.current = null;
        pendingDeleteRef.current = null;
        setEditPending(false);
        setDeletingId(null);
        setConnectionError(serverMessage.data.message);
        return;
      }

      if (
        serverMessage.type === "typing.start" ||
        serverMessage.type === "typing.stop"
      ) {
        handleTyping(serverMessage);
        return;
      }
      if (serverMessage.type === "message.read") {
        if (
          serverMessage.readerId !== currentUser.id &&
          serverMessage.senderId !== currentUser.id
        )
          return;
        const key = `${serverMessage.senderId}:${serverMessage.readerId}`;
        const previous = readReceiptsRef.current.get(key);
        if (
          !previous ||
          BigInt(previous.throughMessageId) <
            BigInt(serverMessage.throughMessageId)
        )
          readReceiptsRef.current.set(key, serverMessage);
        setMessages((current) => applyReadReceipt(current, serverMessage));
        return;
      }
      if (serverMessage.type === "presence.update") {
        setPresence((current) =>
          (current[serverMessage.userId]?.revision ?? -1) <=
          serverMessage.revision
            ? {
                ...current,
                [serverMessage.userId]: {
                  online: serverMessage.online,
                  revision: serverMessage.revision,
                },
              }
            : current,
        );
        return;
      }
      if (
        serverMessage.type === "unread.update" ||
        serverMessage.type === "chat.state"
      ) {
        const revision =
          serverMessage.type === "unread.update"
            ? serverMessage.revision
            : serverMessage.unreadRevision;
        if (revision >= unreadRevisionRef.current) {
          unreadRevisionRef.current = revision;
          const entries =
            serverMessage.type === "unread.update"
              ? serverMessage.counts.map((count) => [
                  count.friendId,
                  count.unreadCount,
                ])
              : serverMessage.friends.map((friend) => [
                  friend.id,
                  friend.unreadCount,
                ]);
          setUnreadState({ synced: true, counts: Object.fromEntries(entries) });
        }
        if (serverMessage.type === "chat.state") {
          setPresence((current) => {
            const updated = { ...current };
            for (const friend of serverMessage.friends) {
              if (
                (updated[friend.id]?.revision ?? -1) <= friend.presenceRevision
              )
                updated[friend.id] = {
                  online: friend.online,
                  revision: friend.presenceRevision,
                };
            }
            return updated;
          });
        }
        return;
      }
      if (
        serverMessage.type !== "message.new" &&
        serverMessage.type !== "message.edited" &&
        serverMessage.type !== "message.deleted"
      )
        return;

      const activeUserId = selectedUserIdRef.current;
      const message = serverMessage.message;
      if (
        message.senderId !== currentUser.id &&
        message.receiverId !== currentUser.id
      )
        return;
      if (serverMessage.type !== "message.new") {
        const cached = mutationCacheRef.current.get(message.id);
        const canonical = mergeMessages(cached ? [cached] : [], [message])[0]!;
        mutationCacheRef.current.set(message.id, canonical);
        if (pendingEditRef.current === message.id) {
          pendingEditRef.current = null;
          setEditPending(false);
          setEditingId(null);
          setText("");
        }
        if (pendingDeleteRef.current === message.id) {
          pendingDeleteRef.current = null;
          setDeletingId(null);
        }
        if (belongsToPair(canonical, currentUser.id, activeUserId)) {
          setMessages((current) => applyMessageMutation(current, canonical));
        }
        return;
      }
      const belongsToActiveConversation =
        activeUserId !== null &&
        ((message.senderId === currentUser.id &&
          message.receiverId === activeUserId) ||
          (message.senderId === activeUserId &&
            message.receiverId === currentUser.id));

      if (belongsToActiveConversation) {
        setMessages((current) =>
          mergeMessages(current, applyKnownReceipts([message])),
        );
      }
    };
    socket.onerror = () => {
      setConnectionError("WebSocket connection failed.");
    };
    socket.onclose = () => {
      pendingEditRef.current = null;
      pendingDeleteRef.current = null;
      setEditPending(false);
      setDeletingId(null);
      clearTyping();
      setStatus("Disconnected");
      if (socketRef.current === socket) socketRef.current = null;
    };
    return () => {
      clearTyping();
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [currentUser.id, applyKnownReceipts, handleTyping, clearTyping]);

  useEffect(() => {
    if (!selectedUserId) return;

    const controller = new AbortController();
    const loadHistory = async () => {
      if (!apiBaseUrl) {
        setHistoryError("NEXT_PUBLIC_API_URL is not configured.");
        return;
      }
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/messages/${encodeURIComponent(selectedUserId)}`,
          { credentials: "include", signal: controller.signal },
        );
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          throw new Error(`History request failed: ${response.status}`);
        }
        const value: unknown = await response.json();
        if (!isRecord(value) || !Array.isArray(value.messages)) {
          throw new Error("Invalid history response");
        }
        const history = value.messages.map(parsePrivateMessage);
        if (history.some((message) => message === null)) {
          throw new Error("Invalid message in history");
        }
        if (
          controller.signal.aborted ||
          selectedUserIdRef.current !== selectedUserId
        )
          return;
        setMessages((current) =>
          mergeMessages(
            current,
            applyKnownReceipts(history as PrivateMessage[]),
          ),
        );
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError")
          return;
        setHistoryError("Message history could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    };
    void loadHistory();
    return () => {
      controller.abort();
    };
  }, [router, selectedUserId, applyKnownReceipts]);

  useEffect(() => {
    markVisibleMessagesRead();
    if (isSidebarOpen || isFriendManagerOpen) stopTyping();
  }, [
    messages,
    selectedUserId,
    status,
    isSidebarOpen,
    isFriendManagerOpen,
    markVisibleMessagesRead,
    stopTyping,
  ]);

  useEffect(() => {
    window.addEventListener("focus", markVisibleMessagesRead);
    document.addEventListener("visibilitychange", markVisibleMessagesRead);
    return () => {
      window.removeEventListener("focus", markVisibleMessagesRead);
      document.removeEventListener("visibilitychange", markVisibleMessagesRead);
    };
  }, [markVisibleMessagesRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (editingId && (!editingMessage || editingMessage.deletedAt)) {
      setEditingId(null);
      setText("");
      pendingEditRef.current = null;
      setEditPending(false);
    }
  }, [editingId, editingMessage]);

  const selectUser = (user: ChatUser) => {
    if (selectedUserIdRef.current === user.id) return;
    stopTyping();
    selectedUserIdRef.current = user.id;
    setSelectedUserId(user.id);
    setMessages([]);
    setText("");
    setReplyId(null);
    setEditingId(null);
    pendingEditRef.current = null;
    setEditPending(false);
    setHistoryError(null);
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const socket = socketRef.current;
    const trimmedText = text.trim();
    if (!selectedUser) {
      setConnectionError("Select a user to start chatting.");
      return;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setConnectionError("WebSocket is not connected.");
      return;
    }
    if (!trimmedText) return;
    if (editingId) {
      if (pendingEditRef.current || !editingMessage || editingMessage.deletedAt)
        return;
      pendingEditRef.current = editingId;
      setEditPending(true);
      socket.send(
        JSON.stringify({
          type: "message.edit",
          messageId: editingId,
          message: trimmedText,
        }),
      );
      stopTyping();
      return;
    }
    socket.send(
      JSON.stringify({
        type: "message.send",
        receiverId: selectedUser.id,
        message: trimmedText,
        replyToMessageId: replyId,
      }),
    );
    stopTyping();
    setText("");
    setReplyId(null);
    setConnectionError(null);
  };

  const closeFriendManager = useCallback(() => {
    setIsFriendManagerOpen(false);
  }, []);

  const cancelComposerAction = () => {
    if (pendingEditRef.current) return;
    stopTyping();
    if (editingId) setText("");
    setEditingId(null);
    setReplyId(null);
  };
  const startReply = (message: PrivateMessage) => {
    if (pendingEditRef.current) return;
    if (editingId) setText("");
    setEditingId(null);
    setReplyId(message.id);
  };
  const startEdit = (message: PrivateMessage) => {
    if (
      message.senderId !== currentUser.id ||
      message.deletedAt ||
      pendingEditRef.current
    )
      return;
    setReplyId(null);
    setEditingId(message.id);
    setText(message.messageText);
  };
  const deleteMessage = (message: PrivateMessage) => {
    if (
      pendingDeleteRef.current ||
      message.senderId !== currentUser.id ||
      message.deletedAt
    )
      return;
    if (!window.confirm("Delete this message for everyone?")) return;
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    pendingDeleteRef.current = message.id;
    setDeletingId(message.id);
    socket.send(
      JSON.stringify({ type: "message.delete", messageId: message.id }),
    );
  };

  const displayedError = friendsError ?? historyError ?? connectionError;

  return (
    <main className="chat-shell">
      <div className="chat-layout">
        <ChatSidebar
          username={currentUser.username}
          email={currentUser.email}
          friends={displayedFriends}
          selectedUserId={selectedUserId}
          friendsLoading={friendsLoading}
          onSelectUser={selectUser}
          onManageFriends={() => setIsFriendManagerOpen(true)}
          onDrawerChange={setIsSidebarOpen}
        />
        <FriendManager
          isOpen={isFriendManagerOpen}
          onClose={closeFriendManager}
          onFriendsChanged={() => void loadFriends()}
        />
        <div className="chat-main">
          <section className="chat-card" aria-labelledby="chat-title">
            <header className="chat-header">
              <div className="chat-title-block">
                <p className="eyebrow">Private conversation</p>
                <h1 id="chat-title">
                  {selectedUser?.username ?? "Private Chat"}
                </h1>
                {selectedUser ? (
                  <p className="chat-presence">
                    <span
                      className={`presence-dot${selectedOnline ? " presence-dot-online" : ""}`}
                      aria-hidden="true"
                    />
                    {selectedOnline ? "Online" : "Offline"}
                  </p>
                ) : null}
              </div>
              <div className={`status status-${status.toLowerCase()}`}>
                <span aria-hidden="true" />
                {status}
              </div>
            </header>

            <div
              className="messages private-messages"
              aria-live="polite"
              aria-label="Private messages"
            >
              {!selectedUser ? (
                <div className="empty-state">
                  <p>Select a friend to start chatting</p>
                  <span>Choose an accepted friend from the sidebar.</span>
                </div>
              ) : historyLoading && messages.length === 0 ? (
                <div className="empty-state">
                  <p>Loading conversation…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="empty-state">
                  <p>No messages yet</p>
                  <span>
                    Start a private conversation with {selectedUser.username}.
                  </span>
                </div>
              ) : (
                messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    currentUserId={currentUser.id}
                    friendName={selectedUser.username}
                    showReceipt={message.id === lastOwnMessageId}
                    disabled={
                      status !== "Connected" ||
                      editPending ||
                      deletingId !== null
                    }
                    onReply={startReply}
                    onEdit={startEdit}
                    onDelete={deleteMessage}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <p className="chat-typing" role="status">
              {selectedUser && typingByUser[selectedUser.id]
                ? `${selectedUser.username} is typing…`
                : ""}
            </p>

            {displayedError ? (
              <p className="error-message" role="alert">
                {displayedError}
              </p>
            ) : null}

            <form className="message-form" onSubmit={sendMessage}>
              {replyId || editingId ? (
                <div className="composer-context" role="status">
                  <div>
                    <strong>
                      {editingId
                        ? "Editing message"
                        : "Replying to " +
                          (replyMessage?.senderId === currentUser.id
                            ? "yourself"
                            : selectedUser?.username)}
                    </strong>
                    <span>
                      {editingId
                        ? editingMessage?.messageText
                        : replyMessage?.deletedAt
                          ? "This message was deleted"
                          : replyMessage?.messageText}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="composer-cancel"
                    disabled={editPending}
                    onClick={cancelComposerAction}
                    aria-label={editingId ? "Cancel editing" : "Cancel reply"}
                  >
                    ×
                  </button>
                </div>
              ) : null}
              <label className="field message-field">
                <span>
                  {selectedUser
                    ? `Message ${selectedUser.username}`
                    : "Select a friend to start chatting"}
                </span>
                <input
                  type="text"
                  value={text}
                  onChange={(event) => {
                    setText(event.target.value);
                    if (selectedUser)
                      updateTyping(selectedUser.id, event.target.value);
                  }}
                  onBlur={stopTyping}
                  placeholder={
                    selectedUser
                      ? "Type a private message…"
                      : "Select a friend first"
                  }
                  maxLength={1_000}
                  disabled={!selectedUser || editPending}
                />
              </label>
              <button
                type="submit"
                disabled={
                  status !== "Connected" ||
                  !selectedUser ||
                  !text.trim() ||
                  editPending
                }
              >
                {editPending ? "Saving…" : editingId ? "Save" : "Send"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
