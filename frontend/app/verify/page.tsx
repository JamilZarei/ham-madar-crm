import { redirect } from "next/navigation";
import { hasSession } from "@crm-service";
import { Verify } from "@/features/auth/screens";

export const metadata = { title: "تأیید شماره موبایل" };
export default async function VerifyPage() {
  if (!await hasSession()) return <Verify />;
  redirect("/dashboard/");
}
