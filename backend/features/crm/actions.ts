"use server";

import { randomUUID } from "node:crypto";
import { currentActor } from "@backend/lib/auth/next";
import { failure } from "@backend/lib/errors/domain";
import { mutation } from "./mutations";

export async function commitCRM(payload: unknown) {
  const requestId = randomUUID();
  try {
    const result = await mutation(await currentActor(), requestId, payload);
    return { ok: true as const, value: result };
  } catch (error) {
    const result = failure(error, requestId);
    return { ok: false as const, status: result.status, error: result.error };
  }
}
