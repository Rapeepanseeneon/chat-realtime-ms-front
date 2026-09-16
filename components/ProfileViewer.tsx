"use client";

import { useEffect, useState } from "react";
import type { ChatUser, PublicProfile } from "../lib/chat-types";
import { UserAvatar } from "./UserAvatar";

const api = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
export function ProfileViewer({
  user,
  onClose,
}: {
  user: ChatUser | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!user || !api) return;
    const controller = new AbortController();
    const load = async () => {
      setProfile(null);
      setError("");
      try {
        const response = await fetch(`${api}/api/profiles/${user.id}`, {
          credentials: "include",
          signal: controller.signal,
        });
        const value = (await response.json()) as {
          profile?: PublicProfile;
          error?: string;
        };
        if (!response.ok || !value.profile)
          throw new Error(value.error ?? "Profile could not be loaded.");
        setProfile(value.profile);
      } catch (loadError) {
        if (!(loadError instanceof Error && loadError.name === "AbortError"))
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Profile could not be loaded.",
          );
      }
    };
    void load();
    const keydown = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    document.addEventListener("keydown", keydown);
    return () => {
      controller.abort();
      document.removeEventListener("keydown", keydown);
    };
  }, [user, onClose]);
  if (!user) return null;
  return (
    <div
      className="friend-dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        className="friend-dialog profile-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-view-title"
      >
        <header className="friend-dialog-header">
          <p className="eyebrow">Profile</p>
          <button
            className="friend-dialog-close"
            type="button"
            aria-label="Close profile"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {error ? (
          <p className="form-message form-error">{error}</p>
        ) : profile ? (
          <>
            <UserAvatar
              username={profile.username}
              avatarUrl={profile.avatarUrl}
              className="profile-avatar profile-avatar-large"
            />
            <h2 id="profile-view-title">{profile.username}</h2>
            <section>
              <h3>Info</h3>
              <p>{profile.bio || "No bio yet."}</p>
            </section>
            <section>
              <h3>Links</h3>
              {profile.links.length ? (
                <div className="profile-public-links">
                  {profile.links.map((link) => (
                    <a
                      key={link.id ?? link.url}
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <span>{link.platform}</span>
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : (
                <p>No public links.</p>
              )}
            </section>
          </>
        ) : (
          <p className="friend-empty">Loading profile…</p>
        )}
      </section>
    </div>
  );
}
