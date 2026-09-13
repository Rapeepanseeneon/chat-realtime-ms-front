import Link from "next/link";
import { BrandLogo } from "../../components/BrandLogo";
import { redirect } from "next/navigation";
import { AuthForm } from "../../components/AuthForm";
import { getCurrentUser } from "../../lib/auth";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="site-shell">
      <section className="auth-card" aria-labelledby="register-title">
        <Link className="back-link" href="/">
          ← Home
        </Link>
        <div className="auth-brand">
          <BrandLogo decorative />
          <span>Pb Messenger</span>
        </div>
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
