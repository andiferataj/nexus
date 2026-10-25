"use client";

import { useEffect, useRef, useState } from "react";
import { createOrganizationSlug } from "@nexus/shared";
import {
  createProject,
  filterProjects,
  formatDate,
  formatMoney,
  getWorkspaceData,
  initialProjects,
  initials,
  organizations,
  teamMembers,
} from "../lib/workspace";
import type {
  Project,
  ProjectInput,
  ProjectStatus,
  TeamMember,
  WorkspaceView,
} from "../lib/workspace";
import { Icon } from "./icon";
import type { IconName } from "./icon";
import { ProjectDialog } from "./project-dialog";

const navigation: { id: WorkspaceView; label: string; icon: IconName }[] = [
  { id: "overview", label: "Overview", icon: "grid" },
  { id: "projects", label: "Projects", icon: "folder" },
  { id: "team", label: "Team", icon: "people" },
];

const headings: Record<WorkspaceView, { title: string; description: string }> =
  {
    overview: {
      title: "Good things are taking shape.",
      description: "Your people, projects, and progress. All in one place.",
    },
    projects: {
      title: "Big ideas. Moving forward.",
      description: "A little structure for your next great thing.",
    },
    team: {
      title: "Great work starts with people.",
      description: "Meet the minds behind your agency’s next chapter.",
    },
  };

export function WorkspaceApp() {
  const [organizationId, setOrganizationId] = useState("org-northstar");
  const [view, setView] = useState<WorkspaceView>("overview");
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "All">("All");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const organization = organizations.find((item) => item.id === organizationId);
  const workspace = getWorkspaceData(organizationId, projects, teamMembers);
  const visibleProjects = filterProjects(workspace.projects, query, status);
  const visibleMembers = workspace.members.filter((member) =>
    `${member.name} ${member.title} ${member.email}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
      const target = event.target;
      if (
        event.key === "/" &&
        !dialogOpen &&
        !(
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
        )
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dialogOpen]);

  if (!organization) return null;

  function navigate(nextView: WorkspaceView) {
    setView(nextView);
    setMenuOpen(false);
    setQuery("");
    setStatus("All");
  }

  function addProject(input: ProjectInput) {
    const project = createProject(input, organizationId, crypto.randomUUID());
    setProjects((previous) => [project, ...previous]);
    navigate("projects");
    setAnnouncement(
      `${project.name} created in ${organization?.name ?? "your workspace"}.`,
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {menuOpen && (
        <button
          className="navigation-backdrop"
          aria-label="Close navigation"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`sidebar ${menuOpen ? "is-open" : ""}`}
        id="workspace-navigation"
      >
        <a className="brand" href="/" aria-label="Nexus home">
          <span className="brand-mark">N</span>
          <span>
            nexus<span className="brand-dot">.</span>
          </span>
        </a>
        <div className="workspace-switcher">
          <span className="workspace-monogram">
            {initials(organization.name)}
          </span>
          <div>
            <label htmlFor="workspace-select">YOUR WORKSPACE</label>
            <select
              id="workspace-select"
              aria-label="Active workspace"
              value={organizationId}
              onChange={(event) => {
                setOrganizationId(event.target.value);
                setAnnouncement("");
                navigate("overview");
              }}
            >
              {organizations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="navigation-label">WORKSPACE</p>
        <nav aria-label="Workspace">
          <ul className="navigation-list">
            {navigation.map((item) => (
              <li key={item.id}>
                <button
                  className={`navigation-item ${view === item.id ? "active" : ""}`}
                  aria-current={view === item.id ? "page" : undefined}
                  onClick={() => navigate(item.id)}
                >
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                  {item.id === "projects" && (
                    <span className="navigation-count">
                      {workspace.projects.length}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-spark">
              <Icon name="spark" size={23} />
            </span>
            <h2>
              Less busywork.
              <br />
              More good work.
            </h2>
            <p>
              A shared space to do
              <br />
              your best work together.
            </p>
            <span className="note-line" />
          </div>
          <div className="profile">
            <span className="avatar avatar-green">AF</span>
            <div>
              <strong>Andi Ferataj</strong>
              <span>Agency founder</span>
            </div>
            <span className="profile-dot" aria-label="Demo profile" />
          </div>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <Icon name="menu" />
            </button>
            <span>{organization.name}</span>
            <span className="breadcrumb-slash">/</span>
            <strong>
              {navigation.find((item) => item.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-actions">
            <span className="demo-badge">
              <span />
              Demo workspace
            </span>
            <a href="/workspaces" className="topbar-link">
              Open workspace
            </a>
          </div>
        </header>
        <main id="main-content" className="main-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</p>
              <h1>{headings[view].title}</h1>
              <p className="page-description">{headings[view].description}</p>
            </div>
            <button
              className="button button-primary"
              onClick={() => setDialogOpen(true)}
            >
              <Icon name="plus" size={18} />
              New project
            </button>
          </div>
          <div className="workspace-toolbar">
            <div className="search-field">
              <Icon name="search" size={18} />
              <input
                ref={searchRef}
                aria-label="Search workspace"
                placeholder={
                  view === "team"
                    ? "Search people by name, role, or email…"
                    : "Search projects or clients…"
                }
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {query ? (
                <button
                  aria-label="Clear search"
                  className="icon-button search-clear"
                  onClick={() => setQuery("")}
                >
                  <Icon name="close" size={15} />
                </button>
              ) : (
                <kbd>/</kbd>
              )}
            </div>
            <span className="workspace-address">
              /{createOrganizationSlug(organization.name)}
            </span>
          </div>
          <p className="live-announcement" role="status">
            {announcement}
          </p>

          {view === "overview" && (
            <>
              <section className="metric-grid" aria-label="Workspace metrics">
                <Metric
                  label="Active projects"
                  value={String(workspace.activeProjects).padStart(2, "0")}
                  detail={`${workspace.completedProjects} completed project${workspace.completedProjects === 1 ? "" : "s"}`}
                  icon="folder"
                />
                <Metric
                  label="Delivery progress"
                  value={`${workspace.progress}%`}
                  detail={`${workspace.completedTasks} of ${workspace.totalTasks} tasks done`}
                  icon="chart"
                />
                <Metric
                  label="Your people"
                  value={String(workspace.members.length).padStart(2, "0")}
                  detail="Making good things happen"
                  icon="people"
                />
                <Metric
                  label="Project value"
                  value={formatMoney(workspace.budgetCents)}
                  detail="Across all workspace projects"
                  icon="wallet"
                />
              </section>
              <div className="overview-grid">
                <section className="panel projects-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="eyebrow">THE BIG PICTURE</p>
                      <h2>
                        Project pulse
                        <span className="count-badge">
                          {workspace.projects.length}
                        </span>
                      </h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("projects")}
                    >
                      View all
                      <Icon name="arrow" size={16} />
                    </button>
                  </div>
                  <ProjectTable
                    projects={visibleProjects.slice(0, 4)}
                    emptyText={
                      query
                        ? "No projects match your search."
                        : "Your first project starts here."
                    }
                  />
                </section>
                <section className="panel delivery-panel">
                  <p className="eyebrow">ONE TASK AT A TIME</p>
                  <h2>Forward looks good.</h2>
                  <div
                    className="progress-orbit"
                    style={{
                      background: `conic-gradient(var(--green) ${workspace.progress}%, var(--line) 0)`,
                    }}
                    role="img"
                    aria-label={`${workspace.progress}% of tasks complete`}
                  >
                    <div>
                      <strong>
                        {workspace.progress}
                        <span>%</span>
                      </strong>
                      <span>tasks complete</span>
                    </div>
                  </div>
                  <div className="delivery-stats">
                    <span>
                      <i className="legend-dot green-dot" />
                      Completed<strong>{workspace.completedTasks}</strong>
                    </span>
                    <span>
                      <i className="legend-dot light-dot" />
                      Still to come
                      <strong>
                        {workspace.totalTasks - workspace.completedTasks}
                      </strong>
                    </span>
                  </div>
                  <p className="delivery-note">A little progress, every day.</p>
                </section>
              </div>
              <section className="team-banner">
                <div>
                  <span className="eyebrow">BETTER, TOGETHER</span>
                  <h2>Good people. Great possibilities.</h2>
                  <p>Your next great project starts with the right team.</p>
                </div>
                <div className="team-banner-action">
                  <div className="avatar-stack">
                    {workspace.members.map((member) => (
                      <span
                        className={`avatar avatar-${member.color}`}
                        title={member.name}
                        key={member.id}
                      >
                        {initials(member.name)}
                      </span>
                    ))}
                  </div>
                  <button
                    className="button button-secondary"
                    onClick={() => navigate("team")}
                  >
                    Meet your team
                    <Icon name="arrow" size={16} />
                  </button>
                </div>
              </section>
            </>
          )}

          {view === "projects" && (
            <section className="panel projects-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">FROM IDEA TO DONE</p>
                  <h2>
                    All projects
                    <span className="count-badge">
                      {visibleProjects.length}
                    </span>
                  </h2>
                </div>
                <label className="status-filter">
                  <span className="sr-only">Filter by status</span>
                  <select
                    aria-label="Filter by status"
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as ProjectStatus | "All")
                    }
                  >
                    <option value="All">All statuses</option>
                    <option>In progress</option>
                    <option>In review</option>
                    <option>Completed</option>
                  </select>
                </label>
              </div>
              <ProjectTable
                projects={visibleProjects}
                emptyText={
                  query || status !== "All"
                    ? "No projects match these filters. Try another search or status."
                    : "No projects yet. Create your first one to get started."
                }
              />
            </section>
          )}

          {view === "team" && (
            <section aria-label="Team members">
              <div className="section-heading">
                <h2>
                  The people behind the work
                  <span className="count-badge">{visibleMembers.length}</span>
                </h2>
                <span className="muted">{organization.name}</span>
              </div>
              {visibleMembers.length ? (
                <div className="people-grid">
                  {visibleMembers.map((member) => (
                    <MemberCard key={member.id} member={member} />
                  ))}
                </div>
              ) : (
                <div className="panel empty-state">
                  <Icon name="people" size={28} />
                  <h3>No people found</h3>
                  <p>Try searching for another name, title, or email.</p>
                </div>
              )}
            </section>
          )}

          <footer className="workspace-footer">
            <span>
              <span className="footer-mark">✳</span> A little more connected.
            </span>
            <span>Sample data · Changes reset on refresh</span>
          </footer>
        </main>
      </div>
      <ProjectDialog
        open={dialogOpen}
        organizationName={organization.name}
        onClose={() => setDialogOpen(false)}
        onCreate={addProject}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: IconName;
}) {
  return (
    <article className="metric-card">
      <div className="metric-top">
        <span>{label}</span>
        <Icon name={icon} size={19} />
      </div>
      <strong className="metric-value">{value}</strong>
      <span className="metric-detail">{detail}</span>
    </article>
  );
}

function ProjectTable({
  projects,
  emptyText,
}: {
  projects: readonly Project[];
  emptyText: string;
}) {
  if (!projects.length)
    return (
      <div className="empty-state">
        <Icon name="folder" size={28} />
        <h3>No projects to show</h3>
        <p>{emptyText}</p>
      </div>
    );
  return (
    <div className="table-scroll">
      <table className="project-table">
        <caption className="sr-only">Projects in the active workspace</caption>
        <thead>
          <tr>
            <th scope="col">PROJECT</th>
            <th scope="col">STATUS</th>
            <th scope="col">PROGRESS</th>
            <th scope="col">DUE DATE</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const progress =
              project.totalTasks === 0
                ? 0
                : Math.round(
                    (project.completedTasks / project.totalTasks) * 100,
                  );
            return (
              <tr key={project.id}>
                <td>
                  <div className="project-name">
                    <span className={`project-monogram color-${project.color}`}>
                      {initials(project.client)}
                    </span>
                    <div>
                      <strong>{project.name}</strong>
                      <span>{project.client}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className={`status-pill status-${project.status.toLowerCase().replace(/ /g, "-")}`}
                  >
                    <i />
                    {project.status}
                  </span>
                </td>
                <td>
                  <div className="table-progress">
                    <progress
                      max={100}
                      value={progress}
                      aria-label={`${project.name} progress`}
                    />
                    <span>{progress}%</span>
                  </div>
                </td>
                <td className="date-cell">
                  <time dateTime={project.dueDate}>
                    {formatDate(project.dueDate)}
                  </time>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MemberCard({ member }: { member: TeamMember }) {
  return (
    <article className="panel member-card">
      <div className="member-top">
        <span className={`avatar avatar-large avatar-${member.color}`}>
          {initials(member.name)}
        </span>
        <span
          className={`role-badge ${member.role === "OWNER" ? "role-owner" : ""}`}
        >
          {member.role === "OWNER"
            ? "Owner"
            : member.role === "ADMIN"
              ? "Admin"
              : "Member"}
        </span>
      </div>
      <h3>{member.name}</h3>
      <p>{member.title}</p>
      <span className="member-email">{member.email}</span>
    </article>
  );
}
