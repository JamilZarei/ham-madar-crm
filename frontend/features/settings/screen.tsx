"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Bell, Building2, KeyRound, Mail, MessageSquareText, Monitor, Moon, Plus, ShieldCheck, Sun, UserRound, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeading, PanelHeading } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, CheckBox, Confirm, Modal, PersonAvatar, Switch, Tabs } from "@/components/ui/primitives";
import { RecordForm, type Field } from "@/components/record-form";
import { RecordMenu } from "@/components/record-tools";
import { DataTable } from "@/components/data-table";
import { useCRM, crm, mutate } from "@/lib/repository";
import { type Role, type Settings, type TeamUser } from "@shared/model";
import { digits, fa } from "@shared/utils";
import { PasswordSettings } from "@/features/auth/password-settings";

const settingsTabs = [
  { key: "profile", label: "پروفایل", icon: UserRound }, { key: "security", label: "امنیت حساب", icon: KeyRound }, { key: "theme", label: "ظاهر", icon: Sun }, { key: "notifications", label: "اعلان‌ها", icon: Bell },
  { key: "sms", label: "پیامک", icon: MessageSquareText }, { key: "otp", label: "کد تأیید", icon: KeyRound }, { key: "users", label: "کاربران", icon: UsersRound },
  { key: "roles", label: "نقش‌ها و مجوزها", icon: ShieldCheck }, { key: "general", label: "عمومی", icon: Building2 },
];
const reportError = (error: unknown) => toast.error(error instanceof Error ? error.message : "ذخیره انجام نشد.");
const saved = () => toast.success("تنظیمات ذخیره شد.");

export default function SettingsScreen() {
  const state = useCRM();
  const { theme, setTheme } = useTheme();
  if (!state) return null;
  const settings = state.settings;
  const allowed = (key: string) => ["users","roles"].includes(key) ? settings.grants?.includes("members.manage") : ["sms","otp","general"].includes(key) ? settings.grants?.includes("settings.manage") : true;
  return <>
    <PageHeading title="تنظیمات" description="پروفایل، اعضای تیم و ترجیحات فضای کاری را مدیریت کنید." />
    <Tabs.Root defaultValue="profile" orientation="vertical" className="settings-layout">
      <Card className="settings-nav"><Tabs.List aria-label="بخش‌های تنظیمات">{settingsTabs.filter(({ key }) => allowed(key)).map(({ key, label, icon: Icon }) => <Tabs.Trigger value={key} key={key}><Icon size={16} />{label}</Tabs.Trigger>)}</Tabs.List></Card>
      <Tabs.Content value="profile"><SettingsForm title="اطلاعات پروفایل" description="نام و ایمیل نمایشی شما در فضای کاری." icon={UserRound} data={{ name: settings.name, email: settings.email }}
        fields={[{ key: "name", label: "نام و نام خانوادگی", required: true }, { key: "email", label: "ایمیل", kind: "email", required: true }]}
        save={(values) => crm.settings({ name: values.name, email: values.email })} /></Tabs.Content>
      <Tabs.Content value="security"><PasswordSettings configured={!!settings.passwordConfigured} /></Tabs.Content>
      <Tabs.Content value="theme"><Card><PanelHeading title="ظاهر نرم‌افزار" description="پوستهٔ موردنظر خود را انتخاب کنید." icon={Sun} /><CardContent><div className="theme-choices">
        {[{ value: "light", title: "روشن", Icon: Sun }, { value: "dark", title: "تاریک", Icon: Moon }, { value: "system", title: "همگام با دستگاه", Icon: Monitor }].map(({ value, title, Icon }) => <button type="button" key={value} className={"theme-option theme-option-" + value} aria-pressed={theme === value} onClick={() => { setTheme(value); saved(); }}>
          <span className="theme-swatch"><i /><i /><i /></span><span className="row"><Icon size={15} />{title}</span>
        </button>)}
      </div></CardContent></Card></Tabs.Content>
      <Tabs.Content value="notifications"><Card><PanelHeading title="اعلان‌ها" description="نمایش اعلان‌ها در نوار بالایی را کنترل کنید." icon={Bell} /><CardContent>
        <div className="settings-toggle"><div><b>اعلان‌های فضای کاری</b><p>نمایش اعلان‌ها در مرکز اعلان‌ها</p></div><Switch label="اعلان‌های فضای کاری" checked={settings.notifications} onCheckedChange={async (notifications) => { try { await crm.settings({ notifications }); saved(); } catch (error) { reportError(error); } }} /></div>
        <div className="settings-toggle"><div><b>یادآوری وظایف</b><p>نمایش وظایف باز در زمان یادآوری یا سررسید</p></div><Switch label="یادآوری وظایف" checked={settings.taskAlerts} onCheckedChange={async (taskAlerts) => { try { await crm.settings({ taskAlerts }); saved(); } catch (error) { reportError(error); } }} /></div>
      </CardContent></Card></Tabs.Content>
      <Tabs.Content value="sms"><SettingsForm title="تنظیمات نمایشی پیامک" description="شمارهٔ فرستنده در صفحهٔ پیامک نمایش داده می‌شود." icon={MessageSquareText} data={{ smsSender: settings.smsSender }}
        fields={[{ key: "smsSender", label: "شمارهٔ فرستنده", required: true, ltr: true }]} save={({ smsSender }) => {
          const value = digits(smsSender);
          if (!/^\d{4,18}$/.test(value)) throw new Error("شمارهٔ فرستنده باید ۴ تا ۱۸ رقم باشد.");
          return crm.settings({ smsSender: value });
        }} /></Tabs.Content>
      <Tabs.Content value="otp"><SettingsForm title="تنظیمات نمایشی کد تأیید" description={fa(settings.otpLength) + " رقم · " + fa(settings.otpResend) + " ثانیه تا ارسال مجدد"} icon={KeyRound}
        fields={[{ key: "otpTemplate", label: "متن صندوق پیامک آزمایشی", required: true, kind: "textarea", placeholder: "کد ورود به هم‌مدار {{code}} است." }]}
        data={{ otpTemplate: settings.otpTemplate || "کد ورود به هم‌مدار {{code}} است." }} save={({ otpTemplate }) => {
          if (!otpTemplate.includes("{{code}}")) throw new Error("متغیر کد را با قالب {{code}} در متن نگه دارید.");
          return crm.settings({ otpTemplate });
        }} /></Tabs.Content>
      <Tabs.Content value="users"><Team settings={settings} /></Tabs.Content>
      <Tabs.Content value="roles"><Roles settings={settings} /></Tabs.Content>
      <Tabs.Content value="general"><SettingsForm title="تنظیمات عمومی" description="نام فضای کاری در پایین سایدبار نمایش داده می‌شود." icon={Building2} data={{ workspace: settings.workspace }}
        fields={[{ key: "workspace", label: "نام فضای کاری", required: true }]} save={({ workspace }) => crm.settings({ workspace })} /></Tabs.Content>
    </Tabs.Root>
  </>;
}
function SettingsForm({ title, description, icon, data, fields, save }: { title: string; description: string; icon: typeof UserRound; data: Record<string, string>; fields: Field[]; save: (fields: Record<string, string>) => void | Promise<unknown> }) {
  const [revision, setRevision] = useState(0);
  return <Card><PanelHeading title={title} description={description} icon={icon} /><CardContent>
    <RecordForm key={revision} fields={fields} initial={data} onCancel={() => setRevision((value) => value + 1)} onSave={async (values) => { await save(values); saved(); }} submitText="ذخیرهٔ تغییرات" />
  </CardContent></Card>;
}
function Team({ settings }: { settings: Settings }) {
  const [editor, setEditor] = useState<TeamUser | "new">();
  const [deleting, setDeleting] = useState<TeamUser>();
  const item = editor === "new" ? undefined : editor;
  return <div className="stack"><Card><PanelHeading title="کاربران" description="اعضای فعال در فهرست انتخاب کارشناس نمایش داده می‌شوند." icon={UsersRound} action={<Button onClick={() => setEditor("new")}><Plus />کاربر جدید</Button>} /></Card>
    <DataTable rows={settings.users} searchBy={(user) => user.name + " " + user.email + " " + user.role} columns={[
      { accessorKey: "name", header: "کاربر", cell: ({ row }) => <div className="table-person"><PersonAvatar name={row.original.name} /><b>{row.original.name}</b></div> },
      { accessorKey: "email", header: "ایمیل", cell: ({ row }) => <bdi className="row" dir="ltr"><Mail size={13} />{row.original.email}</bdi> },
      { accessorKey: "role", header: "نقش" },
      { accessorKey: "active", header: "وضعیت", cell: ({ row }) => <div className="row"><Switch checked={row.original.active} label={"فعال‌سازی " + row.original.name} onCheckedChange={async (active) => { try { await mutate({ operation: "memberState", id: row.original.id, state: active ? "active" : "disabled" }); saved(); } catch (error) { reportError(error); } }} /><Badge tone={row.original.active ? "green" : "neutral"}>{row.original.active ? "فعال" : "غیرفعال"}</Badge></div> },
      { id: "actions", header: "عملیات", enableSorting: false, cell: ({ row }) => <RecordMenu edit={() => setEditor(row.original)} remove={() => setDeleting(row.original)} /> },
    ]} />
    <Modal open={!!editor} onOpenChange={(open) => { if (!open) setEditor(undefined); }} title={item ? "ویرایش کاربر" : "کاربر جدید"}>
      <RecordForm key={item?.id || "new"} fields={[
        ...(!item ? [{ key: "name", label: "نام و نام خانوادگی", required: true }, { key: "email", label: "ایمیل", kind: "email" as const }, { key: "mobile", label: "شماره موبایل", kind: "mobile" as const, required: true }] : []),
        { key: "roleId", label: "نقش", required: true, kind: "select", options: settings.roles.map((role) => ({ value: role.id, label: role.name })) },
      ]} initial={item ? { ...item } : {}}
        onCancel={() => setEditor(undefined)} onSave={async ({ name, email, mobile, roleId }) => {
          await mutate({ operation: "member", values: item ? { id: item.id, roleId } : { name, email, mobile, roleId } }); setEditor(undefined); saved();
        }} />
    </Modal>
    <Confirm open={!!deleting} close={() => setDeleting(undefined)} title="حذف عضویت کاربر" description={(deleting?.name || "") + " از فهرست کاربران حذف شود؟"} onConfirm={async () => {
      if (deleting) try { await mutate({ operation: "memberState", id: deleting.id, state: "removed" }); toast.success("عضویت حذف شد."); } catch (error) { reportError(error); }
    }} />
  </div>;
}
function Roles({ settings }: { settings: Settings }) {
  const [editor, setEditor] = useState<Role | "new">();
  const [deleting, setDeleting] = useState<Role>();
  const item = editor === "new" ? undefined : editor;
  return <div className="stack"><Card><PanelHeading title="نقش‌ها و مجوزها" description="مجوزها برای مشخص کردن مسئولیت اعضای تیم." icon={ShieldCheck} action={<Button onClick={() => setEditor("new")}><Plus />نقش جدید</Button>} /></Card>
    <DataTable rows={settings.roles} searchBy={(role) => role.name + " " + role.permissions.join(" ")} columns={[
      { accessorKey: "name", header: "نقش" }, { accessorKey: "permissions", header: "مجوزها", enableSorting: false, cell: ({ row }) => <div className="row">{row.original.permissions.map((permission) => <Badge tone="indigo" key={permission}>{settings.permissionOptions?.find(({ code }) => code === permission)?.label ?? permission}</Badge>)}</div> },
      { id: "users", header: "تعداد اعضا", accessorFn: (role) => settings.users.filter((user) => user.role === role.name).length, cell: ({ getValue }) => fa(Number(getValue())) },
      { id: "actions", header: "عملیات", enableSorting: false, cell: ({ row }) => <RecordMenu edit={() => setEditor(row.original)} remove={() => {
        if (settings.users.some((user) => user.role === row.original.name)) toast.error("ابتدا نقش اعضای مرتبط را تغییر دهید.");
        else setDeleting(row.original);
      }} /> },
    ]} />
    <Modal open={!!editor} onOpenChange={(open) => { if (!open) setEditor(undefined); }} title={item ? "ویرایش نقش" : "نقش جدید"}>
      {editor && <RoleEditor key={item?.id || "new"} item={item} close={() => setEditor(undefined)} settings={settings} />}
    </Modal>
    <Confirm open={!!deleting} close={() => setDeleting(undefined)} title="حذف نقش" description={(deleting?.name || "") + " حذف شود؟"} onConfirm={async () => { if (deleting) try { await mutate({ operation: "archiveRole", id: deleting.id }); toast.success("نقش حذف شد."); } catch (error) { reportError(error); } }} />
  </div>;
}
function RoleEditor({ item, close, settings }: { item?: Role; close: () => void; settings: Settings }) {
  const [permissions, setPermissions] = useState<string[]>(item?.permissions || []);
  return <RecordForm fields={[{ key: "name", label: "نام نقش", required: true, wide: true }]} initial={item ? { name: item.name } : {}} onCancel={close}
    extra={<fieldset className="role-permissions"><legend>مجوزها</legend>{(settings.permissionOptions ?? []).map(({ code, label }) => <label key={code} className="row"><CheckBox label={label} checked={permissions.includes(code)} onCheckedChange={(checked) => setPermissions((current) => checked ? [...current, code] : current.filter((entry) => entry !== code))} />{label}</label>)}</fieldset>}
    onSave={async ({ name }) => {
      if (!permissions.length) throw new Error("دست‌کم یک مجوز انتخاب کنید.");
      await mutate({ operation: "role", values: { id: item?.id, name, permissions } }); saved(); close();
    }} />;
}
