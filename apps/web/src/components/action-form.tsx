"use client";

import { useActionState, useRef } from "react";
import type { ReactNode } from "react";
import type { FormState } from "../lib/form-state";

export function ActionForm({
  action,
  children,
  label,
  compact = false,
  destructive = false,
  confirmMessage,
  pendingLabel = "One moment…",
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode;
  label: string;
  pendingLabel?: string;
  compact?: boolean;
  destructive?: boolean;
  confirmMessage?: string;
}) {
  const preserveFields = useRef(false);
  const [state, formAction, pending] = useActionState(
    async (previous: FormState, form: FormData) => {
      const result = await action(previous, form);
      preserveFields.current = Boolean(result.error);
      return result;
    },
    { error: null },
  );
  return (
    <form
      action={formAction}
      onReset={(event) => {
        if (preserveFields.current) event.preventDefault();
      }}
      className={`account-form ${compact ? "compact-form" : ""}`}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage))
          event.preventDefault();
      }}
    >
      {children}
      {state.message && (
        <p className="form-success" role="status">
          {state.message}
        </p>
      )}
      {state.error && (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      )}
      {state.invitationUrl && (
        <div className="invitation-result" role="status">
          <label>
            Invitation link
            <input
              readOnly
              value={state.invitationUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <p>
            Share this link with the invited person. It expires in seven days.
          </p>
        </div>
      )}
      {state.shareUrl && (
        <div className="invitation-result" role="status">
          <label>
            Client portal link
            <input
              readOnly
              value={state.shareUrl}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
          <p>
            Share privately with this client. This link expires in 90 days and
            replaces previous links.
          </p>
        </div>
      )}
      <button
        type="submit"
        className={`button ${destructive ? "button-danger" : "button-primary"}`}
        disabled={pending}
      >
        {pending ? pendingLabel : label}
      </button>
    </form>
  );
}
