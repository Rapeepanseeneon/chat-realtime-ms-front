import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/auth";
import { ChatClient } from "./ChatClient";

export default async function ChatPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <ChatClient
      currentUser={{ id: user.id, username: user.username, email: user.email }}
    />
  );
}
