import { currentActor } from "@backend/lib/auth/next";
import { respond } from "@backend/lib/http";
import { searchWorkspace } from "@backend/features/crm/queries";
import { text } from "@backend/lib/validations/common";

export async function GET(request: Request) {
  return respond(async () => {
    const actor = await currentActor();
    return searchWorkspace(actor, text(150).parse(new URL(request.url).searchParams.get("q") ?? ""));
  });
}
