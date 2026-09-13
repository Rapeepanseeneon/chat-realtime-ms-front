"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ChatFriend, ChatUser } from "../lib/chat-types";
import { LogoutButton } from "./LogoutButton";

type ChatSidebarProps = {
  username: string;
  email: string;
  friends: ChatFriend[];
  selectedUserId: string | null;
  friendsLoading: boolean;
  onSelectUser: (user: ChatUser) => void;
  onManageFriends: () => void;
  onDrawerChange: (isOpen: boolean) => void;
};

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 18.5 3.5 21v-5.3A8.5 8.5 0 1 1 7 18.5Z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.8 20c.8-4 3.2-6 7.2-6s6.4 2 7.2 6" />
    </svg>
  );
}

export function ChatSidebar({
  username,
  email,
  friends,
  selectedUserId,
  friendsLoading,
  onSelectUser,
  onManageFriends,
  onDrawerChange,
}: ChatSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const initial = username.trim().charAt(0).toLocaleUpperCase() || "P";

  useEffect(() => {
    onDrawerChange(isOpen);
  }, [isOpen, onDrawerChange]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        menuButtonRef.current?.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const closeDrawer = (restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  };

  return (
    <>
      <button
        ref={menuButtonRef}
        className="sidebar-menu-button"
        type="button"
        aria-label="Open navigation menu"
        aria-controls="chat-sidebar"
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
          onClick={() => closeDrawer(true)}
        />
      ) : null}

      <aside
        id="chat-sidebar"
        className={`chat-sidebar${isOpen ? " chat-sidebar-open" : ""}`}
        aria-label="Chat navigation"
      >
        <div className="sidebar-brand-row">
          <Link
            className="sidebar-brand"
            href="/"
            onClick={() => closeDrawer()}
          >
            <span className="sidebar-brand-mark">Pb</span>
            <span>Pb Messenger</span>
          </Link>
          <button
            ref={closeButtonRef}
            className="sidebar-close-button"
            type="button"
            aria-label="Close navigation menu"
            onClick={() => closeDrawer(true)}
          >
            ×
          </button>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar" aria-hidden="true">
            {initial}
          </div>
          <div className="sidebar-user-copy">
            <strong>{username}</strong>
            <span title={email}>{email}</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <Link
            className={`sidebar-nav-link${pathname === "/chat" ? " sidebar-nav-link-active" : ""}`}
            href="/chat"
            aria-current={pathname === "/chat" ? "page" : undefined}
            onClick={() => closeDrawer()}
          >
            <ChatIcon />
            <span>Chat</span>
          </Link>
          <Link
            className={`sidebar-nav-link${pathname === "/profile/edit" ? " sidebar-nav-link-active" : ""}`}
            href="/profile/edit"
            aria-current={pathname === "/profile/edit" ? "page" : undefined}
            onClick={() => closeDrawer()}
          >
            <ProfileIcon />
            <span>Edit Profile</span>
          </Link>
        </nav>

        <section className="sidebar-contacts" aria-labelledby="contacts-title">
          <div className="sidebar-section-heading">
            <h2 id="contacts-title">Friends</h2>
            <span>{friends.length}</span>
          </div>
          <button
            className="sidebar-add-friend"
            type="button"
            onClick={() => {
              onManageFriends();
              closeDrawer();
            }}
          >
            <span aria-hidden="true">+</span>
            Find friends &amp; requests
          </button>
          <div className="sidebar-contact-list">
            {friendsLoading ? (
              <p className="sidebar-list-message">Loading friends…</p>
            ) : friends.length === 0 ? (
              <p className="sidebar-list-message">
                No friends yet. Search and send a request to get started.
              </p>
            ) : (
              friends.map((user) => {
                const isActive = selectedUserId === user.id;
                const userInitial =
                  user.username.trim().charAt(0).toLocaleUpperCase() || "P";
                return (
                  <button
                    className={`sidebar-contact${isActive ? " sidebar-contact-active" : ""}`}
                    type="button"
                    key={user.id}
                    aria-pressed={isActive}
                    aria-label={`${user.username}, ${user.online ? "online" : "offline"}${user.unreadCount > 0 ? `, ${user.unreadCount} unread messages` : ""}`}
                    onClick={() => {
                      onSelectUser(user);
                      closeDrawer();
                    }}
                  >
                    <span className="sidebar-contact-avatar" aria-hidden="true">
                      {userInitial}
                      <span
                        className={`presence-dot${user.online ? " presence-dot-online" : ""}`}
                      />
                    </span>
                    <span className="sidebar-contact-name">
                      {user.username}
                    </span>
                    {user.unreadCount > 0 ? (
                      <span className="sidebar-unread-badge" aria-hidden="true">
                        {user.unreadCount > 99 ? "99+" : user.unreadCount}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <div className="sidebar-footer">
          <LogoutButton className="sidebar-logout-button" />
        </div>
      </aside>
    </>
  );
}
