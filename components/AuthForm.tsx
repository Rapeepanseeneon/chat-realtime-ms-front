"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

type AuthFormProps = { mode: "login" | "register" };
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!apiBaseUrl) {
      setError("The API URL is not configured.");
      return;
    }

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (isRegister && payload.password !== payload.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const value: unknown = await response.json();
      const message =
        value &&
        typeof value === "object" &&
        "error" in value &&
        typeof value.error === "string"
          ? value.error
          : null;
      if (!response.ok) {
        setError(message ?? "Something went wrong. Please try again.");
        return;
      }
      router.push(isRegister ? "/login?registered=1" : "/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      {isRegister ? (
        <label className="field">
          <span>Username</span>
          <input
            name="username"
            required
            maxLength={50}
            autoComplete="username"
            placeholder="Your username"
          />
        </label>
      ) : null}
      <label className="field">
        <span>Email</span>
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@example.com"
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete={isRegister ? "new-password" : "current-password"}
          placeholder="At least 8 characters"
        />
      </label>
      {isRegister ? (
        <label className="field">
          <span>Confirm password</span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete="new-password"
            placeholder="Enter password again"
          />
        </label>
      ) : null}
      {error ? (
        <p className="form-message form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="button button-primary button-full"
        type="submit"
        disabled={pending}
      >
        {pending ? "Please wait…" : isRegister ? "Create account" : "Login"}
      </button>
      <p className="auth-switch">
        {isRegister ? "Already have an account? " : "New to Pb Messenger? "}
        <Link href={isRegister ? "/login" : "/register"}>
          {isRegister ? "Login" : "Sign Up"}
        </Link>
      </p>
    </form>
  );
}
