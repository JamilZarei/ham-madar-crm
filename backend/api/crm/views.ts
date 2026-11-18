import { z } from "zod";
import { currentActor } from "@backend/lib/auth/next";
import { respond } from "@backend/lib/http";
import { sections, workspaceView } from "@backend/features/crm/views";
import { uuid } from "@backend/lib/validations/common";

export async function GET(request: Request, { params }: { params: Promise<{ section: string }> }) {
  return respond(async () => {
    const actor = await currentActor();
    const section = z.enum(sections).parse((await params).section);
    const query = new URL(request.url).searchParams;
    const selected = query.get("id");
    return workspaceView(actor, section, selected ? uuid.parse(selected) : undefined);
  });
}
