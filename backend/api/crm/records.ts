import { currentActor } from "@backend/lib/auth/next";
import { respond } from "@backend/lib/http";
import { collectionSchema, listQuery } from "@backend/features/crm/schemas";
import { recordPage } from "@backend/features/crm/queries";
import { uuid } from "@backend/lib/validations/common";

export async function GET(request: Request, { params }: { params: Promise<{ collection: string }> }) {
  return respond(async () => {
    const actor = await currentActor();
    const collection = collectionSchema.parse((await params).collection);
    const query = new URL(request.url).searchParams;
    return recordPage(actor, collection, listQuery.parse(Object.fromEntries(query)), query.has("id") ? uuid.parse(query.get("id")) : undefined);
  });
}
