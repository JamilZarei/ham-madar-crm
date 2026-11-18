import { currentActor } from "@backend/lib/auth/next";
import { json, originCheck, respond } from "@backend/lib/http";
import { mutation } from "@backend/features/crm/mutations";

export async function POST(request: Request) {
  return respond(async (requestId) => {
    originCheck(request);
    const actor = await currentActor();
    return mutation(actor, requestId, await json(request));
  });
}
