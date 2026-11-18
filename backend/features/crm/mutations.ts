import { z } from "zod";
import { workspace } from "@database/client";
import type { Actor } from "@backend/lib/permissions/policy";
import { required, uuid } from "@backend/lib/validations/common";
import { addNote, archive, convertLead, saveRecord } from "./domain";
import { collectionSchema } from "./schemas";
import { saveWorkflow, testWorkflow, toggleWorkflow } from "@backend/features/automations/graph";
import { retryMessage, sendInput, sendSimulation } from "@backend/features/sms/service";
import { archiveRole, memberState, saveMember, updateProfile, updateRole } from "@backend/features/users/service";
import { missing } from "@backend/lib/errors/domain";

const schema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("save"), collection: collectionSchema, item: z.unknown() }),
  z.object({ operation: z.literal("archive"), collection: collectionSchema, ids: z.array(uuid).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "شناسه تکراری است.") }),
  z.object({ operation: z.literal("convertLead"), id: uuid }),
  z.object({ operation: z.literal("note"), collection: z.enum(["contacts", "companies"]), id: uuid, text: required(1_500) }),
  z.object({ operation: z.literal("profile"), values: z.unknown() }),
  z.object({ operation: z.literal("member"), values: z.unknown() }),
  z.object({ operation: z.literal("memberState"), id: uuid, state: z.enum(["active", "disabled", "removed"]) }),
  z.object({ operation: z.literal("role"), values: z.unknown() }),
  z.object({ operation: z.literal("archiveRole"), id: uuid }),
  z.object({ operation: z.literal("sms"), values: sendInput }),
  z.object({ operation: z.literal("retrySms"), id: uuid }),
  z.object({ operation: z.literal("workflow"), values: z.unknown() }),
  z.object({ operation: z.literal("workflowState"), id: uuid, enabled: z.boolean() }),
  z.object({ operation: z.literal("workflowTest"), values: z.unknown(), scenario: z.unknown() }),
  z.object({ operation: z.literal("readNotification"), id: uuid }),
]);
export async function mutation(actor: Actor, requestId: string, payload: unknown) {
  const data = schema.parse(payload);
  return workspace(actor.workspaceId, async (tx) => {
    const ctx = { tx, actor, requestId };
    switch (data.operation) {
      case "save": return saveRecord(ctx, data.collection, data.item);
      case "archive": return archive(ctx, data.collection, data.ids);
      case "convertLead": return convertLead(ctx, data.id);
      case "note": return addNote(ctx, data.collection, data.id, data.text);
      case "profile": return updateProfile(ctx, data.values);
      case "member": return saveMember(ctx, data.values);
      case "memberState": return memberState(ctx, data.id, data.state);
      case "role": return updateRole(ctx, data.values);
      case "archiveRole": return archiveRole(ctx, data.id);
      case "sms": return sendSimulation(ctx, data.values);
      case "retrySms": return retryMessage(ctx, data.id);
      case "workflow": return saveWorkflow(ctx, data.values);
      case "workflowState": return toggleWorkflow(ctx, data.id, data.enabled);
      case "workflowTest": return testWorkflow(ctx, data.values, data.scenario);
      case "readNotification": {
        const result = await tx.notification.updateMany({ where: { workspaceId: actor.workspaceId, recipientMembershipId: actor.membershipId, id: data.id }, data: { readAt: new Date() } });
        if (!result.count) throw missing();
        return true;
      }
    }
  });
}
