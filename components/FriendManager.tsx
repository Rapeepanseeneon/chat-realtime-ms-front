"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { FriendRequest, FriendSearchResult } from "../lib/chat-types";
import { getApiBaseUrl } from "../lib/runtime-config";

type FriendManagerProps = {
  isOpen: boolean;
  onClose: () => void;
  onFriendsChanged: () => void;
};

const apiBaseUrl = getApiBaseUrl();
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readError = async (response: Response, fallback: string) => {
  try {
    const value: unknown = await response.json();
    return isRecord(value) && typeof value.error === "string"
      ? value.error
      : fallback;
  } catch {
    return fallback;
  }
};

const parseSearchResult = (value: unknown): FriendSearchResult | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.username !== "string" ||
    !["none", "outgoing_pending", "incoming_pending", "friends"].includes(
      String(value.relationship),
    )
  ) {
    return null;
  }
  return {
    id: value.id,
    username: value.username,
    avatarUrl: typeof value.avatarUrl === "string" ? value.avatarUrl : null,
    bio: typeof value.bio === "string" ? value.bio : "",
    relationship: value.relationship as FriendSearchResult["relationship"],
  };
};

const parseFriendRequest = (value: unknown): FriendRequest | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    !isRecord(value.sender) ||
    typeof value.sender.id !== "string" ||
    typeof value.sender.username !== "string"
  ) {
    return null;
  }
  return {
    id: value.id,
    sender: {
      id: value.sender.id,
      username: value.sender.username,
      avatarUrl:
        typeof value.sender.avatarUrl === "string"
          ? value.sender.avatarUrl
          : null,
      bio: typeof value.sender.bio === "string" ? value.sender.bio : "",
    },
    createdAt: value.createdAt,
  };
};

export function FriendManager({
  isOpen,
  onClose,
  onFriendsChanged,
}: FriendManagerProps) {
  const router = useRouter();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FriendSearchResult[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searching, setSearching] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!apiBaseUrl) {
      setError("NEXT_PUBLIC_API_URL is not configured.");
      return;
    }
    setRequestsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/friend-requests`, {
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(
          await readError(response, "Friend requests could not be loaded."),
        );
      }
      const value: unknown = await response.json();
      if (!isRecord(value) || !Array.isArray(value.requests)) {
        throw new Error("Invalid friend requests response.");
      }
      const parsed = value.requests.map(parseFriendRequest);
      if (parsed.some((request) => request === null)) {
        throw new Error("Invalid friend request in response.");
      }
      setRequests(parsed as FriendRequest[]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Friend requests could not be loaded.",
      );
    } finally {
      setRequestsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    void loadRequests();
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loadRequests, onClose]);

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedQuery = query.trim();
    if (!trimmedQuery || !apiBaseUrl) return;
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/friends/search?q=${encodeURIComponent(trimmedQuery)}`,
        { credentials: "include" },
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(await readError(response, "User search failed."));
      }
      const value: unknown = await response.json();
      if (!isRecord(value) || !Array.isArray(value.users)) {
        throw new Error("Invalid user search response.");
      }
      const parsed = value.users.map(parseSearchResult);
      if (parsed.some((user) => user === null)) {
        throw new Error("Invalid user in search response.");
      }
      setResults(parsed as FriendSearchResult[]);
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "User search failed.",
      );
    } finally {
      setSearching(false);
    }
  };

  const addFriend = async (userId: string) => {
    if (!apiBaseUrl || addingUserId) return;
    setAddingUserId(userId);
    setError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/friend-requests`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: userId }),
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(
          await readError(response, "Friend request could not be sent."),
        );
      }
      setResults((current) =>
        current.map((user) =>
          user.id === userId
            ? { ...user, relationship: "outgoing_pending" }
            : user,
        ),
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Friend request could not be sent.",
      );
    } finally {
      setAddingUserId(null);
    }
  };

  const respond = async (requestId: string, action: "accept" | "reject") => {
    if (!apiBaseUrl || updatingRequestId) return;
    const senderId = requests.find((request) => request.id === requestId)
      ?.sender.id;
    setUpdatingRequestId(requestId);
    setError(null);
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/friend-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      if (!response.ok) {
        throw new Error(
          await readError(response, "Friend request could not be updated."),
        );
      }
      setRequests((current) =>
        current.filter((request) => request.id !== requestId),
      );
      if (senderId) {
        setResults((current) =>
          current.map((user) =>
            user.id === senderId
              ? {
                  ...user,
                  relationship: action === "accept" ? "friends" : "none",
                }
              : user,
          ),
        );
      }
      if (action === "accept") onFriendsChanged();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Friend request could not be updated.",
      );
    } finally {
      setUpdatingRequestId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="friend-dialog-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="friend-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-dialog-title"
      >
        <header className="friend-dialog-header">
          <div>
            <p className="eyebrow">Your network</p>
            <h2 id="friend-dialog-title">Find friends</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="friend-dialog-close"
            type="button"
            aria-label="Close friend manager"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <form className="friend-search-form" onSubmit={search}>
          <label htmlFor="friend-search">Username or email</label>
          <div>
            <input
              id="friend-search"
              type="search"
              value={query}
              maxLength={254}
              placeholder="Search username or exact email"
              onChange={(event) => setQuery(event.target.value)}
            />
            <button type="submit" disabled={searching || !query.trim()}>
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
        </form>

        {results.length > 0 ? (
          <div className="friend-results" aria-label="Search results">
            {results.map((user) => (
              <div className="friend-person-row" key={user.id}>
                <span className="sidebar-contact-avatar" aria-hidden="true">
                  {user.username.charAt(0).toLocaleUpperCase() || "P"}
                </span>
                <strong>{user.username}</strong>
                {user.relationship === "none" ? (
                  <button
                    type="button"
                    disabled={addingUserId !== null}
                    onClick={() => void addFriend(user.id)}
                  >
                    {addingUserId === user.id ? "Sending…" : "Add Friend"}
                  </button>
                ) : (
                  <span className="friend-relationship">
                    {user.relationship === "friends"
                      ? "Friends"
                      : user.relationship === "incoming_pending"
                        ? "Awaiting your response"
                        : "Request sent"}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : query.trim() && !searching ? (
          <p className="friend-empty">No matching users yet.</p>
        ) : null}

        <div className="friend-requests-heading">
          <h3>Friend Requests</h3>
          <button type="button" onClick={() => void loadRequests()}>
            Refresh
          </button>
        </div>
        <div className="friend-requests-list">
          {requestsLoading ? (
            <p className="friend-empty">Loading requests…</p>
          ) : requests.length === 0 ? (
            <p className="friend-empty">No pending friend requests.</p>
          ) : (
            requests.map((request) => (
              <div className="friend-person-row" key={request.id}>
                <span className="sidebar-contact-avatar" aria-hidden="true">
                  {request.sender.username.charAt(0).toLocaleUpperCase() || "P"}
                </span>
                <strong>{request.sender.username}</strong>
                <div className="friend-request-actions">
                  <button
                    className="friend-reject-button"
                    type="button"
                    disabled={updatingRequestId !== null}
                    onClick={() => void respond(request.id, "reject")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={updatingRequestId !== null}
                    onClick={() => void respond(request.id, "accept")}
                  >
                    {updatingRequestId === request.id ? "Saving…" : "Accept"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {error ? (
          <p className="form-message form-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
