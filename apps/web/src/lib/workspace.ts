import type { Organization, OrganizationRole } from "@nexus/shared";

export type WorkspaceView = "overview" | "projects" | "team";
export type ProjectStatus = "In progress" | "In review" | "Completed";

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  client: string;
  status: ProjectStatus;
  budgetCents: number;
  completedTasks: number;
  totalTasks: number;
  dueDate: string;
  color: "green" | "blue" | "purple" | "orange";
}

export interface TeamMember {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  title: string;
  role: OrganizationRole;
  color: string;
}

export interface ProjectInput {
  name: string;
  client: string;
  budget: string;
  dueDate: string;
}

export const organizations: Organization[] = [
  {
    id: "org-northstar",
    name: "Northstar Studio",
    slug: "northstar-studio",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  },
  {
    id: "org-form",
    name: "Form & Field",
    slug: "form-field",
    createdAt: new Date("2026-10-01T00:00:00Z"),
    updatedAt: new Date("2026-10-01T00:00:00Z"),
  },
];

export const initialProjects: Project[] = [
  {
    id: "project-1",
    organizationId: "org-northstar",
    name: "A new chapter for Bloom",
    client: "Bloom Skincare",
    status: "In progress",
    budgetCents: 1250000,
    completedTasks: 18,
    totalTasks: 24,
    dueDate: "2026-11-12",
    color: "green",
  },
  {
    id: "project-2",
    organizationId: "org-northstar",
    name: "The Meridian experience",
    client: "Meridian Hotels",
    status: "In review",
    budgetCents: 2400000,
    completedTasks: 27,
    totalTasks: 30,
    dueDate: "2026-11-18",
    color: "blue",
  },
  {
    id: "project-3",
    organizationId: "org-northstar",
    name: "Built for the everyday",
    client: "Orbit Supply",
    status: "In progress",
    budgetCents: 800000,
    completedTasks: 8,
    totalTasks: 20,
    dueDate: "2026-11-25",
    color: "purple",
  },
  {
    id: "project-4",
    organizationId: "org-northstar",
    name: "A little more wonder",
    client: "Wilder Coffee",
    status: "Completed",
    budgetCents: 650000,
    completedTasks: 16,
    totalTasks: 16,
    dueDate: "2026-10-20",
    color: "orange",
  },
  {
    id: "project-5",
    organizationId: "org-form",
    name: "Room to grow",
    client: "Arc Architecture",
    status: "In progress",
    budgetCents: 1800000,
    completedTasks: 9,
    totalTasks: 18,
    dueDate: "2026-12-04",
    color: "purple",
  },
  {
    id: "project-6",
    organizationId: "org-form",
    name: "From soil to shelf",
    client: "Earthbound",
    status: "In review",
    budgetCents: 900000,
    completedTasks: 14,
    totalTasks: 16,
    dueDate: "2026-11-30",
    color: "green",
  },
];

export const teamMembers: TeamMember[] = [
  {
    id: "member-1",
    organizationId: "org-northstar",
    name: "Andi Ferataj",
    email: "andi@example.com",
    title: "Agency founder",
    role: "OWNER",
    color: "green",
  },
  {
    id: "member-2",
    organizationId: "org-northstar",
    name: "Maya Chen",
    email: "maya@example.com",
    title: "Design director",
    role: "ADMIN",
    color: "purple",
  },
  {
    id: "member-3",
    organizationId: "org-northstar",
    name: "Alex Morgan",
    email: "alex@example.com",
    title: "Product designer",
    role: "MEMBER",
    color: "blue",
  },
  {
    id: "member-4",
    organizationId: "org-northstar",
    name: "Jamie Park",
    email: "jamie@example.com",
    title: "Brand strategist",
    role: "MEMBER",
    color: "orange",
  },
  {
    id: "member-5",
    organizationId: "org-form",
    name: "Andi Ferataj",
    email: "andi@example.com",
    title: "Creative partner",
    role: "OWNER",
    color: "green",
  },
  {
    id: "member-6",
    organizationId: "org-form",
    name: "Sam Rivera",
    email: "sam@example.com",
    title: "Project lead",
    role: "ADMIN",
    color: "blue",
  },
];

export function getWorkspaceData(
  organizationId: string,
  projects: readonly Project[],
  members: readonly TeamMember[],
) {
  const workspaceProjects = projects.filter(
    (project) => project.organizationId === organizationId,
  );
  const workspaceMembers = members.filter(
    (member) => member.organizationId === organizationId,
  );
  const completedTasks = workspaceProjects.reduce(
    (total, project) => total + project.completedTasks,
    0,
  );
  const totalTasks = workspaceProjects.reduce(
    (total, project) => total + project.totalTasks,
    0,
  );

  return {
    projects: workspaceProjects,
    members: workspaceMembers,
    activeProjects: workspaceProjects.filter(
      (project) => project.status !== "Completed",
    ).length,
    completedProjects: workspaceProjects.filter(
      (project) => project.status === "Completed",
    ).length,
    budgetCents: workspaceProjects.reduce(
      (total, project) => total + project.budgetCents,
      0,
    ),
    completedTasks,
    totalTasks,
    progress:
      totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100),
  };
}

export function filterProjects(
  projects: readonly Project[],
  query: string,
  status: ProjectStatus | "All",
) {
  const term = query.trim().toLowerCase();
  return projects.filter(
    (project) =>
      (status === "All" || project.status === status) &&
      `${project.name} ${project.client}`.toLowerCase().includes(term),
  );
}

export function validateProjectInput(input: ProjectInput): string | null {
  if (input.name.trim().length < 2 || input.name.trim().length > 80)
    return "Use a project name between 2 and 80 characters.";
  if (input.client.trim().length < 2 || input.client.trim().length > 80)
    return "Use a client name between 2 and 80 characters.";
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(input.budget.trim()))
    return "Enter a budget from 0 to 9,999,999 with at most two decimal places.";
  const date = new Date(`${input.dueDate}T12:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== input.dueDate
  )
    return "Choose a valid due date.";
  return null;
}

export function createProject(
  input: ProjectInput,
  organizationId: string,
  id: string,
): Project {
  const error = validateProjectInput(input);
  if (error) throw new Error(error);
  if (!organizationId.trim() || !id.trim())
    throw new Error("A project needs a workspace and an ID.");
  return {
    id,
    organizationId,
    name: input.name.trim(),
    client: input.client.trim(),
    status: "In progress",
    budgetCents: Math.round(Number(input.budget) * 100),
    completedTasks: 0,
    totalTasks: 0,
    dueDate: input.dueDate,
    color: "green",
  };
}

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
