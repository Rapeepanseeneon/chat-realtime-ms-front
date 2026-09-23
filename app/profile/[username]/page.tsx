import { redirect } from "next/navigation";
import { AppPageHeader } from "../../../components/AppPageHeader";
import { PublicProfileClient } from "../../../components/PublicProfileClient";
import { AuthenticatedAppShell } from "../../../components/app/AuthenticatedAppShell";
import { getCurrentUser } from "../../../lib/auth";
import { decodeProfileRouteUsername } from "../../../lib/profile-route";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  const { username } = await params;
  return (
    <AuthenticatedAppShell className="profile-app-shell">
      <AppPageHeader active="profile" />
      <PublicProfileClient username={decodeProfileRouteUsername(username)} />
    </AuthenticatedAppShell>
  );
}
