# هم‌مدار CRM

رابط فارسی و راست‌چین با Next.js App Router، بک‌اند همان برنامه، PostgreSQL و Prisma. فرایند مستقل Worker رویدادهای CRM، وظایف موعددار و گردش‌کارهای فعال را پردازش می‌کند.

## ساختار پروژه

| پوشه | محتوا |
| --- | --- |
| [frontend](./frontend/) | صفحات Next.js، رابط کاربری، استایل‌ها و تنظیمات shadcn/ui |
| [backend](./backend/) | پیاده‌سازی API و Server Actions، احراز هویت، سرویس‌ها و Worker |
| [database](./database/) | اسکیمای Prisma، Migrationها، Seed، اتصال PostgreSQL و اسکریپت‌های دیتابیس |
| [shared](./shared/) | مدل‌ها، کدهای دامنه، قواعد گردش‌کار و ابزارهای مشترک |

فرمان‌های npm و Docker Compose در ریشهٔ پروژه مدیریت می‌شوند. در توسعهٔ یکپارچه، Next.js صفحه‌ها و مسیرهای `/api` را از یک سرور ارائه می‌کند. تنظیمات محیط در پوشهٔ هر سرویس و داده‌های محلی PostgreSQL در `.local/postgres` قرار دارند. [استقرار مستقل](./DEPLOYMENT.md)

## راه‌اندازی روی Windows

فایل [start-crm.bat](./start-crm.bat) را اجرا کنید. PostgreSQL محلی، Worker و Next.js را راه می‌اندازد و نشانی ورود را نشان می‌دهد. در اجرای اول وابستگی‌ها نصب می‌شوند و دیتابیس خالی با دادهٔ نمونه آماده می‌شود. Worker در این حالت از PostgreSQL استفاده می‌کند. اگر مسیر ابزار PostgreSQL متفاوت است، فایل را با گزینهٔ `-PostgresBin` و مسیر پوشهٔ `bin` اجرا کنید.

Node.js 24 و ابزار PostgreSQL 17 لازم‌اند. فایل BAT از Windows PowerShell داخلی استفاده می‌کند. فرمان PowerShell خوشهٔ تازه‌ای در `.local/postgres` با دسترسی محلی و دیتابیس‌های جداگانهٔ توسعه و تست می‌سازد. برای اجرای دستی با مسیر متفاوت ابزارهای PostgreSQL، گزینهٔ `-Bin` را بدهید.

```powershell
npm ci
./database/scripts/local-postgres.ps1 start
npm run db:migrate
npm run db:seed
npm run dev -- --hostname 127.0.0.1
```

در محیط توسعه، `http://localhost:3000` را باز کنید. روی «استفاده از شمارهٔ نمونه» بزنید و کدی را که صندوق آزمایشی نشان می‌دهد وارد کنید. مسیرهای CRM با همان نشست پایگاه داده باز می‌شوند.

در «تنظیمات ← امنیت حساب» می‌توانید پس از ورود با کد، برای حساب رمز عبور تعیین کنید. از دفعهٔ بعد، گزینهٔ «رمز عبور» در صفحهٔ ورود از شماره موبایل و رمز استفاده می‌کند. مدیر فضای کاری اعضا را از «تنظیمات ← کاربران» اضافه می‌کند. [ساخت مدیر اول در استقرار تازه](./DEPLOYMENT.md)

## پردازش پس‌زمینه

اگر Docker در دسترس است، Redis محلی را راه‌اندازی کنید و `REDIS_URL=redis://127.0.0.1:56379` را در `backend/.env.development.local` قرار دهید. سپس Worker را در ترمینال دوم اجرا کنید.

```powershell
docker compose up -d redis
npm run worker
```

روی Windows بدون Redis، همان موتور و Outbox را در حالت توسعه با فرمان زیر اجرا کنید. نسخهٔ تولیدی Worker از Redis/BullMQ استفاده می‌کند.

```powershell
$env:WORKER_TRANSPORT = "postgres-local"
npm run worker
```

## بررسی و ساخت

```powershell
npm run db:validate
npm run typecheck
npm run lint
npm test
npm run build
```

`npm test` آزمون‌های واحد را اجرا می‌کند و Migration و آزمون یکپارچه را روی `hamsir_crm_test` انجام می‌دهد. خروجی Build یکپارچه در `frontend/.next` قرار می‌گیرد. اجرای تولیدی وب با `npm start` و اجرای Worker با `npm run worker` از ریشهٔ پروژه است. [مسیرهای Build سرویس‌های مستقل](./DEPLOYMENT.md)

[دیتابیس](./DATABASE.md) · [معماری](./BACKEND_ARCHITECTURE.md) · [API](./API_DOCUMENTATION.md) · [محیط](./ENVIRONMENT.md) · [تحلیل اولیه](./BACKEND_ANALYSIS.md)
