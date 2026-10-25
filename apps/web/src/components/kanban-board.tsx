import { taskStatuses } from "@nexus/contracts";
import { TaskForm, day, label } from "./operation-forms";
import type { WorkspaceData } from "./operation-forms";

export function KanbanBoard({
  data,
  userId,
}: {
  data: WorkspaceData;
  userId: string;
}) {
  return (
    <section className="kanban-board" aria-label="Task board">
      {taskStatuses.map((status) => (
        <section className="kanban-column" key={status}>
          <header>
            <h2>{label(status)}</h2>
            <span className="count-badge">
              {data.tasks.filter((task) => task.status === status).length}
            </span>
          </header>
          {data.tasks
            .filter((task) => task.status === status)
            .map((task) => (
              <article className="panel record-card" key={task.id}>
                <span className="role-badge">{label(task.priority)}</span>
                <h3>{task.title}</h3>
                <p className="record-detail">
                  {
                    data.projects.find(
                      (project) => project.id === task.projectId,
                    )?.name
                  }
                </p>
                <p className="record-detail">
                  {data.members.find(
                    (member) => member.userId === task.assigneeId,
                  )?.name ?? "Unassigned"}
                  {task.dueDate ? ` / ${day(task.dueDate)}` : ""}
                </p>
                {(data.membership.role !== "MEMBER" ||
                  task.assigneeId === userId ||
                  task.createdById === userId) && (
                  <details>
                    <summary>Update task</summary>
                    <TaskForm data={data} task={task} userId={userId} />
                  </details>
                )}
              </article>
            ))}
          {!data.tasks.some((task) => task.status === status) && (
            <p className="page-description">No tasks here yet.</p>
          )}
        </section>
      ))}
    </section>
  );
}
