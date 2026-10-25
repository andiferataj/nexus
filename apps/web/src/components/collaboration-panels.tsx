import type { CollaborationService } from "@nexus/core";
import type { WorkspaceData } from "./operation-forms";
import { day, label, OperationFields } from "./operation-forms";
import { ActionForm } from "./action-form";
import { workspaceAction, uploadFileAction } from "../app/actions";

export type CollaborationData = Awaited<
  ReturnType<CollaborationService["snapshot"]>
>;

export function ContactPanel({
  data,
  extra,
}: {
  data: WorkspaceData;
  extra: CollaborationData;
}) {
  const org = data.organization.id,
    manager = data.membership.role !== "MEMBER";
  return (
    <div className="live-record-layout">
      <section className="record-list">
        {extra.contacts.map((contact) => (
          <article className="panel record-card" key={contact.id}>
            <h2>{contact.name}</h2>
            <p className="record-detail">
              {
                data.clients.find((client) => client.id === contact.clientId)
                  ?.name
              }{" "}
              / {contact.title}
            </p>
            <p className="record-detail">
              {contact.email} {contact.phone}
            </p>
            {manager && (
              <ActionForm
                action={workspaceAction}
                label="Remove contact"
                compact
                destructive
                confirmMessage="Remove this contact?"
              >
                <OperationFields
                  org={org}
                  operation="contact.remove"
                  id={contact.id}
                />
              </ActionForm>
            )}
          </article>
        ))}
        {!extra.contacts.length && (
          <div className="panel empty-state">
            <h3>No contacts yet</h3>
            <p>Add the people you work with at each client.</p>
          </div>
        )}
      </section>
      {manager && (
        <section className="panel account-panel sticky-form">
          <h2>Add a contact</h2>
          {data.clients.length ? (
            <ActionForm action={workspaceAction} label="Add contact">
              <OperationFields org={org} operation="contact.add" />
              <label>
                Client
                <select name="clientId" required>
                  {data.clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Contact name
                <input name="name" required minLength={2} maxLength={80} />
              </label>
              <label>
                Email
                <input name="email" type="email" maxLength={254} />
              </label>
              <label>
                Phone
                <input name="phone" type="tel" maxLength={60} />
              </label>
              <label>
                Job title
                <input name="title" maxLength={120} />
              </label>
            </ActionForm>
          ) : (
            <p className="page-description">
              Add a client before adding contacts.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function CommentPanel({
  org,
  taskId,
  extra,
  userId,
  manager,
}: {
  org: string;
  taskId: string;
  extra: CollaborationData;
  userId: string;
  manager: boolean;
}) {
  return (
    <details className="task-comments">
      <summary>
        Comments (
        {extra.comments.filter((comment) => comment.taskId === taskId).length})
      </summary>
      {extra.comments
        .filter((comment) => comment.taskId === taskId)
        .map((comment) => (
          <div className="task-comment" key={comment.id}>
            <strong>{comment.authorName}</strong>
            <span>{day(comment.createdAt)}</span>
            <p className="pre-wrap">{comment.body}</p>
            {(manager || comment.authorId === userId) && (
              <ActionForm
                action={workspaceAction}
                label="Remove comment"
                compact
                destructive
              >
                <OperationFields
                  org={org}
                  operation="comment.remove"
                  id={comment.id}
                />
              </ActionForm>
            )}
          </div>
        ))}
      <ActionForm action={workspaceAction} label="Post comment">
        <OperationFields org={org} operation="comment.add" />
        <input type="hidden" name="taskId" value={taskId} />
        <label>
          Comment
          <textarea name="body" required maxLength={2000} rows={3} />
        </label>
      </ActionForm>
    </details>
  );
}

export function FilesPanel({
  data,
  extra,
}: {
  data: WorkspaceData;
  extra: CollaborationData;
}) {
  const org = data.organization.id,
    manager = data.membership.role !== "MEMBER";
  return (
    <div className="live-record-layout">
      <section className="record-list">
        {extra.files.map((file) => (
          <article className="panel record-card" key={file.id}>
            <header>
              <div>
                <h2>{file.title}</h2>
                <p>
                  {
                    data.projects.find(
                      (project) => project.id === file.projectId,
                    )?.name
                  }
                </p>
              </div>
              <span className="role-badge">
                {file.published ? label(file.reviewStatus) : "private"}
              </span>
            </header>
            <p className="record-detail">
              {file.originalName} / {Math.ceil(file.size / 1024)} KB
            </p>
            <a
              className="text-button"
              href={`/api/workspaces/${org}/files/${file.id}`}
            >
              Download file
            </a>
            {file.reviewNote && (
              <p className="record-detail pre-wrap">
                Client feedback: {file.reviewNote}
              </p>
            )}
            {manager && (
              <>
                <ActionForm
                  action={workspaceAction}
                  label={
                    file.published
                      ? "Withdraw from client portal"
                      : "Share with client for review"
                  }
                  compact
                >
                  <OperationFields
                    org={org}
                    operation="file.publish"
                    id={file.id}
                  />
                  <input
                    type="hidden"
                    name="published"
                    value={String(!file.published)}
                  />
                </ActionForm>
                <ActionForm
                  action={workspaceAction}
                  label="Delete file"
                  compact
                  destructive
                  confirmMessage="Delete this file permanently?"
                >
                  <OperationFields
                    org={org}
                    operation="file.remove"
                    id={file.id}
                  />
                </ActionForm>
              </>
            )}
          </article>
        ))}
        {!extra.files.length && (
          <div className="panel empty-state">
            <h3>No files yet</h3>
            <p>
              Upload project files, then share deliverables with your client
              when they are ready.
            </p>
          </div>
        )}
      </section>
      {manager && (
        <section className="panel account-panel sticky-form">
          <h2>Upload a project file</h2>
          {data.projects.length ? (
            <ActionForm
              action={uploadFileAction}
              label="Upload file"
              pendingLabel="Uploading…"
            >
              <input type="hidden" name="organizationId" value={org} />
              <label>
                Title
                <input name="title" required minLength={2} maxLength={80} />
              </label>
              <label>
                Project
                <select name="projectId" required>
                  {data.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                File
                <input
                  type="file"
                  name="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv"
                  required
                />
              </label>
              <p className="field-hint">
                Up to 20 MB. PDF, images, plain text, or CSV. Files are private
                until you choose to share them.
              </p>
            </ActionForm>
          ) : (
            <p className="page-description">
              Create a project before uploading a file.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

export function PortalPanel({
  data,
  extra,
}: {
  data: WorkspaceData;
  extra: CollaborationData;
}) {
  const org = data.organization.id;
  if (data.membership.role === "MEMBER")
    return (
      <section className="panel account-panel">
        <p>An agency owner or admin can manage client access.</p>
      </section>
    );
  return (
    <section className="record-list">
      {data.clients.map((client) => {
        const access = extra.portalAccess.find(
            (grant) => grant.clientId === client.id,
          ),
          active = access && !access.revokedAt && access.expiresAt > new Date();
        return (
          <article className="panel record-card" key={client.id}>
            <h2>{client.name}</h2>
            <p className="record-detail">
              {active
                ? `Access active until ${day(access.expiresAt)}`
                : "No active portal access"}
            </p>
            <p className="record-detail">
              Clients see their project names, target dates, and files you
              explicitly share. A new link replaces the previous link.
            </p>
            <ActionForm
              action={workspaceAction}
              label={active ? "Replace portal link" : "Create portal link"}
              compact
            >
              <OperationFields org={org} operation="portal.issue" />
              <input type="hidden" name="clientId" value={client.id} />
            </ActionForm>
            {active && (
              <ActionForm
                action={workspaceAction}
                label="Revoke client access"
                compact
                destructive
                confirmMessage="Revoke this client's portal link immediately?"
              >
                <OperationFields
                  org={org}
                  operation="portal.revoke"
                  id={access.id}
                />
              </ActionForm>
            )}
          </article>
        );
      })}
      {!data.clients.length && (
        <div className="panel empty-state">
          <h3>Add your first client</h3>
          <p>You can create a private portal link for each client.</p>
        </div>
      )}
    </section>
  );
}

export function AnalyticsPanel({ data }: { data: WorkspaceData }) {
  const today = new Date().toISOString().slice(0, 10),
    done = data.tasks.filter((task) => task.status === "DONE").length;
  const overdue = data.tasks.filter(
    (task) =>
      task.status !== "DONE" && task.dueDate && day(task.dueDate) < today,
  ).length;
  return (
    <>
      <section className="metric-grid">
        {[
          [
            "Task completion",
            `${data.tasks.length ? Math.round((done / data.tasks.length) * 100) : 0}%`,
          ],
          ["Overdue tasks", overdue],
          [
            "Projects delivered",
            data.projects.filter((project) => project.status === "COMPLETED")
              .length,
          ],
          ["Team members", data.members.length],
        ].map(([title, value]) => (
          <article className="metric-card" key={title}>
            <p className="metric-top">{title}</p>
            <strong className="metric-value">{value}</strong>
          </article>
        ))}
      </section>
      <section className="panel account-panel">
        <h2>Project progress</h2>
        {data.projects.map((project) => {
          const tasks = data.tasks.filter(
              (task) => task.projectId === project.id,
            ),
            completed = tasks.filter((task) => task.status === "DONE").length;
          return (
            <div className="analytics-row" key={project.id}>
              <strong>{project.name}</strong>
              <progress
                max={tasks.length || 1}
                value={completed}
                aria-label={`${project.name} task completion`}
              />
              <span>
                {completed}/{tasks.length} tasks
              </span>
            </div>
          );
        })}
        {!data.projects.length && (
          <p className="page-description">
            Progress will appear as your team creates projects and tasks.
          </p>
        )}
      </section>
      <section className="panel account-panel">
        <h2>Team workload</h2>
        {data.members.map((member) => (
          <div className="live-list-item" key={member.userId}>
            <strong>{member.name ?? member.email}</strong>
            <span>
              {
                data.tasks.filter(
                  (task) =>
                    task.assigneeId === member.userId && task.status !== "DONE",
                ).length
              }{" "}
              open tasks
            </span>
          </div>
        ))}
      </section>
    </>
  );
}
