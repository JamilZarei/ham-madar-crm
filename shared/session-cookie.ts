export const sessionCookie = () => process.env.NODE_ENV === "production" ? "__Host-hamsir-session" : "hamsir-session";
