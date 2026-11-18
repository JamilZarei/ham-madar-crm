import { Activity, BarChart3, Building2, CalendarDays, ChartNoAxesCombined, CheckSquare2, GitBranch, LayoutGrid, MessageSquareText, Settings2, Target, UsersRound } from "lucide-react";
export const navigation = [
  { name: "فضای کار", items: [
    { label: "داشبورد", href: "/dashboard/", icon: LayoutGrid },
    { label: "مشتریان", href: "/contacts/", icon: UsersRound },
    { label: "شرکت‌ها", href: "/companies/", icon: Building2 },
    { label: "سرنخ‌های فروش", href: "/leads/", icon: Target },
    { label: "فرصت‌های فروش", href: "/deals/", icon: ChartNoAxesCombined },
  ] },
  { name: "برنامه‌ریزی", items: [
    { label: "وظایف", href: "/tasks/", icon: CheckSquare2 },
    { label: "تقویم", href: "/calendar/", icon: CalendarDays },
    { label: "فعالیت‌ها", href: "/activities/", icon: Activity },
  ] },
  { name: "ابزارها", items: [
    { label: "اتوماسیون", href: "/automations/", icon: GitBranch },
    { label: "پیامک‌ها", href: "/sms/", icon: MessageSquareText },
    { label: "گزارش‌ها", href: "/reports/", icon: BarChart3 },
    { label: "تنظیمات", href: "/settings/", icon: Settings2 },
  ] },
];
export const destinations = navigation.flatMap((group) => group.items);

