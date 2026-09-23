import Link from "next/link";
import { BrandLogo } from "./BrandLogo";

export function AppPageHeader({ active }: { active: "friends" | "profile" }) {
  return (
    <header className="app-page-header">
      <Link className="app-page-brand" href="/chat">
        <BrandLogo decorative />
        <span>Pb Messenger</span>
      </Link>
      <nav aria-label="Account navigation">
        <Link href="/chat">Chat</Link>
        <Link
          className={active === "friends" ? "is-active" : ""}
          href="/friends"
        >
          Friends
        </Link>
        <Link
          className={active === "profile" ? "is-active" : ""}
          href="/profile/me"
        >
          Profile
        </Link>
        <Link href="/settings">Settings</Link>
      </nav>
    </header>
  );
}
