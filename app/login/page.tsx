import { redirect } from "next/navigation";
import { AuthForm } from "../../components/AuthForm";
import { AuthPageShell } from "../../components/auth/AuthPageShell";
import { getCurrentUser } from "../../lib/auth";
import { getAuthenticatedDestination } from "../../lib/auth-routing";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(getAuthenticatedDestination(user));
  return (
    <AuthPageShell
      eyebrow="Welcome back"
      title="Continue the conversation."
      description="Log in with the email connected to your Pb Messenger account."
    >
      <AuthForm mode="login" />
    </AuthPageShell>
  );
}
