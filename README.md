# Loopz 📺

منصة عربية (RTL أولاً) لتتبع المسلسلات والأفلام والأنمي: بحث ومتابعة، تأشير الحلقات المشاهَدة مع شريط تقدّم، اكتشاف وقوائم وعوالم، مجتمعات ورسائل فورية، وإحصائيات مشاهدة. تسجيل الدخول عبر Google.

**الموقع الرسمي:** https://loopztv.com

**التقنيات:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Auth + Postgres + Realtime) · TMDB API · منشور على Vercel.

> ملاحظة تسمية: اسم المستودع `meshahed` هو الاسم القديم للمشروع؛ اسم المنتج هو **Loopz**.

---

## التشغيل محلياً

```bash
npm install
cp .env.example .env.local   # ثم عبّئ القيم
npm run dev
```

افتح http://localhost:3000 — وراجع `SETUP.md` لخطوات الحصول على المفاتيح.

---

## متغيّرات البيئة

| المتغيّر | الوصف |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح anon العام من Supabase |
| `TMDB_API_KEY` | مفتاح TMDB (v3) |
| `NEXT_PUBLIC_SITE_URL` | رابط الموقع (محلياً `http://localhost:3000`، إنتاجاً `https://loopztv.com`) |
| `GEMINI_API_KEY` | اختياري — يفعّل بحث الوصف الحرّ (وضع الذكاء) |
| `TRAKT_CLIENT_ID` / `TRAKT_CLIENT_SECRET` | اختياري — استيراد المكتبة من Trakt |

---

## قاعدة البيانات

ملفات `supabase/*.sql` تُشغَّل في Supabase → SQL Editor **بالترتيب المرقّم في `supabase/README.md`**. سياسات القراءة ودوال العرض مصدرها الوحيد `security.sql` و`security2.sql`.

---

## البنية

```
src/
  app/            الصفحات (الرئيسية، اكتشف، البحث، المكتبة، القوائم، المجتمع، تفاصيل العمل…)
    admin/        لوحة الإدارة — فهرسٌ + المستخدمون · الشركاء · التوثيق · التحويلات · روابط المنصّات
                  (`am_admin()` وحدها، وغيرُ الإداريّ يرى 404: وجودُ اللوحة لا يُقال لمن لا يملكها)
  components/     مكوّنات الواجهة (تتبّع الحلقات، البطاقات، الأوراق، المجتمعات…)
  lib/
    tmdb.ts       عميل TMDB
    supabase/     عملاء Supabase (متصفح/خادم)
    actions.ts    Server Actions
    data.ts       جلب بيانات المستخدم
    site.ts       النطاق الرسمي — كل رابط يخرج من التطبيق يُبنى منه
  proxy.ts        تجديد جلسة Supabase (Middleware سابقاً في Next الأقدم)
supabase/         ملفات SQL المرقّمة + README بترتيب التشغيل
public/sw.js      Service Worker — قشرة تطبيق للفتح الفوري (PWA)
```
