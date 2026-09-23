"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";
import type { CurrentUser } from "../lib/auth";
import type { UserSettings } from "../lib/chat-types";
import { getApiBaseUrl } from "../lib/runtime-config";
import { BrandLogo } from "./BrandLogo";
import { LogoutButton } from "./LogoutButton";
import { MobileBottomNav } from "./MobileBottomNav";
import { ThemeControl } from "./ThemeControl";
import { UserAvatar } from "./UserAvatar";

const api = getApiBaseUrl();
const categories = [
  ["account", "Account", "👤"],
  ["appearance", "Appearance", "◐"],
  ["chat", "Chat", "💬"],
  ["status", "Status", "●"],
  ["privacy", "Privacy", "🔒"],
  ["notifications", "Notifications", "🔔"],
  ["ghost", "Ghost", "👻"],
  ["security", "Security", "🛡"],
  ["about", "About", "ⓘ"],
] as const;
type Category = (typeof categories)[number][0];

const statusLabels: Record<UserSettings["presenceStatus"], string> = {
  online: "🟢 Online",
  away: "🌙 Away",
  dnd: "🔴 Do Not Disturb",
  invisible: "👻 Invisible",
};

function PreferenceSwitch({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-switch-row">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function SettingsClient({
  user,
  version,
}: {
  user: CurrentUser;
  version: string;
}) {
  const [active, setActive] = useState<Category>("account");
  const [mobileSection, setMobileSection] = useState<Category | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customStatus, setCustomStatus] = useState("");
  const [passwordPending, setPasswordPending] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!api) return setError("The API URL is not configured.");
      try {
        const response = await fetch(`${api}/api/settings`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const value = (await response.json()) as { settings: UserSettings };
        setSettings(value.settings);
        setCustomStatus(value.settings.customStatus);
      } catch (requestError) {
        if (!(
          requestError instanceof Error && requestError.name === "AbortError"
        ))
          setError("Settings could not be loaded.");
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const save = async (patch: Partial<UserSettings>) => {
    if (!api || !settings || pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${api}/api/settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const value = (await response.json()) as {
        settings?: UserSettings;
        error?: string;
      };
      if (!response.ok || !value.settings)
        throw new Error(value.error || "Settings could not be updated.");
      setSettings(value.settings);
      if (patch.customStatus !== undefined)
        setCustomStatus(value.settings.customStatus);
      if (patch.messageTextSize) {
        document.documentElement.dataset.messageSize = patch.messageTextSize;
        localStorage.setItem("pb-message-size", patch.messageTextSize);
      }
      setMessage("Settings saved.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Settings could not be updated.",
      );
    } finally {
      setPending(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!api || passwordPending) return;
    setPasswordPending(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`${api}/api/settings/password`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const value = (await response.json()) as {
        message?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(value.error || "Password could not be changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(value.message || "Password changed successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Password could not be changed.",
      );
    } finally {
      setPasswordPending(false);
    }
  };

  const openCategory = (category: Category) => {
    setActive(category);
    setMobileSection(category);
    setError(null);
    setMessage(null);
  };

  const section = settings ? (
    <>
      {active === "account" ? (
        <section className="settings-panel">
          <h2>Account</h2>
          <p>Your private account details and public profile.</p>
          <div className="settings-account-card">
            <UserAvatar
              username={user.username}
              avatarUrl={user.avatarUrl}
              className="settings-avatar"
            />
            <div>
              <strong>{user.username}</strong>
              <span>{user.email}</span>
              <p>{user.bio || "No bio yet."}</p>
            </div>
          </div>
          <Link
            className="button button-primary settings-action"
            href="/profile/edit"
          >
            Edit Profile
          </Link>
        </section>
      ) : null}
      {active === "appearance" ? (
        <section className="settings-panel">
          <h2>Appearance</h2>
          <p>Choose how Pb Messenger looks on this device.</p>
          <div className="settings-card">
            <ThemeControl />
          </div>
          <div className="settings-card">
            <label className="settings-select-label">
              <span>
                <strong>Message text size</strong>
                <small>Only message content changes size.</small>
              </span>
              <select
                value={settings.messageTextSize}
                disabled={pending}
                onChange={(event) =>
                  void save({
                    messageTextSize: event.target
                      .value as UserSettings["messageTextSize"],
                  })
                }
              >
                <option value="small">Small</option>
                <option value="default">Default</option>
                <option value="large">Large</option>
              </select>
            </label>
          </div>
        </section>
      ) : null}
      {active === "chat" ? (
        <section className="settings-panel">
          <h2>Chat</h2>
          <p>
            Control the message composer without changing realtime behavior.
          </p>
          <PreferenceSwitch
            label="Press Enter to Send"
            description="When off, Enter creates a new line and Send sends the message."
            checked={settings.enterToSend}
            disabled={pending}
            onChange={(checked) => void save({ enterToSend: checked })}
          />
        </section>
      ) : null}
      {active === "status" ? (
        <section className="settings-panel">
          <h2>Status</h2>
          <p>Invisible keeps you connected while friends see you as offline.</p>
          <label className="settings-select-label settings-card">
            <span>
              <strong>Presence</strong>
              <small>Offline is managed automatically.</small>
            </span>
            <select
              value={settings.presenceStatus}
              disabled={pending}
              onChange={(event) =>
                void save({
                  presenceStatus: event.target
                    .value as UserSettings["presenceStatus"],
                })
              }
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <form
            className="settings-custom-status"
            onSubmit={(event) => {
              event.preventDefault();
              void save({ customStatus });
            }}
          >
            <label>
              <strong>Custom status</strong>
              <input
                value={customStatus}
                maxLength={80}
                placeholder="💻 Coding"
                onChange={(event) => setCustomStatus(event.target.value)}
              />
            </label>
            <div>
              <button
                className="button button-primary"
                disabled={pending}
                type="submit"
              >
                Save status
              </button>
              <button
                className="button button-secondary"
                disabled={pending || !settings.customStatus}
                type="button"
                onClick={() => void save({ customStatus: "" })}
              >
                Clear
              </button>
            </div>
          </form>
        </section>
      ) : null}
      {active === "privacy" ? (
        <section className="settings-panel">
          <h2>Privacy</h2>
          <p>These controls are enforced by the backend.</p>
          <PreferenceSwitch
            label="Show Online Status"
            description="When off, friends see you as offline while messages continue normally."
            checked={settings.showOnlineStatus}
            disabled={pending}
            onChange={(checked) => void save({ showOnlineStatus: checked })}
          />
          <PreferenceSwitch
            label="Send Read Receipts"
            description="When off, new Seen receipts are not sent to message senders."
            checked={settings.sendReadReceipts}
            disabled={pending}
            onChange={(checked) => void save({ sendReadReceipts: checked })}
          />
          <PreferenceSwitch
            label="Show Typing Indicator"
            description="When off, private and group typing events are not broadcast."
            checked={settings.showTypingIndicator}
            disabled={pending}
            onChange={(checked) => void save({ showTypingIndicator: checked })}
          />
        </section>
      ) : null}
      {active === "notifications" ? (
        <section className="settings-panel">
          <h2>Notifications</h2>
          <p>
            Pb Messenger does not currently include browser push notifications
            or notification sounds.
          </p>
          <div className="settings-notice">
            No inactive toggles are shown. Do Not Disturb is available under
            Status and is ready for a future notification service.
          </div>
        </section>
      ) : null}
      {active === "ghost" ? (
        <section className="settings-panel">
          <h2>Ghost</h2>
          <p>Ghost privacy, schedules, recovery and retry remain unchanged.</p>
          <PreferenceSwitch
            label="Confirm before releasing Ghost"
            description="Ask before a Ghost becomes visible to the receiver."
            checked={settings.confirmGhostRelease}
            disabled={pending}
            onChange={(checked) => void save({ confirmGhostRelease: checked })}
          />
        </section>
      ) : null}
      {active === "security" ? (
        <section className="settings-panel">
          <h2>Security</h2>
          <p>
            Changing your password does not expose or return password hashes.
          </p>
          <form className="settings-password-form" onSubmit={changePassword}>
            <label>
              Current Password
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </label>
            <label>
              New Password
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <label>
              Confirm New Password
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <button
              className="button button-primary"
              disabled={passwordPending}
              type="submit"
            >
              {passwordPending ? "Changing…" : "Change Password"}
            </button>
          </form>
          <div className="settings-security-logout">
            <LogoutButton />
          </div>
        </section>
      ) : null}
      {active === "about" ? (
        <section className="settings-panel settings-about">
          <BrandLogo decorative />
          <h2>Pb Messenger</h2>
          <p>Private realtime messaging with Ghost Type.</p>
          <span>Version {version}</span>
        </section>
      ) : null}
    </>
  ) : (
    <div className="settings-loading">Loading settings…</div>
  );

  return (
    <main className="settings-shell">
      <aside className="settings-app-sidebar">
        <Link className="sidebar-brand" href="/">
          <BrandLogo decorative />
          <span>Pb Messenger</span>
        </Link>
        <div className="settings-user">
          <UserAvatar
            username={user.username}
            avatarUrl={user.avatarUrl}
            className="sidebar-avatar"
          />
          <div>
            <strong>{user.username}</strong>
            <span>{user.bio || "Ready to chat"}</span>
          </div>
        </div>
        <nav className="settings-app-nav">
          <Link href="/chat">
            💬 <span>Chat</span>
          </Link>
          <Link className="settings-current" href="/settings">
            ⚙ <span>Settings</span>
          </Link>
        </nav>
        <div className="settings-sidebar-bottom">
          <LogoutButton />
        </div>
      </aside>
      <aside className="settings-category-nav">
        <Link className="settings-back-link" href="/chat">
          ← Back to Chat
        </Link>
        <h1>Settings</h1>
        <nav>
          {categories.map(([id, label, icon]) => (
            <button
              className={active === id ? "settings-category-active" : ""}
              key={id}
              type="button"
              onClick={() => openCategory(id)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </nav>
      </aside>
      <section
        className={`settings-content${mobileSection ? " settings-mobile-detail" : ""}`}
      >
        <header className="settings-mobile-header">
          <button type="button" onClick={() => setMobileSection(null)}>
            ← Settings
          </button>
          <Link href="/chat">Chat</Link>
        </header>
        <div className="settings-mobile-list">
          <div className="settings-mobile-title">
            <BrandLogo decorative />
            <h1>Settings</h1>
          </div>
          {categories.map(([id, label, icon]) => (
            <button key={id} type="button" onClick={() => openCategory(id)}>
              <span>
                {icon} {label}
              </span>
              <b>›</b>
            </button>
          ))}
        </div>
        <div className="settings-detail">
          {section}
          {message ? (
            <p className="form-success" role="status">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>
      <MobileBottomNav />
    </main>
  );
}
