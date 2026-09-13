import Link from "next/link";
import { BrandLogo } from "../components/BrandLogo";
import { LogoutButton } from "../components/LogoutButton";
import { getCurrentUser } from "../lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <main className="site-shell">
      <section className="hero-card">
        <div className="hero-brand">
          <BrandLogo size="large" decorative />
        </div>
        <p className="eyebrow">Pb Messenger</p>
        <h1>Welcome to Pb Messenger</h1>
        <p className="hero-copy">
          A simple place to connect, chat, and stay close in real time.
        </p>
        {user ? (
          <div className="signed-in-panel">
            <p className="welcome-user">
              Welcome, <strong>{user.username}</strong>
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/chat">
                Enter Chat
              </Link>
              <Link className="button button-secondary" href="/profile/edit">
                Edit Profile
              </Link>
              <LogoutButton />
            </div>
          </div>
        ) : (
          <div className="hero-actions">
            <Link className="button button-primary" href="/login">
              Login
            </Link>
            <Link className="button button-secondary" href="/register">
              Sign Up
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
