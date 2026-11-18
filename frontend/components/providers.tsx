"use client";
import { Direction, Tooltip } from "radix-ui";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <Direction.Provider dir="rtl"><Tooltip.Provider delayDuration={220}>{children}
      <Toaster containerAriaLabel="اعلان‌ها" position="bottom-left" dir="rtl" richColors closeButton toastOptions={{ closeButtonAriaLabel: "بستن اعلان" }} />
    </Tooltip.Provider></Direction.Provider>
  </ThemeProvider>;
}

