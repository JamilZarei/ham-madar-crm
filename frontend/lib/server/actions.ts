"use server";

import { commitCRM as commit } from "@crm-service";

export async function commitCRM(payload: unknown) {
  return commit(payload);
}
