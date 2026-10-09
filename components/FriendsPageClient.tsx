"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  FriendPageFriend,
  FriendSearchUser,
  FriendSuggestion,
  ReceivedRequest,
  SentRequest,
} from "../lib/friends-types";
import { getApiBaseUrl } from "../lib/runtime-config";
import { collectCursorPages } from "../lib/cursor-pagination";
import { UserAvatar } from "./UserAvatar";

type Overview = {
  friends: FriendPageFriend[];
  received: ReceivedRequest[];
  sent: SentRequest[];
  suggestions: FriendSuggestion[];
};

const emptyOverview: Overview = {
  friends: [],
  received: [],
  sent: [],
  suggestions: [],
};

async function responseJson<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok)
    throw new Error(value.error ?? "Something went wrong. Please try again.");
  return value;
}

export function FriendsPageClient() {
  const router = useRouter();
  const loadRevisionRef = useRef(0);
  const [overview, setOverview] = useState(emptyOverview);
  const [searchResults, setSearchResults] = useState<FriendSearchUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const api = getApiBaseUrl();
    if (!api) return;
    setLoading(true);
    const revision = ++loadRevisionRef.current;
    try {
      const options = { credentials: "include" as const };
      const loadAll = async <T extends { id: string }>(
        path: string,
        key: "friends" | "requests",
      ) =>
        collectCursorPages<T>(
          async (cursor) => {
            const query = new URLSearchParams({ limit: "100" });
            if (cursor) query.set("cursor", cursor);
            const response = await fetch(
              `${api}${path}?${query.toString()}`,
              options,
            );
            if (response.status === 401) {
              router.replace("/login");
              throw new DOMException("Unauthorized", "AbortError");
            }
            const value = await responseJson<{
              friends?: T[];
              requests?: T[];
              hasMore: boolean;
              nextCursor: string | null;
            }>(response);
            const items = value[key];
            if (
              !Array.isArray(items) ||
              typeof value.hasMore !== "boolean" ||
              !(
                typeof value.nextCursor === "string" ||
                value.nextCursor === null
              )
            )
              throw new Error("Invalid paginated list response.");
            return {
              items,
              hasMore: value.hasMore,
              nextCursor: value.nextCursor,
            };
          },
          () => revision === loadRevisionRef.current,
        );
      const [friends, received, sent, suggestionsResponse] = await Promise.all([
        loadAll<FriendPageFriend>("/api/friends", "friends"),
        loadAll<ReceivedRequest>("/api/friend-requests", "requests"),
        loadAll<SentRequest>("/api/friend-requests/sent", "requests"),
        fetch(`${api}/api/friends/suggestions`, options),
      ]);
      if (suggestionsResponse.status === 401) {
        router.replace("/login");
        return;
      }
      const suggestions = await responseJson<{ users: FriendSuggestion[] }>(
        suggestionsResponse,
      );
      if (
        revision !== loadRevisionRef.current ||
        !friends ||
        !received ||
        !sent
      )
        return;
      setOverview({
        friends,
        received,
        sent,
        suggestions: suggestions.users,
      });
      setError(null);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Friends could not be loaded.",
      );
    } finally {
      if (revision === loadRevisionRef.current) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const act = async (id: string, request: () => Promise<Response>) => {
    if (workingId) return;
    setWorkingId(id);
    setError(null);
    setNotice(null);
    try {
      const value = await responseJson<{ message?: string }>(await request());
      setNotice(value.message ?? "Done.");
      await loadOverview();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Action failed.",
      );
    } finally {
      setWorkingId(null);
    }
  };

  const respond = (requestId: string, action: "accept" | "reject") => {
    const api = getApiBaseUrl();
    if (!api) return;
    void act(requestId, () =>
      fetch(`${api}/api/friend-requests/${requestId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }),
    );
  };

  const addFriend = (userId: string) => {
    const api = getApiBaseUrl();
    if (!api) return;
    void act(userId, () =>
      fetch(`${api}/api/friend-requests`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiverId: userId }),
      }),
    );
  };

  const cancel = (requestId: string) => {
    const api = getApiBaseUrl();
    if (!api) return;
    void act(requestId, () =>
      fetch(`${api}/api/friend-requests/${requestId}`, {
        method: "DELETE",
        credentials: "include",
      }),
    );
  };

  const search = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = String(
      new FormData(event.currentTarget).get("query") ?? "",
    ).trim();
    if (!query) return;
    setError(null);
    try {
      const api = getApiBaseUrl();
      if (!api) return;
      const value = await responseJson<{ users: FriendSearchUser[] }>(
        await fetch(
          `${api}/api/friends/search?q=${encodeURIComponent(query)}`,
          {
            credentials: "include",
          },
        ),
      );
      setSearchResults(value.users);
    } catch (searchError) {
      setError(
        searchError instanceof Error ? searchError.message : "Search failed.",
      );
    }
  };

  const identity = (
    user: {
      id: string;
      username: string;
      displayName?: string;
      avatarUrl: string | null;
    },
    trailing?: React.ReactNode,
  ) => (
    <article className="friend-row" key={user.id}>
      <UserAvatar
        username={user.username}
        avatarUrl={user.avatarUrl}
        className="friend-row-avatar"
      />
      <div className="friend-row-copy">
        <strong>{user.displayName || user.username}</strong>
        <span>@{user.username}</span>
      </div>
      <div className="friend-row-actions">{trailing}</div>
    </article>
  );

  return (
    <div className="friends-page-content">
      <header className="friends-hero">
        <div>
          <p className="eyebrow">Your circle</p>
          <h1>Friends</h1>
          <p>Find people, manage requests, and return to a conversation.</p>
        </div>
        <span className="friends-total">{overview.friends.length} friends</span>
      </header>
      {error ? (
        <p className="form-message form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="form-message form-success" role="status">
          {notice}
        </p>
      ) : null}

      <section
        className="friends-panel friends-search-panel"
        aria-labelledby="friend-search-title"
      >
        <div className="friends-panel-heading">
          <div>
            <p className="eyebrow">Search</p>
            <h2 id="friend-search-title">Find someone</h2>
          </div>
        </div>
        <form className="friends-search-form" onSubmit={search}>
          <input
            name="query"
            type="search"
            maxLength={254}
            placeholder="Username or email"
            aria-label="Search by username or email"
          />
          <button className="button button-primary" type="submit">
            Search
          </button>
        </form>
        {searchResults.length ? (
          <div className="friend-list">
            {searchResults.map((user) =>
              identity(
                user,
                user.relationship === "none" ? (
                  <button
                    disabled={workingId === user.id}
                    onClick={() => addFriend(user.id)}
                  >
                    Add friend
                  </button>
                ) : user.relationship === "incoming_pending" &&
                  user.requestId ? (
                  <button
                    disabled={workingId === user.requestId}
                    onClick={() => respond(user.requestId!, "accept")}
                  >
                    Accept
                  </button>
                ) : user.relationship === "friends" ? (
                  <Link href={`/chat?user=${user.id}`}>Message</Link>
                ) : (
                  <span className="relationship-label">Request sent</span>
                ),
              ),
            )}
          </div>
        ) : null}
      </section>

      <div className="friends-grid">
        <section
          className="friends-panel"
          aria-labelledby="current-friends-title"
        >
          <div className="friends-panel-heading">
            <div>
              <p className="eyebrow">Friends</p>
              <h2 id="current-friends-title">Your people</h2>
            </div>
          </div>
          {loading ? (
            <p className="friends-empty">Loading…</p>
          ) : overview.friends.length ? (
            <div className="friend-list">
              {overview.friends.map((friend) =>
                identity(
                  friend,
                  <>
                    <Link
                      href={`/profile/${encodeURIComponent(friend.username)}`}
                    >
                      Profile
                    </Link>
                    <Link
                      className="primary-action"
                      href={`/chat?user=${friend.id}`}
                    >
                      Message
                    </Link>
                  </>,
                ),
              )}
            </div>
          ) : (
            <p className="friends-empty">
              No friends yet. Search for someone to begin.
            </p>
          )}
        </section>

        <section className="friends-panel" aria-labelledby="requests-title">
          <div className="friends-panel-heading">
            <div>
              <p className="eyebrow">Requests</p>
              <h2 id="requests-title">Pending</h2>
            </div>
          </div>
          <h3 className="friends-subheading">Received</h3>
          {overview.received.length ? (
            <div className="friend-list">
              {overview.received.map((request) =>
                identity(
                  request.sender,
                  <>
                    <button
                      className="primary-action"
                      disabled={workingId === request.id}
                      onClick={() => respond(request.id, "accept")}
                    >
                      Accept
                    </button>
                    <button
                      disabled={workingId === request.id}
                      onClick={() => respond(request.id, "reject")}
                    >
                      Decline
                    </button>
                  </>,
                ),
              )}
            </div>
          ) : (
            <p className="friends-empty">No received requests.</p>
          )}
          <h3 className="friends-subheading">Sent</h3>
          {overview.sent.length ? (
            <div className="friend-list">
              {overview.sent.map((request) =>
                identity(
                  request.receiver,
                  <>
                    <span className="relationship-label">Pending</span>
                    <button
                      disabled={workingId === request.id}
                      onClick={() => cancel(request.id)}
                    >
                      Cancel
                    </button>
                  </>,
                ),
              )}
            </div>
          ) : (
            <p className="friends-empty">No sent requests.</p>
          )}
        </section>

        <section
          className="friends-panel friends-suggestions"
          aria-labelledby="suggestions-title"
        >
          <div className="friends-panel-heading">
            <div>
              <p className="eyebrow">Suggestions</p>
              <h2 id="suggestions-title">People you may know</h2>
            </div>
          </div>
          {overview.suggestions.length ? (
            <div className="friend-list">
              {overview.suggestions.map((user) =>
                identity(
                  user,
                  <>
                    {user.mutualFriendCount !== null ? (
                      <span className="relationship-label">
                        {user.mutualFriendCount} mutual
                      </span>
                    ) : null}
                    {user.relationship === "none" ? (
                      <button
                        className="primary-action"
                        disabled={workingId === user.id}
                        onClick={() => addFriend(user.id)}
                      >
                        Add friend
                      </button>
                    ) : (
                      <span className="relationship-label">
                        {user.relationship === "outgoing_pending"
                          ? "Pending"
                          : "Request received"}
                      </span>
                    )}
                  </>,
                ),
              )}
            </div>
          ) : (
            <p className="friends-empty">
              No suggestions yet. Suggestions come from real mutual connections.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
