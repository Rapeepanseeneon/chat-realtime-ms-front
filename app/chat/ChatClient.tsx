"use client";

import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AuthenticatedAppShell } from "../../components/app/AuthenticatedAppShell";
import { ChatHeader } from "../../components/chat/ChatHeader";
import { ConversationList } from "../../components/chat/ConversationList";
import { ConversationPane } from "../../components/chat/ConversationPane";
import { MessageComposer } from "../../components/chat/MessageComposer";
import { MessageList } from "../../components/chat/MessageList";
import { FriendManager } from "../../components/FriendManager";
import { GroupManager } from "../../components/GroupManager";
import { GroupMessageBubble } from "../../components/GroupMessageBubble";
import { MessageBubble } from "../../components/MessageBubble";
import { ProfileViewer } from "../../components/ProfileViewer";
import { VoiceCallOverlay } from "../../components/VoiceCallOverlay";
import type { GhostCommand } from "../../components/GhostMessage";
import type {
  ChatFriend,
  ChatUser,
  ChatGroup,
  GroupMessage,
  PrivateMessage,
  ReadReceipt,
  UserSettings,
} from "../../lib/chat-types";
import {
  applyReadReceipt,
  applyMessageMutation,
  isRecord,
  mergeMessages,
  newerMessage,
  parseChatFriend,
  parsePrivateMessage,
  parseServerMessage,
} from "../../lib/chat-events";
import { useChatTyping } from "../../lib/use-chat-typing";
import { useVoiceCall } from "../../lib/use-voice-call";
import { getApiBaseUrl, getWebSocketUrl } from "../../lib/runtime-config";

type ConnectionStatus = "Connecting" | "Connected" | "Disconnected";
type PendingAttachment =
  | { kind: "image" | "file"; file: File; previewUrl: string | null }
  | { kind: "location"; latitude: number; longitude: number };

type ChatClientProps = {
  currentUser: {
    id: string;
    username: string;
    email: string;
    bio: string;
    avatarUrl: string | null;
  };
};

const websocketUrl = getWebSocketUrl();
const apiBaseUrl = getApiBaseUrl();
const defaultSettings: UserSettings = {
  presenceStatus: "online",
  customStatus: "",
  showOnlineStatus: true,
  sendReadReceipts: true,
  showTypingIndicator: true,
  confirmGhostRelease: true,
  enterToSend: true,
  messageTextSize: "default",
  updatedAt: "",
};
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
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [groupInfoTarget, setGroupInfoTarget] = useState<ChatGroup | null>(
    null,
  );
  const [groupReplyId, setGroupReplyId] = useState<string | null>(null);
  const [groupEditingId, setGroupEditingId] = useState<string | null>(null);
  const [groupTypingUsers, setGroupTypingUsers] = useState<
    Record<string, string>
  >({});
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [text, setText] = useState("");
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [linkEntryOpen, setLinkEntryOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [locating, setLocating] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [ghostBusyId, setGhostBusyId] = useState<string | null>(null);
  const [ghostCreating, setGhostCreating] = useState(false);
  const ghostBusyRef = useRef<string | null>(null);
  const ghostCreatingRef = useRef<string | null>(null);
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
  const [profileTarget, setProfileTarget] = useState<ChatUser | null>(null);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [presence, setPresence] = useState<
    Record<
      string,
      {
        online: boolean;
        status: ChatFriend["status"];
        customStatus: string;
        revision: number;
      }
    >
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
  const selectedGroupIdRef = useRef<string | null>(null);
  const groupTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageAreaRef = useRef<HTMLDivElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nearBottomRef = useRef(true);
  const jumpToLatestRef = useRef(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const { typingByUser, updateTyping, stopTyping, handleTyping, clearTyping } =
    useChatTyping(socketRef, currentUser.id, settings.showTypingIndicator);
  const voiceCall = useVoiceCall(socketRef, currentUser.id);
  const voiceSignalHandlerRef = useRef(voiceCall.handleSignal);
  const voiceDisconnectHandlerRef = useRef(voiceCall.handleSignalingDisconnect);
  voiceSignalHandlerRef.current = voiceCall.handleSignal;
  voiceDisconnectHandlerRef.current = voiceCall.handleSignalingDisconnect;
  messagesRef.current = messages;
  conversationObscuredRef.current =
    isFriendManagerOpen || groupManagerOpen || !!profileTarget;

  const clearPendingAttachment = useCallback(() => {
    setPendingAttachment(null);
    setUploadProgress(0);
    setAttachmentMenuOpen(false);
  }, []);

  useEffect(() => {
    const previewUrl =
      pendingAttachment && "previewUrl" in pendingAttachment
        ? pendingAttachment.previewUrl
        : null;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [pendingAttachment]);

  const selectedUser =
    friends.find((friend) => friend.id === selectedUserId) ?? null;
  const selectedGroup =
    groups.find((group) => group.id === selectedGroupId) ?? null;
  const displayedFriends = friends.map((friend) => ({
    ...friend,
    online: presence[friend.id]?.online ?? friend.online,
    status: presence[friend.id]?.status ?? friend.status,
    customStatus: presence[friend.id]?.customStatus ?? friend.customStatus,
    unreadCount: unreadState.synced
      ? (unreadState.counts[friend.id] ?? 0)
      : friend.unreadCount,
  }));
  const selectedStatus = selectedUser
    ? (presence[selectedUser.id]?.status ?? selectedUser.status)
    : "offline";
  const selectedCustomStatus = selectedUser
    ? (presence[selectedUser.id]?.customStatus ?? selectedUser.customStatus)
    : "";
  const lastOwnMessageId = messages.findLast(
    (message) =>
      message.senderId === currentUser.id &&
      !message.deletedAt &&
      message.messageStatus === "sent",
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
        message.messageStatus === "sent" &&
        !message.deletedAt &&
        !message.readAt,
    );
    if (!latestIncoming) return;
    const previous = readRequestsRef.current.get(friendId);
    const deliveryId = latestIncoming.deliveryId ?? latestIncoming.id;
    if (previous && BigInt(previous) >= BigInt(deliveryId)) return;
    readRequestsRef.current.set(friendId, deliveryId);
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
  const loadGroups = useCallback(
    async (signal?: AbortSignal) => {
      if (!apiBaseUrl) return;
      try {
        const response = await fetch(`${apiBaseUrl}/api/groups`, {
          credentials: "include",
          signal,
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw Error();
        const value = (await response.json()) as { groups: ChatGroup[] };
        if (!Array.isArray(value.groups)) throw Error();
        setGroups(value.groups);
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError"))
          setConnectionError("Groups could not be loaded.");
      }
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadFriends(controller.signal);
    void loadGroups(controller.signal);
    const loadSettings = async () => {
      if (!apiBaseUrl) return;
      try {
        const response = await fetch(`${apiBaseUrl}/api/settings`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) return;
        const value = (await response.json()) as { settings?: UserSettings };
        if (!value.settings) return;
        setSettings(value.settings);
        document.documentElement.dataset.messageSize =
          value.settings.messageTextSize;
        localStorage.setItem("pb-message-size", value.settings.messageTextSize);
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError"))
          setConnectionError("Chat preferences could not be loaded.");
      }
    };
    void loadSettings();
    return () => {
      controller.abort();
    };
  }, [loadFriends, loadGroups]);

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
      try {
        const value: unknown = JSON.parse(event.data);
        if (
          isRecord(value) &&
          typeof value.type === "string" &&
          value.type.startsWith("call.")
        ) {
          void voiceSignalHandlerRef.current(value);
          return;
        }
      } catch {
        // Existing message validation below handles malformed payloads.
      }
      const groupEvent = (() => {
        try {
          const value = JSON.parse(event.data) as {
            type: string;
            groupId?: string;
            userId?: string;
            username?: string;
            message?: GroupMessage;
          } | null;
          return value &&
            typeof value.type === "string" &&
            value.type.startsWith("group.")
            ? value
            : null;
        } catch {
          return null;
        }
      })();
      if (groupEvent) {
        if (groupEvent.type === "group.updated") {
          void loadGroups();
          return;
        }
        if (
          (groupEvent.type === "group.typing.start" ||
            groupEvent.type === "group.typing.stop") &&
          groupEvent.groupId &&
          groupEvent.userId &&
          groupEvent.username
        ) {
          if (groupEvent.groupId === selectedGroupIdRef.current)
            setGroupTypingUsers((current) => {
              const next = { ...current };
              if (groupEvent!.type === "group.typing.start")
                next[groupEvent!.userId!] = groupEvent!.username!;
              else delete next[groupEvent!.userId!];
              return next;
            });
          return;
        }
        if (
          groupEvent.message &&
          [
            "group.message.new",
            "group.message.edited",
            "group.message.deleted",
          ].includes(groupEvent.type)
        ) {
          const incoming = groupEvent.message;
          if (incoming.groupId === selectedGroupIdRef.current)
            setGroupMessages((current) => {
              const found = current.some(
                (message) => message.id === incoming.id,
              );
              return (
                found
                  ? current.map((message) =>
                      message.id === incoming.id ? incoming : message,
                    )
                  : [...current, incoming]
              ).sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
            });
          if (
            incoming.groupId === selectedGroupIdRef.current &&
            document.visibilityState === "visible" &&
            !conversationObscuredRef.current
          )
            socket.send(
              JSON.stringify({ type: "group.read", groupId: incoming.groupId }),
            );
          if (incoming.senderId === currentUser.id) {
            setText("");
            setGroupReplyId(null);
            setGroupEditingId(null);
            setEditPending(false);
          }
          return;
        }
      }
      const serverMessage = parseServerMessage(event.data);
      if (!serverMessage) return;
      if (serverMessage.type === "settings.updated") {
        setSettings(serverMessage.settings);
        document.documentElement.dataset.messageSize =
          serverMessage.settings.messageTextSize;
        localStorage.setItem(
          "pb-message-size",
          serverMessage.settings.messageTextSize,
        );
        return;
      }
      if (serverMessage.type === "error") {
        readRequestsRef.current.clear();
        pendingEditRef.current = null;
        pendingDeleteRef.current = null;
        setEditPending(false);
        setDeletingId(null);
        ghostBusyRef.current = null;
        ghostCreatingRef.current = null;
        setGhostBusyId(null);
        setGhostCreating(false);
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
          BigInt(previous.throughDeliveryId ?? previous.throughMessageId) <
            BigInt(
              serverMessage.throughDeliveryId ?? serverMessage.throughMessageId,
            )
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
                  status: serverMessage.status,
                  customStatus: serverMessage.customStatus,
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
                  status: friend.status,
                  customStatus: friend.customStatus,
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
        serverMessage.type !== "message.deleted" &&
        serverMessage.type !== "ghost.updated"
      )
        return;

      const activeUserId = selectedUserIdRef.current;
      const message = serverMessage.message;
      if (
        message.senderId !== currentUser.id &&
        message.receiverId !== currentUser.id
      )
        return;
      if (
        message.messageStatus !== "sent" &&
        message.senderId !== currentUser.id
      )
        return;
      if (ghostBusyRef.current === message.id) {
        ghostBusyRef.current = null;
        setGhostBusyId(null);
      }
      if (
        serverMessage.type === "ghost.updated" &&
        ghostCreatingRef.current === message.receiverId
      ) {
        ghostCreatingRef.current = null;
        setGhostCreating(false);
        if (selectedUserIdRef.current === message.receiverId) {
          setText("");
          setReplyId(null);
        }
      }
      if (serverMessage.type !== "message.new") {
        const cached = mutationCacheRef.current.get(message.id);
        const canonical = newerMessage(cached, message);
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
          setMessages((current) =>
            serverMessage.type === "ghost.updated"
              ? mergeMessages(current, [canonical])
              : applyMessageMutation(current, canonical),
          );
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
        if (message.releasedAt)
          mutationCacheRef.current.set(
            message.id,
            newerMessage(mutationCacheRef.current.get(message.id), message),
          );
        setMessages((current) =>
          mergeMessages(current, applyKnownReceipts([message])),
        );
      }
    };
    socket.onerror = () => {
      setConnectionError("WebSocket connection failed.");
    };
    socket.onclose = () => {
      if (groupTypingTimerRef.current) {
        clearTimeout(groupTypingTimerRef.current);
        groupTypingTimerRef.current = null;
      }
      ghostBusyRef.current = null;
      ghostCreatingRef.current = null;
      setGhostBusyId(null);
      setGhostCreating(false);
      pendingEditRef.current = null;
      pendingDeleteRef.current = null;
      setEditPending(false);
      setDeletingId(null);
      clearTyping();
      voiceDisconnectHandlerRef.current();
      setStatus("Disconnected");
      if (socketRef.current === socket) socketRef.current = null;
    };
    return () => {
      if (groupTypingTimerRef.current) {
        clearTimeout(groupTypingTimerRef.current);
        groupTypingTimerRef.current = null;
      }
      clearTyping();
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [
    currentUser.id,
    applyKnownReceipts,
    handleTyping,
    clearTyping,
    loadGroups,
  ]);

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
    if (!selectedGroupId) return;
    const controller = new AbortController();
    const load = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/groups/${selectedGroupId}/messages`,
          { credentials: "include", signal: controller.signal },
        );
        if (!response.ok) throw Error();
        const value = (await response.json()) as { messages: GroupMessage[] };
        if (
          !controller.signal.aborted &&
          selectedGroupIdRef.current === selectedGroupId
        ) {
          setGroupMessages((current) => {
            const byId = new Map(
              value.messages.map((message) => [message.id, message]),
            );
            for (const message of current) byId.set(message.id, message);
            return [...byId.values()].sort((a, b) =>
              BigInt(a.id) < BigInt(b.id) ? -1 : 1,
            );
          });
          socketRef.current?.send(
            JSON.stringify({ type: "group.read", groupId: selectedGroupId }),
          );
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError"))
          setHistoryError("Group history could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [selectedGroupId]);

  useEffect(() => {
    markVisibleMessagesRead();
    if (isFriendManagerOpen) stopTyping();
  }, [
    messages,
    selectedUserId,
    status,
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

  const scrollToLatest = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    nearBottomRef.current = true;
    setHasNewMessages(false);
  }, []);

  useEffect(() => {
    nearBottomRef.current = true;
    jumpToLatestRef.current = true;
    setHasNewMessages(false);
  }, [selectedUserId, selectedGroupId]);

  useEffect(() => {
    const area = messageAreaRef.current;
    if (jumpToLatestRef.current) {
      if (messages.length === 0 && groupMessages.length === 0) return;
      jumpToLatestRef.current = false;
      requestAnimationFrame(() => scrollToLatest("auto"));
      return;
    }
    const isNearBottom = area
      ? area.scrollHeight - area.scrollTop - area.clientHeight < 96
      : true;
    nearBottomRef.current = isNearBottom;
    if (isNearBottom) requestAnimationFrame(() => scrollToLatest());
    else if (messages.length || groupMessages.length) setHasNewMessages(true);
  }, [messages, groupMessages, scrollToLatest]);

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
    if (
      selectedGroupIdRef.current &&
      socketRef.current?.readyState === WebSocket.OPEN
    ) {
      socketRef.current.send(
        JSON.stringify({
          type: "group.typing.stop",
          groupId: selectedGroupIdRef.current,
        }),
      );
    }
    if (groupTypingTimerRef.current) {
      clearTimeout(groupTypingTimerRef.current);
      groupTypingTimerRef.current = null;
    }
    selectedUserIdRef.current = user.id;
    selectedGroupIdRef.current = null;
    setSelectedGroupId(null);
    setSelectedUserId(user.id);
    setMessages([]);
    setText("");
    clearPendingAttachment();
    setLinkEntryOpen(false);
    setReplyId(null);
    setEditingId(null);
    pendingEditRef.current = null;
    setEditPending(false);
    setHistoryError(null);
  };
  const selectGroup = (group: ChatGroup) => {
    if (selectedGroupIdRef.current === group.id) return;
    stopTyping();
    if (
      selectedGroupIdRef.current &&
      socketRef.current?.readyState === WebSocket.OPEN
    ) {
      socketRef.current.send(
        JSON.stringify({
          type: "group.typing.stop",
          groupId: selectedGroupIdRef.current,
        }),
      );
    }
    if (groupTypingTimerRef.current) {
      clearTimeout(groupTypingTimerRef.current);
      groupTypingTimerRef.current = null;
    }
    selectedUserIdRef.current = null;
    setSelectedUserId(null);
    selectedGroupIdRef.current = group.id;
    setSelectedGroupId(group.id);
    setGroupMessages([]);
    setGroupTypingUsers({});
    setText("");
    clearPendingAttachment();
    setLinkEntryOpen(false);
    setReplyId(null);
    setEditingId(null);
    setGroupReplyId(null);
    setGroupEditingId(null);
    setHistoryError(null);
  };

  const chooseAttachment = (
    event: ChangeEvent<HTMLInputElement>,
    kind: "image" | "file",
  ) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const limit = kind === "image" ? 8 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > limit) {
      setConnectionError(
        `${kind === "image" ? "Photo" : "File"} must be smaller than ${limit / 1024 / 1024} MB.`,
      );
      return;
    }
    if (kind === "image" && !file.type.startsWith("image/")) {
      setConnectionError("Choose a valid image file.");
      return;
    }
    setConnectionError(null);
    setReplyId(null);
    setGroupReplyId(null);
    setPendingAttachment({
      kind,
      file,
      previewUrl: kind === "image" ? URL.createObjectURL(file) : null,
    });
    setAttachmentMenuOpen(false);
  };

  const requestCurrentLocation = () => {
    setAttachmentMenuOpen(false);
    if (!("geolocation" in navigator)) {
      setConnectionError("Location is not supported by this browser.");
      return;
    }
    setLocating(true);
    setConnectionError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setReplyId(null);
        setGroupReplyId(null);
        setPendingAttachment({
          kind: "location",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        setLocating(false);
        setConnectionError(
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. You can allow it in your browser settings and try again."
            : "Your current location could not be found. Please try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  };

  const addLinkToComposer = () => {
    try {
      const url = new URL(linkValue.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") throw Error();
      setText(url.toString());
      setLinkValue("");
      setLinkEntryOpen(false);
      setAttachmentMenuOpen(false);
      setConnectionError(null);
    } catch {
      setConnectionError("Enter a valid http:// or https:// link.");
    }
  };

  const uploadCurrentAttachment = async () => {
    if (
      !apiBaseUrl ||
      !pendingAttachment ||
      uploadingAttachment ||
      (!selectedUser && !selectedGroup)
    )
      return;
    const scope = selectedGroup ? "group" : "private";
    const targetId = selectedGroup?.id ?? selectedUser!.id;
    setUploadingAttachment(true);
    setUploadProgress(0);
    setConnectionError(null);
    try {
      let value: unknown;
      if (pendingAttachment.kind === "location") {
        const response = await fetch(`${apiBaseUrl}/api/attachments/location`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scope,
            targetId,
            latitude: pendingAttachment.latitude,
            longitude: pendingAttachment.longitude,
            caption: text.trim(),
          }),
        });
        value = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(
            isRecord(value) && typeof value.error === "string"
              ? value.error
              : "Location could not be sent.",
          );
      } else {
        value = await new Promise<unknown>((resolve, reject) => {
          const request = new XMLHttpRequest();
          request.open("POST", `${apiBaseUrl}/api/attachments`);
          request.withCredentials = true;
          request.upload.onprogress = (event) => {
            if (event.lengthComputable)
              setUploadProgress(Math.round((event.loaded / event.total) * 100));
          };
          request.onload = () => {
            let body: unknown = null;
            try {
              body = JSON.parse(request.responseText);
            } catch {
              // The status-specific fallback below remains user friendly.
            }
            if (request.status >= 200 && request.status < 300) resolve(body);
            else
              reject(
                new Error(
                  isRecord(body) && typeof body.error === "string"
                    ? body.error
                    : "Attachment could not be sent.",
                ),
              );
          };
          request.onerror = () =>
            reject(new Error("Could not reach the attachment server."));
          const form = new FormData();
          form.set("scope", scope);
          form.set("targetId", targetId);
          form.set("kind", pendingAttachment.kind);
          form.set("caption", text.trim());
          form.set("file", pendingAttachment.file);
          request.send(form);
        });
      }
      if (!isRecord(value) || !isRecord(value.message))
        throw new Error("Attachment response was invalid.");
      if (scope === "private") {
        const message = parsePrivateMessage(value.message);
        if (!message) throw new Error("Attachment message was invalid.");
        setMessages((current) => mergeMessages(current, [message]));
      } else {
        const message = value.message as GroupMessage;
        if (message.groupId !== targetId)
          throw new Error("Group attachment response was invalid.");
        setGroupMessages((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          byId.set(message.id, message);
          return [...byId.values()].sort((a, b) =>
            BigInt(a.id) < BigInt(b.id) ? -1 : 1,
          );
        });
      }
      setText("");
      clearPendingAttachment();
    } catch (error) {
      setConnectionError(
        error instanceof Error
          ? error.message
          : "Attachment could not be sent.",
      );
    } finally {
      setUploadingAttachment(false);
      setUploadProgress(0);
    }
  };

  const sendCurrentMessage = (ghost = false) => {
    const socket = socketRef.current;
    const trimmedText = text.trim();
    if (selectedGroup) {
      if (ghost) {
        setConnectionError(
          "Ghost messages are available in private chats only.",
        );
        return;
      }
      if (!socket || socket.readyState !== WebSocket.OPEN || !trimmedText)
        return;
      socket.send(
        JSON.stringify({
          type: groupEditingId ? "group.message.edit" : "group.message.send",
          groupId: selectedGroup.id,
          messageId: groupEditingId,
          message: trimmedText,
          replyToMessageId: groupReplyId,
        }),
      );
      setEditPending(Boolean(groupEditingId));
      if (groupTypingTimerRef.current)
        clearTimeout(groupTypingTimerRef.current);
      socket.send(
        JSON.stringify({
          type: "group.typing.stop",
          groupId: selectedGroup.id,
        }),
      );
      return;
    }
    if (!selectedUser) {
      setConnectionError("Select a user to start chatting.");
      return;
    }
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setConnectionError("WebSocket is not connected.");
      return;
    }
    if (!trimmedText) return;
    if (ghostCreatingRef.current) return;
    if (editingId) {
      if (pendingEditRef.current || !editingMessage || editingMessage.deletedAt)
        return;
      pendingEditRef.current = editingId;
      setEditPending(true);
      socket.send(
        JSON.stringify({
          type:
            editingMessage.messageStatus === "sent"
              ? "message.edit"
              : "ghost.edit",
          messageId: editingId,
          message: trimmedText,
        }),
      );
      stopTyping();
      return;
    }
    socket.send(
      JSON.stringify({
        type: ghost ? "ghost.create" : "message.send",
        receiverId: selectedUser.id,
        message: trimmedText,
        replyToMessageId: replyId,
      }),
    );
    stopTyping();
    if (ghost) {
      ghostCreatingRef.current = selectedUser.id;
      setGhostCreating(true);
      return;
    }
    setText("");
    setReplyId(null);
    setConnectionError(null);
  };
  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pendingAttachment) void uploadCurrentAttachment();
    else sendCurrentMessage();
  };

  const closeFriendManager = useCallback(() => {
    setIsFriendManagerOpen(false);
  }, []);

  const toggleFavorite = async (friend: ChatFriend) => {
    if (!apiBaseUrl) return;
    const favorite = !friend.favorite;
    setFriends((current) =>
      current
        .map((item) => (item.id === friend.id ? { ...item, favorite } : item))
        .sort((a, b) => Number(b.favorite) - Number(a.favorite)),
    );
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/friends/${friend.id}/favorite`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ favorite }),
        },
      );
      if (!response.ok) throw new Error();
    } catch {
      setConnectionError("Favorite preference could not be saved.");
      void loadFriends();
    }
  };

  const cancelComposerAction = () => {
    if (pendingEditRef.current) return;
    stopTyping();
    if (editingId) setText("");
    setEditingId(null);
    setReplyId(null);
    setGroupEditingId(null);
    setGroupReplyId(null);
  };
  const startReply = (message: PrivateMessage) => {
    if (pendingEditRef.current) return;
    if (editingId) setText("");
    clearPendingAttachment();
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
    clearPendingAttachment();
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
    const ghost = message.messageStatus !== "sent";
    if (
      !window.confirm(
        ghost
          ? "Delete this private ghost? Your friend has never seen it."
          : "Delete this message for everyone?",
      )
    )
      return;
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return;
    pendingDeleteRef.current = message.id;
    setDeletingId(message.id);
    socket.send(
      JSON.stringify({
        type: ghost ? "ghost.delete" : "message.delete",
        messageId: message.id,
      }),
    );
  };
  const sendGhostCommand = (command: GhostCommand) => {
    const socket = socketRef.current;
    if (ghostBusyRef.current || socket?.readyState !== WebSocket.OPEN) return;
    if (
      command.type === "ghost.release" &&
      settings.confirmGhostRelease &&
      !window.confirm("Release this Ghost message now?")
    )
      return;
    ghostBusyRef.current = command.messageId;
    setGhostBusyId(command.messageId);
    socket.send(JSON.stringify(command));
  };
  const startGroupReply = (message: GroupMessage) => {
    clearPendingAttachment();
    setGroupEditingId(null);
    setGroupReplyId(message.id);
    setText("");
  };
  const startGroupEdit = (message: GroupMessage) => {
    if (message.senderId !== currentUser.id || message.deletedAt) return;
    clearPendingAttachment();
    setGroupReplyId(null);
    setGroupEditingId(message.id);
    setText(message.messageText);
  };
  const deleteGroupMessage = (message: GroupMessage) => {
    if (
      message.senderId !== currentUser.id ||
      message.deletedAt ||
      !window.confirm("Delete this group message for everyone?")
    )
      return;
    socketRef.current?.send(
      JSON.stringify({ type: "group.message.delete", messageId: message.id }),
    );
  };
  const updateGroupTyping = (value: string) => {
    if (
      !settings.showTypingIndicator ||
      !selectedGroup ||
      socketRef.current?.readyState !== WebSocket.OPEN
    )
      return;
    socketRef.current.send(
      JSON.stringify({ type: "group.typing.start", groupId: selectedGroup.id }),
    );
    if (groupTypingTimerRef.current) clearTimeout(groupTypingTimerRef.current);
    groupTypingTimerRef.current = setTimeout(
      () =>
        socketRef.current?.send(
          JSON.stringify({
            type: "group.typing.stop",
            groupId: selectedGroup.id,
          }),
        ),
      1200,
    );
  };
  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing ||
      !settings.enterToSend
    )
      return;
    event.preventDefault();
    if (pendingAttachment) void uploadCurrentAttachment();
    else sendCurrentMessage();
  };
  const showMobileChatList = () => {
    stopTyping();
    if (
      selectedGroupIdRef.current &&
      socketRef.current?.readyState === WebSocket.OPEN
    )
      socketRef.current.send(
        JSON.stringify({
          type: "group.typing.stop",
          groupId: selectedGroupIdRef.current,
        }),
      );
    if (groupTypingTimerRef.current) {
      clearTimeout(groupTypingTimerRef.current);
      groupTypingTimerRef.current = null;
    }
    selectedUserIdRef.current = null;
    selectedGroupIdRef.current = null;
    setSelectedUserId(null);
    setSelectedGroupId(null);
    setMessages([]);
    setGroupMessages([]);
    setGroupTypingUsers({});
    setText("");
    clearPendingAttachment();
    setLinkEntryOpen(false);
    setReplyId(null);
    setEditingId(null);
    setGroupReplyId(null);
    setGroupEditingId(null);
    setHistoryError(null);
  };
  const groupReply = groupMessages.find(
      (message) => message.id === groupReplyId,
    ),
    groupEditing = groupMessages.find(
      (message) => message.id === groupEditingId,
    );

  const displayedError = friendsError ?? historyError ?? connectionError;

  return (
    <AuthenticatedAppShell className="chat-shell">
      <div
        className={`chat-layout${selectedUser || selectedGroup ? " mobile-conversation-active" : ""}`}
      >
        <ConversationList
          username={currentUser.username}
          bio={currentUser.bio}
          avatarUrl={currentUser.avatarUrl}
          friends={displayedFriends}
          selectedUserId={selectedUserId}
          groups={groups}
          selectedGroupId={selectedGroupId}
          friendsLoading={friendsLoading}
          onSelectUser={selectUser}
          onManageFriends={() => setIsFriendManagerOpen(true)}
          onViewProfile={setProfileTarget}
          onToggleFavorite={(friend) => void toggleFavorite(friend)}
          onSelectGroup={selectGroup}
          onCreateGroup={() => {
            setGroupInfoTarget(null);
            setGroupManagerOpen(true);
          }}
        />
        <FriendManager
          isOpen={isFriendManagerOpen}
          onClose={closeFriendManager}
          onFriendsChanged={() => void loadFriends()}
        />
        <ProfileViewer
          user={profileTarget}
          onClose={() => setProfileTarget(null)}
        />
        <GroupManager
          isOpen={groupManagerOpen}
          group={groupInfoTarget}
          friends={displayedFriends}
          onClose={() => setGroupManagerOpen(false)}
          onChanged={(group, left) => {
            void loadGroups();
            if (group) selectGroup(group);
            if (left && groupInfoTarget?.id === selectedGroupIdRef.current) {
              selectedGroupIdRef.current = null;
              setSelectedGroupId(null);
              setGroupMessages([]);
              setGroupTypingUsers({});
            }
          }}
        />
        <VoiceCallOverlay
          call={voiceCall.view}
          onAccept={() => void voiceCall.acceptCall()}
          onReject={voiceCall.rejectCall}
          onEnd={voiceCall.endCall}
          onMute={voiceCall.toggleMute}
          onCamera={voiceCall.toggleCamera}
          onSpeaker={voiceCall.toggleSpeaker}
          onDismiss={voiceCall.dismissCall}
        />
        <ConversationPane>
          <ChatHeader
            selectedUser={selectedUser}
            selectedGroup={selectedGroup}
            selectedStatus={selectedStatus}
            selectedCustomStatus={selectedCustomStatus}
            connectionStatus={status}
            callActive={voiceCall.active}
            onBack={showMobileChatList}
            onOpenGroup={(group) => {
              setGroupInfoTarget(group);
              setGroupManagerOpen(true);
            }}
            onViewProfile={setProfileTarget}
            onStartCall={(callType) => {
              if (selectedUser)
                void voiceCall.startCall(
                  selectedUser,
                  selectedStatus !== "offline",
                  callType,
                );
            }}
          />

          <MessageList
            containerRef={messageAreaRef}
            label={selectedGroup ? "Group messages" : "Private messages"}
            hasNewMessages={hasNewMessages}
            onJumpToLatest={() => scrollToLatest()}
            onScroll={(event) => {
              const element = event.currentTarget;
              nearBottomRef.current =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                96;
              if (nearBottomRef.current) setHasNewMessages(false);
            }}
          >
            {!selectedUser && !selectedGroup ? (
              <div className="empty-state">
                <p>Select a chat to start messaging</p>
                <span>Choose a friend or group from the sidebar.</span>
              </div>
            ) : selectedGroup ? (
              historyLoading && groupMessages.length === 0 ? (
                <div className="empty-state">
                  <p>Loading group…</p>
                </div>
              ) : groupMessages.length === 0 ? (
                <div className="empty-state">
                  <p>No group messages yet</p>
                </div>
              ) : (
                groupMessages.map((message) => (
                  <GroupMessageBubble
                    key={message.id}
                    message={message}
                    currentUserId={currentUser.id}
                    disabled={status !== "Connected" || editPending}
                    onReply={startGroupReply}
                    onEdit={startGroupEdit}
                    onDelete={deleteGroupMessage}
                  />
                ))
              )
            ) : historyLoading && messages.length === 0 ? (
              <div className="empty-state">
                <p>Loading conversation…</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="empty-state">
                <p>No messages yet</p>
                <span>
                  Start a private conversation with {selectedUser!.username}.
                </span>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  currentUserId={currentUser.id}
                  friendName={selectedUser!.username}
                  showReceipt={message.id === lastOwnMessageId}
                  disabled={
                    status !== "Connected" ||
                    editPending ||
                    deletingId !== null ||
                    ghostBusyId !== null ||
                    ghostCreating
                  }
                  onReply={startReply}
                  onEdit={startEdit}
                  onDelete={deleteMessage}
                  onGhostCommand={sendGhostCommand}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </MessageList>

          <p className="chat-typing" role="status">
            {selectedGroup && Object.keys(groupTypingUsers).length
              ? `${Object.values(groupTypingUsers).slice(0, 2).join(" and ")}${Object.keys(groupTypingUsers).length > 2 ? " and others" : ""} ${Object.keys(groupTypingUsers).length === 1 ? "is" : "are"} typing…`
              : selectedUser && typingByUser[selectedUser.id]
                ? `${selectedUser.username} is typing…`
                : ""}
          </p>

          {displayedError ? (
            <p className="error-message" role="alert">
              {displayedError}
            </p>
          ) : null}

          <MessageComposer
            editing={Boolean(editingId || groupEditingId)}
            onSubmit={sendMessage}
          >
            {pendingAttachment ? (
              <div className="composer-attachment-preview" role="status">
                {pendingAttachment.kind === "image" &&
                pendingAttachment.previewUrl ? (
                  <img
                    src={pendingAttachment.previewUrl}
                    alt={`Preview ${pendingAttachment.file.name}`}
                  />
                ) : (
                  <span className="composer-attachment-icon" aria-hidden="true">
                    {pendingAttachment.kind === "file" ? "📎" : "📍"}
                  </span>
                )}
                <div>
                  <strong>
                    {pendingAttachment.kind === "location"
                      ? "Current location"
                      : pendingAttachment.file.name}
                  </strong>
                  <small>
                    {pendingAttachment.kind === "location"
                      ? `${pendingAttachment.latitude.toFixed(5)}, ${pendingAttachment.longitude.toFixed(5)}`
                      : `${(pendingAttachment.file.size / 1024).toFixed(1)} KB`}
                  </small>
                  {uploadingAttachment ? (
                    <span className="upload-progress">
                      <span style={{ width: `${uploadProgress}%` }} />
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Cancel attachment"
                  disabled={uploadingAttachment}
                  onClick={clearPendingAttachment}
                >
                  ×
                </button>
              </div>
            ) : null}
            {linkEntryOpen ? (
              <div className="composer-link-entry">
                <label>
                  <span>Paste a link</span>
                  <input
                    autoFocus
                    type="url"
                    inputMode="url"
                    value={linkValue}
                    placeholder="https://example.com"
                    onChange={(event) => setLinkValue(event.target.value)}
                  />
                </label>
                <button type="button" onClick={addLinkToComposer}>
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLinkEntryOpen(false);
                    setLinkValue("");
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : null}
            {replyId || editingId || groupReplyId || groupEditingId ? (
              <div className="composer-context" role="status">
                <div>
                  <strong>
                    {editingId || groupEditingId
                      ? "Editing message"
                      : "Replying to " +
                        (replyMessage?.senderId === currentUser.id
                          ? "yourself"
                          : selectedGroup
                            ? groupReply?.senderUsername
                            : selectedUser?.username)}
                  </strong>
                  <span>
                    {editingId || groupEditingId
                      ? (editingMessage?.messageText ??
                        groupEditing?.messageText)
                      : replyMessage?.deletedAt
                        ? "This message was deleted"
                        : (replyMessage?.messageText ??
                          (groupReply?.deletedAt
                            ? "This message was deleted"
                            : groupReply?.messageText))}
                  </span>
                </div>
                <button
                  type="button"
                  className="composer-cancel"
                  disabled={editPending}
                  onClick={cancelComposerAction}
                  aria-label={
                    editingId || groupEditingId
                      ? "Cancel editing"
                      : "Cancel reply"
                  }
                >
                  ×
                </button>
              </div>
            ) : null}
            {!editingId && !groupEditingId ? (
              <div className="attachment-menu-wrap">
                <button
                  className="attachment-menu-button"
                  type="button"
                  aria-label="Add attachment"
                  aria-expanded={attachmentMenuOpen}
                  disabled={
                    (!selectedUser && !selectedGroup) ||
                    uploadingAttachment ||
                    ghostCreating
                  }
                  onClick={() => setAttachmentMenuOpen((open) => !open)}
                >
                  +
                </button>
                {attachmentMenuOpen ? (
                  <div className="attachment-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      🖼 Photo
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      📎 File
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setLinkEntryOpen(true);
                        setAttachmentMenuOpen(false);
                      }}
                    >
                      🔗 Link
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      disabled={locating}
                      onClick={requestCurrentLocation}
                    >
                      📍 {locating ? "Locating…" : "Location"}
                    </button>
                  </div>
                ) : null}
                <input
                  ref={photoInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(event) => chooseAttachment(event, "image")}
                />
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  accept=".pdf,.txt,.csv,.zip,.docx,.xlsx,.pptx"
                  onChange={(event) => chooseAttachment(event, "file")}
                />
              </div>
            ) : null}
            <label className="field message-field">
              <span>
                {selectedGroup
                  ? `Message ${selectedGroup.name}`
                  : selectedUser
                    ? `Message ${selectedUser.username}`
                    : "Select a friend to start chatting"}
              </span>
              <textarea
                rows={1}
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  if (selectedGroup) updateGroupTyping(event.target.value);
                  else if (selectedUser)
                    updateTyping(selectedUser.id, event.target.value);
                }}
                onBlur={() => {
                  if (selectedGroup)
                    socketRef.current?.send(
                      JSON.stringify({
                        type: "group.typing.stop",
                        groupId: selectedGroup.id,
                      }),
                    );
                  else stopTyping();
                }}
                onKeyDown={handleComposerKeyDown}
                placeholder={
                  selectedGroup
                    ? "Type a group message…"
                    : selectedUser
                      ? "Type a private message…"
                      : "Select a friend first"
                }
                maxLength={1_000}
                disabled={
                  (!selectedUser && !selectedGroup) ||
                  editPending ||
                  ghostCreating ||
                  uploadingAttachment
                }
              />
            </label>
            {!editingId && !groupEditingId ? (
              <button
                type="button"
                className="ghost-create-button"
                aria-label={
                  ghostCreating
                    ? "Creating Ghost message"
                    : "Create Ghost message — only you can see it"
                }
                title="Create Ghost message — only you can see it"
                disabled={
                  status !== "Connected" ||
                  !selectedUser ||
                  selectedGroup !== null ||
                  !text.trim() ||
                  ghostCreating ||
                  pendingAttachment !== null ||
                  uploadingAttachment
                }
                onClick={() => sendCurrentMessage(true)}
              >
                <span aria-hidden="true">{ghostCreating ? "…" : "👻"}</span>
              </button>
            ) : null}
            <button
              type="submit"
              className="composer-send"
              aria-label={
                editingId || groupEditingId ? "Save message" : "Send message"
              }
              title={
                editingId || groupEditingId ? "Save message" : "Send message"
              }
              disabled={
                status !== "Connected" ||
                (!selectedUser && !selectedGroup) ||
                (!text.trim() && !pendingAttachment) ||
                editPending ||
                ghostCreating ||
                uploadingAttachment
              }
            >
              {editPending || uploadingAttachment ? (
                "…"
              ) : editingId || groupEditingId ? (
                "Save"
              ) : (
                <span aria-hidden="true">➤</span>
              )}
            </button>
          </MessageComposer>
        </ConversationPane>
      </div>
    </AuthenticatedAppShell>
  );
}
