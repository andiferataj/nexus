import { signOutAction } from "../app/actions";

export function AccountHeader({ name }: { name: string | null | undefined }) {
  return (
    <header className="account-header">
      <a className="brand" href="/workspaces">
        <span className="brand-mark">N</span>
        <span>
          nexus<span className="brand-dot">.</span>
        </span>
      </a>
      <div>
        <span>{name ?? "Your workspace"}</span>
        <form action={signOutAction}>
          <button className="button button-secondary" type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
