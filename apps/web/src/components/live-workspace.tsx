import Link from "next/link";
import type { OrganizationAccess } from "@nexus/core";
import { projectStatuses, taskStatuses } from "@nexus/contracts";
import { ActionForm } from "./action-form";
import { AccountHeader } from "./account-header";
import { BillingPanel } from "./billing-panel";
import { NotificationFeed } from "./notification-feed";
import {
  ContactPanel,
  CommentPanel,
  FilesPanel,
  PortalPanel,
  AnalyticsPanel,
} from "./collaboration-panels";
import type { CollaborationData } from "./collaboration-panels";
import { KanbanBoard } from "./kanban-board";
import { Icon } from "./icon";
import {
  ClientForm,
  ProjectForm,
  TaskForm,
  DeleteRecord,
  OperationFields,
  day,
  label,
} from "./operation-forms";
import type { WorkspaceData } from "./operation-forms";
import {
  inviteColleagueAction,
  switchWorkspaceAction,
  workspaceAction,
} from "../app/actions";

const views = [
  "overview",
  "clients",
  "projects",
  "tasks",
  "team",
  "activity",
  "notifications",
  "settings",
  "billing",
  "contacts",
  "board",
  "files",
  "portal",
  "analytics",
];
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
type Props = {
  subscriptionBlocked?: boolean;
  extra: CollaborationData;
  data: WorkspaceData;
  workspaces: OrganizationAccess[];
  name: string | null | undefined;
  userId: string;
  view: string;
  query: string;
  status: string;
  projectId: string;
};

export function LiveWorkspace({
  subscriptionBlocked = false,
  data,
  extra,
  workspaces,
  name,
  userId,
  view: requestedView,
  query,
  status,
  projectId,
}: Props) {
  const view = views.includes(requestedView) ? requestedView : "overview",
    org = data.organization.id,
    base = `/workspaces/${org}`;
  const manager = data.membership.role !== "MEMBER",
    owner = data.membership.role === "OWNER",
    term = query.toLowerCase();
  const clients = data.clients.filter((client) =>
    `${client.name} ${client.email} ${client.company}`
      .toLowerCase()
      .includes(term),
  );
  const projects = data.projects.filter(
    (project) =>
      `${project.name} ${project.description}`.toLowerCase().includes(term) &&
      (!status || project.status === status),
  );
  const tasks = data.tasks.filter(
    (task) =>
      `${task.title} ${task.description}`.toLowerCase().includes(term) &&
      (!status || task.status === status) &&
      (!projectId || task.projectId === projectId),
  );
  const unread = data.notifications.filter(
    (notification) => !notification.readAt,
  ).length;
  const title =
    view === "overview"
      ? "Your agency, in focus."
      : (view[0]?.toUpperCase() ?? "") + view.slice(1);
  return (
    <>
      <AccountHeader name={name} />
      <div className="live-shell">
        <aside className="live-sidebar">
          <Link className="text-button" href="/workspaces">
            All workspaces
          </Link>
          <h2>{data.organization.name}</h2>
          <span className="role-badge">{label(data.membership.role)}</span>
          <nav aria-label="Agency navigation">
            {views.map((item) => (
              <Link
                key={item}
                href={`${base}?view=${item}`}
                className={`live-nav-link ${view === item ? "selected" : ""}`}
                aria-current={view === item ? "page" : undefined}
              >
                {item}
                {item === "notifications" && unread > 0 && (
                  <span className="count-badge">{unread}</span>
                )}
              </Link>
            ))}
          </nav>
          <form action={switchWorkspaceAction} className="account-form">
            <label>
              Workspace
              <select name="organizationId" defaultValue={org}>
                {workspaces.map(({ organization }) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button button-secondary">
              Switch workspace
            </button>
          </form>
        </aside>
        <main className="live-content">
          {subscriptionBlocked && (
            <div className="form-error" role="status">
              An active subscription is needed to add or change work. Your
              existing work remains available.{" "}
              <Link className="text-button" href={`${base}?view=billing`}>
                Open billing
              </Link>
            </div>
          )}
          <header className="live-heading">
            <div>
              <p className="eyebrow">{data.organization.name}</p>
              <h1>{title}</h1>
              <p className="page-description">
                {view === "overview"
                  ? "A live view of your people, clients, and work."
                  : `Manage your agency's ${view}.`}
              </p>
            </div>
            <div className="live-heading-status">
              <span className="live-tag">
                <i />
                Live workspace
              </span>
              <NotificationFeed
                organizationId={org}
                initialUnread={unread}
                initialSignature={data.notifications
                  .map(
                    (record) =>
                      `${record.id}:${record.readAt?.toISOString() ?? ""}`,
                  )
                  .join("|")}
              />
            </div>
          </header>
          {["clients", "projects", "tasks"].includes(view) && (
            <form className="live-filter" method="get">
              <input type="hidden" name="view" value={view} />
              <label className="sr-only" htmlFor="workspace-query">
                Search {view}
              </label>
              <input
                id="workspace-query"
                name="q"
                placeholder={`Search ${view}...`}
                defaultValue={query}
                maxLength={120}
              />
              {view !== "clients" && (
                <select
                  name="status"
                  aria-label="Filter by status"
                  defaultValue={status}
                >
                  <option value="">All statuses</option>
                  {(view === "tasks" ? taskStatuses : projectStatuses).map(
                    (item) => (
                      <option key={item} value={item}>
                        {label(item)}
                      </option>
                    ),
                  )}
                </select>
              )}
              {view === "tasks" && (
                <select
                  name="project"
                  aria-label="Filter by project"
                  defaultValue={projectId}
                >
                  <option value="">All projects</option>
                  {data.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              )}
              <button className="button button-secondary">Apply filters</button>
              <Link href={`${base}?view=${view}`} className="text-button">
                Reset
              </Link>
            </form>
          )}

          {view === "contacts" && <ContactPanel data={data} extra={extra} />}
          {view === "files" && <FilesPanel data={data} extra={extra} />}
          {view === "portal" && <PortalPanel data={data} extra={extra} />}
          {view === "analytics" && <AnalyticsPanel data={data} />}
          {view === "board" && <KanbanBoard data={data} userId={userId} />}
          {view === "overview" && (
            <>
              <section className="metric-grid" aria-label="Agency metrics">
                {[
                  ["Clients", data.clients.length],
                  [
                    "Active projects",
                    data.projects.filter(
                      (project) =>
                        !["COMPLETED", "ARCHIVED"].includes(project.status),
                    ).length,
                  ],
                  [
                    "Tasks complete",
                    `${data.tasks.filter((task) => task.status === "DONE").length}/${data.tasks.length}`,
                  ],
                  [
                    "Project budgets",
                    money(
                      data.projects.reduce(
                        (sum, project) => sum + project.budgetCents,
                        0,
                      ),
                    ),
                  ],
                ].map(([text, value]) => (
                  <article className="metric-card" key={text}>
                    <p className="metric-top">{text}</p>
                    <strong className="metric-value">{value}</strong>
                  </article>
                ))}
              </section>
              <div className="account-grid">
                <section className="panel account-panel">
                  <h2>Projects in motion</h2>
                  {data.projects.length ? (
                    data.projects.slice(0, 8).map((project) => (
                      <Link
                        key={project.id}
                        href={`${base}?view=tasks&project=${project.id}`}
                        className="live-list-item"
                      >
                        <strong>{project.name}</strong>
                        <span className="role-badge">
                          {label(project.status)}
                        </span>
                      </Link>
                    ))
                  ) : (
                    <div className="empty-state">
                      <Icon name="folder" size={30} />
                      <h3>Your first project starts here.</h3>
                      <p>
                        Add a client and project to bring your workspace to
                        life.
                      </p>
                      <Link
                        className="text-button"
                        href={`${base}?view=projects`}
                      >
                        Open projects
                      </Link>
                    </div>
                  )}
                </section>
                <section className="panel account-panel">
                  <h2>Recent activity</h2>
                  {data.activity.slice(0, 6).map((event) => (
                    <div className="activity-item" key={event.id}>
                      <strong>
                        {event.action}: {event.entityLabel}
                      </strong>
                      <span>
                        {event.actorName} / {day(event.createdAt)}
                      </span>
                    </div>
                  ))}
                  {!data.activity.length && (
                    <p className="page-description">
                      Your team's activity will appear here.
                    </p>
                  )}
                </section>
              </div>
            </>
          )}

          {view === "clients" && (
            <div className="live-record-layout">
              <section className="record-list">
                {clients.map((client) => (
                  <article className="panel record-card" key={client.id}>
                    <header>
                      <div>
                        <h2>{client.name}</h2>
                        <p>{client.company}</p>
                      </div>
                      <span className="workspace-monogram">
                        {client.name.slice(0, 2).toUpperCase()}
                      </span>
                    </header>
                    <p className="record-detail">
                      {client.email || "No contact email"}
                    </p>
                    <p className="record-detail pre-wrap">{client.notes}</p>
                    {manager && (
                      <>
                        <details>
                          <summary>Edit client</summary>
                          <ClientForm org={org} client={client} />
                        </details>
                        <DeleteRecord org={org} kind="client" id={client.id} />
                      </>
                    )}
                  </article>
                ))}
                {!clients.length && (
                  <div className="panel empty-state">
                    <h3>No clients found</h3>
                    <p>Add your first client, or try another search.</p>
                  </div>
                )}
              </section>
              {manager && (
                <section className="panel account-panel sticky-form">
                  <h2>Add a client</h2>
                  <ClientForm org={org} />
                </section>
              )}
            </div>
          )}

          {view === "projects" && (
            <div className="live-record-layout">
              <section className="record-list">
                {projects.map((project) => (
                  <article className="panel record-card" key={project.id}>
                    <header>
                      <div>
                        <h2>{project.name}</h2>
                        <p>
                          {data.clients.find(
                            (client) => client.id === project.clientId,
                          )?.name ?? "Internal project"}
                        </p>
                      </div>
                      <span className="role-badge">
                        {label(project.status)}
                      </span>
                    </header>
                    <p className="record-detail pre-wrap">
                      {project.description}
                    </p>
                    <div className="record-facts">
                      <span>
                        Budget <strong>{money(project.budgetCents)}</strong>
                      </span>
                      <span>
                        Due{" "}
                        <strong>{day(project.dueDate) || "No deadline"}</strong>
                      </span>
                      <span>
                        Tasks{" "}
                        <strong>
                          {
                            data.tasks.filter(
                              (task) =>
                                task.projectId === project.id &&
                                task.status === "DONE",
                            ).length
                          }
                          /
                          {
                            data.tasks.filter(
                              (task) => task.projectId === project.id,
                            ).length
                          }
                        </strong>
                      </span>
                    </div>
                    <Link
                      href={`${base}?view=tasks&project=${project.id}`}
                      className="text-button"
                    >
                      View tasks <Icon name="arrow" size={15} />
                    </Link>
                    {manager && (
                      <>
                        <details>
                          <summary>Edit project</summary>
                          <ProjectForm data={data} project={project} />
                        </details>
                        <DeleteRecord
                          org={org}
                          kind="project"
                          id={project.id}
                        />
                      </>
                    )}
                  </article>
                ))}
                {!projects.length && (
                  <div className="panel empty-state">
                    <h3>No projects found</h3>
                    <p>Create your first project or adjust the filters.</p>
                  </div>
                )}
              </section>
              {manager && (
                <section className="panel account-panel sticky-form">
                  <h2>Create a project</h2>
                  <ProjectForm data={data} />
                </section>
              )}
            </div>
          )}

          {view === "tasks" && (
            <div className="live-record-layout">
              <section className="record-list">
                {tasks.map((task) => (
                  <article className="panel record-card" key={task.id}>
                    <header>
                      <div>
                        <h2>{task.title}</h2>
                        <p>
                          {
                            data.projects.find(
                              (project) => project.id === task.projectId,
                            )?.name
                          }
                        </p>
                      </div>
                      <span
                        className={`task-status task-${task.status.toLowerCase()}`}
                      >
                        {label(task.status)}
                      </span>
                    </header>
                    <p className="record-detail pre-wrap">{task.description}</p>
                    <div className="record-facts">
                      <span>
                        Assignee{" "}
                        <strong>
                          {data.members.find(
                            (member) => member.userId === task.assigneeId,
                          )?.name ?? "Unassigned"}
                        </strong>
                      </span>
                      <span>
                        Priority <strong>{label(task.priority)}</strong>
                      </span>
                      <span>
                        Due{" "}
                        <strong>{day(task.dueDate) || "No deadline"}</strong>
                      </span>
                    </div>
                    {(manager ||
                      task.assigneeId === userId ||
                      task.createdById === userId) && (
                      <details>
                        <summary>Edit task</summary>
                        <TaskForm data={data} task={task} userId={userId} />
                      </details>
                    )}
                    {(manager || task.createdById === userId) && (
                      <DeleteRecord org={org} kind="task" id={task.id} />
                    )}
                    <CommentPanel
                      org={org}
                      taskId={task.id}
                      extra={extra}
                      userId={userId}
                      manager={manager}
                    />
                  </article>
                ))}
                {!tasks.length && (
                  <div className="panel empty-state">
                    <h3>No tasks found</h3>
                    <p>Create a task or adjust the filters.</p>
                  </div>
                )}
              </section>
              <section className="panel account-panel sticky-form">
                <h2>Create a task</h2>
                {data.projects.some(
                  (project) => project.status !== "ARCHIVED",
                ) ? (
                  <TaskForm data={data} userId={userId} />
                ) : (
                  <p className="page-description">
                    Create a project before adding tasks.
                  </p>
                )}
              </section>
            </div>
          )}

          {view === "team" && (
            <div className="account-grid">
              <section className="record-list">
                {data.members.map((member) => (
                  <article
                    className="panel record-card"
                    key={member.membershipId}
                  >
                    <header>
                      <div>
                        <h2>{member.name ?? "Team member"}</h2>
                        <p>{member.email}</p>
                      </div>
                      <span className="role-badge">{label(member.role)}</span>
                    </header>
                    {owner && (
                      <>
                        <ActionForm
                          action={workspaceAction}
                          label="Update role"
                          compact
                        >
                          <OperationFields org={org} operation="member.role" />
                          <input
                            type="hidden"
                            name="userId"
                            value={member.userId}
                          />
                          <label>
                            Role for {member.name ?? member.email}
                            <select name="role" defaultValue={member.role}>
                              <option>OWNER</option>
                              <option>ADMIN</option>
                              <option>MEMBER</option>
                            </select>
                          </label>
                        </ActionForm>
                        <ActionForm
                          action={workspaceAction}
                          label="Remove member"
                          compact
                          destructive
                          confirmMessage="Remove this person from the agency? Their assigned tasks will become unassigned."
                        >
                          <OperationFields
                            org={org}
                            operation="member.remove"
                          />
                          <input
                            type="hidden"
                            name="userId"
                            value={member.userId}
                          />
                        </ActionForm>
                      </>
                    )}
                  </article>
                ))}
              </section>
              {manager && (
                <section className="panel account-panel sticky-form">
                  <h2>Invite a colleague</h2>
                  <ActionForm
                    action={inviteColleagueAction}
                    label="Create invitation link"
                  >
                    <input type="hidden" name="organizationId" value={org} />
                    <label>
                      Email address
                      <input
                        name="email"
                        type="email"
                        required
                        maxLength={254}
                      />
                    </label>
                    <label>
                      Workspace role
                      <select name="role" defaultValue="MEMBER">
                        <option value="MEMBER">Member</option>
                        {owner && <option value="ADMIN">Admin</option>}
                      </select>
                    </label>
                  </ActionForm>
                </section>
              )}
            </div>
          )}

          {view === "activity" && (
            <section className="panel account-panel">
              <h2>Agency activity</h2>
              <p className="page-description">
                The latest 50 changes in your agency.
              </p>
              {data.activity.map((event) => (
                <div className="activity-item" key={event.id}>
                  <strong>
                    {event.action}: {event.entityLabel}
                  </strong>
                  <span>
                    {event.actorName} /{" "}
                    {event.createdAt
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 19)}{" "}
                    UTC
                  </span>
                </div>
              ))}
              {!data.activity.length && (
                <div className="empty-state">
                  <h3>No activity yet</h3>
                </div>
              )}
            </section>
          )}

          {view === "notifications" && (
            <section className="record-list">
              {data.notifications.map((notification) => (
                <article
                  key={notification.id}
                  className={`panel record-card ${notification.readAt ? "notification-read" : "notification-unread"}`}
                >
                  <h2>{notification.title}</h2>
                  <p className="record-detail">{notification.message}</p>
                  <p className="muted">{day(notification.createdAt)}</p>
                  {!notification.readAt && (
                    <ActionForm
                      action={workspaceAction}
                      label="Mark as read"
                      compact
                    >
                      <OperationFields
                        org={org}
                        operation="notification.read"
                        id={notification.id}
                      />
                    </ActionForm>
                  )}
                </article>
              ))}
              {!data.notifications.length && (
                <div className="panel empty-state">
                  <Icon name="check" size={30} />
                  <h3>You're all caught up.</h3>
                  <p>Task assignments will appear here.</p>
                </div>
              )}
            </section>
          )}

          {view === "settings" && (
            <section className="panel account-panel settings-panel">
              <h2>Agency settings</h2>
              <p className="page-description">
                Workspace URL: /{data.organization.slug}
              </p>
              {owner ? (
                <ActionForm action={workspaceAction} label="Save agency name">
                  <OperationFields org={org} operation="agency.rename" />
                  <label>
                    Agency name
                    <input
                      name="name"
                      defaultValue={data.organization.name}
                      minLength={2}
                      maxLength={80}
                      required
                    />
                  </label>
                </ActionForm>
              ) : (
                <p className="page-description">
                  An agency owner can change these settings.
                </p>
              )}
              <div className="settings-note">
                <h3>Your access</h3>
                <p>
                  You are a {label(data.membership.role)}. Owners manage access
                  and billing. Admins manage projects and clients. Members
                  contribute to tasks.
                </p>
              </div>
            </section>
          )}
          {view === "billing" && (
            <BillingPanel organizationId={org} isOwner={owner} />
          )}
          <footer className="workspace-footer">
            <span>Nexus / One workspace. Clearer work.</span>
            <span>
              {data.clients.length} clients / {data.projects.length} projects /{" "}
              {data.members.length} people
            </span>
          </footer>
        </main>
      </div>
    </>
  );
}
