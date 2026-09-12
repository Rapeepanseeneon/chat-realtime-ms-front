"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

type ProfileFormProps = { username: string; email: string };
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
const SUCCESS_REDIRECT_DELAY_MS = 700;

export function ProfileForm({ username, email }: ProfileFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!apiBaseUrl) return setError("The API URL is not configured.");
    const form = new FormData(event.currentTarget);
    setPending(true);
    let updateSucceeded = false;
    try {
      const response = await fetch(`${apiBaseUrl}/api/profile`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const value: unknown = await response.json();
      const isObject = value && typeof value === "object";
      if (!response.ok) {
        setError(
          isObject && "error" in value && typeof value.error === "string"
            ? value.error
            : "Profile could not be updated.",
        );
        return;
      }
      updateSucceeded = true;
      setSuccess("Profile updated successfully.");
      redirectTimerRef.current = setTimeout(() => {
        router.replace("/chat");
      }, SUCCESS_REDIRECT_DELAY_MS);
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      if (!updateSucceeded) setPending(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span>Username</span>
        <input
          name="username"
          defaultValue={username}
          required
          maxLength={50}
          autoComplete="username"
        />
      </label>
      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          defaultValue={email}
          required
          maxLength={254}
          autoComplete="email"
        />
      </label>
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
          disabled={pending}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button
          className="button button-ghost"
          type="button"
          disabled={pending}
          onClick={() => router.push("/")}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
