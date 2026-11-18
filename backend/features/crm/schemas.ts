import { z } from "zod";
import { digits } from "@shared/utils";
import { activityType, contactState, eventType, leadState, priorityType, reminders, sourceType, stageType, taskState } from "@shared/codes";
import { dateField, email, numberIn, optional, optionalDate, optionalId, optionalTime, phone, required, text, uuid } from "@backend/lib/validations/common";

export const collections = ["contacts", "companies", "leads", "deals", "tasks", "events", "activities", "templates", "workflows", "sms"] as const;
export const collectionSchema = z.enum(collections, "بخش معتبر نیست.");
export type Collection = z.infer<typeof collectionSchema>;
const identity = { id: uuid, name: required() };
const relationship = { companyId: optionalId, owner: optionalId };
const details = { description: optional(4_000) };
const webUrl = z.union([z.url().refine((value) => /^https?:\/\//i.test(value), "آدرس وب معتبر نیست."), z.literal("")]).nullish().transform((value) => value || null);
const source = z.union([sourceType.schema, z.literal("")]).nullish().transform((value) => value || null);
const amount = z.string().transform(digits).pipe(z.string().regex(/^\d{1,20}$/, "مبلغ صحیح و نامنفی تا ۲۰ رقم وارد کنید."));
export const recordSchemas = {
  contacts: z.object({ ...identity, ...relationship, ...details, mobile: phone, email, role: optional(), status: contactState.schema, source, tags: z.array(required(60)).max(30).default([]) }),
  companies: z.object({ ...identity, ...details, industry: optional(), mobile: optional(32), email, website: webUrl }),
  leads: z.object({ ...identity, ...relationship, ...details, mobile: phone, email, source, status: leadState.schema, score: numberIn(0, 100), followUp: optionalDate }),
  deals: z.object({ ...identity, ...relationship, ...details, contactId: optionalId, stage: stageType.schema, amountToman: amount, probability: numberIn(0, 100), close: optionalDate, rowVersion: numberIn(1, 2_147_483_647).optional() }),
  tasks: z.object({ ...identity, ...details, contactId: optionalId, owner: optionalId, priority: priorityType.schema, status: taskState.schema, due: dateField, dueTime: optionalTime, reminder: z.union([z.enum(Object.keys(reminders) as [keyof typeof reminders, ...(keyof typeof reminders)[]]), z.literal("")]).nullish() }),
  events: z.object({ ...identity, ...details, contactId: optionalId, type: eventType.schema, date: dateField, time: optionalTime }),
  activities: z.object({ ...identity, ...details, contactId: optionalId, companyId: optionalId, owner: optionalId, type: activityType.schema }),
  templates: z.object({ ...identity, text: required(670) }),
};
export const listQuery = z.object({
  page: z.coerce.number().int().min(0).max(5_000).default(0),
  size: z.coerce.number().int().min(1).max(50).default(8),
  search: text(150).default(""), sort: text(45).default(""), direction: z.enum(["asc", "desc"]).default("desc"),
  status: text(50).optional(), source: text(50).optional(), stage: text(50).optional(), priority: text(50).optional(), type: text(50).optional(),
});
export type ListQuery = z.infer<typeof listQuery>;
