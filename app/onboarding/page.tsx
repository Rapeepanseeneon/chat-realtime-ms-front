import { redirect } from "next/navigation";
import { BrandLogo } from "../../components/BrandLogo";
import { OnboardingFlow } from "../../components/onboarding/OnboardingFlow";
import { getCurrentUser } from "../../lib/auth";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.onboardingCompleted) redirect("/chat");

  return (
    <main className="onboarding-page">
      <div className="onboarding-brand">
        <BrandLogo decorative />
        <span>Pb Messenger</span>
      </div>
      <OnboardingFlow username={user.username} />
      <p className="onboarding-footer">Your message. Your control.</p>
    </main>
  );
}
