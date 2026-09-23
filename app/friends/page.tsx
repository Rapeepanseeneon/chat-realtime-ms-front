import { redirect } from "next/navigation";
import { AppPageHeader } from "../../components/AppPageHeader";
import { FriendsPageClient } from "../../components/FriendsPageClient";
import { AuthenticatedAppShell } from "../../components/app/AuthenticatedAppShell";
import { getCurrentUser } from "../../lib/auth";

export default async function FriendsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  return (
    <AuthenticatedAppShell className="friends-app-shell">
      <AppPageHeader active="friends" />
      <FriendsPageClient />
    </AuthenticatedAppShell>
  );
}
