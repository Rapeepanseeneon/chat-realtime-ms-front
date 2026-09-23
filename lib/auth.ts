import { cookies } from "next/headers";

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

export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "") ??
  "http://localhost:3001";

export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    if (!response.ok) return null;
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("user" in value)) return null;
    return value.user as CurrentUser;
  } catch {
    return null;
  }
};
