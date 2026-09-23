"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { getApiBaseUrl } from "../lib/runtime-config";

type AuthFormProps = { mode: "login" | "register" };
const apiBaseUrl = getApiBaseUrl();

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!apiBaseUrl) {
      setError("The API URL is not configured.");
      return;
    }

    const payload = isRegister
      ? { username, email, password, confirmPassword }
      : { email, password };
    if (isRegister && password !== confirmPassword) {
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
            value={username}
            onChange={(event) => setUsername(event.target.value)}
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
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          maxLength={254}
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          inputMode="email"
          placeholder="you@example.com"
        />
      </label>
      <label className="field">
        <span>Password</span>
        <span className="password-control">
          <input
            id="auth-password"
            name="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            maxLength={128}
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            className="password-toggle"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            aria-controls="auth-password"
            onClick={() => setShowPassword((value) => !value)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {showPassword ? <path d="m3 3 18 18" /> : null}
            </svg>
          </button>
        </span>
      </label>
      {isRegister ? (
        <label className="field">
          <span>Confirm password</span>
          <input
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
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
        {pending ? "Please wait…" : isRegister ? "Create account" : "Log in"}
      </button>
      <p className="auth-switch">
        {isRegister ? "Already have an account? " : "Don't have an account? "}
        <Link href={isRegister ? "/login" : "/register"}>
          {isRegister ? "Log in" : "Sign up"}
        </Link>
      </p>
    </form>
  );
}
