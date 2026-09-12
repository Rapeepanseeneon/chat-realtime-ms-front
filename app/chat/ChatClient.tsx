"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

type ConnectionStatus = "Connecting" | "Connected" | "Disconnected";
type ChatMessage = {
  id: string;
  name: string;
  text: string;
  createdAt: string;
};
type ServerMessage =
  | { type: "message.new"; data: ChatMessage }
  | { type: "error"; data: { message: string } };

const websocketUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseChatMessage = (value: unknown): ChatMessage | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.text !== "string" ||
    typeof value.createdAt !== "string"
  )
    return null;
  return {
    id: value.id,
    name: value.name,
    text: value.text,
    createdAt: value.createdAt,
  };
};

const mergeMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.length - right.id.length ||
      left.id.localeCompare(right.id),
  );
};

const parseServerMessage = (raw: string): ServerMessage | null => {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || !isRecord(value.data)) return null;
    if (value.type === "message.new") {
      const message = parseChatMessage(value.data);
      return message ? { type: "message.new", data: message } : null;
    }
    if (value.type === "error" && typeof value.data.message === "string") {
      return { type: "error", data: { message: value.data.message } };
    }
    return null;
  } catch {
    return null;
  }
};

export function ChatClient({ username }: { username: string }) {
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("Connecting");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadHistory = async () => {
      if (!apiBaseUrl)
        return setError("NEXT_PUBLIC_API_URL is not configured.");
      try {
        const response = await fetch(`${apiBaseUrl}/api/messages`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(`History request failed: ${response.status}`);
        const value: unknown = await response.json();
        if (!isRecord(value) || !Array.isArray(value.messages))
          throw new Error("Invalid history response");
        const history = value.messages.map(parseChatMessage);
        if (history.some((message) => message === null))
          throw new Error("Invalid message in history");
        setMessages((current) =>
          mergeMessages(current, history as ChatMessage[]),
        );
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === "AbortError")
          return;
        setError("Message history could not be loaded.");
      }
    };
    void loadHistory();

    if (!websocketUrl) {
      setStatus("Disconnected");
      setError("NEXT_PUBLIC_WS_URL is not configured.");
      return () => controller.abort();
    }
    const socket = new WebSocket(websocketUrl);
    socketRef.current = socket;
    socket.onopen = () => {
      setStatus("Connected");
      setError(null);
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      const message = parseServerMessage(event.data);
      if (!message) return;
      if (message.type === "error") return setError(message.data.message);
      setMessages((current) => mergeMessages(current, [message.data]));
    };
    socket.onerror = () => setError("WebSocket connection failed.");
    socket.onclose = () => {
      setStatus("Disconnected");
      if (socketRef.current === socket) socketRef.current = null;
    };
    return () => {
      controller.abort();
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, []);

  useEffect(
    () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
    [messages],
  );

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const socket = socketRef.current;
    const trimmedText = text.trim();
    if (!socket || socket.readyState !== WebSocket.OPEN)
      return setError("WebSocket is not connected.");
    if (!trimmedText) return setError("Message is required.");
    socket.send(
      JSON.stringify({ type: "message.send", data: { text: trimmedText } }),
    );
    setText("");
    setError(null);
  };

  return (
    <main className="chat-shell">
      <section className="chat-card" aria-labelledby="chat-title">
        <header className="chat-header">
          <div>
            <Link className="back-link" href="/">
              ← Home
            </Link>
            <p className="eyebrow">Pb Messenger · {username}</p>
            <h1 id="chat-title">Realtime Chat</h1>
          </div>
          <div className={`status status-${status.toLowerCase()}`}>
            <span aria-hidden="true" />
            {status}
          </div>
        </header>
        <div className="messages" aria-live="polite" aria-label="Chat messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>No messages yet</p>
              <span>Be the first to say hello.</span>
            </div>
          ) : (
            messages.map((message) => (
              <article className="message" key={message.id}>
                <div className="message-meta">
                  <strong>{message.name}</strong>
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                <p>{message.text}</p>
              </article>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        {error ? (
          <p className="error-message" role="alert">
            {error}
          </p>
        ) : null}
        <form className="message-form" onSubmit={sendMessage}>
          <label className="field message-field">
            <span>Message as {username}</span>
            <input
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Type a message…"
              maxLength={1_000}
            />
          </label>
          <button
            type="submit"
            disabled={status !== "Connected" || !text.trim()}
          >
            Send
          </button>
        </form>
      </section>
    </main>
  );
}
