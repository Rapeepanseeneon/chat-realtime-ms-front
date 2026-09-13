import Link from "next/link";
import { BrandLogo } from "../../components/BrandLogo";
import { redirect } from "next/navigation";
import { AuthForm } from "../../components/AuthForm";
import { getCurrentUser } from "../../lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { registered } = await searchParams;
  return (
    <main className="site-shell">
      <section className="auth-card" aria-labelledby="login-title">
        <Link className="back-link" href="/">
          ← Home
        </Link>
        <div className="auth-brand">
          <BrandLogo decorative />
          <span>Pb Messenger</span>
        </div>
        <p className="eyebrow">Welcome back</p>
        <h1 id="login-title">Login to Pb Messenger</h1>
        <p className="card-copy">
          Enter your account details to continue to chat.
        </p>
        {registered === "1" ? (
          <p className="form-message form-success">
            Account created. You can log in now.
          </p>
        ) : null}
        <AuthForm mode="login" />
      </section>
    </main>
  );
}
