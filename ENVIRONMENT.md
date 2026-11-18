# تنظیمات محیط هم‌مدار

| بخش | توسعهٔ محلی | استقرار |
| --- | --- | --- |
| فرانت | `frontend/.env.local` | متغیرهای فرایند Next.js فرانت |
| API و Worker | `backend/.env.development.local` | متغیرهای فرایند هر سرویس و مخزن اسرار |
| Prisma، تست و Compose | `database/.env.local` | متغیرهای فرایند Migration یا پنل PostgreSQL |

فرایندهای مستقل فایل محیط سرویس دیگر را نمی‌خوانند. در حالت یکپارچهٔ توسعه، سرور Next.js فرانت API را نیز اجرا می‌کند و تنظیمات توسعهٔ بک‌اند را می‌خواند. متغیرهای تزریق‌شده به فرایند بر فایل‌ها تقدم دارند. ابزار Prisma در تولید `DIRECT_URL` را از محیط فرایند می‌گیرد.

| مالک و کاربرد | نام متغیر |
| --- | --- |
| فرانت، انتخاب Build یکپارچه یا مستقل | `CRM_FRONTEND_MODE` |
| فرانت مستقل، مقصد خصوصی API در زمان اجرا | `CRM_BACKEND_URL` |
| API و Worker، نقش محدود PostgreSQL | `DATABASE_URL` |
| API، مبدأ مرورگر، احراز هویت و محدودیت نرخ | `APP_ORIGIN`، `OTP_SECRET`، `SMS_PROVIDER`، `TRUSTED_CLIENT_IP_HEADER` |
| API، دریافت Callback امضاشدهٔ پیامک | `SMS_WEBHOOK_SECRET`، `SMS_WEBHOOK_ACCOUNT`، `SMS_WEBHOOK_WORKSPACE_ID` |
| Worker، انتخاب روش انتقال و اتصال Redis | `WORKER_TRANSPORT`، `REDIS_URL` |
| ابزار دیتابیس، نقش مستقل Migration و اتصالات تست | `DIRECT_URL`، `TEST_DATABASE_URL`، `TEST_DIRECT_URL` |
| Compose، ساخت PostgreSQL محلی | `POSTGRES_PASSWORD`، `HAMSIR_APP_PASSWORD` |

مرورگر از مسیر نسبی `/api` استفاده می‌کند. این پروژه اکنون هیچ متغیر `NEXT_PUBLIC_*` لازم ندارد. اگر در آینده متغیری با این پیشوند اضافه شد، آن را دادهٔ عمومی در نظر بگیرید و پیش از Build در پنل فرانت تعریف کنید. تغییرش در نسخهٔ Build‌شده به Build مجدد نیاز دارد. [مستندات Next.js](https://nextjs.org/docs/app/guides/environment-variables)

پورت سرویس از `PORT` در محیط فرایند یا گزینهٔ `--port` فرمان Next.js تعیین می‌شود. برای راه‌اندازی محلی Windows، فایل BAT متغیرهای فرآیند توسعه و اتصال لوپ‌بک را تنظیم می‌کند. نام کاربری و دیتابیس پیش‌فرض Compose در `compose.yaml` با اسکریپت اولیهٔ آن هماهنگ‌اند.

نمونه‌ها در [فرانت](./frontend/.env.example)، [بک‌اند](./backend/.env.example) و [دیتابیس](./database/.env.example) قرار دارند. [راهنمای استقرار مستقل](./DEPLOYMENT.md)
