import Link from "next/link";
import { PublicHeader } from "../components/public/PublicHeader";
import { getCurrentUser } from "../lib/auth";
import { getAuthenticatedDestination } from "../lib/auth-routing";

const features = [
  {
    icon: "◎",
    title: "Conversations that stay close",
    copy: "Move naturally between private chats and groups without losing your place.",
  },
  {
    icon: "↗",
    title: "Share more than words",
    copy: "Send photos, files, links, locations, and connect through voice or video.",
  },
  {
    icon: "◌",
    title: "You decide the moment",
    copy: "Ghost messages let you hold a thought privately until you choose to release it.",
  },
] as const;

export default async function Home() {
  const user = await getCurrentUser();
  const messengerHref = user ? getAuthenticatedDestination(user) : "/register";

  return (
    <main className="public-page">
      <PublicHeader authenticated={Boolean(user)} />
      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="public-eyebrow">A calmer way to keep in touch</p>
          <h1>
            Your message.
            <span>Your control.</span>
          </h1>
          <p>
            Pb Messenger brings friends, groups, rich sharing, and thoughtful
            Ghost messages into one focused place.
          </p>
          <div className="public-hero-actions">
            <Link className="button button-primary" href={messengerHref}>
              {user ? "Open Messenger" : "Create your account"}
            </Link>
            {!user ? (
              <Link className="button button-secondary" href="/login">
                Log in
              </Link>
            ) : null}
          </div>
          <span className="public-hero-note">
            {user
              ? `Welcome back, ${user.username}.`
              : "Free to start. Set up in less than a minute."}
          </span>
        </div>
        <div className="product-preview" aria-label="Pb Messenger preview">
          <div className="preview-sidebar">
            <div className="preview-logo">Pb</div>
            <span className="preview-line preview-line-wide" />
            <span className="preview-line" />
            <span className="preview-line" />
            <span className="preview-line preview-line-short" />
          </div>
          <div className="preview-chat">
            <div className="preview-chat-head">
              <span className="preview-avatar">P</span>
              <span>Private conversation</span>
            </div>
            <div className="preview-messages">
              <p className="preview-bubble preview-bubble-left">
                Ready when you are.
              </p>
              <p className="preview-bubble preview-bubble-right">
                Let&apos;s talk 👋
              </p>
              <div className="preview-ghost">
                <span>👻 Ghost</span>
                <small>Only you can see this</small>
              </div>
            </div>
            <div className="preview-composer">Type a message…</div>
          </div>
        </div>
      </section>

      <section
        className="public-section public-features"
        aria-labelledby="features-title"
      >
        <div className="public-section-heading">
          <p className="public-eyebrow">Built around real conversation</p>
          <h2 id="features-title">Everything important, nothing noisy.</h2>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.title}>
              <span className="feature-icon" aria-hidden="true">
                {feature.icon}
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="public-section ghost-showcase">
        <div className="ghost-showcase-art" aria-hidden="true">
          <span className="ghost-showcase-emoji">👻</span>
          <div className="ghost-message-card">
            <strong>Only you can see this</strong>
            <span>Release now or schedule for later.</span>
          </div>
        </div>
        <div>
          <p className="public-eyebrow">Ghost messages</p>
          <h2>Say it when the timing feels right.</h2>
          <p>
            Write a private message that stays in your own timeline. Edit it,
            schedule it, or release it when you are ready.
          </p>
          <ul className="ghost-points">
            <li>Private until release</li>
            <li>Schedule for later</li>
            <li>Works inside your existing private chats</li>
          </ul>
        </div>
      </section>

      <section className="public-section final-cta">
        <p className="public-eyebrow">Start a better conversation</p>
        <h2>Keep people close, on your terms.</h2>
        <Link className="button button-primary" href={messengerHref}>
          {user ? "Continue to Messenger" : "Get started with Pb"}
        </Link>
      </section>

      <footer className="public-footer">
        <span>Pb Messenger</span>
        <span>Your message. Your control.</span>
      </footer>
    </main>
  );
}
