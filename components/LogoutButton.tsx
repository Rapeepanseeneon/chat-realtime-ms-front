"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getApiBaseUrl } from "../lib/runtime-config";

const apiBaseUrl = getApiBaseUrl();

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
