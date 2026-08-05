# مشاهد 📺

تطبيق ويب لمتابعة المسلسلات والأفلام (شبيه بـ TV Time): بحث ومتابعة، تأشير الحلقات المشاهَدة مع شريط تقدّم، قسم "القادم قريباً" للتذكير بالحلقات الجديدة، وإحصائيات مشاهدة. تسجيل الدخول عبر Google.

**التقنيات:** Next.js 16 · TypeScript · Tailwind CSS 4 · Supabase (Auth + Postgres) · TMDB API · جاهز للنشر على Vercel.

---

## المتطلبات قبل التشغيل

تحتاج ثلاثة أشياء مجانية:

1. **مفتاح TMDB** — لبيانات المسلسلات والأفلام.
2. **مشروع Supabase** — لتسجيل الدخول وحفظ البيانات.
3. **بيانات Google OAuth** — لزر "الدخول عبر Google".

راجع ملف `SETUP.md` لخطوات الحصول عليها بالتفصيل.

---

## التشغيل محلياً

```bash
npm install
cp .env.example .env.local   # ثم عبّئ القيم
npm run dev
```

افتح http://localhost:3000

---

## متغيّرات البيئة

| المتغيّر | الوصف |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح anon العام من Supabase |
| `TMDB_API_KEY` | مفتاح TMDB (v3) |
| `NEXT_PUBLIC_SITE_URL` | رابط الموقع (محلياً `http://localhost:3000`) |

---

## قاعدة البيانات

شغّل محتوى `supabase/schema.sql` في: Supabase Dashboard → SQL Editor.
يُنشئ الجداول (`follows`, `watched_episodes`, `watched_movies`) مع سياسات RLS بحيث لا يرى أي مستخدم إلا بياناته.

---

## البنية

```
src/
  app/            الصفحات (الرئيسية، البحث، المكتبة، الإحصائيات، تفاصيل العمل، الدخول)
  components/      مكوّنات الواجهة (تتبّع الحلقات، أزرار المتابعة، إلخ)
  lib/
    tmdb.ts       عميل TMDB
    supabase/     عملاء Supabase (متصفح/خادم)
    actions.ts    Server Actions للمتابعة والتأشير
    data.ts       جلب بيانات المستخدم
  proxy.ts        تحديث جلسة Supabase (كان اسمه middleware في إصدارات أقدم)
supabase/schema.sql
```


<!-- redeploy: re-trigger Vercel production build for latest main (cf61c30) -->
