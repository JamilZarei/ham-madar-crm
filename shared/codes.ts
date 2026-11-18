import { activityTypes, contactStatuses, eventTypes, leadStatuses, priorities, sources, stages, taskStatuses } from "@shared/model";
import { z } from "zod";

function dictionary<T extends string, K extends string>(labels: readonly T[], codes: readonly K[]) {
  return {
    code: (label: T) => codes[labels.indexOf(label)],
    label: (code: string) => labels[codes.indexOf(code as K)] ?? labels[0],
    schema: z.enum(labels, "گزینهٔ انتخاب‌شده معتبر نیست.").transform((label) => codes[labels.indexOf(label)]),
    find: (input: string) => codes.find((code, index) => input === code || input === labels[index]),
  };
}
export const contactState = dictionary(contactStatuses, ["active", "negotiating", "potential", "inactive"]);
export const leadState = dictionary(leadStatuses, ["new", "following_up", "qualified", "rejected", "converted"]);
export const sourceType = dictionary(sources, ["website", "referral", "social", "direct", "event"]);
export const stageType = dictionary(stages, ["discovery", "evaluation", "proposal", "negotiation", "won", "lost"]);
export const taskState = dictionary(taskStatuses, ["open", "in_progress", "done"]);
export const priorityType = dictionary(priorities, ["low", "medium", "high"]);
export const eventType = dictionary(eventTypes, ["meeting", "call", "task"]);
export const activityType = dictionary(activityTypes, ["call", "meeting", "email", "note", "contact", "deal", "task", "sms", "lead"]);
export const smsType = dictionary(["اطلاع‌رسانی", "پیگیری", "خوشامدگویی"] as const, ["notification", "follow_up", "welcome"]);
export const reminders = { "۳۰ دقیقه قبل": 30, "۱ ساعت قبل": 60, "۱ روز قبل": 1440 } as const;
export const reminderName = (minutes?: number) => (Object.entries(reminders).find(([, value]) => value === minutes)?.[0] ?? "");
export const roleLabels = (permission: string[]) => permission;

