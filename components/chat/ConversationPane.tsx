import type { ReactNode } from "react";

export function ConversationPane({ children }: { children: ReactNode }) {
  return (
    <div className="chat-main">
      <section className="chat-card" aria-labelledby="chat-title">
        {children}
      </section>
    </div>
  );
}
