import { z } from "zod";
import { currentActor } from "@backend/lib/auth/next";
import { respond } from "@backend/lib/http";
import { reports } from "@backend/features/reports/report";

const query = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() });
export async function GET(request: Request) {
  return respond(async () => reports(await currentActor(), query.parse(Object.fromEntries(new URL(request.url).searchParams))));
}
