import { DomainError } from "@nexus/contracts";
import { requireWorkspaceWrite } from "../../../../../../../lib/billing";
import { operationsService } from "../../../../../../../lib/server";
import {
  apiActor,
  apiInput,
  apiData,
  apiError,
} from "../../../../../../../lib/api";

type Context = {
  params: Promise<{
    organizationId: string;
    resource: string;
    recordId?: string[];
  }>;
};
function resource(value: string): "clients" | "projects" | "tasks" {
  if (value !== "clients" && value !== "projects" && value !== "tasks")
    throw new DomainError("NOT_FOUND", "Unknown resource.");
  return value;
}
function recordId(value?: string[]): string | undefined {
  if (value && value.length !== 1)
    throw new DomainError("NOT_FOUND", "Unknown resource.");
  return value?.[0];
}
export async function GET(_request: Request, context: Context) {
  try {
    const {
        organizationId,
        resource: kind,
        recordId: ids,
      } = await context.params,
      actor = await apiActor(),
      key = resource(kind),
      id = recordId(ids);
    const records = (await operationsService.snapshot(actor, organizationId))[
      key
    ];
    if (id) {
      const found = records.find((record) => record.id === id);
      if (!found) throw new DomainError("NOT_FOUND", "Unknown resource.");
      return apiData(found);
    }
    return apiData(records);
  } catch (error) {
    return apiError(error);
  }
}
async function save(request: Request, context: Context, update: boolean) {
  try {
    const {
        organizationId,
        resource: kind,
        recordId: ids,
      } = await context.params,
      actor = await apiActor(),
      key = resource(kind),
      id = recordId(ids);
    if (update !== Boolean(id))
      throw new DomainError(
        "VALIDATION",
        update
          ? "Supply a record ID."
          : "Create records at the collection URL.",
      );
    const input = await apiInput(request);
    await requireWorkspaceWrite(actor, organizationId);
    const result =
      key === "clients"
        ? await operationsService.saveClient(actor, organizationId, input, id)
        : key === "projects"
          ? await operationsService.saveProject(
              actor,
              organizationId,
              input,
              id,
            )
          : await operationsService.saveTask(actor, organizationId, input, id);
    return apiData(result, update ? 200 : 201);
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request, context: Context) {
  return save(request, context, false);
}
export async function PUT(request: Request, context: Context) {
  return save(request, context, true);
}
export async function DELETE(request: Request, context: Context) {
  try {
    const {
        organizationId,
        resource: kind,
        recordId: ids,
      } = await context.params,
      actor = await apiActor(),
      key = resource(kind),
      id = recordId(ids);
    await apiInput(request);
    if (!id) throw new DomainError("VALIDATION", "Supply a record ID.");
    await operationsService.deleteRecord(
      actor,
      organizationId,
      key === "clients" ? "client" : key === "projects" ? "project" : "task",
      id,
    );
    return new Response(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
