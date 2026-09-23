import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { ChatClient } from "./ChatClient";

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  const requested = (await searchParams).user;
  return (
    <ChatClient
      initialUserId={requested && /^\d+$/.test(requested) ? requested : null}
      currentUser={{
        id: user.id,
        username: user.username,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
      }}
    />
  );
}
