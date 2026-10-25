import type { OperationsService } from "@nexus/core";
import { projectStatuses, taskStatuses, priorities } from "@nexus/contracts";
import { ActionForm } from "./action-form";
import { workspaceAction } from "../app/actions";

export type WorkspaceData = Awaited<ReturnType<OperationsService["snapshot"]>>;
export const day = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : "";
export const label = (value: string) =>
  value.toLowerCase().replaceAll("_", " ");

export function OperationFields({
  org,
  operation,
  id,
}: {
  org: string;
  operation: string;
  id?: string;
}) {
  return (
    <>
      <input type="hidden" name="organizationId" value={org} />
      <input type="hidden" name="operation" value={operation} />
      {id && <input type="hidden" name="id" value={id} />}
    </>
  );
}

export function DeleteRecord({
  org,
  kind,
  id,
}: {
  org: string;
  kind: "client" | "project" | "task";
  id: string;
}) {
  return (
    <ActionForm
      action={workspaceAction}
      label={`Delete ${kind}`}
      compact
      destructive
      confirmMessage={`Delete this ${kind}${kind === "project" ? " and its tasks" : ""}? This cannot be undone.`}
    >
      <OperationFields org={org} operation={`${kind}.delete`} id={id} />
    </ActionForm>
  );
}

export function ClientForm({
  org,
  client,
}: {
  org: string;
  client?: WorkspaceData["clients"][number];
}) {
  return (
    <ActionForm
      action={workspaceAction}
      label={client ? "Save client" : "Create client"}
    >
      <OperationFields
        org={org}
        operation="client.save"
        {...(client ? { id: client.id } : {})}
      />
      <label>
        Client name
        <input
          name="name"
          defaultValue={client?.name}
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          defaultValue={client?.email}
          maxLength={254}
        />
      </label>
      <label>
        Company
        <input name="company" defaultValue={client?.company} maxLength={120} />
      </label>
      <label>
        Notes
        <textarea
          name="notes"
          defaultValue={client?.notes}
          maxLength={2000}
          rows={3}
        />
      </label>
    </ActionForm>
  );
}

export function ProjectForm({
  data,
  project,
}: {
  data: WorkspaceData;
  project?: WorkspaceData["projects"][number];
}) {
  return (
    <ActionForm
      action={workspaceAction}
      label={project ? "Save project" : "Create project"}
    >
      <OperationFields
        org={data.organization.id}
        operation="project.save"
        {...(project ? { id: project.id } : {})}
      />
      <label>
        Project name
        <input
          name="name"
          defaultValue={project?.name}
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        Client
        <select name="clientId" defaultValue={project?.clientId ?? ""}>
          <option value="">No client</option>
          {data.clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Description
        <textarea
          name="description"
          defaultValue={project?.description}
          maxLength={2000}
          rows={3}
        />
      </label>
      <div className="form-row">
        <label>
          Status
          <select name="status" defaultValue={project?.status ?? "PLANNED"}>
            {projectStatuses.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Budget (USD)
          <input
            name="budget"
            type="number"
            min="0"
            max="9999999.99"
            step="0.01"
            defaultValue={
              project ? (project.budgetCents / 100).toFixed(2) : "0"
            }
          />
        </label>
      </div>
      <label>
        Due date
        <input
          name="dueDate"
          type="date"
          defaultValue={day(project?.dueDate ?? null)}
        />
      </label>
    </ActionForm>
  );
}

export function TaskForm({
  data,
  task,
  userId,
}: {
  data: WorkspaceData;
  task?: WorkspaceData["tasks"][number];
  userId: string;
}) {
  const manager = data.membership.role !== "MEMBER";
  return (
    <ActionForm
      action={workspaceAction}
      label={task ? "Save task" : "Create task"}
    >
      <OperationFields
        org={data.organization.id}
        operation="task.save"
        {...(task ? { id: task.id } : {})}
      />
      <label>
        Task title
        <input
          name="title"
          defaultValue={task?.title}
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        Project
        <select name="projectId" defaultValue={task?.projectId ?? ""} required>
          <option value="" disabled>
            Choose a project
          </option>
          {data.projects
            .filter(
              (project) =>
                project.status !== "ARCHIVED" || task?.projectId === project.id,
            )
            .map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
        </select>
      </label>
      <label>
        Description
        <textarea
          name="description"
          defaultValue={task?.description}
          maxLength={2000}
          rows={3}
        />
      </label>
      <label>
        Assignee
        <select name="assigneeId" defaultValue={task?.assigneeId ?? ""}>
          <option value="">Unassigned</option>
          {data.members
            .filter(
              (member) =>
                manager ||
                member.userId === userId ||
                member.userId === task?.assigneeId,
            )
            .map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name ?? member.email}
              </option>
            ))}
        </select>
      </label>
      <div className="form-row">
        <label>
          Status
          <select name="status" defaultValue={task?.status ?? "TODO"}>
            {taskStatuses.map((status) => (
              <option key={status} value={status}>
                {label(status)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" defaultValue={task?.priority ?? "NORMAL"}>
            {priorities.map((priority) => (
              <option key={priority}>{priority}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Due date
        <input
          name="dueDate"
          type="date"
          defaultValue={day(task?.dueDate ?? null)}
        />
      </label>
    </ActionForm>
  );
}
