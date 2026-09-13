import Link from "next/link";
import { BrandLogo } from "../../components/BrandLogo";
import { redirect } from "next/navigation";
import { AuthForm } from "../../components/AuthForm";
import { getCurrentUser } from "../../lib/auth";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="site-shell auth-shell">
      <header className="auth-page-header">
        <Link className="auth-brand" href="/">
          <BrandLogo decorative />
          <span>Pb Messenger</span>
        </Link>
      </header>
      <section className="auth-card" aria-labelledby="register-title">
        <p className="eyebrow">Join the conversation</p>
        <h1 id="register-title">Create your account</h1>
        <p className="card-copy">
          Sign up to start chatting with Pb Messenger.
        </p>
        <AuthForm mode="register" />
      </section>
    </main>
  );
}
