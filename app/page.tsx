"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type ConnectionStatus = "Connecting" | "Connected" | "Disconnected";

type ChatMessage = {
  id: string;
  name: string;
  text: string;
  createdAt: string;
};

type ServerMessage =
  | {
      type: "message.new";
      data: ChatMessage;
    }
  | {
      type: "error";
      data: {
        message: string;
      };
    };

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
  ) {
    return null;
  }

  return {
    id: value.id,
    name: value.name,
    text: value.text,
    createdAt: value.createdAt,
  };
};

const mergeMessages = (
  currentMessages: ChatMessage[],
  incomingMessages: ChatMessage[],
): ChatMessage[] => {
  const messagesById = new Map(
    currentMessages.map((message) => [message.id, message]),
  );

  for (const message of incomingMessages) {
    messagesById.set(message.id, message);
  }

  return [...messagesById.values()].sort((left, right) => {
    const dateComparison = left.createdAt.localeCompare(right.createdAt);

    if (dateComparison !== 0) {
      return dateComparison;
    }

    return left.id.length - right.id.length || left.id.localeCompare(right.id);
  });
};

const parseServerMessage = (rawValue: string): ServerMessage | null => {
  try {
    const value: unknown = JSON.parse(rawValue);

    if (!isRecord(value) || !isRecord(value.data)) {
      return null;
    }

    if (value.type === "message.new") {
      const message = parseChatMessage(value.data);

      if (!message) {
        return null;
      }

      return {
        type: "message.new",
        data: message,
      };
    }

    if (value.type === "error" && typeof value.data.message === "string") {
      return {
        type: "error",
        data: { message: value.data.message },
      };
    }

    return null;
  } catch {
    return null;
  }
};

export default function Home() {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("Connecting");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const requestController = new AbortController();

    const loadMessageHistory = async () => {
      if (!apiBaseUrl) {
        setError("NEXT_PUBLIC_API_URL is not configured.");
        return;
      }

      try {
        const response = await fetch(`${apiBaseUrl}/api/messages`, {
          signal: requestController.signal,
        });

        if (!response.ok) {
          throw new Error(
            `History request failed with status ${response.status}`,
          );
        }

        const value: unknown = await response.json();

        if (!isRecord(value) || !Array.isArray(value.messages)) {
          throw new Error("History response has an invalid format");
        }

        const history = value.messages.map(parseChatMessage);

        if (history.some((message) => message === null)) {
          throw new Error("History response contains an invalid message");
        }

        setMessages((currentMessages) =>
          mergeMessages(currentMessages, history as ChatMessage[]),
        );
      } catch (requestError) {
        if (
          requestError instanceof Error &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError("Message history could not be loaded.");
      }
    };

    void loadMessageHistory();

    if (!websocketUrl) {
      setStatus("Disconnected");
      setError("NEXT_PUBLIC_WS_URL is not configured.");
      return () => requestController.abort();
    }

    setStatus("Connecting");
    const socket = new WebSocket(websocketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus("Connected");
      setError(null);
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      const message = parseServerMessage(event.data);

      if (!message) {
        return;
      }

      if (message.type === "error") {
        setError(message.data.message);
        return;
      }

      setMessages((currentMessages) =>
        mergeMessages(currentMessages, [message.data]),
      );
    };

    socket.onerror = () => {
      setError("WebSocket connection failed.");
    };

    socket.onclose = () => {
      setStatus("Disconnected");
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };

    return () => {
      requestController.abort();
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const socket = socketRef.current;
    const trimmedName = name.trim();
    const trimmedText = text.trim();

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError("WebSocket is not connected.");
      return;
    }

    if (!trimmedName || !trimmedText) {
      setError("Name and message are required.");
      return;
    }

    socket.send(
      JSON.stringify({
        type: "message.send",
        data: {
          name: trimmedName,
          text: trimmedText,
        },
      }),
    );
    setText("");
    setError(null);
  };

  return (
    <main className="chat-shell">
      <section className="chat-card" aria-labelledby="chat-title">
        <header className="chat-header">
          <div>
            <p className="eyebrow">Step 2</p>
            <h1 id="chat-title">Realtime Chat</h1>
          </div>
          <div className={`status status-${status.toLowerCase()}`}>
            <span aria-hidden="true" />
            {status}
          </div>
        </header>

        <label className="field name-field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nichaphon"
            maxLength={50}
            autoComplete="name"
          />
        </label>

        <div className="messages" aria-live="polite" aria-label="Chat messages">
          {messages.length === 0 ? (
            <div className="empty-state">
              <p>No messages yet</p>
              <span>Open this page in another tab and say hello.</span>
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

        {error ? <p className="error-message">{error}</p> : null}

        <form className="message-form" onSubmit={sendMessage}>
          <label className="field message-field">
            <span>Message</span>
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
            disabled={status !== "Connected" || !name.trim() || !text.trim()}
          >
            Send
          </button>
        </form>
      </section>
    </main>
  );
}
