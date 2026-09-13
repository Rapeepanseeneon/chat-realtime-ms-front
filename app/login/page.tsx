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
    <main className="site-shell auth-shell">
      <header className="auth-page-header">
        <Link className="auth-brand" href="/">
          <BrandLogo decorative />
          <span>Pb Messenger</span>
        </Link>
      </header>
      <section className="auth-card" aria-labelledby="login-title">
        <h1 id="login-title">Welcome back</h1>
        <p className="card-copy">Message when you're ready.</p>
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
