import type { Metadata } from "next";
import "@fontsource-variable/vazirmatn";
import "./globals.css";
import "./auth.css";
import "./workspace.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = { title: { default: "هم‌مدار | مدیریت ارتباط با مشتری", template: "%s | هم‌مدار" }, description: "فضای کار مدیریت ارتباط با مشتری هم‌مدار" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fa" dir="rtl" suppressHydrationWarning><body><Providers>{children}</Providers></body></html>;
}

