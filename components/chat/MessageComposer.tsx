"use client";

import type { FormEventHandler, ReactNode } from "react";

type Props = {
  children: ReactNode;
  editing: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
};

/** Layout-only composer boundary; the controller still owns all behavior. */
export function MessageComposer({ children, editing, onSubmit }: Props) {
  return (
    <form
      className={`message-form${editing ? " message-form-editing" : ""}`}
      onSubmit={onSubmit}
    >
      {children}
    </form>
  );
}
