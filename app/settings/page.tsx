import { redirect } from "next/navigation";
import packageJson from "../../package.json";
import { SettingsClient } from "../../components/SettingsClient";
import { getCurrentUser } from "../../lib/auth";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  return <SettingsClient user={user} version={packageJson.version} />;
}
