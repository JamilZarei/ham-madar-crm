import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { authenticate, sessionCookie } from "@backend/features/auth/session";

export const currentActor = cache(async () => authenticate((await cookies()).get(sessionCookie())?.value));
