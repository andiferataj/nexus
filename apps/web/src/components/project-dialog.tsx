"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import { validateProjectInput } from "../lib/workspace";
import type { ProjectInput } from "../lib/workspace";
import { Icon } from "./icon";

export function ProjectDialog({
  open,
  organizationName,
  onClose,
  onCreate,
}: {
  open: boolean;
  organizationName: string;
  onClose: () => void;
  onCreate: (input: ProjectInput) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const errorId = useId();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      setError(null);
      dialog.showModal();
      nameInputRef.current?.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input: ProjectInput = {
      name: String(data.get("name") ?? ""),
      client: String(data.get("client") ?? ""),
      budget: String(data.get("budget") ?? ""),
      dueDate: String(data.get("dueDate") ?? ""),
    };
    const message = validateProjectInput(input);
    if (message) {
      setError(message);
      return;
    }
    onCreate(input);
    event.currentTarget.reset();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="project-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
      onClose={onClose}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">LET’S MAKE SOMETHING</p>
          <h2 id={titleId}>A new project</h2>
        </div>
        <button
          className="icon-button"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <Icon name="close" />
        </button>
      </div>
      <p className="muted dialog-description">
        Add a project to {organizationName}.
      </p>
      <form onSubmit={submit} aria-describedby={error ? errorId : undefined}>
        <label>
          Project name
          <input
            ref={nameInputRef}
            name="name"
            placeholder="e.g. A fresh start for Acme"
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <label>
          Client name
          <input
            name="client"
            placeholder="e.g. Acme Studio"
            required
            minLength={2}
            maxLength={80}
          />
        </label>
        <div className="form-row">
          <label>
            Budget (USD)
            <input
              name="budget"
              type="number"
              placeholder="5000"
              required
              min="0"
              max="9999999"
              step="0.01"
            />
          </label>
          <label>
            Due date
            <input name="dueDate" type="date" required />
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert" id={errorId}>
            {error}
          </p>
        )}
        <p className="dialog-note">
          Demo projects stay in this tab and reset when you refresh.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button button-primary" type="submit">
            Create project
            <Icon name="arrow" size={17} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
