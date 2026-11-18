import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Shell, ShellLoading } from "@/components/shell";
import { CRMProvider } from "@/lib/repository";
import { hasSession } from "@crm-service";

export default async function CRMLayout({ children }: { children: React.ReactNode }) {
  if (!await hasSession()) redirect("/login/");
  return <Suspense fallback={<ShellLoading />}><CRMProvider><Shell>{children}</Shell></CRMProvider></Suspense>;
}
