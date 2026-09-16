"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatFriend, ChatGroup, ChatUser } from "../lib/chat-types";
import { BrandLogo } from "./BrandLogo";
import { LogoutButton } from "./LogoutButton";
import { ThemeControl } from "./ThemeControl";
import { UserAvatar } from "./UserAvatar";

type Props = {
  username: string;
  bio: string;
  avatarUrl: string | null;
  friends: ChatFriend[];
  selectedUserId: string | null;
  friendsLoading: boolean;
  onSelectUser: (user: ChatUser) => void;
  onManageFriends: () => void;
  onViewProfile: (user: ChatUser) => void;
  onToggleFavorite: (friend: ChatFriend) => void;
  groups: ChatGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (group: ChatGroup) => void;
  onCreateGroup: () => void;
  onDrawerChange: (open: boolean) => void;
};

export function ChatSidebar(props: Props) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [viewAll, setViewAll] = useState<"friends" | "groups" | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const normalized = query.trim().toLocaleLowerCase();
  const filteredFriends = useMemo(
    () =>
      props.friends.filter((friend) =>
        friend.username.toLocaleLowerCase().includes(normalized),
      ),
    [props.friends, normalized],
  );
  const filteredGroups = useMemo(
    () =>
      props.groups.filter((group) =>
        group.name.toLocaleLowerCase().includes(normalized),
      ),
    [props.groups, normalized],
  );
  const quickFriends = (normalized ? filteredFriends : props.friends).slice(
    0,
    5,
  );
  const quickGroups = (normalized ? filteredGroups : props.groups).slice(0, 4);

  useEffect(() => props.onDrawerChange(isOpen), [isOpen, props.onDrawerChange]);
  useEffect(() => setIsOpen(false), [pathname]);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", keydown);
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
    };
  }, [isOpen]);
  const close = () => setIsOpen(false);

  const friendRow = (friend: ChatFriend, full = false) => (
    <div
      className={`sidebar-contact-row${props.selectedUserId === friend.id ? " sidebar-contact-active" : ""}`}
      key={friend.id}
    >
      <button
        className="sidebar-contact-main"
        type="button"
          onClick={() => {
            props.onSelectUser(friend);
            if (full) setViewAll(null);
            close();
          }}
      >
        <span className="sidebar-avatar-wrap">
          <UserAvatar
            username={friend.username}
            avatarUrl={friend.avatarUrl}
            className="sidebar-contact-avatar"
          />
          <span
            className={`presence-dot${friend.online ? " presence-dot-online" : ""}`}
          />
        </span>
        <span className="sidebar-contact-name">{friend.username}</span>
        {friend.unreadCount > 0 ? (
          <span className="sidebar-unread-badge">
            {friend.unreadCount > 99 ? "99+" : friend.unreadCount}
          </span>
        ) : null}
      </button>
      <button
        className={`sidebar-icon-action${friend.favorite ? " favorite-active" : ""}`}
        type="button"
        aria-label={`${friend.favorite ? "Unfavorite" : "Favorite"} ${friend.username}`}
        onClick={() => props.onToggleFavorite(friend)}
      >
        ★
      </button>
      {full ? (
        <button
          className="sidebar-icon-action"
          type="button"
          aria-label={`View ${friend.username} profile`}
          onClick={() => props.onViewProfile(friend)}
        >
          ⓘ
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <button
        ref={menuButtonRef}
        className="sidebar-menu-button"
        type="button"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <span />
        <span />
        <span />
      </button>
      {isOpen ? (
        <button
          className="sidebar-overlay"
          type="button"
          aria-label="Close navigation menu"
          onClick={close}
        />
      ) : null}
      <aside
        id="chat-sidebar"
        className={`chat-sidebar${isOpen ? " chat-sidebar-open" : ""}`}
        aria-label="Chat navigation"
      >
        <div className="sidebar-brand-row">
          <Link className="sidebar-brand" href="/">
            <BrandLogo decorative />
            <span>Pb Messenger</span>
          </Link>
          <button
            ref={closeButtonRef}
            className="sidebar-close-button"
            type="button"
            aria-label="Close navigation menu"
            onClick={close}
          >
            ×
          </button>
        </div>
        <div className="sidebar-user">
          <UserAvatar
            username={props.username}
            avatarUrl={props.avatarUrl}
            className="sidebar-avatar"
          />
          <div className="sidebar-user-copy">
            <strong>{props.username}</strong>
            <span>{props.bio || "Ready to chat"}</span>
          </div>
          <Link
            className="sidebar-profile-link"
            href="/profile/edit"
            aria-label="Edit profile"
          >
            ⚙
          </Link>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <Link
            className={`sidebar-nav-link${pathname === "/chat" ? " sidebar-nav-link-active" : ""}`}
            href="/chat"
          >
            💬 <span>Chat</span>
          </Link>
        </nav>
        <label className="sidebar-search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            placeholder="Search friends and groups"
            aria-label="Search friends and groups"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="sidebar-scroll-area">
          <section
            className="sidebar-contacts"
            aria-labelledby="contacts-title"
          >
            <div className="sidebar-section-heading">
              <h2 id="contacts-title">Friends</h2>
              <button type="button" onClick={() => setViewAll("friends")}>
                View all ›
              </button>
            </div>
            {props.friendsLoading ? (
              <p className="sidebar-list-message">Loading friends…</p>
            ) : quickFriends.length ? (
              <div className="sidebar-contact-list">
                {quickFriends.map((friend) => friendRow(friend))}
              </div>
            ) : (
              <p className="sidebar-list-message">
                {normalized ? "No matching friends." : "No friends yet."}
              </p>
            )}
            <button
              className="sidebar-add-friend"
              type="button"
              onClick={() => {
                props.onManageFriends();
                close();
              }}
            >
              + Find friends & requests
            </button>
          </section>
          <section className="sidebar-groups" aria-labelledby="groups-title">
            <div className="sidebar-section-heading">
              <h2 id="groups-title">Groups</h2>
              <button type="button" onClick={() => setViewAll("groups")}>
                View all ›
              </button>
            </div>
            {quickGroups.length ? (
              <div className="sidebar-contact-list">
                {quickGroups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    className={`sidebar-contact${props.selectedGroupId === group.id ? " sidebar-contact-active" : ""}`}
                    onClick={() => {
                      props.onSelectGroup(group);
                      close();
                    }}
                  >
                    <span className="sidebar-contact-avatar group-avatar">
                      👥
                    </span>
                    <span className="sidebar-contact-name">{group.name}</span>
                    {group.unreadCount ? (
                      <span className="sidebar-unread-badge">
                        {group.unreadCount}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className="sidebar-list-message">
                {normalized ? "No matching groups." : "No groups yet."}
              </p>
            )}
            <button
              className="sidebar-add-friend"
              type="button"
              onClick={() => {
                props.onCreateGroup();
                close();
              }}
            >
              + Create group
            </button>
          </section>
        </div>
        <div className="sidebar-footer">
          <ThemeControl compact />
          <LogoutButton className="sidebar-logout-button" />
        </div>
      </aside>
      {viewAll ? (
        <div
          className="friend-dialog-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setViewAll(null)
          }
        >
          <section
            className="friend-dialog quick-access-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`All ${viewAll}`}
          >
            <header className="friend-dialog-header">
              <div>
                <p className="eyebrow">Quick access</p>
                <h2>All {viewAll}</h2>
              </div>
              <button
                className="friend-dialog-close"
                type="button"
                aria-label="Close"
                onClick={() => setViewAll(null)}
              >
                ×
              </button>
            </header>
            <label className="sidebar-search">
              <span>⌕</span>
              <input
                autoFocus
                type="search"
                value={query}
                placeholder={`Search ${viewAll}`}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="quick-access-list">
              {viewAll === "friends"
                ? filteredFriends.map((friend) => friendRow(friend, true))
                : filteredGroups.map((group) => (
                    <button
                      key={group.id}
                      className="sidebar-contact"
                      type="button"
                      onClick={() => {
                        props.onSelectGroup(group);
                        setViewAll(null);
                        close();
                      }}
                    >
                      <span className="sidebar-contact-avatar group-avatar">
                        👥
                      </span>
                      <span className="sidebar-contact-name">{group.name}</span>
                    </button>
                  ))}
            </div>
            {viewAll === "friends" ? (
              <button
                className="button button-ghost"
                type="button"
                onClick={() => {
                  setViewAll(null);
                  props.onManageFriends();
                }}
              >
                Friend requests
              </button>
            ) : (
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  setViewAll(null);
                  props.onCreateGroup();
                }}
              >
                Create Group
              </button>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
