import { type CRMState, type Contact, type Company, type Deal, type Lead, type Task, type Activity, contactStatuses, stages, sources, leadStatuses, priorities, eventTypes, smsStatuses } from "@shared/model";
import { isoDay, today } from "@shared/utils";

export const seedOwners = ["آرمان رضایی", "سارا مرادی", "علی کریمی", "نیلوفر احمدی"];
const daysAgo = (days: number) => today(-days).toISOString();
const day = (offset = 0) => isoDay(today(offset));
const contactNames = ["مهسا صادقی", "امیر محمدی", "نازنین اکبری", "کیان رحیمی", "آوا حسینی", "علی کرمی", "یلدا شریفی", "پیمان موسوی", "شبنم نوری", "ماهان امیری", "سینا سعیدی", "مینا مقدم", "ترانه راد", "آراد کریمی", "داریوش فلاح", "مریم بهرامی", "نیما کاظمی", "پرستو یوسفی", "الهام صالحی", "هومن حیدری", "تینا معینی", "محمد حسینی", "مونا مرادی", "آرین اسدی"];
const companyNames = ["رادین‌پرداز", "گروه آوید", "داده‌پردازان نوین", "آتیه‌نگر", "ویرا تجارت", "رایان گستر", "پارس داده", "آوای سپهر"];
const industries = ["فناوری اطلاعات", "خدمات مالی", "توسعه نرم‌افزار", "بازرگانی"];
const roles = ["مدیر محصول", "مدیر فروش", "مدیرعامل", "کارشناس توسعه"];
const companyId = (index: number) => "company-" + index % companyNames.length;
const contactId = (index: number) => "contact-" + index % contactNames.length;
const owner = (index: number) => seedOwners[index % seedOwners.length];
const phone = (index: number) => "0912" + String(3475610 + index * 711);
const email = (index: number) => "contact" + (index + 1) + "@example.ir";

export function createSeed(): CRMState {
  const companies: Company[] = companyNames.map((name, index) => ({ id: companyId(index), name, industry: industries[index % 4], mobile: phone(index + 40), email: "info" + (index + 1) + "@example.ir", website: "https://example.ir", description: "اطلاعات و سوابق همکاری با " + name, notes: [], created: daysAgo(60 + index) }));
  const contacts: Contact[] = contactNames.map((name, index) => ({ id: contactId(index), name, mobile: phone(index), email: email(index), companyId: companyId(index), role: roles[index % 4], status: contactStatuses[index % 4], source: sources[index % 5], created: daysAgo(index * 2), owner: owner(index), description: "", tags: [index % 2 ? "پیگیری" : "مشتری کلیدی"], notes: index ? [] : [{ id: "note-0", text: "پیشنهاد همکاری برای بررسی ارسال شد. تماس بعدی در هفتهٔ آینده.", date: daysAgo(1) }] }));
  const leads: Lead[] = Array.from({ length: 19 }, (_, index) => ({ id: "lead-" + index, name: ["بهزاد قاسمی", "مهدیه شمس", "سروش هاشمی", "نگار محمدی", "بهنام سوری", "رها فراهانی", "سحر رستمی", "پژمان جلالی", "سپیده نادری", "کاوه معینی"][index % 10] + (index >= 10 ? "‌زاده" : ""), mobile: phone(index + 80), email: email(index + 80), companyId: companyId(index), source: sources[index % 5], status: leadStatuses[index % 5], score: 35 + (index * 9) % 64, owner: owner(index), followUp: day(-index), created: daysAgo(index * 2), description: "" }));
  const dealNames = ["راه‌اندازی سامانه فروش", "قرارداد پشتیبانی سالانه", "افزودن کاربران سازمانی", "ارتقای پنل ارتباط با مشتری", "پیاده‌سازی اتوماسیون", "تمدید اشتراک سازمانی", "آموزش و استقرار", "یکپارچه‌سازی فرایند فروش", "سرویس گزارش‌گیری پیشرفته"];
  const deals: Deal[] = Array.from({ length: 22 }, (_, index) => ({ id: "deal-" + index, name: dealNames[index % dealNames.length], companyId: companyId(index), contactId: contactId(index), stage: stages[(index + Math.floor(index / 4)) % 6], value: (12 + (index * 16) % 131) * 1_000_000, probability: [15, 35, 55, 80, 100, 0][(index + Math.floor(index / 4)) % 6], owner: owner(index), close: day(index - 4), created: daysAgo(index), description: "" }));
  const taskNames = ["پیگیری پیشنهاد گروه آوید", "تماس با مهسا صادقی", "ارسال قرارداد رادین‌پرداز", "هماهنگی جلسهٔ معرفی محصول", "بررسی بازخورد مشتریان", "آماده‌سازی گزارش فروش", "ارسال صورت‌جلسه", "پیگیری تمدید قرارداد"];
  const tasks: Task[] = taskNames.map((name, index) => ({ id: "task-" + index, name, contactId: contactId(index), owner: owner(index), priority: priorities[2 - (index % 3)], status: index === 6 ? "انجام‌شده" : index === 2 ? "در حال انجام" : "باز", due: day(Math.max(0, index - 1)), reminder: "۳۰ دقیقه قبل", description: "", created: daysAgo(index % 4) }));
  const activityNames = ["فرصت فروش جدید ثبت شد", "تماس با مهسا صادقی", "مشتری جدید اضافه شد", "جلسهٔ معرفی محصول", "یادداشت پیگیری ثبت شد", "وظیفهٔ پیگیری پیشنهاد ایجاد شد"];
  const activityNotes = ["راه‌اندازی سامانه فروش · رادین‌پرداز", "پیگیری مراحل قرارداد", "امیر محمدی · گروه آوید", "ارائه به تیم بازرگانی", "بررسی شرایط تجاری", "پیگیری پیشنهاد گروه آوید"];
  const types = ["فرصت", "تماس", "مشتری", "جلسه", "یادداشت", "وظیفه"] as const;
  const activities: Activity[] = activityNames.map((name, index) => ({ id: "activity-" + index, name, description: activityNotes[index], type: types[index], owner: owner(index), date: new Date(Date.now() - (index + 1) * 3_600_000).toISOString(), contactId: contactId(index), companyId: companyId(index) }));
  const curve = [12, 15, 14, 20, 17, 30, 27, 23, 38, 31, 46, 40, 47, 39, 58, 52, 70, 67, 48, 61, 54, 68, 64, 78, 73, 89, 78, 91, 88, 104];
  return {
    contacts, companies, leads, deals, tasks, activities,
    events: ["جلسهٔ بررسی قرارداد", "تماس با سرنخ جدید", "جلسهٔ استقرار سامانه", "پیگیری پیشنهاد قیمت"].map((name, index) => ({ id: "event-" + index, name, type: eventTypes[index % 3], date: day(index * 3 - 2), time: ["09:00", "12:30", "15:00", "10:30"][index], contactId: contactId(index), description: "" })),
    sms: Array.from({ length: 10 }, (_, index) => ({ id: "sms-" + index, mobile: phone(index), contactId: contactId(index), name: contactNames[index], text: "سلام " + contactNames[index] + "، درخواست شما ثبت شد.", date: daysAgo(index), status: index < 6 ? "موفق" : smsStatuses[index % 3], source: index % 2 === 0 ? "دستی" : "اتوماسیون", type: "اطلاع‌رسانی" })),
    templates: [
      { id: "template-1", name: "خوشامدگویی مشتری", text: "سلام {{customer_name}}، به هم‌مدار خوش آمدید. از همراهی {{company_name}} خوشحالیم." },
      { id: "template-2", name: "تأیید ثبت درخواست", text: "سلام {{customer_name}}، درخواست شما با موفقیت ثبت شد." },
    ],
    workflows: [
      { id: "workflow-1", name: "خوشامدگویی به مشتری", description: "ارسال پیام خوشامدگویی با ثبت مشتری جدید", enabled: true, created: daysAgo(15),
        nodes: [
          { id: "welcome-trigger", kind: "trigger", operation: "ایجاد مشتری جدید", value: "", position: {x: 380, y: 95} },
          { id: "welcome-action", kind: "action", operation: "ارسال پیامک", value: "سلام، به هم‌مدار خوش آمدید.", position: {x: 85, y: 95} },
        ],
        links: [{ id: "welcome-edge", source: "welcome-trigger", target: "welcome-action" }],
        runs: [{ id: "welcome-run", date: daysAgo(1), result: "موفق", steps: [
          { nodeId: "welcome-trigger", title: "ایجاد مشتری جدید", result: "موفق", message: "رویداد آزمایشی دریافت شد." },
          { nodeId: "welcome-action", title: "ارسال پیامک", result: "موفق", message: "ارسال پیامک شبیه‌سازی شد." },
        ] }],
      },
      { id: "workflow-2", name: "یادآوری پیگیری سرنخ", description: "ایجاد وظیفهٔ پیگیری برای سرنخ‌های تازه", enabled: false, created: daysAgo(7),
        nodes: [
          { id: "lead-trigger", kind: "trigger", operation: "ایجاد سرنخ جدید", value: "", position: {x: 380, y: 95} },
          { id: "lead-action", kind: "action", operation: "ایجاد وظیفه", value: "پیگیری سرنخ", position: {x: 85, y: 95} },
        ], links: [{ id: "lead-edge", source: "lead-trigger", target: "lead-action" }], runs: [],
      },
    ],
    settings: { name: seedOwners[0], email: "arman@example.ir", workspace: "فضای کاری فروش", notifications: true, taskAlerts: true, smsSender: "300012345", otpLength: 6, otpResend: 120,
      users: seedOwners.map((name, index) => ({ id: "user-" + index, name, role: index === 0 ? "مدیر" : "کارشناس", email: email(index), active: true })),
      roles: [{ id: "role-0", name: "مدیر", permissions: ["مشاهده", "ویرایش", "مدیریت"] }, { id: "role-1", name: "کارشناس", permissions: ["مشاهده", "ویرایش"] }] },
    sales: Array.from({ length: 90 }, (_, index) => ({ date: day(index - 89), value: (index < 60 ? Math.round(curve[index % 30] * .9) : curve[index % 30]) * 1_000_000, owner: owner(index) })),
  };
}

