import { redirect } from "next/navigation";
import { demoLoginEnabled, hasSession } from "@crm-service";
import { Login } from "@/features/auth/screens";

export const metadata = { title: "ورود" };
export default async function LoginPage() {
  if (!await hasSession()) return <Login demo={await demoLoginEnabled()} />;
  redirect("/dashboard/");
}
