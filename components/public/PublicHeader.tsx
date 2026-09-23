import Link from "next/link";
import { BrandLogo } from "../BrandLogo";
import { ThemeControl } from "../ThemeControl";

export function PublicHeader({ authenticated = false }) {
  return (
    <header className="public-header">
      <Link className="public-brand" href="/" aria-label="Pb Messenger home">
        <BrandLogo decorative />
        <span>Pb Messenger</span>
      </Link>
      <nav className="public-nav" aria-label="Primary navigation">
        <ThemeControl compact />
        {authenticated ? (
          <Link className="button button-primary public-nav-cta" href="/chat">
            Open Messenger
          </Link>
        ) : (
          <>
            <Link className="public-nav-link" href="/login">
              Log in
            </Link>
            <Link
              className="button button-primary public-nav-cta"
              href="/register"
            >
              Get started
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
