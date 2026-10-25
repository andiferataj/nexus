import { notFound } from "next/navigation";
import { DomainError } from "@nexus/contracts";
import { collaborationService } from "../../../lib/server";
import { ActionForm } from "../../../components/action-form";
import { day, label } from "../../../components/operation-forms";
import { reviewDeliverableAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Your client portal — Nexus",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function PortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let data;
  try {
    data = await collaborationService.portalSnapshot(token);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }
  return (
    <main className="portal-shell">
      <header className="portal-header">
        <span className="brand">
          <span className="brand-mark">N</span>nexus.
        </span>
        <span>Private client portal</span>
      </header>
      <section className="portal-heading">
        <p className="eyebrow">
          {data.agencyName} / {data.clientName}
        </p>
        <h1>A clear view of your project.</h1>
        <p className="page-description">
          Review shared deliverables, download files, and send your feedback to
          the team.
        </p>
      </section>
      <section className="record-list">
        {data.projects.map((project) => (
          <article className="panel account-panel" key={project.id}>
            <header className="portal-project-heading">
              <h2>{project.name}</h2>
              <span className="role-badge">{label(project.status)}</span>
            </header>
            {project.dueDate && (
              <p className="page-description">
                Target date: {day(project.dueDate)}
              </p>
            )}
            <div className="portal-deliverables">
              {data.files
                .filter((file) => file.projectId === project.id)
                .map((file) => (
                  <section className="record-card portal-file" key={file.id}>
                    <h3>{file.title}</h3>
                    <p className="record-detail">
                      {file.originalName} / {Math.ceil(file.size / 1024)} KB
                    </p>
                    <p className="record-detail">
                      Review: <strong>{label(file.reviewStatus)}</strong>
                    </p>
                    {file.reviewNote && (
                      <p className="record-detail pre-wrap">
                        Your feedback: {file.reviewNote}
                      </p>
                    )}
                    <a
                      className="text-button"
                      href={`/api/portal/${token}/files/${file.id}`}
                    >
                      Download file
                    </a>
                    <details>
                      <summary>Review this deliverable</summary>
                      <ActionForm
                        action={reviewDeliverableAction}
                        label="Send feedback"
                      >
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="id" value={file.id} />
                        <label>
                          Your decision
                          <select name="status" defaultValue="APPROVED">
                            <option value="APPROVED">
                              Approve deliverable
                            </option>
                            <option value="CHANGES_REQUESTED">
                              Request changes
                            </option>
                          </select>
                        </label>
                        <label>
                          Feedback
                          <textarea name="note" rows={3} maxLength={2000} />
                        </label>
                      </ActionForm>
                    </details>
                  </section>
                ))}
              {!data.files.some((file) => file.projectId === project.id) && (
                <p className="page-description">
                  Your agency will share deliverables here when they are ready.
                </p>
              )}
            </div>
          </article>
        ))}
      </section>
      {!data.projects.length && (
        <section className="panel empty-state">
          <h2>Your workspace is ready.</h2>
          <p>Your agency will add your projects here.</p>
        </section>
      )}
      <footer className="landing-footer">
        Keep this link private. Access expires {day(data.expiresAt)} and may be
        withdrawn by your agency.
      </footer>
    </main>
  );
}
