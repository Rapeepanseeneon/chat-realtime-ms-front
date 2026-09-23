import { redirect } from "next/navigation";
import { AuthForm } from "../../components/AuthForm";
import { AuthPageShell } from "../../components/auth/AuthPageShell";
import { getCurrentUser } from "../../lib/auth";
import { getAuthenticatedDestination } from "../../lib/auth-routing";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(getAuthenticatedDestination(user));
  return (
    <AuthPageShell
      eyebrow="Create your account"
      title="A better place to talk."
      description="Choose your Pb identity and you will be ready to meet Messenger in a few quick steps."
    >
      <AuthForm mode="register" />
    </AuthPageShell>
  );
}
