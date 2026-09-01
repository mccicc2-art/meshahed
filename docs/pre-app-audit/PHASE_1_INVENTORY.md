# Phase 1 — Full Inventory (إعادة تسليم بعد `CHANGES_REQUESTED`)

- الحالة: `READY_FOR_REVIEW` · المنفّذ: Claude · المراجع: ChatGPT
- **Audited SHA: `f8a2b33cd036cffd1e7a0b9bc3e5ced0e19b8bfa`** — الـbaseline التشغيلي المعتمد.
- Phase 0 الأصلي يخصّ `64bd1d41851c0cc05f93a8444eaadd41d47f9108`، **ونتائج بوّاباته لا تُعاد استخدامها هنا** — أُعيد تشغيل البوّابات الأربع كاملةً على `f8a2b33c` (§1).
- النطاق: قراءة وجرد فقط. **صفر تعديل على كود التطبيق · صفر حذف · صفر كتابة في قاعدة البيانات · صفر Deploy · صفر مورد جديد.**
- الفرع: `docs/pre-app-audit` · التاريخ: 2026-09-01 UTC.

## ما عولج من `CHANGES_REQUESTED`

| اعتراضك | العلاج | القسم |
|---|---|---|
| 1 — SHA غير معتمد | أُعيد كل شيء على `f8a2b33c`، والبوّابات الأربع شُغّلت عليه بوقتٍ وexit code | §1 · §2 |
| 2 — جرد API ناقص | قُرئت **الواحد والعشرون ملفاً كاملة**؛ جدول بالمسار الكامل والوظيفة والمدخلات والتحقق والمصادقة وحدّ المعدّل والخدمات والمتغيّرات. **`UNKNOWN` اختفت من الجدول** | §4 |
| 3 — تصنيف الصفحات ناقص | فُصل تصنيف البناء (`ƒ`/`○`) عن وجود export باسم `dynamic`، وأُضيف `loading`/`error`/`not-found` **محلّي أم موروث** لكل صفحة، وحُسم كل `عام؟` | §3 |
| 4 — خريطة الميزات ناقصة الربط | كل ميزة صارت: Route + المكوّنات + Server Actions + Tables/Views + RPC + Storage/خدمة + مسار ملف | §6 |

**وثلاثة تصحيحات إضافية لأخطاءٍ منّي** — مفصّلة في §9.

---

## 1. بوّابات الجودة على `f8a2b33c`

شُغّلت بالترتيب في نسخة عمل نظيفة (`git worktree` على الـSHA نفسه).

| # | الأمر | exit code | الزمن | المخرَج |
|---|---|---:|---:|---|
| 1 | `npm ci` | **0** | 29s | `added 391 packages in 28s` |
| 2 | `npm run lint` | **0** | 48s | `✖ 16 problems (0 errors, 16 warnings)` |
| 3 | `npx tsc --noEmit` | **0** | 24s | لا مخرَج — صفر خطأ |
| 4 | `npm run build` | **0** | 62s | `✓ Compiled successfully in 30.9s` · `✓ Generating static pages (58/58) in 1054ms` |

**البوّابات الأربع خضراء على الـSHA المعتمد.** لا حالة `BLOCKED`.

جدول مسارات البناء على `f8a2b33c`: **76 مساراً فريداً — 73 `ƒ` ديناميكي + 3 `○` ثابت.** مطابق تماماً لما قيس على `64bd1d41`.

**التحذيرات الستّة عشر** (لا أخطاء): عشرة في `src/lib/shareCard.tsx` (`<img>` بلا `alt` وبلا `next/image` — مولّد صور OG، والاستثناء تقنيّ لأن `next/image` لا يعمل داخل `ImageResponse`؛ يُحسم في Phase 3)، ومتغيّران غير مستعملين في `src/components/ListCoverSheet.tsx:55` و`src/components/TourGuide.tsx:6`، والباقي متفرّق.

---

## 2. مطابقة العدّ (بندك 12) — على `f8a2b33c`

| المصدر | العدد | الأمر |
|---|---:|---|
| `page.tsx` | 49 | `find src/app -name page.tsx \| wc -l` |
| `route.ts` + `route.tsx` | 21 | `find src/app -name 'route.*' \| wc -l` |
| `opengraph-image.tsx` | 3 | |
| `sitemap.ts` · `manifest.ts` · `not-found.tsx` | 3 | |
| **المجموع المتوقَّع** | **76** | |
| **جدول البناء** | **76** | `grep -E '^[├└]' build.log \| grep -oE '(ƒ\|○) /[^ ]*' \| sed 's/^[ƒ○] //' \| sort -u \| wc -l` |
| **الفرق** | **0** | |

`route.tsx` عددها 2: `src/app/api/share/route.tsx` و`src/app/api/list-og/[id]/route.tsx`.

---

## 3. تصنيف صفحات App Router (49)

**عمودان منفصلان كما طلبت:** `build` هو تصنيف ناتج البناء (`ƒ` ديناميكي / `○` ثابت) من جدول `npm run build`؛ و`dynamic export` هو وجود `export const dynamic` في ملف الصفحة. وأعمدة الحالة تقول **`local`** (الملف في مجلد المسار نفسه) أو **`inherit ← <المجلّد>`** (موروث من أقرب سلف) أو **`none`**.

> **النتيجة الأهم: جميع الصفحات التسع والأربعين `ƒ` في البناء — لا صفحة ثابتة واحدة.** الثوابت الثلاثة الوحيدة في التطبيق كله هي `/manifest.webmanifest` و`/opengraph-image` و`/sitemap.xml`. أي أن `export const dynamic = "force-dynamic"` في ست صفحات **لا يغيّر التصنيف** — فهي ديناميكية أصلاً بحكم `cookies()`؛ الـexport يمنع تخبئة أخرى لا أكثر.

| المسار | build | dynamic export | الوصول | الحارس (بالدليل) | loading | error | not-found |
|---|:--:|---|---|---|---|---|---|
| `/` | ƒ | — | مسجَّل | `redirect("/login")` + `getUser()` | local | **local** | **local** |
| `/activity` | ƒ | — | مسجَّل | redirect-login + getUser | local | inherit ← `/` | inherit ← `/` |
| `/calendar` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/library` | ƒ | — | مسجَّل | redirect-login + getUser | local | inherit ← `/` | inherit ← `/` |
| `/lists` | ƒ | — | مسجَّل | redirect-login + getUser | local | inherit ← `/` | inherit ← `/` |
| `/lists/[id]` | ƒ | — | مختلط | getUser + `notFound()` | local | inherit ← `/` | inherit ← `/` |
| `/messages` | ƒ | force-dynamic | مسجَّل | redirect-login + getUser | local | inherit ← `/` | inherit ← `/` |
| `/profile` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/profile/edit` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/profile/settings` | ƒ | — | مسجَّل | redirect-login + getUser | local | inherit ← `/` | inherit ← `/` |
| `/profile/settings/about` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/account` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/appearance` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/billing` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/content` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/help` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/home` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/import` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/invites` | ƒ | force-dynamic | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/notifications` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/privacy` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/profile/settings/verify` | ƒ | force-dynamic | مسجَّل | redirect-login + getUser | inherit ← `/profile/settings` | inherit ← `/` | inherit ← `/` |
| `/ratings` | ƒ | — | مسجَّل | redirect-login + getUser | local | inherit ← `/` | inherit ← `/` |
| `/reports` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/statistics` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/stats` | ƒ | — | مسجَّل | redirect-login + getUser | local | inherit ← `/` | inherit ← `/` |
| `/welcome` | ƒ | — | مسجَّل | redirect-login + getUser | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/admin/links` | ƒ | — | **إداري** | `notFound()` + `am_admin()` في القاعدة | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/admin/partners` | ƒ | — | **إداري** | `notFound()` + `am_admin()` | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/admin/verify` | ƒ | — | **إداري** | `notFound()` + `am_admin()` | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/news` | ƒ | — | مختلط | getUser (بلا redirect) | local | inherit ← `/` | inherit ← `/` |
| `/people` | ƒ | — | مختلط | getUser | local | inherit ← `/` | inherit ← `/` |
| `/post/[key]` | ƒ | force-dynamic | مختلط | getUser + notFound | local | inherit ← `/` | inherit ← `/` |
| `/review/[type]/[id]/[user]` | ƒ | force-dynamic | مختلط | getUser + notFound | inherit ← `/review/[type]/[id]` | inherit ← `/` | inherit ← `/` |
| `/talk/[type]/[id]` | ƒ | force-dynamic | مختلط | getUser + notFound | local | inherit ← `/` | inherit ← `/` |
| `/u/[username]` | ƒ | — | مختلط | getUser + طبقة البيانات | local | inherit ← `/` | inherit ← `/` |
| `/login` | ƒ | — | عام | getUser (لإعادة توجيه المسجَّل) | local | inherit ← `/` | inherit ← `/` |
| `/discover/[section]` | ƒ | force-dynamic | عام | `notFound()` لقسم غير معروف | local | inherit ← `/` | inherit ← `/` |
| `/movie/[id]` | ƒ | — | عام | notFound | local | inherit ← `/` | inherit ← `/` |
| `/show/[id]` | ƒ | — | عام | notFound | local | inherit ← `/` | inherit ← `/` |
| `/person/[id]` | ƒ | — | عام | notFound | local | inherit ← `/` | inherit ← `/` |
| `/search` | ƒ | — | **عام (مثبَّت)** | لا حارس — يسلّم لـ`SearchScreen` والحماية في `/api/search` | local | inherit ← `/` | inherit ← `/` |
| `/trailers` | ƒ | — | **عام (مثبَّت)** | لا حارس — تفضيلات من الكوكيز فقط | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/u/[username]/stats` | ƒ | — | **عام محروس بالقاعدة** | لا حارس في الصفحة؛ `getProfileByUsername` + RLS (`can_view_profile`) | inherit ← `/u/[username]` | inherit ← `/` | inherit ← `/` |
| `/plus` | ƒ | — | **عام (مثبَّت)** | صفحة تسويق — `generateMetadata` ونصوص فقط | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/features` | ƒ | — | **عام (مثبَّت)** | صفحة تسويق | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/terms` | ƒ | — | **عام (مثبَّت)** | صفحة قانونية | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/privacy` | ƒ | — | **عام (مثبَّت)** | صفحة قانونية + getUser للترويسة | inherit ← `/` | inherit ← `/` | inherit ← `/` |
| `/diary` | ƒ | — | **إعادة توجيه فقط** | جسم الصفحة كلّه `redirect("/activity")` — ثلاثة أسطر | local | inherit ← `/` | inherit ← `/` |

**`عام؟` اختفت.** كل صفحة صارت مصنَّفة بدليل من جسمها.

**اكتشاف يستحق التسجيل:** `/diary` **ليست صفحة** — ملفها كامله `redirect("/activity")`. تبقى في البناء كمسار، ولها `loading.tsx` محلّي **لن يُرى أبداً**. مرشّح تنظيف في Phase 7 (`src/app/diary/page.tsx` و`src/app/diary/loading.tsx`).

**ملاحظة على `error` و`not-found`:** الجذر وحده يملك `error.tsx` و`not-found.tsx` و`global-error.tsx` — **لا صفحة واحدة تملك حدود خطأ محلّية**. عملياً: أي فشل رسم في أي صفحة يهبط إلى حدّ الخطأ الجذري، فيسقط الإطار كله لا الجزء المعطوب. هذه ملاحظة معمارية لـPhase 2 (سلوك الخطأ) لا حكم الآن.

---

## 4. جرد API الكامل — الواحد والعشرون ملفاً مقروءة كاملة

**لا `UNKNOWN` في هذا الجدول.** كل سطر من قراءة جسم الملف.

| # | المسار الكامل للملف | المسار | Method | الوظيفة | المدخلات | التحقق | المصادقة/الدور | حدّ المعدّل | خدمة | متغيّرات |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `src/app/api/build/route.ts` | `/api/build` | GET | يُعيد SHA النسخة المنشورة نصّاً؛ يقارنه `SwRegister` عند كل عودة للواجهة فيعيد التحميل عند اختلاف البصمة | — | — | **عام** | — | — | `VERCEL_GIT_COMMIT_SHA` |
| 2 | `src/app/api/curated/route.ts` | `/api/curated` | GET | يبني قائمة منسّقة واحدة، أو يُعيد حالة كل القوائم عند `list=1` | `?list=1` · `?slug=` | `slug` يُقصّ ويُصغَّر؛ فارغ ← **400** | **جلسة مطلوبة** — بلا مستخدم **401** | `curated:<uid>` · 20/60s ← **429 + Retry-After** | TMDB | `TMDB_API_KEY` |
| 3 | `src/app/api/franchise/route.ts` | `/api/franchise` | GET | أجزاء سلسلة/كون/جائزة لورقة المعاينة | `?id=` `?exclude=` `?slug=` | `Number()` للمعرّفات؛ `slug` يُقصّ ويُصغَّر؛ كون مجهول ← `{parts:[]}` | **جلسة مطلوبة** — **401** | `franchise:<uid>` · 30/60s | TMDB | `TMDB_API_KEY` |
| 4 | `src/app/api/genres/route.ts` | `/api/genres` | GET | دورة تعبئة: يجلب الأعمال الناقصة تصنيفاتها ويكتبها عبر RPC | `?n=` (افتراضي 50) | **مقيَّد `1..100`** بـ`Math.max/min` | **جلسة + إداري فعلياً** — `admin_titles_missing_genres` تردّ خطأً لغير الإداري ← **403** | `genres:<uid>` · 40/60s | TMDB + Supabase RPC | `TMDB_API_KEY` |
| 5 | `src/app/api/imdb-chart/route.ts` | `/api/imdb-chart` | GET | بناء قائمة IMDb على شرائح، أو `step=build` لتجميعها | `?step=build` · `?part=` | `part` ← `Math.max(0, …\|0)`؛ يتجاوز العدد ← `{done:true}` | **جلسة مطلوبة** — **401** | `imdbchart:<uid>` · **3/60s** (الأضيق) | TMDB + OMDb + RPC | `TMDB_API_KEY`, `OMDB_API_KEY` |
| 6 | `src/app/api/lang-ping/route.ts` | `/api/lang-ping` | **POST** | يسجّل لغة المتصفّح إحصائياً عبر `bump_visit_lang` | لا جسم — يقرأ `accept-language` | أول قيمة فقط؛ فارغ ← **204** | **عام** | `lang:<ip>` · **10/10min** — بالـIP لا بالمستخدم | Supabase RPC | — |
| 7 | `src/app/api/list-og/[id]/route.tsx` | `/api/list-og/[id]` | GET | صورة OG لقائمة عامة (`ImageResponse`, `runtime="nodejs"`) | `[id]` من المسار | `getPublicList(id)` فارغ ← **404** | **عام — والحارس RLS**: القوائم العامة فقط | — | خطوط محلّية | — |
| 8 | `src/app/api/news-gen/route.ts` | `/api/news-gen` | GET | دورة توليد الأخبار + التقارير، أو `probe=1` لفحص حياة الفيدات | `?limit=` (26) · `?probe=1` | **مقيَّد `1..60`** | **جلسة مطلوبة** — **401** | `newsgen:<uid>` · 6/60s | Gemini + مصادر RSS | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| 9 | `src/app/api/search/route.ts` | `/api/search` | GET | بحث موحّد: أعمال · فنّانون · أعضاء · قوائم | `?q=` · `?type=` | **`q` أقصر من حرفين ← نتيجة فارغة**؛ `type` يُقصر على أربع قيم وإلا `all` | **عام عمداً** (كتالوج وملفّات عامة) | `search:<uid \|\| ip>` · 40/60s — **بالـIP للزائر** | TMDB + Supabase | `TMDB_API_KEY` |
| 10 | `src/app/api/season/route.ts` | `/api/season` | GET | حلقات موسم، وتقييمات IMDb عند الطلب فقط | `?tv=` · `?s=` · `?r=1` | **`Number.isInteger` + `tv>0` + `s≥0`، وإلا 400**؛ `r` اختياري لتوفير حصة OMDb | **جلسة مطلوبة** — **401** | `season:<uid>` · 60/60s | TMDB + OMDb | `TMDB_API_KEY`, `OMDB_API_KEY` |
| 11 | `src/app/api/share/route.tsx` | `/api/share` | GET | بطاقة مشاركة للإحصائيات/التقرير (`ImageResponse`, `runtime="nodejs"`) | معاملات الفترة والنوع | يُطبَّع عبر `asStatsPeriod` و`asTimeZone` | **جلسة مطلوبة** — بلا مستخدم **401**؛ يرسم بيانات صاحب الجلسة وحده | — | — | — |
| 12 | `src/app/api/suggest/route.ts` | `/api/suggest` | GET | اقتراحات فورية أثناء الكتابة (أعمال + أشخاص) | `?q=` | **أقصر من حرفين ← فارغ** | **جلسة مطلوبة** — **401** | `suggest:<uid>` · 40/60s | TMDB | `TMDB_API_KEY` |
| 13 | `src/app/api/title-meta/route.ts` | `/api/title-meta` | GET | دورة تعبئة بيانات الأعمال (سنة، بلد، طاقم) بالإنجليزية عمداً | `?n=` (25) | **مقيَّد `1..50`** | **جلسة + إداري فعلياً** — `admin_titles_missing_meta` ← **403** | `titlemeta:<uid>` · 40/60s | TMDB + RPC | `TMDB_API_KEY` |
| 14 | `src/app/api/trakt/start/route.ts` | `/api/trakt/start` | GET | يبدأ OAuth مع Trakt | — | `traktConfigured()` وإلا تحويل لـ`?trakt=off` | **جلسة مطلوبة** — وإلا تحويل لـ`/login` | — | Trakt | `TRAKT_CLIENT_ID` |
| 15 | `src/app/api/trakt/callback/route.ts` | `/api/trakt/callback` | GET · `maxDuration=300` | يبادل الرمز ويستورد المكتبة | `?code=` · `?state=` | **مقارنة `state` بكوكي `trakt_state` (httpOnly · secure · sameSite=lax · 600s) — عدم التطابق ← `?trakt=denied`**؛ سقوف `IMPORT_CAPS` | **جلسة مطلوبة** — وإلا `/login` | — | Trakt + Supabase | `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET` |
| 16 | `src/app/auth/callback/route.ts` | `/auth/callback` | GET | `exchangeCodeForSession` ثم امتصاص تفضيلات الزائر ومطالبة الإحالة | `?code=` · `?next=` | **`safeNext()` تردّ `/` لأي قيمة لا تبدأ بـ`/` أو تبدأ بـ`//` أو تحوي `\` أو تطابق `^/[a-z]+:` — حارس open-redirect صريح**؛ والوجهة `resolveAuthBase(origin)` بقائمة `TRUSTED_ORIGINS` مغلقة | تبادل الرمز؛ الفشل ← `/login?error=auth` | — | Supabase Auth | Supabase |
| 17 | `src/app/auth/signout/route.ts` | `/auth/signout` | **POST** | خروج | — | **مقارنة ترويسة `origin` بأصل الطلب — الاختلاف يعيد التحويل بلا تنفيذ (حارس CSRF)** | جلسة | — | Supabase Auth | Supabase |
| 18 | `src/app/i/[size]/[file]/route.ts` | `/i/[size]/[file]` | GET | ممرّ صور TMDB المخزَّن (D-841) | `[size]` · `[file]` | **قائمة بيضاء للمقاسات (8 قيم) + `^[A-Za-z0-9]+\.(jpg\|png)$` — وإلا 400**؛ الفشل ← 502، و404 تُمرَّر | **عام** | — | image.tmdb.org | — |
| 19 | `src/app/join/[code]/route.ts` | `/join/[code]` | GET | دعوة: يضع كوكي الإحالة ثم يحوّل للجذر | `[code]` | **`toUpperCase` + `[^A-Z0-9]` يُحذف + `slice(0,10)`** | **عام** | — | — | — |
| 20 | `src/app/p/[code]/route.ts` | `/p/[code]` | GET | رابط شريك: كوكي الإحالة + `bump_partner_click` | `[code]` | نفس التطبيع؛ فشل الـRPC مبتلَع صامتاً | **عام** | — | Supabase RPC | — |
| 21 | `src/app/robots.txt/route.ts` | `/robots.txt` | GET | robots حسب المضيف | ترويسة `host` | `loopztv.com`/`www` ← فهرسة مسموحة مع `Disallow: /api/` و`/auth/`؛ **أي مضيف آخر ← `Disallow: /`** | **عام** | — | — | `SITE_URL` |

### ما يستحق نظرك من هذا الجرد

1. **نمط الحماية متّسق ومطبَّق فعلاً:** ثلاثة عشر مساراً من أصل واحد وعشرين تفرض جلسة، **وأحد عشر منها محدود المعدّل** عبر `src/lib/ratelimit.ts` بمفتاح لكل مستخدم — وللزائر بالـIP في `/api/search` و`/api/lang-ping`. هذا ليس تطبيقاً بلا حراسة.
2. **`/api/genres` و`/api/title-meta` و`/api/imdb-chart` مسارات مشغّل لا مستخدم**: تفرض جلسة عادية، **والحارس الحقيقي أن الـRPC الإدارية ترفض غير الإداري** فتُعيد 403. النمط سليم (الحارس في القاعدة) لكنه **يستحق تأكيداً في Phase 5**: عضو عادي يستطيع استدعاءها وسيأخذ 403 — أي أنها ليست ثغرة بل ضجيج.
3. **`/api/trakt/callback` بـ`maxDuration=300` هو أطول سطح تنفيذ في التطبيق**، ويستقبل رمزاً من طرف ثالث — **لكنه يحمي نفسه بـ`state` في كوكي httpOnly**. أولوية فحص في Phase 5 لا مشكلة الآن.
4. **`safeNext` و`origin check` و`state cookie` ثلاثة حرّاس مكتوبة بيد** — تُختبر في Phase 5 لا تُفترض.
5. **`/robots.txt` يفسّر مانعاً سجّلته في Phase 0**: `Disallow: /api/` هو سبب حجب أداة الجلب لديّ عن `loopztv.com/api/build`. **المانع مفهوم الآن وليس عطلاً.**

---

## 5. المسارات السبعة بلا `page.tsx`

`/auth/callback` · `/auth/signout` · `/i/[size]/[file]` · `/join/[code]` · `/p/[code]` · `/robots.txt` · `/_not-found` (من `src/app/not-found.tsx`). تفاصيلها في §4.

---

## 6. خريطة الميزات — الربط الكامل

كل صف: Route → المكوّنات → Server Actions/data → Tables/Views → RPC → Storage/خدمة.

| الميزة | Route | المكوّنات الرئيسية | Server Actions | Tables/Views | RPC | Storage/خدمة |
|---|---|---|---|---|---|---|
| **Onboarding والجولات** | `/welcome` · `/profile/settings/help` | `TourGuide.tsx` `TourMount.tsx` `settings/HelpTourRows.tsx` | `updateUiState` `applyOnboardingProgress` | `profiles.ui_state` (jsonb) | — | `src/lib/tour.ts` — `TOUR_VERSION=2`, `TOURS`, `TOUR_META` |
| **الثيمات** | `/profile/settings/appearance` | `ThemeCookieSync.tsx` `settings/ThemeSection.tsx` | `syncThemeCookie` | `profiles.theme` `theme_accent` | — | `src/lib/themes.ts` — 7 ثيمات: `loopz` `amber` `ocean` `violet` `crimson` `forest` `daylight` |
| **الخطوط** | `/profile/settings/appearance` | `FontPrefsSync.tsx` `settings/FontSizeSection.tsx` | `setFontPrefs` | `profiles.font_ui` `font_content` | — | `@fontsource` + `public/fonts` |
| **اللغة** | كل الصفحات · `/profile/settings/appearance` | `LangMenu.tsx` `LangPing.tsx` `settings/LanguageRow.tsx` | `setLocale` | `profiles.locale` · `visit_langs` | `bump_visit_lang` | `src/lib/i18n.ts` (3791 سطراً) · `Locale = "ar" \| "en"` · flagcdn |
| **الإشعارات/الإشارات** | `/activity` · `/profile/settings/notifications` | `NotificationList.tsx` `SignalsLink.tsx` `MarkSignalsSeen.tsx` | `mySignals` `markSignalsSeen` `markFeedSeen` | `profiles.notif_seen_at` `feed_seen_at` | `my_signals` `unread_signals` `mark_signals_seen` `mark_feed_seen` `my_feed_seen` `new_feed_count` | **لا قناة دفع ولا مرسِل بريد ولا عمود تفضيلات** — الصفحة موجودة والتخزين لا (يطابق D-462) |
| **الرسائل والمشاركات** | `/messages` | `MessagesLink.tsx` `SendShareSheet.tsx` `ShareListSheet.tsx` `ShareTitleButton.tsx` `ShareCard.tsx` | `sendShare` `sendListShare` `replyToShare` `markSharesRead` `hideShare` `markConversationRead` `hideConversation` `postCommunityMessage` | `title_shares` `share_replies` `list_shares` `community_messages` | `unread_shares` `mark_conversation_read` | Supabase Realtime (`supabase/realtime_messages.sql`) |
| **المجتمع والنقاش** | `/talk/[type]/[id]` · `/post/[key]` · `/news` | `Communities.tsx` `CommunityPager.tsx` `CommunityTools.tsx` `TitleCommunityFeed.tsx` `TitleCommunityTab.tsx` `WorksTalk.tsx` + `src/components/thread/` | `joinCommunity` `leaveCommunity` `acceptCommunityRequest` `rejectCommunityRequest` `cancelCommunityRequest` `inviteToCommunity` `acceptCommunityInvite` `rejectCommunityInvite` `cancelCommunityInvite` `deleteCommunity` `setCommunityPhoto` `openTitleRoom` `toggleRoomPin` `setGlobalRoomPin` `setTalkFollowedOnly` `addTalkPost` `deleteMyTalkPost` `reportTalkPost` `myCommunitiesList` (23 إجمالاً) | `communities` `community_members` `community_join_requests` `community_invites` `community_messages` `title_posts` `title_post_likes` `title_post_votes` `title_room_pins` `title_room_global_pins` `news_posts` `news_post_replies` + جداول البلاغات | `my_communities` `join_community` `accept_join_request` `title_thread` `title_rooms` `title_talk_rooms` `title_room_of` `title_community` `title_circle` `title_pulse` `title_replies` `global_room_pins` `set_global_room_pin` `news_post_thread` `news_reply_counts` `loopz_news` `set_news_posts` | Cron يومي `loopz-title-communities` عند `17 3 * * *` |
| **الترايلرات** | `/trailers` | `Trailer.tsx` `TrailerFeed.tsx` `TrailerRail.tsx` `TrailerTabs.tsx` `TrailerBackButton.tsx` `trailers/TrailerCardMedia.tsx` `trailers/TrailerPlaybackController.tsx` | `moreTrailerClips` | — (كوكي `loopz_trailer_sound`) | — | TMDB + **YouTube** (`youtube-nocookie` + `s.ytimg.com`) + **iTunes** (`src/lib/appleTrailers.ts:31`) · `src/lib/trailers.ts` `trailerPrefs.ts` `trailerTabs.ts` `trailerProviders.ts` |
| **Plus والإحالات** | `/plus` · `/profile/settings/invites` · `/profile/settings/billing` | `PlusGateHost.tsx` `ui/PlusPill.tsx` `stats/PlusPreview.tsx` `settings/InviteLinkCard.tsx` | `viewerIsPlus` `claimReferralFromCookie` | `profiles.plan` `plus_until` `founder` · `subscriptions` `plus_rewards` `referral_codes` `referrals` `referral_events` | `my_referral_code` `my_invite_stats` `my_invite_list` `claim_referral` `qualify_referral` `grant_plus_days` `sync_plan_from_subscription` | كوكي `loopz_ref` من `/join/[code]` و`/p/[code]` · `src/lib/plan.ts` `plusGate.ts` |
| **Partner** | `/admin/partners` · `/p/[code]` | — (صفحة إدارية عربية صرفة بلا مكوّن مخصّص) | `applyPartner` `cancelPartnerApplication` `adminDecidePartner` | `partners` `partner_applications` `partner_clicks` | `apply_partner` `cancel_partner_application` `my_partner_state` `admin_partner_applications` `admin_decide_partner` `bump_partner_click` | — |
| **التوثيق** | `/profile/settings/verify` · `/admin/verify` | `settings/VerifyScreen.tsx` | `getVerificationScreen` `requestVerification` `adminVerificationQueue` `adminDecideVerification` | `verification_requests` · `profiles.verified_at` `verified_kind` `x_verified_at` | `request_verification` `my_verification_state` `verification_eligibility` `admin_verification_queue` `admin_decide_verification` `sync_x_identity` `reverify_on_handle_change` `linked_providers` | `src/lib/xLink.ts` |
| **الإعدادات (الإطار)** | `/profile/settings/*` (14 صفحة) | `AccountSettings.tsx` `settings/SettingsBottomSheet.tsx` `SettingsArrangeSheet.tsx` `SettingsExpandRow.tsx` `SettingsHeader.tsx` … | 4 أفعال ملف/حساب/خصوصية | `profiles.*` `profile_prefs` `home_prefs` `content_prefs` | `delete_my_account` `touch_last_seen` | bucket `avatars` |
| **التتبّع والمكتبة** | `/library` `/calendar` `/ratings` `/stats` | `EpisodeTracker.tsx` `LibraryAnalysis.tsx` … | 13 فعلاً (`watch/episode/season`) | `watched_episodes` `watched_movies` `movie_progress` `ratings` `episode_ratings` `follows` | `user_watch_stats` `user_watch_overview` `watch_summary` `set_episode_rating` `episode_ratings_of` `toggle_favorite` | — |
| **القوائم** | `/lists` `/lists/[id]` | `ListCoverSheet.tsx` … | 28 فعلاً | `user_lists` `user_list_items` `list_saves` `list_shares` `featured_lists` `curated_lists` | `my_lists` `public_list` `reorder_list` `for_you_lists` `list_card_stats` `top_saved_lists` `upsert_curated_list` | `/api/list-og/[id]` |
| **المراجعات** | `/review/[type]/[id]/[user]` | `src/components/thread/` | 16 فعلاً | `list_reviews` `review_likes` `review_replies` `list_review_*` | `title_reviews` `list_reviews_of` `review_reply_counts` `title_review_likes` | `opengraph-image.tsx` مخصّص |
| **الاجتماعي** | `/people` `/u/[username]` `/activity` | `MemberAnalysis.tsx` `stats/TasteMatchDoor.tsx` … | 15 فعلاً | `follows` `user_follows` `person_follows` `follow_requests` `blocks` `profile_views` | `follow_stats` `following_activity_v2` `request_or_follow` `remove_follower` `block_user` `my_blocks` `people_to_follow` `people_leaderboard` `record_profile_view` | View `public_profiles` |
| **الاستيراد/التصدير** | `/profile/settings/import` | — | 4 أفعال | `follows` `watched_episodes` `watched_movies` | — | Trakt · `src/lib/letterboxd.ts` `tvtime.ts` `importParse.ts` `trackerExport.ts` |

---

## 7. الأرقام على `f8a2b33c`

| المقياس | القيمة |
|---|---:|
| ملفات متتبَّعة | 668 |
| ملفات `src/` | 453 |
| ملفات `supabase/*.sql` | 173 |
| **مكوّنات `src/components/**/*.tsx`** | **229** |
| منها `"use client"` | **166** |
| منها مكوّنات خادم | **63** |
| ملفات `"use client"` في `src` كلها | 180 |
| وحدات `src/lib` (`.ts`) | 113 · و`.tsx`: 2 (`og.tsx`, `shareCard.tsx`) |
| Server Actions مُصدَّرة | 162 (`src/lib/actions.ts` — 6051 سطراً) |
| `src/lib/data.ts` | 6394 سطراً |
| أسماء عبر `.from()` | 52 (50 جدولاً + View `public_profiles` + bucket `avatars`) |
| أسماء RPC في الكود | 130 |
| دوال في `public` بالقاعدة | 176 |
| **استدعاءات RPC مكسورة** | **0** |
| `revalidatePath` | 194 استدعاءً في 6 ملفات |
| `: any` / `as any` | **0** |
| `TODO` / `FIXME` | **0** |
| `console.log` | 2 |
| `eslint-disable` | 24 |

---

## 8. عوائق React Native / Expo — مقاسة على `f8a2b33c`

| العائق | ملفات | إشارات | الحكم |
|---|---:|---:|---|
| `next/navigation` | 110 | 110 | 🔴 إعادة بناء → Expo Router |
| `next/link` | 84 | 84 | 🔴 |
| `next/image` | 50 | 56 | 🔴 → `expo-image` |
| `window.` | 48 | 185 | 🟡 |
| `document.` | 29 | 74 | 🔴 |
| `cookies()` | 15 | 66 | 🔴 → `expo-secure-store` |
| `localStorage` | 11 | 37 | 🔴 → `AsyncStorage` |
| `sessionStorage` | 4 | 15 | 🔴 |
| `IntersectionObserver` | 4 | 11 | 🔴 |
| `matchMedia` | 3 | 5 | 🔴 |
| `serviceWorker` | 1 | 5 | 🟢 يُسقط |
| **`revalidatePath`** | **6** | **194** | 🔴🔴 لا مفهوم مقابل |

**والعائق الأكبر ليس في هذا الجدول:** كل المفاتيح خادمية (TMDB · OMDb · Trakt · Gemini · DeepL · Giphy)، والوصول إليها **حصراً** عبر Server Components وServer Actions — **وExpo لا يملك أيّاً منهما.** أي أن 12,445 سطراً في `data.ts` + `actions.ts` تحتاج **طبقة API عامة ومؤمّنة لا وجود لها بعد**. الواحد والعشرون مساراً القائمة تخدم الويب لا تطبيقاً.

---

## 9. تصحيحات لأخطاء منّي

| # | الخطأ | الصواب |
|---|---|---|
| 1 | Phase 0 قال **81 مساراً** | **76** — عددتُ أسطر جدول البناء فدخل سطرا الأسطورة. مؤكَّد على الـSHA الجديد. |
| 2 | التسليم السابق قال **«182 مكوّناً منها 180 `use client`»** | **229 ملف `.tsx` في `src/components`، منها 166 عميل و63 خادم.** الرقم 182 كان `ls src/components/*.tsx` (المستوى الأعلى فقط، بلا المجلدات الخمسة الفرعية)، و180 كان عدّ `use client` في `src` كلها لا في المكوّنات وحدها. **خلطُ مقياسين.** |
| 3 | التسليم السابق ترك مصادقة عدة مسارات `UNKNOWN` بحجّة أنها مادة Phase 5 | **اعتراضك صحيح** — كان جرداً مطلوباً في Phase 1 لا مانعاً خارجياً. قُرئت الأجسام كاملة و§4 بلا `UNKNOWN`. |

---

## 10. مرشّحات الموت — إثبات فقط، بلا حذف

**مكوّنات بصفر مرجع (5)** — على `f8a2b33c`، مع فحص الاستدعاء الديناميكي بالاسم:
`src/components/HeaderTools.tsx` · `src/components/LanguageSwitch.tsx` · `src/components/RailWindow.tsx` · `src/components/settings/SettingsDoneAction.tsx` · `src/components/settings/SettingsSoon.tsx`.

**صفحة إعادة توجيه بلا محتوى:** `src/app/diary/page.tsx` (ثلاثة أسطر) و`src/app/diary/loading.tsx` (لن يُرى).

**دوال قاعدة بيانات غير مستدعاة من `src` (46 من 176)** مصنّفة: triggers وحرّاس سياسات (طبيعي) · `ops_*` عشر دوال لوحة مشغّل **بلا لوحة إدارة في المشروع** · و**13 مرشّحاً حقيقياً**: `create_community` `search_communities` `community_activity` `award_weekly_top` `most_watched_period` `top_rated_period` `my_referral_count` `my_referral_list` `featured_list_ids` `grant_plus_days` `set_news_items` `prune_news_posts` `sync_plan_from_subscription`.

**جداول بلا `.from()` (21)** — وأكثرها يُقرأ عبر RPC فليست ميتة؛ **الاستثناء الوحيد `watched_episodes_backup_133`** (`LOOPZ-AUD-0005`).

**لم أحذف شيئاً، ولن أحذف قبل بروتوكول الحذف كاملاً وقرارك.**

---

## 11. Delta Queue

الفروق بين الـAudited SHA ورأس `main` — تُسجَّل ولا تُعيد تشغيل المراحل، وتُفحص في Final Delta Audit.

| الحالة | القيمة |
|---|---|
| Audited SHA | `f8a2b33cd036cffd1e7a0b9bc3e5ced0e19b8bfa` |
| رأس `main` وقت هذا التسليم | `f8a2b33cd036cffd1e7a0b9bc3e5ced0e19b8bfa` — **متطابقان** |
| Commits في الطابور | **لا شيء بعد** |

للسجل: الستة commits من `64bd1d41` إلى `f8a2b33c` (D-852/D-853) مسّت 6 ملفات، +50/−7، نصوص تلميحات وتنسيق فقط — صفر مسار وصفر ميزة وصفر جدول أو RPC. وقد صارت **داخل** الـbaseline المعتمد.

---

## 12. الفرعان المؤجَّلان — وفق قرارك

| الفرع | الحالة | الحكم | الدليل |
|---|---|---|---|
| `mccicc2-art-patch-1` | **DEFERRED — لا دمج ولا حذف** | محتوى مفقود فعلاً | `src/lib/trailerPrefs.ts`: في `main` الافتراض صامت، وفي الفرع الصوت شغّال. رسالة الـcommit تصفه بنقض صريح من أحمد لـD-726. **سيُسجَّل كتجربة وظيفية صريحة في Phase 2 وفي Final Delta Audit كما أمرت. لم أطبّق شيئاً منه.** |
| `fix/ios-perf-probe-standalone-gate` | **SUPERSEDED — لا حذف** | متجاوَز | `src/components/PerfProbe.tsx` محذوف من `main`، و0 مرجع للاسم. |

---

## 13. الموانع

| # | المانع | الحالة |
|---|---|---|
| 1 | حسابات الاختبار | قائم — Phase 2 تبدأ بالزائر والقراءة الآمنة، والرحلات المحتاجة حسابات تُوسم `BLOCKED_BY_TEST_ENV` كما أمرت |
| 2 | `LOOPZ-AUD-0006` لا بيئة معزولة | قائم — **ولم أنشئ أي مورد**، والتصوّر يبقى تصوّراً |
| 3 | Vercel 403 | مؤجَّل إلى Phase 8 |
| 4 | `loopztv.com/api/*` محجوب عن أداة الجلب لديّ | **مفهوم الآن**: `src/app/robots.txt/route.ts` يضع `Disallow: /api/` — ليس عطلاً. الفحص الحيّ في Phase 2 يمرّ بالمتصفّح |

لا حالة `BLOCKED`.

---

## 14. إقرار

- ✅ لم أعدّل أي ملف في `src/` أو `supabase/` أو أي إعداد تطبيق.
- ✅ لم ألمس `main` ولم أفتح PR نحوه ولم أدمج ولم أحذف أي فرع.
- ✅ لم أحذف ملفاً ولا دالة ولا صفحة.
- ✅ لم أنشئ مشروع Supabase ولا حساباً ولا صفّاً ولا أي مورد.
- ✅ كل استعلامات Supabase **metadata فقط** (`information_schema` · `pg_proc` · `cron.job`) — صفر قراءة لبيانات مستخدمين.
- ✅ لا Deploy ولا Migration.
- ✅ لا أسرار ولا Tokens ولا بيانات مستخدمين في هذا الملف. قيم البيئة في البناء كانت **نائبة** (`placeholder-not-a-real-key`).

**متوقّف عند البوابة. لن أبدأ Phase 2 قبل `VERIFIED`.**
