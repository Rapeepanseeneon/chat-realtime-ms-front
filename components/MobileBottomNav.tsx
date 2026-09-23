"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      <Link
        className={pathname === "/chat" ? "mobile-nav-active" : ""}
        href="/chat"
      >
        <span aria-hidden="true">💬</span> Chat
      </Link>
      <Link
        className={pathname === "/friends" ? "mobile-nav-active" : ""}
        href="/friends"
      >
        <span aria-hidden="true">👥</span> Friends
      </Link>
      <Link
        className={pathname.startsWith("/profile") ? "mobile-nav-active" : ""}
        href="/profile/me"
      >
        <span aria-hidden="true">◉</span> Profile
      </Link>
      <Link
        className={pathname === "/settings" ? "mobile-nav-active" : ""}
        href="/settings"
      >
        <span aria-hidden="true">⚙</span> Settings
      </Link>
    </nav>
  );
}
