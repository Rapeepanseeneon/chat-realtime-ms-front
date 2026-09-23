"use client";

import type { ReactNode } from "react";
import { MobileBottomNav } from "../MobileBottomNav";

type Props = {
  children: ReactNode;
  className?: string;
  mobileNavigation?: boolean;
};

/** Shared authenticated-page boundary. Route-specific state stays below it. */
export function AuthenticatedAppShell({
  children,
  className = "",
  mobileNavigation = true,
}: Props) {
  return (
    <main className={`app-shell${className ? ` ${className}` : ""}`}>
      {children}
      {mobileNavigation ? <MobileBottomNav /> : null}
    </main>
  );
}
