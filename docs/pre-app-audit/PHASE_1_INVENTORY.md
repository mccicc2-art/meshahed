# Phase 1 — Full Inventory

- الحالة: `READY_FOR_REVIEW`
- المنفّذ: Claude · المراجع: ChatGPT
- التاريخ: 2026-09-01 UTC
- **SHA المُجرَد:** `64bd1d41851c0cc05f93a8444eaadd41d47f9108` — نقطة الرجوع التي اعتمدها ChatGPT في Phase 0.
- **النطاق:** قراءة وجرد فقط. **صفر تعديل على كود التطبيق · صفر حذف · صفر كتابة في قاعدة البيانات · صفر Deploy.**
- **الفرع:** `docs/pre-app-audit` — لم يُنشأ فرع `audit/phase-01-*` لأن هذه المرحلة توثيقٌ بلا إصلاح، و`README.md` يخصّ `audit/phase-XX-*` بمجموعات **الإصلاحات**؛ ووضع الملف هنا هو ما يجعله يظهر في diff الـPR رقم 19 كما طلبت. اعترِض إن أردت غير ذلك.

> **قاعدة الإثبات في هذا الملف:** كل رقم مصحوب بأمره أو ملفه. وحيث تعذّر الإثبات كُتب `UNKNOWN` مع السبب — لا تخمين.

---

## 0. تصحيح لخطأ في Phase 0 — قبل أي شيء آخر

**Phase 0 قال «81 مساراً». الصحيح 76.** الخطأ منّي: عددتُ الأسطر التي تبدأ بـ`├`/`└` في سجلّ البناء، فدخل في العدّ سطرا الأسطورة (`○ (Static)` و`ƒ (Dynamic)`) وسطور أخرى ليست مسارات.

| المصدر | العدد |
|---|---:|
| مسارات فريدة في جدول البناء | **76** |
| منها `ƒ` ديناميكي | 73 |
| منها `○` ثابت | 3 (`/manifest.webmanifest` · `/opengraph-image` · `/sitemap.xml`) |

الأمر: `grep -E '^[├└]' build.log | grep -oE '(ƒ|○) /[^ ]*' | sed 's/^[ƒ○] //' | sort -u | wc -l` → `76`.

كل ما عدا هذا الرقم في Phase 0 صحيح كما هو. **الرجاء تصحيحه عند الاعتماد.**

---

## 1. جرد المسارات — App Router

### 1.1 مطابقة العدّ (البند 12 من معيارك)

| المصدر في الشجرة | العدد | الأمر |
|---|---:|---|
| `page.tsx` | 49 | `find src/app -name page.tsx \| wc -l` |
| `route.ts` + `route.tsx` | 21 | `find src/app -name 'route.*' \| wc -l` |
| `opengraph-image.tsx` | 3 | `find src/app -name 'opengraph-image*' \| wc -l` |
| `sitemap.ts` | 1 | |
| `manifest.ts` | 1 | |
| `not-found.tsx` (→ `/_not-found`) | 1 | |
| **المجموع المتوقَّع** | **76** | |
| **المُعلَن في جدول البناء** | **76** | |
| **الفرق** | **0** | |

**المطابقة تامّة — لا مسار في البناء بلا مصدر، ولا مصدر بلا مسار.**

ملاحظة على العدّ: `route.ts` عددها 19 و`route.tsx` عددها 2 (`/api/share` و`/api/list-og/[id]`) — ولهذا لم تظهرا في جرد Phase 0 الذي بحث عن `route.ts` وحدها.

### 1.2 الصفحات (49) — التصنيف والحارس

الحارس مستخرج بالبحث عن `redirect("/login")` و`auth.getUser()` و`notFound()` داخل كل `page.tsx`.

| المسار | الوصول | الحارس في الصفحة | `dynamic` | `loading.tsx` |
|---|---|---|---|---|
| `/` | مسجَّل | redirect-login + getUser | — | ✅ |
| `/activity` | مسجَّل | redirect-login + getUser | — | ✅ |
| `/calendar` | مسجَّل | redirect-login + getUser | — | — |
| `/library` | مسجَّل | redirect-login + getUser | — | ✅ |
| `/lists` | مسجَّل | redirect-login + getUser | — | ✅ |
| `/messages` | مسجَّل | redirect-login + getUser | force-dynamic | ✅ |
| `/profile` | مسجَّل | redirect-login + getUser | — | — |
| `/profile/edit` | مسجَّل | redirect-login + getUser | — | — |
| `/profile/settings` | مسجَّل | redirect-login + getUser | — | ✅ |
| `/profile/settings/about` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/account` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/appearance` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/billing` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/content` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/help` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/home` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/import` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/invites` | مسجَّل | redirect-login + getUser | force-dynamic | ↑ |
| `/profile/settings/notifications` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/privacy` | مسجَّل | redirect-login + getUser | — | ↑ |
| `/profile/settings/verify` | مسجَّل | redirect-login + getUser | force-dynamic | ↑ |
| `/ratings` | مسجَّل | redirect-login + getUser | — | ✅ |
| `/reports` | مسجَّل | redirect-login + getUser | — | — |
| `/statistics` | مسجَّل | redirect-login + getUser | — | — |
| `/stats` | مسجَّل | redirect-login + getUser | — | ✅ |
| `/welcome` | مسجَّل | redirect-login + getUser | — | — |
| `/admin/links` | **إداري** | `notFound()` + `am_admin()` | — | — |
| `/admin/partners` | **إداري** | `notFound()` + `am_admin()` | — | — |
| `/admin/verify` | **إداري** | `notFound()` + `am_admin()` | — | — |
| `/lists/[id]` | مختلط | getUser + notFound | — | ✅ |
| `/news` | مختلط | getUser | — | ✅ |
| `/people` | مختلط | getUser | — | ✅ |
| `/post/[key]` | مختلط | getUser + notFound | force-dynamic | ✅ |
| `/privacy` | عام | getUser (للترويسة) | — | — |
| `/review/[type]/[id]/[user]` | مختلط | getUser + notFound | force-dynamic | ✅ (على مستوى `[id]`) |
| `/talk/[type]/[id]` | مختلط | getUser + notFound | force-dynamic | ✅ |
| `/u/[username]` | مختلط | getUser | — | ✅ |
| `/login` | عام | getUser (لإعادة التوجيه) | — | ✅ |
| `/discover/[section]` | عام | notFound | force-dynamic | ✅ |
| `/movie/[id]` | عام | notFound | — | ✅ |
| `/show/[id]` | عام | notFound | — | ✅ |
| `/person/[id]` | عام | notFound | — | ✅ |
| `/diary` | عام؟ | **لا حارس في الصفحة** | — | ✅ |
| `/features` | عام | لا حارس | — | — |
| `/plus` | عام | لا حارس | — | — |
| `/search` | عام | **لا حارس في الصفحة** | — | ✅ |
| `/terms` | عام | لا حارس | — | — |
| `/trailers` | عام | **لا حارس في الصفحة** | — | — |
| `/u/[username]/stats` | مختلط | **لا حارس في الصفحة** | — | — |

> ⚠️ **حدّ هذا الجدول بحرفه:** العمود «الحارس» يصف **ما في ملف الصفحة نفسه**، لا الحماية الفعلية. الحماية الحقيقية طبقتان أخريان: `src/proxy.ts` (تجديد الجلسة) و**RLS في قاعدة البيانات**. الصفحات الخمس بلا حارس ظاهر (`/diary` · `/search` · `/trailers` · `/u/[username]/stats` وجزئياً `/plus`) **ليست ثغرات مثبتة** — تُفحص فعلياً في Phase 2 و5. سُجّلت هنا كنقاط اختبار لا كأحكام.

### 1.3 مسارات لا يقابلها `page.tsx` (7)

| المسار | الملف | الوظيفة |
|---|---|---|
| `/auth/callback` | `src/app/auth/callback/route.ts` | `exchangeCodeForSession` — عودة OAuth |
| `/auth/signout` | `src/app/auth/signout/route.ts` | `signOut` — **POST فقط** |
| `/i/[size]/[file]` | `src/app/i/[size]/[file]/route.ts` | الممرّ المخزَّن لصور TMDB (D-841) |
| `/join/[code]` | `src/app/join/[code]/route.ts` | دعوة مجتمع |
| `/p/[code]` | `src/app/p/[code]/route.ts` | رابط قصير / إحالة |
| `/robots.txt` | `src/app/robots.txt/route.ts` | robots (ليس `robots.ts` — ولهذا لم يظهر في بحث Phase 0) |
| `/_not-found` | `src/app/not-found.tsx` | 404 |

### 1.4 ملفات الحالة الخاصة

- `src/app/layout.tsx` — **الوحيد**؛ لا layouts فرعية إطلاقاً.
- `src/app/error.tsx` · `src/app/global-error.tsx` · `src/app/not-found.tsx` · `src/app/loading.tsx` — كلها على الجذر.
- `loading.tsx` في **21** مسار فرعي (القائمة الكاملة بالأمر: `find src/app -name loading.tsx`).
- **لا `template.tsx` ولا `default.tsx` ولا layouts متداخلة** — يعني: كل صفحة تُعيد بناء إطارها بنفسها. هذه حقيقة معمارية مهمّة لبند التنقّل في Phase 9.
- `src/proxy.ts` — بديل `middleware.ts` في Next 16، matcher: كل مسار عدا `_next/static` و`_next/image` و`favicon.ico` وملفات الصور.

---

## 2. جرد API Routes (21)

| المسار | الملف | Methods | إعدادات | المصادقة | خدمة خارجية | متغيرات البيئة |
|---|---|---|---|---|---|---|
| `/api/build` | `route.ts` | GET | `force-dynamic` | لا | — | `VERCEL_GIT_COMMIT_SHA` |
| `/api/curated` | `route.ts` | GET | `maxDuration=60` | UNKNOWN¹ | TMDB | `TMDB_API_KEY` |
| `/api/franchise` | `route.ts` | GET | — | UNKNOWN¹ | TMDB | `TMDB_API_KEY` |
| `/api/genres` | `route.ts` | GET | `maxDuration=60` | UNKNOWN¹ | TMDB | `TMDB_API_KEY` |
| `/api/imdb-chart` | `route.ts` | GET | `maxDuration=60` | UNKNOWN¹ | TMDB + OMDb | `TMDB_API_KEY`, `OMDB_API_KEY` |
| `/api/lang-ping` | `route.ts` | **POST** | — | UNKNOWN¹ | — | — |
| `/api/list-og/[id]` | `route.tsx` | GET | — | لا (OG عام) | — | — |
| `/api/news-gen` | `route.ts` | GET | `maxDuration=60` | UNKNOWN¹ | Gemini | `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `/api/search` | `route.ts` | GET | — | UNKNOWN¹ | TMDB | `TMDB_API_KEY` |
| `/api/season` | `route.ts` | GET | — | UNKNOWN¹ | TMDB | `TMDB_API_KEY` |
| `/api/share` | `route.tsx` | GET | — | لا (بطاقة صورة) | — | — |
| `/api/suggest` | `route.ts` | GET | — | UNKNOWN¹ | TMDB | `TMDB_API_KEY` |
| `/api/title-meta` | `route.ts` | GET | `maxDuration=60` | UNKNOWN¹ | TMDB | `TMDB_API_KEY` |
| `/api/trakt/start` | `route.ts` | GET | — | يتطلّب جلسة | Trakt | `TRAKT_CLIENT_ID` |
| `/api/trakt/callback` | `route.ts` | GET | **`maxDuration=300`** | يتطلّب جلسة | Trakt | `TRAKT_CLIENT_ID`, `TRAKT_CLIENT_SECRET` |
| `/auth/callback` | `route.ts` | GET | — | تبادل الرمز | Supabase Auth | Supabase |
| `/auth/signout` | `route.ts` | **POST** | — | جلسة | Supabase Auth | Supabase |
| `/i/[size]/[file]` | `route.ts` | GET | — | لا | image.tmdb.org | — |
| `/join/[code]` | `route.ts` | GET | — | يتطلّب جلسة | — | — |
| `/p/[code]` | `route.ts` | GET | — | UNKNOWN¹ | — | — |
| `/robots.txt` | `route.ts` | GET | — | لا | — | — |

¹ **`UNKNOWN` مقصود:** لم أقرأ جسم كل مسار سطراً سطراً في هذه المرحلة، والادّعاء بأن مساراً «عام» أو «محميّ» بلا قراءة كاملة هو تخمين. **هذه هي المادة الأولى لـ Phase 5** (BOLA/IDOR وrate limiting)، وسأثبتها هناك بقراءة كاملة. يوجد `src/lib/ratelimit.ts` (48 سطراً) — نطاق تطبيقه غير مثبت بعد.

> ⚠️ **نقطة تستحق نظرك الآن:** `/api/trakt/callback` بـ`maxDuration=300` (خمس دقائق) هو أطول سطح تنفيذ في التطبيق كلّه، ويستقبل رمزاً من طرف ثالث. مرشّح أولوية في Phase 5.

---

## 3. خريطة الميزات

### 3.1 طبقة المنطق

| الطبقة | الحقيقة | الأمر/الملف |
|---|---|---|
| Server Actions | **162 دالة مُصدَّرة** في `src/lib/actions.ts` (6051 سطراً) | `grep -cE '^export async function ' src/lib/actions.ts` |
| ملفات تحمل `"use server"` | **5**: `src/lib/actions.ts` + أربع صفحات (`admin/partners`, `admin/links`, `admin/verify`, `profile/settings/invites`) | |
| طبقة القراءة | `src/lib/data.ts` — 6394 سطراً | |
| الترجمة | `src/lib/i18n.ts` — 3791 سطراً · `Locale = "ar" \| "en"` | |
| وحدات `src/lib` | **113 ملف `.ts`** + ملفّا `.tsx` (`og.tsx`, `shareCard.tsx`) | |
| مكوّنات | **182 ملف `.tsx`** في `src/components`، منها **180 `"use client"`** | |

> **ملاحظة معمارية للبند 8:** 180 من 182 مكوّناً هي مكوّنات عميل. هذا **يقلّل** كلفة الانتقال إلى React Native في طبقة الحالة والتفاعل، ويُبقي الكلفة كلها في طبقة العرض (DOM/CSS). و`revalidatePath` بـ**194 استدعاءً في 6 ملفات** هو العمود الفقري للتحديث بعد الكتابة — **وهو مفهوم لا وجود له في React Native**، فيحتاج بديلاً صريحاً (مخزن استعلامات/إبطال يدوي). هذا أكبر بند معماري في التحويل.

### 3.2 الجداول الأكثر استعمالاً من الكود (عبر `.from()`)

`user_lists` 33 · `profiles` 29 · `follows` 26 · `watched_episodes` 24 · `user_follows` 17 · `watched_movies` 15 · `public_profiles` 15 (View) · `user_list_items` 14 · `list_saves` 12 · `ratings` 10 · `title_shares` 8 · `avatars` 8 (Storage bucket) · `movie_progress` 6 · `list_shares` 6 · `list_reviews` 5 …

المجموع: **52 اسماً** مستعملاً عبر `.from()`، منها **50 جدولاً** واحدٌ **View** (`public_profiles`) وواحدٌ **Storage bucket** (`avatars`).

### 3.3 الميزات ← الصفحات (خريطة مختصرة)

| الميزة | الصفحات | الجداول/RPC الرئيسية |
|---|---|---|
| التتبّع والمكتبة | `/library` `/diary` `/calendar` `/ratings` | `watched_episodes` `watched_movies` `movie_progress` `ratings` `episode_ratings` |
| القوائم | `/lists` `/lists/[id]` | `user_lists` `user_list_items` `list_saves` `list_shares` · `my_lists` `reorder_list` `public_list` `for_you_lists` |
| المراجعات | `/review/[type]/[id]/[user]` | `list_reviews` `review_likes` `review_replies` · `title_reviews` `list_reviews_of` |
| المجتمع والنقاش | `/talk/[type]/[id]` `/post/[key]` `/news` | `communities` `community_*` `title_posts` `news_posts` · `title_thread` `title_rooms` `news_post_thread` |
| الاجتماعي | `/people` `/u/[username]` `/activity` | `follows` `user_follows` `person_follows` `follow_requests` `blocks` · `follow_stats` `following_activity_v2` `request_or_follow` |
| الرسائل | `/messages` | `community_messages` `title_shares` `share_replies` · `mark_conversation_read` `unread_shares` |
| الإحصائيات | `/statistics` `/stats` `/u/[username]/stats` | `user_watch_stats` `user_watch_overview` `watch_summary` `most_watched_period` `top_rated_period` |
| الترايلرات | `/trailers` | TMDB + YouTube + iTunes · `src/lib/trailers.ts` `appleTrailers.ts` |
| الاستكشاف | `/discover/[section]` `/search` | TMDB · `src/lib/browse.ts` `sections.ts` `suggest.ts` |
| Plus والإحالات | `/plus` `/profile/settings/invites` `/profile/settings/billing` | `subscriptions` `plus_rewards` `referral_codes` `referrals` · `my_referral_code` `claim_referral` `qualify_referral` |
| الشراكة والتوثيق | `/profile/settings/verify` `/admin/partners` `/admin/verify` | `partners` `partner_applications` `verification_requests` · `apply_partner` `request_verification` `admin_decide_*` |
| الاستيراد | `/profile/settings/import` | Trakt · `src/lib/trakt.ts` `letterboxd.ts` `tvtime.ts` `importParse.ts` |
| المظهر واللغة | `/profile/settings/appearance` | `profiles.theme` `theme_accent` `font_ui` `font_content` `locale` |
| الإشراف | `/reports` `/admin/*` | `*_reports` · `am_admin` `hide_reported_*` |

---

## 4. مصفوفة الأدوار والصلاحيات

مصدرها أعمدة `public.profiles` (مخطّط فقط — **صفر بيانات مستخدم**).

| # | الدور | يتحدّد بـ | السطح المتأثّر | مطلوب لـ |
|---|---|---|---|---|
| 1 | زائر | لا جلسة | كل صفحة عامة + الروابط المباشرة | Phase 2 |
| 2 | مجاني | `plan` افتراضي · `plus_until` منتهٍ | خط الأساس كله | Phase 2 |
| 3 | Plus | `plus_until > now()` | `/plus` · الإحصائيات · الجولات · حدود القوائم | Phase 2 |
| 4 | Founder | `founder = true` | الشارات | Phase 3 |
| 5 | Verified | `verified_at` + `verified_kind` | الشارة + `/profile/settings/verify` | Phase 2/3 |
| 6 | X-Verified | `x_verified_at` | شارة منفصلة · `sync_x_identity` | Phase 3 |
| 7 | Admin | `is_admin = true` → `am_admin()` | `/admin/links` `/admin/partners` `/admin/verify` | Phase 5 |
| 8 | System | `is_system = true` | حسابات النظام والقوائم المنسّقة | Phase 6 |
| 9 | خاص | `is_private = true` (+ `hide_follow_lists`) | `can_view_profile()` · `follow_requests` | **Phase 5 — الأهم** |
| 10 | Partner | `partners` / `partner_applications` | `/admin/partners` · `bump_partner_click` | Phase 2 |
| 11 | زوج A/B | حسابان + `blocks` | IDOR/BOLA · العزل | **Phase 5 — الأهم** |

**الحارس الحقيقي للإدارة في قاعدة البيانات لا في الواجهة:** `am_admin()` دالة `SECURITY DEFINER` بـ`search_path=public`، والتعليق في `src/app/admin/verify/page.tsx` يقول ذلك صراحةً — «الحارسُ الحقيقيُّ في جسم `admin_decide_verification` مهما فعلت هذه القشرة (D-011)». **هذا نمط سليم** ويجب التحقق منه لا نقضه في Phase 5.

---

## 5. خريطة تدفّق البيانات

```
المتصفّح
  │
  ├─ Server Component (page.tsx)  ─→ src/lib/data.ts ─→ supabase-js (server client, ملفات تعريف الارتباط)
  │                                     │                    │
  │                                     │                    ├─→ 71 جدولاً في public (RLS مفعّل 72/72*)
  │                                     │                    ├─→ View واحد: public_profiles
  │                                     │                    ├─→ 176 دالة في public (130 منها تُستدعى من الكود)
  │                                     │                    └─→ Storage bucket واحد: avatars
  │                                     └─→ src/lib/tmdb.ts ─→ api.themoviedb.org (TMDB_API_KEY، خادم فقط)
  │
  ├─ Server Action (162 دالة)     ─→ src/lib/actions.ts ─→ نفس الطبقة + revalidatePath (194 استدعاء)
  │
  ├─ Client Component (180 ملف)   ─→ supabase-js (browser client، ANON key) ─→ RLS هي الحارس الوحيد
  │
  ├─ API Route (21)               ─→ TMDB · OMDb · Trakt · Gemini · Giphy · DeepL
  │
  └─ src/proxy.ts (Middleware)    ─→ تجديد جلسة Supabase على كل مسار عدا الأصول الثابتة
```

\* الرقم 72 من `list_tables` في Phase 0؛ عدّ `information_schema` اليوم يعطي **71 جدولاً** + View واحد = 72 كياناً. الفرق تسمية لا نقص.

### الخدمات الخارجية — مثبتة بالملف

| الخدمة | النطاق | الملف | المفتاح | جانب |
|---|---|---|---|---|
| TMDB API | `api.themoviedb.org` | `src/lib/tmdb.ts` · `imdbChart.ts` | `TMDB_API_KEY` | **خادم فقط** |
| TMDB Images | `image.tmdb.org` | `src/app/i/[size]/[file]/route.ts` · `imageLoader.ts` · `media.ts` | — | عبر نطاقنا (D-726/D-841) |
| OMDb | `omdbapi.com` | `src/lib/omdb.ts` | `OMDB_API_KEY` | خادم |
| Trakt | `api.trakt.tv` | `src/lib/trakt.ts` | `TRAKT_CLIENT_ID/SECRET` | خادم |
| Google Gemini | `generativelanguage.googleapis.com` | `src/lib/ai.ts` | `GEMINI_API_KEY` | خادم |
| DeepL | `api-free.deepl.com` | `src/lib/translate.ts:45` | `DEEPL_API_KEY` | خادم |
| Giphy | `api.giphy.com` | `src/lib/gif.ts` | `GIPHY_API_KEY` | خادم |
| Google Identity | `accounts.google.com` | `src/components/GoogleButton.tsx` | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | **عميل** |
| YouTube | `youtube.com` / `s.ytimg.com` | `Trailer.tsx` · `TrailerPlaybackController.tsx` | — | عميل |
| iTunes | `itunes.apple.com` | `src/lib/appleTrailers.ts:31` | — | خادم |
| flagcdn | `flagcdn.com` | `src/components/LangMenu.tsx` | — | خادم ثم يُقدَّم من نطاقنا |

**تنبيه لـ `LOOPZ-AUD-0002`:** المتغيّرات الستة الغائبة عن `.env.example` كلها مثبتة الاستعمال أعلاه بملفها — فالمشكلة توثيقية لا وهمية.

### Cron

**وظيفة مجدولة واحدة، داخل Postgres لا عبر HTTP:**

| jobname | schedule | active |
|---|---|---|
| `loopz-title-communities` | `17 3 * * *` | ✅ |

(المصدر: `select jobname, schedule, active from cron.job` — قراءة فقط.) وهذا يطابق ما في `18_Project_Context.md`: لا سرّ cron ولا مفتاح service-role مطلوب.

---

## 6. Auth / OAuth / Session / Deep links

| العنصر | الحقيقة | الملف |
|---|---|---|
| المزوّد | **Google فقط** — لا مزوّد ثانٍ في الكود | `src/components/GoogleButton.tsx` |
| مسارا الدخول | `signInWithIdToken` (GIS داخل الصفحة) **و** `signInWithOAuth` (تحويل احتياطي) | نفس الملف، سطور 21/107/160 |
| العودة | `/auth/callback` → `exchangeCodeForSession` | `src/app/auth/callback/route.ts` |
| الخروج | `/auth/signout` → `signOut` — **POST فقط** (حماية جيدة من CSRF عبر GET) | `src/app/auth/signout/route.ts` |
| تجديد الجلسة | `src/proxy.ts` على كل مسار غير ثابت | `src/proxy.ts:150` |
| عميلا Supabase | `src/lib/supabase/server.ts` و`client.ts` | |
| ملفات ارتباط التطبيق | **14 كوكي** بادئتها `loopz_` (لا تشمل كوكيز Supabase) | |
| COOP | `same-origin-allow-popups` — **مقصود**، بدونه تنكسر نافذة Google | `next.config.ts` |

**كوكيز التطبيق (14):** `loopz_content_prefs` `loopz_ctabs_hidden` `loopz_feed_sort` `loopz_feed_strangers` `loopz_news` `loopz_rails` `loopz_ref` `loopz_tabs_community` `loopz_tabs_discover` `loopz_tabs_library` `loopz_talk_followed` `loopz_title_mode` `loopz_trailer_sound` `loopz_translate`.

**Deep links / روابط قصيرة:** `/p/[code]` · `/join/[code]` · `/i/[size]/[file]` — الثلاثة route handlers بلا صفحة. **`UNKNOWN`:** لم أتحقق بعد من التحقق من المدخلات في `/p/[code]` و`/join/[code]` — هذا بند Phase 5 (open redirect / IDOR).

---

## 7. المظهر واللغة والجولات والPWA

| العنصر | الحقيقة |
|---|---|
| اللغات | **اثنتان فقط**: `ar` (RTL، افتراضية) و`en` — `src/lib/i18n.ts:4` |
| الثيمات | **سبعة**: `loopz` · `amber` · `ocean` · `violet` · `crimson` · `forest` · **`daylight`** (النهاري) — `src/lib/themes.ts:66` |
| الخطوط | Cairo · Tajawal · Poppins (`@fontsource`) + `public/fonts` |
| الجولات | `TOUR_VERSION = 2`، سجلّ `TOURS: Record<TourId, TourStep[]>`، حالة الإكمال في `profiles.ui_state` (jsonb) — `src/lib/tour.ts` |
| PWA | `public/sw.js` + `src/app/manifest.ts` + `public/splash` + `icon-192/512` + `icon-maskable-512` + `apple-icon` |
| Storage | **bucket واحد**: `avatars` — `storage.from("avatars")` هو الاستدعاء الوحيد في `src` |
| الإشعارات | **لا قناة دفع ولا مرسِل بريد ولا عمود تفضيلات** — `/profile/settings/notifications` موجودة والتخزين غير موجود (يطابق D-462) |

---

## 8. عوائق React Native / Expo — مقاسة

| العائق | ملفات | إشارات | الحكم المبدئي |
|---|---:|---:|---|
| `next/navigation` | **110** | 110 | 🔴 إعادة بناء كاملة → Expo Router |
| `next/link` | 84 | 84 | 🔴 استبدال بمكوّن تنقّل |
| `next/image` | 50 | 56 | 🔴 استبدال (`expo-image`) |
| `window.` | 48 | 185 | 🟡 فحص فرديّ — كثير منه قابل للتجريد |
| `document.` | 29 | 74 | 🔴 لا مقابل — إعادة بناء |
| `addEventListener` | 27 | 52 | 🟡 تجريد إلى طبقة أحداث |
| `next/headers` | 20 | 22 | 🟢 خادم فقط — يبقى في الويب |
| `next/server` | 20 | 20 | 🟢 خادم فقط |
| `cookies()` | 15 | 66 | 🔴 → `expo-secure-store` |
| `navigator.` | 12 | 29 | 🟡 |
| `localStorage` | 11 | 37 | 🔴 → `AsyncStorage` |
| `sessionStorage` | 4 | 15 | 🔴 |
| `IntersectionObserver` | 4 | 11 | 🔴 → `onViewableItemsChanged` |
| `matchMedia` | 3 | 5 | 🔴 → `useWindowDimensions` |
| `serviceWorker` | 1 | 5 | 🟢 يُسقط كلياً |
| **`revalidatePath`** | **6** | **194** | 🔴🔴 **أكبر بند** — لا مفهوم مقابل له |

### 8.1 التصنيف المبدئي (البند 9 من AUDIT_PLAN)

**قابل للمشاركة كما هو:** الأنواع · `src/lib/i18n.ts` · `themes.ts` (كقيم لا كـCSS) · `plan.ts` `plusGate.ts` `periodStats.ts` `statsFormat.ts` `when.ts` `locale.ts` `arabic.ts` `validate.ts` `searchTypes.ts` `postKeys.ts` `smartListKeys.ts` — منطق صرف بلا DOM.

**قابل للمشاركة بعد تجريد الشبكة:** `tmdb.ts` `omdb.ts` `trakt.ts` `anilist.ts` `wikidata.ts` `ai.ts` `translate.ts` — تعتمد `fetch` فقط، لكنها **خادمية بمفاتيح**؛ التطبيق يحتاج **endpoint وسيط آمناً** لا نسخ المفاتيح.

**يحتاج إعادة بناء:** كل `src/components` (182) · التنقّل · الأوراق والنوافذ · القوائم والتمرير · مشغّل الترايلر · رفع الصور · Safe areas.

**يُسقط:** `sw.js` · `SwRegister` · `imageLoader.ts` · `prefetchIntent.ts` · `useBeforePaint.ts` · `useScrollMemory.ts` (يُستبدل بمنطق FlatList).

> 🔴 **أخطر بند معماري وجدته:** المفاتيح كلها خادمية اليوم (TMDB وOMDb وTrakt وGemini وDeepL وGiphy)، والتطبيق يصل إليها **حصراً** عبر Server Components وServer Actions. **وتطبيق Expo لا يملك Server Components ولا Server Actions.** أي أن كل ما يمرّ اليوم بـ`src/lib/data.ts` و`actions.ts` (12,445 سطراً مجتمعةً) **يحتاج طبقة API عامة ومؤمّنة لا وجود لها بعد**. هذا ليس تفصيلاً في Phase 9 — إنه شرط دخولها.

---

## 9. مرشّحات الموت والتكرار — إثبات فقط، بلا حذف

### 9.1 مكوّنات لا تُستورد في أي مكان (5)

| الملف | الأدلة |
|---|---|
| `src/components/HeaderTools.tsx` | 0 مرجع خارج ملفه |
| `src/components/LanguageSwitch.tsx` | 0 |
| `src/components/RailWindow.tsx` | 0 |
| `src/components/settings/SettingsDoneAction.tsx` | 0 |
| `src/components/settings/SettingsSoon.tsx` | 0 |

الأمر: لكل ملف، `grep -rl "\b<basename>\b" src --include=*.ts --include=*.tsx` مع استبعاد الملف نفسه → صفر. **وفُحص الاستدعاء الديناميكي أيضاً** (بحث نصّي بالاسم في كل `src`) → صفر كذلك.
⚠️ **ليست حكماً بالموت.** بروتوكول الحذف يقتضي خطوة إثبات ثانية (بحث بسلاسل مبنية، وفحص `dynamic(() => import(...))` بمسار نصّي) قبل أي حذف. **لم أحذف شيئاً.**

### 9.2 دوال في قاعدة البيانات لا تُستدعى من `src` (46 من 176)

**مقسّمة بالغرض لا كلها ميتة:**

- **Triggers وحرّاس السياسات (طبيعي ألّا تُستدعى من الكود):** `handle_new_user` `are_mutual` `can_view_profile` `can_touch_post` `is_blocked` `is_community_member` `is_open_title_room` `*_depth_guard` (4) `*_reports_hide` (5) `hide_reported_review` `hide_reported_list_review` `touch_subscription_updated_at` `reverify_on_handle_change` `maintain_title_communities` `sync_plan_from_subscription` `log_runtime_error` `news_host_ok`.
- **لوحة مشغّل (`ops_*`، 10 دوال):** `ops_content` `ops_cron` `ops_db_size` `ops_locales` `ops_logins_daily` `ops_logins_hourly` `ops_overview` `ops_signups_daily` `ops_snapshots` `ops_storage`. **`18_Project_Context.md` يقول صراحةً «لا لوحة إدارة»** — فهذه إمّا تُستدعى يدوياً من محرّر SQL، أو بقايا. **`UNKNOWN` — يحتاج قرار أحمد.**
- **مرشّحات حقيقية للموت أو لميزة غير موصولة (13):** `create_community` · `search_communities` · `community_activity` · `award_weekly_top` · `weekly_top` (الجدول بصفر صفوف) · `most_watched_period` · `top_rated_period` · `my_referral_count` · `my_referral_list` · `featured_list_ids` · `grant_plus_days` · `set_news_items` · `prune_news_posts`.

> **الأهم:** `comm` بين 130 دالة تُستدعى من الكود و176 في القاعدة أعطى **صفر دالة تُستدعى ولا وجود لها** — أي **لا استدعاء RPC مكسور في التطبيق**. هذا خبر جيد ودليل قابل للتكرار.

### 9.3 جداول لا تُقرأ عبر `.from()` (21 من 71)

`curated_lists` `episode_ratings` `featured_lists` `imdb_pool` `news_posts` `partner_clicks` `partners` `plus_rewards` `profile_views` `provider_content_links` `provider_events` `referral_codes` `referral_events` `referrals` `runtime_errors` `subscriptions` `title_room_global_pins` `user_active_days` `visit_langs` `watched_episodes_backup_133` `weekly_top`.

⚠️ **هذا ليس دليل موت.** أكثرها يُقرأ ويُكتب **عبر RPC** لا عبر `.from()` — مثلاً `episode_ratings` عبر `set_episode_rating`/`episode_ratings_of`، و`referral_codes` عبر `my_referral_code`، و`runtime_errors` عبر `log_runtime_error`. **الجدول الوحيد الذي لا أرى له مساراً في الكود ولا في الدوال هو `watched_episodes_backup_133`** — وهو محلّ `LOOPZ-AUD-0005`.

### 9.4 فروع ميتة

عشرة فروع بصفر commits أمام `main` (لقطات وrollback من 19–28 أغسطس). التنظيف بند Phase 7 لا الآن.

### 9.5 مؤشّرات جودة الكود على نقطة الرجوع

| المؤشّر | العدد |
|---|---:|
| `TODO` / `FIXME` | **0** |
| `: any` | **0** |
| `as any` | **0** |
| `@ts-ignore` / `@ts-expect-error` | **0** |
| `console.log` | **2** |
| `console.*` (كلها) | 7 |
| `eslint-disable` | 24 |
| `npx eslint .` | **0 خطأ · 16 تحذيراً** |

التحذيرات الستّة عشر: 10 في `src/lib/shareCard.tsx` (`<img>` بلا `alt` وبلا `next/image` — وهو مولّد صور OG فالاستثناء مبرَّر تقنياً، يُحسم في Phase 3)، ومتغيّران غير مستعملين في `ListCoverSheet.tsx` و`TourGuide.tsx`، والباقي متفرّق.

**هذه قاعدة كود نظيفة بمقياس موضوعي.** صفر `any` في 453 ملفاً ليس شائعاً.

---

## 10. الفرعان المؤجَّلان — مفقود أم متجاوَز؟ (البند 10)

### `fix/ios-perf-probe-standalone-gate` → **متجاوَز (SUPERSEDED)**

- التغيير الوحيد: `src/components/PerfProbe.tsx` (+17/−2).
- **الملف نفسه محذوف من `main`**: `git cat-file -e origin/main:src/components/PerfProbe.tsx` → غير موجود.
- ولا مرجع باسم `PerfProbe` في `main` إطلاقاً (0 ملف).
- **الحكم: لا شيء مفقود. الفرع يعدّل ملفاً لم يعد موجوداً.** آمن للأرشفة في Phase 7.

### `mccicc2-art-patch-1` → **مفقود فعلاً (MISSING)**

- 4 commits · 6 ملفات · +236/−90.
- **الدليل القاطع** — `src/lib/trailerPrefs.ts`:
  - في `main`: `return raw === "on";` → **الترايلر صامت افتراضياً**.
  - في الفرع: `return raw !== "off";` → **الصوت شغّال افتراضياً**، ومن كتم مرّة يبقى مكتوماً.
- رسالة الـcommit تصف هذا بأنه **«نقضٌ صريحٌ من أحمد لشرطه في D-726»** — أي **قرار منتَج معلن ولم يصل إلى الإنتاج**.
- الملفات: `src/lib/trailerPrefs.ts` · `src/lib/i18n.ts` · `TrailerFeed.tsx` · `trailers/TrailerCardMedia.tsx` · `trailers/TrailerPlaybackController.tsx` (+162/−…) · `scripts/trailer-lab/run.mjs` (28 اختباراً).
- **الحكم: محتوى حقيقي غير مدموج، ويحمل تغيير سلوك يراه كل مستخدم.** أُبقيه `DEFERRED` كما أمرت — **لم أدمج ولم أحذف** — لكن أسجّل أن هذا ليس فرعاً مهجوراً بل قرار منتَج معلّق.

> ⚖️ **وأقولها بصراحة:** إبقاء `mccicc2-art-patch-1` مؤجّلاً بلا قرار يعني أن التدقيق سيصادق على سلوك ترايلر يعرف أحمد أنه ليس ما يريده. يستحق قراراً في Phase 2 لا في Phase 7.

---

## 11. تصوّر بيئة اختبار معزولة — **تصوّر فقط، لم يُنفَّذ منه شيء**

استجابةً للبند 3 و11 من تعليماتك. **لم أُنشئ أي مورد، ولا حساباً، ولا صفّاً، ولا فرع قاعدة بيانات.**

### الخيارات الثلاثة

| # | الخيار | الكلفة | يعالج | المخاطرة |
|---|---|---|---|---|
| A | **Supabase Branching** (فرع قاعدة بيانات للـPreview) | مدفوع — المنظمة على **Free** اليوم | العزل الكامل: Phase 2 و5 و6 | ترقية خطة + إعداد |
| B | **مشروع Supabase ثانٍ للاختبار** (Free) | مجاني | العزل + بيانات اصطناعية | مزامنة المخطط يدوياً (173 ملف SQL) |
| C | **حسابات اصطناعية داخل Production الحالية** | مجاني وفوري | Phase 2 جزئياً | **تلويث بيانات حقيقية — لا أوصي به** |

**توصيتي: (B).** مشروع ثانٍ مجاني يُبنى بتشغيل ملفات `supabase/*.sql` بترتيبها، ويُملأ ببيانات اصطناعية بحتة. يعطي عزلاً كاملاً بلا كلفة وبلا لمس بيانات المستخدمين الحقيقيين الاثنين والثلاثين.

### الحسابات الاصطناعية المطلوبة (10)

`t_guest` (بلا حساب) · `t_free` · `t_plus` · `t_founder` · `t_verified` · `t_xverified` · `t_admin` · `t_private` · `t_partner` · `t_blocked_pair` (حسابان).

**كلها بأسماء بادئتها `t_` وبريد اختباري، ولا واحد منها يمثّل شخصاً حقيقياً.**

⚠️ **قيد ثابت لا يتغيّر بأي قرار:** لا أُدخل بيانات اعتماد ولا أسجّل الدخول بأي حساب. إنشاء الحسابات فعلٌ يحتاج من يملك الوصول.

---

## 12. الموانع بعد Phase 1

| # | المانع | الحالة |
|---|---|---|
| 1 | حسابات الاختبار | ما زال قائماً — لكنه **لم يمنع Phase 1** كما قدّرت أنت بحق |
| 2 | لا بيئة بيانات معزولة (`LOOPZ-AUD-0006`) | قائم — التصوّر جاهز في §11، والتنفيذ ينتظر قرارك |
| 3 | Vercel 403 | مؤجَّل إلى Phase 8 بأمرك |
| 4 | `loopztv.com` محجوب عن أداة الجلب لديّ | قائم — الفحص الحيّ في Phase 2 يحتاج المتصفّح |
| 5 | **`main` تحرّك 6 commits بعد نقطة الرجوع** | **قائم وبلا قرار** — انظر تعليقي في PR رقم 19 بتاريخ 01:40 UTC |

### أثر تحرّك `main` على هذا الجرد — مقيس لا مقدَّر

الستة commits (`64bd1d41` → `f8a2b33c`) مسّت **6 ملفات**: `calendar/page.tsx` · `statistics/page.tsx` · `EpisodeTracker.tsx` · `HomeAvatarLink.tsx` · `HomeHeader.tsx` · `i18n.ts` — **+50/−7 سطراً، كلها نصوص تلميحات وتنسيق**.

**النتيجة: صفر مسار جديد · صفر ميزة جديدة · صفر جدول أو RPC جديد.** أي أن **هذا الجرد صالح كما هو على `f8a2b33c`** أيضاً، ما عدا أرقام الأسطر داخل الملفات الستة. سجّلته لأن الادّعاء بلا قياس لا يجوز.

---

## 13. إقرار

- ✅ لم أعدّل أي ملف في `src/` أو `supabase/` أو أي إعداد تطبيق.
- ✅ لم ألمس `main` ولم أفتح PR نحوه.
- ✅ لم أحذف ملفاً ولا دالة ولا فرعاً.
- ✅ لم أنشئ حساباً ولا صفّاً ولا فرع قاعدة بيانات ولا أي مورد.
- ✅ كل استعلامات Supabase كانت **metadata فقط** (`information_schema` · `pg_proc` · `cron.job`) — **صفر قراءة لبيانات مستخدمين**.
- ✅ لا أسرار ولا Tokens ولا بيانات مستخدمين في هذا الملف.
- ✅ الكتابة الوحيدة: ملفات توثيق على `docs/pre-app-audit`.

**المطلوب منك:** `VERIFIED` أو `CHANGES_REQUESTED`، وتصحيح رقم المسارات في Phase 0 من 81 إلى 76، وقرار في تحرّك `main`، وقرار في `mccicc2-art-patch-1`. **متوقّف عند البوابة ولن أبدأ Phase 2 قبل ردّك.**
