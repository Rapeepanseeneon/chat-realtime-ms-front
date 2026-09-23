"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import type { ProfileLink } from "../lib/chat-types";
import type { ProfilePrivacy } from "../lib/friends-types";
import { getApiBaseUrl } from "../lib/runtime-config";
import { ThemeControl } from "./ThemeControl";
import { UserAvatar } from "./UserAvatar";

type ProfileFormProps = {
  username: string;
  email: string;
  bio: string;
  avatarUrl: string | null;
  displayName?: string;
  redirectAfterSave?: string | null;
};
const apiBaseUrl = getApiBaseUrl();
const emptyLink = (): ProfileLink => ({
  platform: "Website",
  label: "",
  url: "",
});

export function ProfileForm(initial: ProfileFormProps) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [avatarPending, setAvatarPending] = useState(false);
  const [privacy, setPrivacy] = useState<ProfilePrivacy>({
    profileVisibility: "friends",
    friendListVisibility: "only_me",
    mutualFriendsVisibility: "friends",
    onlineStatusVisibility: "friends",
  });

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!apiBaseUrl) return;
      try {
        const response = await fetch(`${apiBaseUrl}/api/profile`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (response.ok) {
          const value = (await response.json()) as {
            links?: ProfileLink[];
            profile?: { privacy?: ProfilePrivacy | null };
          };
          setLinks(Array.isArray(value.links) ? value.links : []);
          if (value.profile?.privacy) setPrivacy(value.profile.privacy);
        }
      } catch (loadError) {
        if (!(loadError instanceof Error && loadError.name === "AbortError"))
          setError("Profile links could not be loaded.");
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const readResponse = async (response: Response) => {
    const value = (await response.json()) as {
      error?: string;
      message?: string;
      user?: { avatarUrl?: string | null };
    };
    if (!response.ok)
      throw new Error(value.error ?? "Profile could not be updated.");
    return value;
  };

  const changeAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !apiBaseUrl || avatarPending) return;
    setAvatarPending(true);
    setError(null);
    setSuccess(null);
    try {
      const body = new FormData();
      body.set("avatar", file);
      const value = await readResponse(
        await fetch(`${apiBaseUrl}/api/profile/avatar`, {
          method: "POST",
          credentials: "include",
          body,
        }),
      );
      setAvatarUrl(value.user?.avatarUrl ?? null);
      setSuccess(value.message ?? "Profile picture updated.");
      router.refresh();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setAvatarPending(false);
    }
  };

  const removeAvatar = async () => {
    if (!apiBaseUrl || avatarPending) return;
    setAvatarPending(true);
    setError(null);
    try {
      const value = await readResponse(
        await fetch(`${apiBaseUrl}/api/profile/avatar`, {
          method: "DELETE",
          credentials: "include",
        }),
      );
      setAvatarUrl(null);
      setSuccess(value.message ?? "Profile picture removed.");
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : "Remove failed.",
      );
    } finally {
      setAvatarPending(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!apiBaseUrl || pending) return;
    setPending(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${apiBaseUrl}/api/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          displayName: form.get("displayName"),
          email: form.get("email"),
          bio: form.get("bio"),
          links: links.map(({ platform, label, url }) => ({
            platform,
            label,
            url,
          })),
        }),
      });
      const value = await readResponse(response);
      await readResponse(
        await fetch(`${apiBaseUrl}/api/profile/privacy`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(privacy),
        }),
      );
      setSuccess(value.message ?? "Profile updated successfully.");
      router.refresh();
      if (initial.redirectAfterSave)
        setTimeout(() => router.replace(initial.redirectAfterSave!), 650);
      else setPending(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed.");
      setPending(false);
    }
  };

  const updateLink = (index: number, patch: Partial<ProfileLink>) =>
    setLinks((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  return (
    <form className="auth-form profile-form" onSubmit={submit}>
      <section className="avatar-editor" aria-label="Profile picture">
        <UserAvatar
          username={initial.username}
          avatarUrl={avatarUrl}
          className="profile-avatar"
        />
        <div>
          <strong>Profile picture</strong>
          <p>JPG, PNG or WebP · maximum 5 MB</p>
          <div className="avatar-actions">
            <label className="button button-ghost">
              {avatarPending ? "Working…" : avatarUrl ? "Change" : "Upload"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={avatarPending}
                onChange={changeAvatar}
              />
            </label>
            {avatarUrl ? (
              <button
                type="button"
                className="button button-ghost"
                disabled={avatarPending}
                onClick={() => void removeAvatar()}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </section>
      <label className="field">
        <span>Display name</span>
        <input
          name="displayName"
          defaultValue={initial.displayName || initial.username}
          required
          maxLength={80}
          autoComplete="name"
        />
      </label>
      <label className="field">
        <span>Username</span>
        <input
          name="username"
          defaultValue={initial.username}
          required
          maxLength={50}
          autoComplete="username"
        />
      </label>
      <label className="field">
        <span>
          Email <small>Private · used for login</small>
        </span>
        <input
          name="email"
          type="email"
          defaultValue={initial.email}
          required
          maxLength={254}
          autoComplete="email"
        />
      </label>
      <label className="field">
        <span>Info / Bio</span>
        <textarea
          name="bio"
          defaultValue={initial.bio}
          maxLength={150}
          rows={3}
          placeholder="Tell friends a little about yourself…"
        />
      </label>
      <section className="profile-links-editor">
        <div className="profile-section-title">
          <strong>Contact & social links</strong>
          <button
            type="button"
            disabled={links.length >= 8}
            onClick={() => setLinks((current) => [...current, emptyLink()])}
          >
            + Add link
          </button>
        </div>
        {links.length === 0 ? (
          <p className="profile-empty">No public links added.</p>
        ) : (
          links.map((link, index) => (
            <div className="profile-link-row" key={link.id ?? index}>
              <select
                aria-label={`Platform ${index + 1}`}
                value={link.platform}
                onChange={(event) =>
                  updateLink(index, { platform: event.target.value })
                }
              >
                {[
                  "Website",
                  "Instagram",
                  "Facebook",
                  "TikTok",
                  "X",
                  "GitHub",
                  "Other",
                ].map((platform) => (
                  <option key={platform}>{platform}</option>
                ))}
              </select>
              <input
                aria-label={`Link label ${index + 1}`}
                value={link.label}
                maxLength={60}
                placeholder="Label"
                required
                onChange={(event) =>
                  updateLink(index, { label: event.target.value })
                }
              />
              <input
                aria-label={`Link URL ${index + 1}`}
                type="url"
                value={link.url}
                maxLength={2048}
                placeholder="https://…"
                required
                onChange={(event) =>
                  updateLink(index, { url: event.target.value })
                }
              />
              <button
                type="button"
                aria-label={`Delete link ${index + 1}`}
                onClick={() =>
                  setLinks((current) =>
                    current.filter((_, itemIndex) => itemIndex !== index),
                  )
                }
              >
                ×
              </button>
            </div>
          ))
        )}
      </section>
      <section
        className="profile-privacy-editor"
        aria-labelledby="privacy-title"
      >
        <div className="profile-section-title">
          <strong id="privacy-title">Privacy</strong>
          <span>Enforced by Pb Messenger</span>
        </div>
        <div className="profile-privacy-grid">
          <label>
            <span>Profile</span>
            <select
              value={privacy.profileVisibility}
              onChange={(event) =>
                setPrivacy((current) => ({
                  ...current,
                  profileVisibility: event.target
                    .value as ProfilePrivacy["profileVisibility"],
                }))
              }
            >
              <option value="public">Public</option>
              <option value="friends">Friends only</option>
              <option value="private">Private</option>
            </select>
          </label>
          <label>
            <span>Friend list</span>
            <select
              value={privacy.friendListVisibility}
              onChange={(event) =>
                setPrivacy((current) => ({
                  ...current,
                  friendListVisibility: event.target
                    .value as ProfilePrivacy["friendListVisibility"],
                }))
              }
            >
              <option value="everyone">Everyone</option>
              <option value="friends">Friends</option>
              <option value="only_me">Only me</option>
            </select>
          </label>
          <label>
            <span>Mutual friends</span>
            <select
              value={privacy.mutualFriendsVisibility}
              onChange={(event) =>
                setPrivacy((current) => ({
                  ...current,
                  mutualFriendsVisibility: event.target
                    .value as ProfilePrivacy["mutualFriendsVisibility"],
                }))
              }
            >
              <option value="everyone">Everyone</option>
              <option value="friends">Friends</option>
              <option value="only_me">Only me</option>
            </select>
          </label>
          <label>
            <span>Online status</span>
            <select
              value={privacy.onlineStatusVisibility}
              onChange={(event) =>
                setPrivacy((current) => ({
                  ...current,
                  onlineStatusVisibility: event.target
                    .value as ProfilePrivacy["onlineStatusVisibility"],
                }))
              }
            >
              <option value="everyone">Everyone</option>
              <option value="friends">Friends</option>
              <option value="nobody">Nobody</option>
            </select>
          </label>
        </div>
      </section>
      <ThemeControl />
      {error ? (
        <p className="form-message form-error" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="form-message form-success" role="status">
          {success}
        </p>
      ) : null}
      <div className="form-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={pending || avatarPending}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          className="button button-ghost"
          type="button"
          disabled={pending}
          onClick={() => router.push("/chat")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
