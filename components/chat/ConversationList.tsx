"use client";

import type { ComponentProps } from "react";
import { ChatSidebar } from "../ChatSidebar";

type Props = ComponentProps<typeof ChatSidebar>;

/** Presentation boundary for the future route-aware conversation list. */
export function ConversationList(props: Props) {
  return <ChatSidebar {...props} />;
}
