"use client";

import { useEffect, useState } from "react";
import type { CurrentUser } from "../lib/auth";
import type { ProfileView } from "../lib/friends-types";
import { getApiBaseUrl } from "../lib/runtime-config";
import { ProfileForm } from "./ProfileForm";
import { UserAvatar } from "./UserAvatar";

export function OwnProfileClient({ user }: { user: CurrentUser }) {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      const api = getApiBaseUrl();
      if (!api) return;
      try {
        const response = await fetch(`${api}/api/profile`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (response.ok) {
          const value = (await response.json()) as { profile?: ProfileView };
          setProfile(value.profile ?? null);
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError"))
          setProfile(null);
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  return (
    <div className="profile-page-content">
      <section className="profile-page-hero">
        <UserAvatar
          username={user.username}
          avatarUrl={user.avatarUrl}
          className="profile-page-avatar"
        />
        <div>
          <p className="eyebrow">Your profile</p>
          <h1>{profile?.displayName || user.username}</h1>
          <p>@{user.username}</p>
        </div>
      </section>
      <section
        className="profile-editor-card"
        aria-labelledby="edit-profile-title"
      >
        <div className="profile-card-heading">
          <div>
            <p className="eyebrow">Account & privacy</p>
            <h2 id="edit-profile-title">Edit profile</h2>
          </div>
          <p>Your email stays private.</p>
        </div>
        <ProfileForm
          username={user.username}
          displayName={profile?.displayName || user.username}
          email={user.email}
          bio={user.bio}
          avatarUrl={user.avatarUrl}
        />
      </section>
    </div>
  );
}
