"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ChatSidebar } from "../../components/ChatSidebar";
import type { ChatUser, PrivateMessage } from "../../lib/chat-types";

type ConnectionStatus = "Connecting" | "Connected" | "Disconnected";
type ServerMessage =
  | { type: "message.new"; message: PrivateMessage }
  | { type: "error"; data: { message: string } };

type ChatClientProps = {
  currentUser: {
    id: string;
    username: string;
    email: string;
  };
};

const websocketUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseChatUser = (value: unknown): ChatUser | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.username !== "string"
  ) {
    return null;
  }
  return { id: value.id, username: value.username };
};

const parsePrivateMessage = (value: unknown): PrivateMessage | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.senderId !== "string" ||
    typeof value.receiverId !== "string" ||
    typeof value.messageText !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    senderId: value.senderId,
    receiverId: value.receiverId,
    messageText: value.messageText,
    createdAt: value.createdAt,
  };
};

const parseServerMessage = (raw: string): ServerMessage | null => {
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
    ) {
      return { type: "error", data: { message: value.data.message } };
    }
    return null;
  } catch {
    return null;
  }
};

const mergeMessages = (
  current: PrivateMessage[],
  incoming: PrivateMessage[],
) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.length - right.id.length ||
      left.id.localeCompare(right.id),
  );
};

export function ChatClient({ currentUser }: ChatClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("Connecting");
  const [usersLoading, setUsersLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const selectedUser =
    users.find((user) => user.id === selectedUserId) ?? null;

  useEffect(() => {
    const controller = new AbortController();
    const loadUsers = async () => {
      if (!apiBaseUrl) {
        setUsersError("NEXT_PUBLIC_API_URL is not configured.");
        setUsersLoading(false);
        return;
      }
      try {
        const response = await fetch(`${apiBaseUrl}/api/users`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error(`Users request failed: ${response.status}`);
        const value: unknown = await response.json();
        if (!isRecord(value) || !Array.isArray(value.users)) {
          throw new Error("Invalid users response");
        }
        const parsedUsers = value.users.map(parseChatUser);
        if (parsedUsers.some((user) => user === null)) {
          throw new Error("Invalid user in response");
        }
        setUsers(parsedUsers as ChatUser[]);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setUsersError("Users could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setUsersLoading(false);
      }
    };
    void loadUsers();
    return () => {
      controller.abort();
    };
  }, [router]);

  useEffect(() => {
    if (!websocketUrl) {
      setStatus("Disconnected");
      setConnectionError("NEXT_PUBLIC_WS_URL is not configured.");
      return;
    }
    const socket = new WebSocket(websocketUrl);
    socketRef.current = socket;
    socket.onopen = () => {
      setStatus("Connected");
      setConnectionError(null);
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      const serverMessage = parseServerMessage(event.data);
      if (!serverMessage) return;
      if (serverMessage.type === "error") {
        setConnectionError(serverMessage.data.message);
        return;
      }

      const activeUserId = selectedUserIdRef.current;
      const message = serverMessage.message;
      const belongsToActiveConversation =
        activeUserId !== null &&
        ((message.senderId === currentUser.id &&
          message.receiverId === activeUserId) ||
          (message.senderId === activeUserId &&
            message.receiverId === currentUser.id));

      if (belongsToActiveConversation) {
        setMessages((current) => mergeMessages(current, [message]));
      }
    };
    socket.onerror = () => {
      setConnectionError("WebSocket connection failed.");
    };
    socket.onclose = () => {
      setStatus("Disconnected");
      if (socketRef.current === socket) socketRef.current = null;
    };
    return () => {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [currentUser.id]);

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
        setMessages((current) =>
          mergeMessages(current, history as PrivateMessage[]),
        );
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError") return;
        setHistoryError("Message history could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false);
      }
    };
    void loadHistory();
    return () => {
      controller.abort();
    };
  }, [router, selectedUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectUser = (user: ChatUser) => {
    selectedUserIdRef.current = user.id;
    setSelectedUserId(user.id);
    setMessages([]);
    setText("");
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
    socket.send(
      JSON.stringify({
        type: "message.send",
        receiverId: selectedUser.id,
        message: trimmedText,
      }),
    );
    setText("");
    setConnectionError(null);
  };

  const displayedError = usersError ?? historyError ?? connectionError;

  return (
    <main className="chat-shell">
      <div className="chat-layout">
        <ChatSidebar
          username={currentUser.username}
          email={currentUser.email}
          users={users}
          selectedUserId={selectedUserId}
          usersLoading={usersLoading}
          onSelectUser={selectUser}
        />
        <div className="chat-main">
          <section className="chat-card" aria-labelledby="chat-title">
            <header className="chat-header">
              <div className="chat-title-block">
                <p className="eyebrow">Private conversation</p>
                <h1 id="chat-title">
                  {selectedUser?.username ?? "Private Chat"}
                </h1>
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
                  <p>Select a user to start chatting</p>
                  <span>Choose someone from the sidebar.</span>
                </div>
              ) : historyLoading && messages.length === 0 ? (
                <div className="empty-state">
                  <p>Loading conversation…</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="empty-state">
                  <p>No messages yet</p>
                  <span>Start a private conversation with {selectedUser.username}.</span>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.senderId === currentUser.id;
                  return (
                    <article
                      className={`message private-message ${isOwnMessage ? "private-message-own" : "private-message-other"}`}
                      key={message.id}
                    >
                      <div className="message-meta">
                        <strong>
                          {isOwnMessage ? "You" : selectedUser.username}
                        </strong>
                        <time dateTime={message.createdAt}>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <p>{message.messageText}</p>
                    </article>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {displayedError ? (
              <p className="error-message" role="alert">
                {displayedError}
              </p>
            ) : null}

            <form className="message-form" onSubmit={sendMessage}>
              <label className="field message-field">
                <span>
                  {selectedUser
                    ? `Message ${selectedUser.username}`
                    : "Select a user to start chatting"}
                </span>
                <input
                  type="text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={
                    selectedUser ? "Type a private message…" : "Select a user first"
                  }
                  maxLength={1_000}
                  disabled={!selectedUser}
                />
              </label>
              <button
                type="submit"
                disabled={
                  status !== "Connected" || !selectedUser || !text.trim()
                }
              >
                Send
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
