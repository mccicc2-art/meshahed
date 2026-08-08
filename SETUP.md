# دليل الإعداد والنشر — Loopz

اتبع الخطوات بالترتيب. كلها مجانية. الوقت المتوقّع: ١٥–٢٥ دقيقة.

---

## ① مفتاح TMDB (بيانات المسلسلات والأفلام)

1. سجّل حساب على https://www.themoviedb.org/signup
2. فعّل الحساب من رسالة البريد.
3. اذهب إلى: الإعدادات → API → اطلب مفتاحاً (Developer / للاستخدام الشخصي).
   الرابط المباشر: https://www.themoviedb.org/settings/api
4. انسخ قيمة **API Key (v3 auth)**.

➜ هذه قيمة `TMDB_API_KEY`.

---

## ② مشروع Supabase (تسجيل الدخول + قاعدة البيانات)

1. سجّل على https://supabase.com ثم **New project**.
2. اختر اسماً وكلمة مرور لقاعدة البيانات ومنطقة قريبة، وأنشئ المشروع (ينتظر دقيقة).
3. من **Project Settings → API** انسخ:
   - **Project URL** ➜ `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key ➜ `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. من **SQL Editor → New query**، الصق كامل محتوى ملف `supabase/schema.sql` ثم **Run**.
   (يُنشئ الجداول وسياسات الحماية.)

---

## ③ تفعيل الدخول عبر Google

يتطلب إنشاء "بيانات OAuth" في Google، ثم لصقها في Supabase.

### أ. في Google Cloud
1. افتح https://console.cloud.google.com ← أنشئ مشروعاً جديداً.
2. **APIs & Services → OAuth consent screen**: اختر *External*، عبّئ اسم التطبيق وبريدك، واحفظ. أضف بريدك في **Test users**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - نوع التطبيق: **Web application**.
   - **Authorized redirect URIs** — أضف الرابط التالي (تجده جاهزاً في Supabase في الخطوة ب):
     ```
     https://<اسم-مشروعك>.supabase.co/auth/v1/callback
     ```
4. انسخ **Client ID** و **Client Secret**.

### ب. في Supabase
1. **Authentication → Sign In / Providers → Google** ← فعّله.
2. الصق **Client ID** و **Client Secret**.
3. انسخ رابط **Callback URL** الظاهر هنا وتأكد أنه نفس ما وضعته في Google (خطوة أ-٣).
4. احفظ.

### ج. روابط إعادة التوجيه في Supabase
**Authentication → URL Configuration**:
- **Site URL**: رابط موقعك على Vercel (بعد النشر) مثل `https://loopztv.com` (أو رابط Vercel قبل ربط الدومين)
- **Redirect URLs**: أضف
  ```
  http://localhost:3000/**
  https://<موقعك>.vercel.app/**
  ```

---

## ④ التشغيل محلياً (اختياري للتجربة)

```bash
npm install
cp .env.example .env.local
# عبّئ القيم الأربع في .env.local
npm run dev
```

---

## ⑤ النشر على GitHub + Vercel

### أ. رفع الكود إلى GitHub
1. أنشئ مستودعاً جديداً فارغاً على https://github.com/new (خاص أو عام).
2. من مجلد المشروع:
   ```bash
   git init
   git add .
   git commit -m "Loopz: النسخة الأولى"
   git branch -M main
   git remote add origin https://github.com/<حسابك>/<المستودع>.git
   git push -u origin main
   ```

### ب. النشر على Vercel
1. افتح https://vercel.com ← **Add New → Project** ← استورد مستودع GitHub.
2. Vercel يكتشف Next.js تلقائياً — لا تغيّر إعدادات البناء.
3. في **Environment Variables** أضف الأربعة:
   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | رابط Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح anon |
   | `TMDB_API_KEY` | مفتاح TMDB |
   | `NEXT_PUBLIC_SITE_URL` | رابط موقعك على Vercel |
4. **Deploy**.
5. بعد النشر، ارجع لـ Supabase (خطوة ٣-ج) وحدّث **Site URL** و **Redirect URLs** برابط Vercel الفعلي، وأضف نفس الرابط في **Google → Authorized redirect URIs** إن لزم.

> ملاحظة: عند أول نشر لن تعرف رابط Vercel النهائي. انشر أولاً، خذ الرابط، ثم عدّل `NEXT_PUBLIC_SITE_URL` في Vercel وأعد النشر، وحدّث روابط Supabase/Google.

---

## المشاكل الشائعة

- **زر Google يعطي خطأ redirect_uri_mismatch**: الرابط في Google لا يطابق تماماً Callback URL في Supabase. انسخه حرفياً.
- **بعد الدخول يرجعني لصفحة الدخول**: تأكد أن `NEXT_PUBLIC_SITE_URL` صحيح وأن الرابط مضاف في Supabase → Redirect URLs.
- **لا تظهر صور/بيانات**: تحقق من `TMDB_API_KEY`.
