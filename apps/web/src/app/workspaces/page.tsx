import { AccountHeader } from "../../components/account-header";
import { ActionForm } from "../../components/action-form";
import { organizationService, requireSession } from "../../lib/server";
import { createAgencyAction } from "../actions";

export const runtime = "nodejs";

export default async function WorkspacesPage() {
  const session = await requireSession();
  const workspaces = await organizationService.list({
    userId: session.user.id,
  });
  return (
    <>
      <AccountHeader name={session.user.name} />
      <main className="account-content">
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR SPACE TO MAKE THINGS HAPPEN</p>
            <h1>Your workspaces.</h1>
            <p className="page-description">
              Choose an agency or create a new one.
            </p>
          </div>
        </div>
        <div className="account-grid">
          <section>
            <h2 className="account-section-heading">Your agencies</h2>
            {workspaces.length ? (
              <div className="workspace-card-list">
                {workspaces.map(({ organization, membership }) => (
                  <a
                    className="panel workspace-card"
                    href={`/workspaces/${organization.id}`}
                    key={organization.id}
                  >
                    <span className="workspace-monogram">
                      {organization.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <h3>{organization.name}</h3>
                      <p>/{organization.slug}</p>
                    </div>
                    <span className="role-badge">
                      {membership.role.toLowerCase()}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="panel empty-state">
                <h3>A fresh start.</h3>
                <p>
                  Create your first agency, or ask a colleague for an
                  invitation.
                </p>
              </div>
            )}
          </section>
          <section className="panel account-panel">
            <p className="eyebrow">BUILD SOMETHING TOGETHER</p>
            <h2>Create an agency</h2>
            <ActionForm action={createAgencyAction} label="Create agency">
              <label>
                Agency name
                <input
                  name="name"
                  placeholder="e.g. Northstar Studio"
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <label>
                Workspace URL name{" "}
                <span className="field-hint">
                  Optional · generated from the agency name
                </span>
                <input
                  name="slug"
                  placeholder="northstar-studio"
                  minLength={2}
                  maxLength={63}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                />
              </label>
            </ActionForm>
          </section>
        </div>
      </main>
    </>
  );
}
