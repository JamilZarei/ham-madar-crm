"use client";

import { useEffect, useRef, useState } from "react";
import { Command } from "cmdk";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Bell, Building2, ChevronDown, ChevronLeft, Command as CommandIcon, PanelRightClose, PanelRightOpen, LogOut, Menu as MenuIcon, Moon, Search, Settings2, Sun, UsersRound, ChartNoAxesCombined } from "lucide-react";
import { Brand, IconTile, Empty } from "./common";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import { Hint, Menu, MenuItem, MenuSeparator, Modal, PersonAvatar, Pop } from "./ui/primitives";
import { destinations, navigation } from "./navigation";
import { toast } from "sonner";
import { auth } from "@/features/auth/service";
import { mutate, refreshCRM, useCRM, useCRMError, useResource } from "@/lib/repository";
import type { Company, Contact, Deal } from "@shared/model";
import { fa, searchText } from "@shared/utils";

export function ShellLoading() {
  return <main className="center-page" role="status" aria-label="در حال بارگیری فضای کار"><Brand /><Skeleton className="h-2 w-32" /></main>;
}
export function Shell({ children }: { children: React.ReactNode }) {
  const state = useCRM();
  const error = useCRMError();
  const path = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [command, setCommand] = useState(false);
  const [query, setQuery] = useState("");
  const matches = useResource<{ contacts: Contact[]; companies: Company[]; deals: Deal[] }>(command && query.trim().length >= 2 ? "/api/crm/search/?q=" + encodeURIComponent(query.trim()) : null, 180);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const active = destinations.find((item) => path.startsWith(item.href)) ?? destinations[0];

  useEffect(() => {
    function hotkey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.code === "KeyK") { event.preventDefault(); setCommand((value) => !value); }
      if (event.key === "Escape" && sidebar.current?.classList.contains("mobile-open")) { setMobile(false); mobileTrigger.current?.focus(); }
    }
    window.addEventListener("keydown", hotkey);
    return () => window.removeEventListener("keydown", hotkey);
  }, []);
  useEffect(() => {
    if (mobile) sidebar.current?.querySelector<HTMLElement>("[aria-current=page]")?.focus();
  }, [mobile]);
  if (!state && error) return <main className="center-page"><p role="alert">{error}</p><Button onClick={refreshCRM}>تلاش دوباره</Button></main>;
  if (!state) return <ShellLoading />;

  function go(href: string) { setCommand(false); setMobile(false); router.push(href); }
  const alerts = state.notifications || [];
  const access: Record<string, string> = { "/automations/": "automation.manage", "/sms/": "sms.send", "/reports/": "reports.read" };
  const allowed = (href: string) => !access[href] || state.settings.grants?.includes(access[href]);
  return <div className={"app-shell" + (collapsed && !mobile ? " is-collapsed" : "")}>
    <a href="#main-content" className="skip-link">رفتن به محتوای اصلی</a>
    <button className={"sidebar-scrim" + (mobile ? " shown" : "")} aria-label="بستن منو" onClick={() => { setMobile(false); mobileTrigger.current?.focus(); }} />
    <aside ref={sidebar} className={"sidebar" + (mobile ? " mobile-open" : "")}>
      <div className="sidebar-brand"><Link href="/dashboard/" onClick={() => setMobile(false)} aria-label="هم‌مدار، داشبورد"><Brand small={collapsed && !mobile} /></Link>
        <Hint label={collapsed ? "باز کردن سایدبار" : "جمع کردن سایدبار"}><Button size="icon" variant="ghost" className="desktop-collapse" aria-label={collapsed ? "باز کردن سایدبار" : "جمع کردن سایدبار"} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelRightOpen /> : <PanelRightClose />}</Button></Hint>
      </div>
      <nav className="sidebar-nav" aria-label="ناوبری اصلی">
        {navigation.map((group) => <div className="nav-group" key={group.name}><div className="nav-group-label">{group.name}</div>
          {group.items.filter(({ href }) => allowed(href)).map(({ label, href, icon: Icon }) => {
            const link = <Link href={href} className="nav-link" aria-label={label} aria-current={active.href === href ? "page" : undefined} onClick={() => setMobile(false)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>;
            return collapsed && !mobile ? <Hint key={href} label={label}>{link}</Hint> : <div key={href}>{link}</div>;
          })}
        </div>)}
      </nav>
      <div className="sidebar-bottom"><Link href="/settings/" className="workspace" aria-label="تنظیمات فضای کار" onClick={() => setMobile(false)}><IconTile icon={Building2} /><span><b>{state.settings.workspace}</b><small>فضای کاری</small></span><ChevronLeft size={14} className="muted" /></Link></div>
    </aside>
    <div className="app-main"><header className="topbar">
      <div className="row"><Button ref={mobileTrigger} className="mobile-toggle" aria-label="باز کردن منو" aria-expanded={mobile} size="icon" variant="ghost" onClick={() => setMobile(!mobile)}><MenuIcon /></Button>
        <nav className="crumb" aria-label="مسیر صفحه"><Link href="/dashboard/" className="muted crumb-root">فضای کار</Link><ChevronLeft size={13} className="muted crumb-arrow" /><b>{active.label}</b>{path.startsWith("/automations/builder/") && <><ChevronLeft size={13} className="muted" /><b>طراح</b></>}</nav>
      </div>
      <div className="top-actions">
        <button className="global-search" onClick={() => setCommand(true)} aria-label="جست‌وجوی سراسری"><Search size={16} /><span>جست‌وجوی سراسری…</span><kbd dir="ltr"><CommandIcon size={9} className="inline" /> K</kbd></button>
        <Hint label="تغییر پوسته"><Button size="icon" variant="ghost" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="تغییر پوسته">{resolvedTheme === "dark" ? <Sun /> : <Moon />}</Button></Hint>
        <Pop trigger={<Button variant="ghost" size="icon" className="notification-trigger" aria-label="اعلان‌ها"><Bell />{alerts.some((item) => !item.read) && <i />}</Button>}>
          <div className="notification-panel"><div className="spread mb-2"><strong>اعلان‌ها</strong><span className="muted">{fa(alerts.length)} یادآوری</span></div>
            {alerts.length ? alerts.map((item) => <article key={item.id}><button className="text-start" onClick={async () => { try { await mutate({ operation: "readNotification", id: item.id }); if (item.taskId) go("/tasks/?id=" + item.taskId); } catch (error) { toast.error(error instanceof Error ? error.message : "اعلان به‌روز نشد."); } }}><strong>{item.name}</strong><p>{item.body}</p></button></article>) : <Empty title="اعلان تازه‌ای ندارید" icon={Bell} />}
          </div>
        </Pop>
        <Menu trigger={<button className="top-profile" aria-label="منوی حساب"><PersonAvatar name={state.settings.name} /><span><b>{state.settings.name}</b><small>{state.settings.roleName}</small></span><ChevronDown size={13} className="muted" /></button>}>
          <MenuItem onSelect={() => go("/settings/")}><Settings2 /> تنظیمات پروفایل</MenuItem><MenuSeparator />
          <MenuItem className="danger-text" onSelect={async () => { try { await auth.signOut(); window.location.replace("/login/"); } catch (error) { toast.error(error instanceof Error ? error.message : "خروج انجام نشد."); } }}><LogOut /> خروج از حساب</MenuItem>
        </Menu>
      </div>
    </header><main className="main-content" id="main-content">{!allowed(active.href) ? <Empty title="به این بخش دسترسی ندارید" /> : children}</main></div>
    <Modal open={command} onOpenChange={setCommand} title="جست‌وجوی سراسری" description="صفحه، مشتری، شرکت یا فرصت فروش را جست‌وجو کنید.">
      <Command dir="rtl" filter={(value, search) => Number(searchText(value).includes(searchText(search)))}>
        <div className="command-input"><Search size={17} className="muted" /><Command.Input placeholder="نام یا عنوان را وارد کنید…" aria-label="عبارت جست‌وجو" value={query} onValueChange={setQuery} /></div>
        <Command.List><Command.Empty>نتیجه‌ای پیدا نشد.</Command.Empty>
          <Command.Group heading="صفحات">{destinations.filter(({ href }) => allowed(href)).map(({ label, href, icon: Icon }) => <Command.Item key={href} value={label + " " + href} onSelect={() => go(href)}><Icon size={16} />{label}</Command.Item>)}</Command.Group>
          <Command.Group heading="مشتریان">{matches.data?.contacts.map((item) => <Command.Item key={item.id} value={item.name + " " + item.mobile + " " + query} onSelect={() => go("/contacts/?id=" + item.id)}><UsersRound size={16} />{item.name}</Command.Item>)}</Command.Group>
          <Command.Group heading="شرکت‌ها">{matches.data?.companies.map((item) => <Command.Item key={item.id} value={item.name + " " + query} onSelect={() => go("/companies/?id=" + item.id)}><Building2 size={16} />{item.name}</Command.Item>)}</Command.Group>
          <Command.Group heading="فرصت‌ها">{matches.data?.deals.map((item) => <Command.Item key={item.id} value={item.name + " " + item.id + " " + query} onSelect={() => go("/deals/?id=" + item.id)}><ChartNoAxesCombined size={16} />{item.name}</Command.Item>)}</Command.Group>
        </Command.List>
      </Command>
    </Modal>
  </div>;
}




