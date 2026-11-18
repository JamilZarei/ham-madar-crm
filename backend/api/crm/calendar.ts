import { z } from "zod";
import { currentActor } from "@backend/lib/auth/next";
import { respond } from "@backend/lib/http";
import { calendarRange } from "@backend/features/crm/views";

const query = z.object({ from: z.iso.date(), to: z.iso.date() });
export async function GET(request: Request) {
  return respond(async () => {
    const actor = await currentActor();
    const { from, to } = query.parse(Object.fromEntries(new URL(request.url).searchParams));
    return calendarRange(actor, from, to);
  });
}
