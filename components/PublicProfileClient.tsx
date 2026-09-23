"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { ProfileIdentity, ProfileView } from "../lib/friends-types";
import { getApiBaseUrl } from "../lib/runtime-config";
import { profileApiPath } from "../lib/profile-route";
import { UserAvatar } from "./UserAvatar";

async function parse<T>(response: Response): Promise<T> {
  const value = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(value.error ?? "Request failed.");
  return value;
}

export function PublicProfileClient({ username }: { username: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [friends, setFriends] = useState<ProfileIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const api = getApiBaseUrl();
    if (!api) return;
    setLoading(true);
    try {
      const response = await fetch(`${api}${profileApiPath(username)}`, {
        credentials: "include",
      });
      if (response.status === 401) {
        router.replace("/login");
        return;
      }
      const value = await parse<{ profile: ProfileView }>(response);
      if (value.profile.isOwner) {
        router.replace("/profile/me");
        return;
      }
      setProfile(value.profile);
      if (value.profile.friendCount !== null) {
        const listResponse = await fetch(
          `${api}${profileApiPath(username)}/friends`,
          { credentials: "include" },
        );
        if (listResponse.ok)
          setFriends(
            ((await listResponse.json()) as { friends: ProfileIdentity[] })
              .friends,
          );
      }
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Profile could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [router, username]);

  useEffect(() => {
    void load();
  }, [load]);

  const relationshipAction = async (kind: "add" | "accept") => {
    if (!profile || pending) return;
    const api = getApiBaseUrl();
    if (!api) return;
    setPending(true);
    setError(null);
    try {
      if (kind === "add") {
        await parse(
          await fetch(`${api}/api/friend-requests`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ receiverId: profile.id }),
          }),
        );
      } else if (profile.requestId) {
        await parse(
          await fetch(`${api}/api/friend-requests/${profile.requestId}`, {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "accept" }),
          }),
        );
      }
      await load();
    } catch (actionError) {
      setError(
        actionError instanceof Error ? actionError.message : "Action failed.",
      );
    } finally {
      setPending(false);
    }
  };

  if (loading) return <div className="profile-loading">Loading profile…</div>;
  if (!profile)
    return (
      <div className="profile-loading">
        <h1>Profile unavailable</h1>
        <p>{error || "This profile was not found."}</p>
        <Link href="/friends">Back to Friends</Link>
      </div>
    );

  return (
    <div className="profile-page-content">
      <section className="profile-page-hero public-profile-hero">
        <UserAvatar
          username={profile.username}
          avatarUrl={profile.avatarUrl}
          className="profile-page-avatar"
        />
        <div className="public-profile-identity">
          <p className="eyebrow">Pb profile</p>
          <h1>{profile.displayName}</h1>
          <p>@{profile.username}</p>
          <span
            className={`profile-presence profile-presence-${profile.status}`}
          >
            {profile.online
              ? profile.customStatus || profile.status
              : "Offline"}
          </span>
        </div>
        <div className="profile-primary-actions">
          {profile.relationship === "friends" ? (
            <Link
              className="button button-primary"
              href={`/chat?user=${profile.id}`}
            >
              Message
            </Link>
          ) : null}
          {profile.relationship === "none" ? (
            <button
              className="button button-primary"
              disabled={pending}
              onClick={() => void relationshipAction("add")}
            >
              {pending ? "Sending…" : "Add friend"}
            </button>
          ) : null}
          {profile.relationship === "incoming_pending" ? (
            <button
              className="button button-primary"
              disabled={pending}
              onClick={() => void relationshipAction("accept")}
            >
              {pending ? "Accepting…" : "Accept request"}
            </button>
          ) : null}
          {profile.relationship === "outgoing_pending" ? (
            <span className="relationship-label">Request pending</span>
          ) : null}
        </div>
      </section>
      {error ? (
        <p className="form-message form-error" role="alert">
          {error}
        </p>
      ) : null}
      {profile.isPrivate ? (
        <section className="profile-detail-card profile-private-card">
          <span aria-hidden="true">🔒</span>
          <div>
            <h2>This profile is private</h2>
            <p>Only minimal identity information is available.</p>
          </div>
        </section>
      ) : (
        <div className="profile-detail-grid">
          <section className="profile-detail-card">
            <p className="eyebrow">About</p>
            <h2>Bio</h2>
            {profile.bio ? (
              <p>{profile.bio}</p>
            ) : (
              <p className="profile-muted">No bio yet.</p>
            )}
          </section>
          {profile.links.length ? (
            <section className="profile-detail-card">
              <p className="eyebrow">Links</p>
              <h2>Find {profile.displayName}</h2>
              <div className="public-profile-links">
                {profile.links.map((link) => (
                  <a
                    key={link.id ?? link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
      <section className="profile-detail-card">
        <div className="profile-friends-heading">
          <div>
            <p className="eyebrow">Connections</p>
            <h2>Friends</h2>
          </div>
          {profile.friendCount !== null ? (
            <strong>{profile.friendCount}</strong>
          ) : null}
        </div>
        {profile.mutualFriendCount !== null ? (
          <p>
            {profile.mutualFriendCount} mutual friend
            {profile.mutualFriendCount === 1 ? "" : "s"}
          </p>
        ) : null}
        {profile.friendCount === null ? (
          <p className="profile-muted">Friend list is private.</p>
        ) : friends.length ? (
          <div className="profile-friend-strip">
            {friends.slice(0, 12).map((friend) => (
              <Link
                key={friend.id}
                href={`/profile/${encodeURIComponent(friend.username)}`}
              >
                <UserAvatar
                  username={friend.username}
                  avatarUrl={friend.avatarUrl}
                />
                <span>{friend.displayName}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="profile-muted">No friends to show.</p>
        )}
      </section>
      <p className="profile-call-note">
        Voice and video calls remain available from the private chat header.
      </p>
    </div>
  );
}
