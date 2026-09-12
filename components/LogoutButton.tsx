"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");

export function LogoutButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const logout = async () => {
    if (!apiBaseUrl) return;
    setPending(true);
    try {
      await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <button
      className={`button button-ghost ${className}`.trim()}
      onClick={logout}
      disabled={pending}
    >
      {pending ? "Logging out…" : "Logout"}
    </button>
  );
}
