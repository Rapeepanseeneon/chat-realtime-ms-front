import { cookies } from "next/headers";
import { getServerApiBaseUrl } from "./server-config";

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  bio: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
};

export const apiBaseUrl = getServerApiBaseUrl();

export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("pb_session");
  if (!sessionCookie) return null;
  const cookieHeader = `${sessionCookie.name}=${sessionCookie.value}`;

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
      cache: "no-store",
      headers: { cookie: cookieHeader },
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("user" in value)) return null;
    return value.user as CurrentUser;
  } catch {
    return null;
  }
};
