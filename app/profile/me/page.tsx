import { redirect } from "next/navigation";
import { AppPageHeader } from "../../../components/AppPageHeader";
import { OwnProfileClient } from "../../../components/OwnProfileClient";
import { AuthenticatedAppShell } from "../../../components/app/AuthenticatedAppShell";
import { getCurrentUser } from "../../../lib/auth";

export default async function OwnProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  return (
    <AuthenticatedAppShell className="profile-app-shell">
      <AppPageHeader active="profile" />
      <OwnProfileClient user={user} />
    </AuthenticatedAppShell>
  );
}
