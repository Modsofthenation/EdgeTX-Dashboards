import { checkApiAuth } from "@/lib/apiSecurity";
import { listModelCatalog } from "@/server/generatorFacade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const authErr = checkApiAuth(request);
  if (authErr) return authErr;

  return Response.json(await listModelCatalog());
}
