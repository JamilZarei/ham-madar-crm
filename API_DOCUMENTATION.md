# قرارداد API

مسیرهای زیر روی همان میزبان Next.js قرار دارند. تأیید OTP نشست را با Cookie تنظیم می‌کند. مسیرهای خصوصی هویت و مجوز و محدودهٔ فضای کاری را در سرور بررسی می‌کنند. درخواست‌های تغییردهندهٔ مبتنی بر کوکی از Origin مجاز و نوع محتوای `application/json` استفاده می‌کنند.

| روش و مسیر | ورودی و نتیجه |
| --- | --- |
| `POST /api/auth/request/` و `/resend/` | `mobile`. پاسخ شامل `challengeId`، `expiresAt` و `resendAfter` است. `demoCode` به درخواست موفق Mock در Node development محدود است. |
| `POST /api/auth/verify/` | `mobile`، `challengeId` و `code`. در موفقیت Cookie نشست و `signedIn`. |
| `POST /api/auth/password/` | `mobile` و `password`. در موفقیت Cookie نشست و `signedIn`. |
| `POST /api/auth/change-password/` | نشست فعال، `password` جدید و برای حساب دارای رمز، `currentPassword`. نشست‌های قبلی باطل و Cookie تازه صادر می‌شود. |
| `GET /api/auth/session/` | نام کاربر، شناسهٔ فضای فعلی و کد نقش. |
| `GET /api/auth/capabilities/` | وضعیت دسترسی به ورود آزمایشی در محیط توسعه. |
| `POST /api/auth/logout/` | شیء خالی. ابطال نشست و پاک‌شدن Cookie. |
| `GET /api/crm/views/{section}/` | نمای محدود صفحه و تنظیمات جاری. برای جزئیات `id` اختیاری است. |
| `GET /api/crm/records/{collection}/` | `page` از صفر، `size` حداکثر ۵۰، `search`، `sort`، `direction` و فیلترهای مجاز مجموعه. `id` یک جزئیات مجاز می‌خواند. پاسخ `rows` و `total`. |
| `GET /api/crm/search/?q=…` | نتیجهٔ محدود مشتری، شرکت و فرصت در فضای کاری. |
| `GET /api/crm/calendar/?from=…&to=…` | تاریخ استاندارد `YYYY-MM-DD`. رویدادها و وظایف محدوده. |
| `GET /api/crm/reports/?from=…&to=…` | شاخص‌ها و گزارش با بازهٔ حداکثر ۳۶۶ روز. `totalToman` و مبلغ دقیق فروش رشتهٔ عددی هستند. |
| `POST /api/crm/operations/` | ورودی `operation` و payload متناسب. فرم داخلی از Server Action با همان قرارداد استفاده می‌کند. |
| `POST /api/webhooks/sms/{workspaceId}/` | Callback اختیاری و امضاشده. `id`، `messageRef`، `status` و `account`. زمان Unix ثانیه در `x-hamsir-timestamp` و HMAC-SHA256 هگز از `timestamp + "." + rawBody` در `x-hamsir-signature`. |

## عملیات

- `save` با `collection` و `item` و `archive` با `collection` و `ids`. نوع‌های پایه `contacts`، `companies`، `leads`، `deals`، `tasks`، `events`، `activities` و `templates` هستند. تغییر فرصت موجود `rowVersion` و `amountToman` رشتهٔ دیجیت دارد.
- `convertLead` با `id` و `note` با `collection`، `id` و `text`. تنظیمات `profile`، `member`، `memberState`، `role` و `archiveRole` جدا مجوز می‌گیرند. `member.values` برای ایجاد عضویت شامل `name`، `email`، `mobile` و `roleId` و برای تغییر نقش شامل `id` و `roleId` است.
- `sms` با `values` شامل UUID برای `key`، فهرست `selected`، `mobile`، `text`، `type` و `templateId` اختیاری. `retrySms` شناسهٔ گیرنده را می‌گیرد.
- `workflow` برای تعریف نسخه، `workflowState` برای فعال‌سازی، `workflowTest` برای اجرای آزمایشی روی `values` و `scenario` و `readNotification` برای رسید خواندن اعلان.

## پاسخ

موفقیت به شکل `{ ok: true, value }` و خطا به شکل `{ ok: false, error: { code, message, requestId, fields? } }` است. کدهای HTTP اصلی شامل `401` نشست، `403` مجوز، `404` محدودهٔ نامعتبر، `409` تعارض، `422` اعتبارسنجی و `429` محدودیت نرخ هستند. در پاسخ محدودیت نرخ، زمان انتظار در `Retry-After` می‌آید.
