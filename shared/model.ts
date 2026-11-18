export const contactStatuses = ["فعال", "در مذاکره", "بالقوه", "غیرفعال"] as const;
export const sources = ["وب‌سایت", "معرفی", "شبکه‌های اجتماعی", "تماس مستقیم", "نمایشگاه"] as const;
export const leadStatuses = ["جدید", "در حال پیگیری", "واجد شرایط", "رد شده", "تبدیل‌شده"] as const;
export const stages = ["شناسایی", "ارزیابی", "پیشنهاد", "مذاکره", "موفق", "ناموفق"] as const;
export const priorities = ["کم", "متوسط", "زیاد"] as const;
export const taskStatuses = ["باز", "در حال انجام", "انجام‌شده"] as const;
export const eventTypes = ["جلسه", "تماس", "وظیفه"] as const;
export const activityTypes = ["تماس", "جلسه", "ایمیل", "یادداشت", "مشتری", "فرصت", "وظیفه", "پیامک", "سرنخ"] as const;
export const smsStatuses = ["موفق", "ناموفق", "در انتظار"] as const;
export const tones = ["indigo", "green", "cyan", "violet", "amber", "red"] as const;
export type ContactStatus = typeof contactStatuses[number];
export type LeadStatus = typeof leadStatuses[number];
export type Stage = typeof stages[number];
export type Priority = typeof priorities[number];
export type TaskStatus = typeof taskStatuses[number];
export type EventType = typeof eventTypes[number];
export type ActivityType = typeof activityTypes[number];
export type SmsStatus = typeof smsStatuses[number];

export interface Note { id: string; text: string; date: string }
export interface Contact { id: string; name: string; mobile: string; email: string; companyId: string; companyName?: string; role: string; status: ContactStatus; source: string; description: string; tags: string[]; notes: Note[]; created: string; owner: string; ownerId?: string }
export interface Company { id: string; name: string; industry: string; mobile: string; email: string; website: string; description: string; notes: Note[]; created: string; personCount?: number }
export interface Lead { id: string; name: string; mobile: string; email: string; companyId: string; source: string; status: LeadStatus; score: number; owner: string; ownerId?: string; followUp: string; created: string; description: string }
export interface Deal { id: string; name: string; companyId: string; companyName?: string; contactId: string; stage: Stage; value: number; amountToman?: string; rowVersion?: number; probability: number; owner: string; ownerId?: string; close: string; wonAt?: string; created: string; description: string }
export interface Task { id: string; name: string; contactId: string; owner: string; ownerId?: string; priority: Priority; status: TaskStatus; due: string; dueTime?: string; reminder: string; description: string; created: string }
export interface CalendarEvent { id: string; name: string; type: EventType; date: string; time: string; contactId: string; description: string }
export interface Activity { id: string; name: string; description: string; type: ActivityType; date: string; contactId?: string; companyId?: string; owner: string; ownerId?: string; isSystem?: boolean }
export interface Sms { id: string; mobile: string; contactId: string; name: string; text: string; date: string; status: SmsStatus; type: string; source: "دستی" | "اتوماسیون" }
export interface Template { id: string; name: string; text: string }
export type NodeKind = "trigger" | "condition" | "action" | "delay";
export interface WorkflowNode { id: string; kind: NodeKind; operation: string; value: string; position: {x: number; y: number}; }
export interface WorkflowLink { id: string; source: string; target: string; branch?: string }
export type RunResult = "موفق" | "خطا" | "در حال اجرا";
export interface WorkflowStep { nodeId: string; title: string; result: RunResult | "رد شد"; message: string }
export interface WorkflowRun { id: string; date: string; steps: WorkflowStep[]; result: RunResult }
export interface Workflow { id: string; name: string; description: string; enabled: boolean; created: string; nodes: WorkflowNode[]; links: WorkflowLink[]; runs: WorkflowRun[]; rowVersion?: number; runCount?: number; lastRunAt?: string }
export interface TeamUser { id: string; name: string; role: string; roleId?: string; mobile?: string; email: string; active: boolean }
export interface Role { id: string; name: string; permissions: string[] }
export interface Settings { name: string; email: string; workspace: string; membershipId?: string; roleName?: string; grants?: string[]; notifications: boolean; taskAlerts: boolean; smsSender: string; smsCredit?: number; otpLength: number; otpResend: number; otpTemplate?: string; passwordConfigured?: boolean; users: TeamUser[]; roles: Role[]; permissionOptions?: { code: string; label: string }[] }
export interface Sale { date: string; value: number; amountToman?: string; owner: string }
export interface CRMState {
  contacts: Contact[]; companies: Company[]; leads: Lead[]; deals: Deal[]; tasks: Task[]; events: CalendarEvent[];
  activities: Activity[]; sms: Sms[]; templates: Template[]; workflows: Workflow[]; settings: Settings; sales: Sale[];
  notifications?: { id: string; taskId?: string; name: string; body: string; read: boolean }[];
  dashboard?: { today: string; todayTasks: number; daily: { day: string; kind: string; count: number }[]; funnel: { stage: string; count: number }[] };
  stats?: { contacts: number; activeContacts: number; negotiations: number; inactiveContacts: number; joined: number; activeDeals: number; openToman: string; weightedToman: string; wonDeals: number; leads: number; newLeads: number; qualifiedLeads: number; convertedLeads: number; workflowCount: number; enabledWorkflows: number; workflowRuns: number; sms: number; smsDelivered: number; smsFailed: number; smsPending: number };
}

export const contactTone: Record<ContactStatus, string> = { "فعال": "green", "در مذاکره": "violet", "بالقوه": "amber", "غیرفعال": "neutral" };
export const stageTone: Record<Stage, string> = { "شناسایی": "cyan", "ارزیابی": "amber", "پیشنهاد": "violet", "مذاکره": "indigo", "موفق": "green", "ناموفق": "red" };
export const taskTone: Record<TaskStatus, string> = { "باز": "neutral", "در حال انجام": "indigo", "انجام‌شده": "green" };
export const priorityTone: Record<Priority, string> = { "کم": "cyan", "متوسط": "amber", "زیاد": "red" };
export const smsTone: Record<SmsStatus, string> = { "موفق": "green", "ناموفق": "red", "در انتظار": "amber" };
