import "server-only";
import { currentActor } from "@backend/lib/auth/next";
import { DomainError } from "@backend/lib/errors/domain";

export { demoLoginEnabled } from "@backend/features/sms/provider";
export { commitCRM } from "@backend/features/crm/actions";
export * as authRoutes from "@backend/api/auth";
export * as calendarRoutes from "@backend/api/crm/calendar";
export * as operationRoutes from "@backend/api/crm/operations";
export * as recordRoutes from "@backend/api/crm/records";
export * as reportRoutes from "@backend/api/crm/reports";
export * as searchRoutes from "@backend/api/crm/search";
export * as viewRoutes from "@backend/api/crm/views";
export * as smsWebhookRoutes from "@backend/api/webhooks/sms";

export async function hasSession() {
  try {
    await currentActor();
    return true;
  } catch (error) {
    if (error instanceof DomainError && error.status === 401) return false;
    throw error;
  }
}
