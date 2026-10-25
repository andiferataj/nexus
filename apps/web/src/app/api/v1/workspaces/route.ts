import { organizationService } from "../../../../lib/server";
import { apiActor, apiInput, apiData, apiError } from "../../../../lib/api";

export async function GET() {
  try {
    const records = await organizationService.list(await apiActor());
    return apiData(
      records.map(({ organization, membership }) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        role: membership.role,
      })),
    );
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    const actor = await apiActor(),
      input = await apiInput(request);
    const result = await organizationService.create(actor, input);
    return apiData(result.organization, 201);
  } catch (error) {
    return apiError(error);
  }
}
