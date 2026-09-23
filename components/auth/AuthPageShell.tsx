import type { ReactNode } from "react";
import { PublicHeader } from "../public/PublicHeader";

type AuthPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthPageShell({
  eyebrow,
  title,
  description,
  children,
}: AuthPageShellProps) {
  return (
    <main className="auth-experience">
      <PublicHeader />
      <section className="auth-experience-body">
        <div className="auth-story" aria-hidden="true">
          <span className="ghost-orbit ghost-orbit-one">👻</span>
          <span className="ghost-orbit ghost-orbit-two">✦</span>
          <p>Your message.</p>
          <strong>Your control.</strong>
          <span>
            Private conversations, thoughtful sharing, and Ghost messages in one
            focused space.
          </span>
        </div>
        <section className="auth-panel" aria-labelledby="auth-page-title">
          <p className="public-eyebrow">{eyebrow}</p>
          <h1 id="auth-page-title">{title}</h1>
          <p className="auth-panel-copy">{description}</p>
          {children}
        </section>
      </section>
    </main>
  );
}
