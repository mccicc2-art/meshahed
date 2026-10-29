# Phase 9 — جاهزية React Native / Expo · المصفوفات وتصميم طبقة الـAPI (`0008`) والبنية المستهدفة وترتيب البناء

> **الحالة:** `READY_FOR_REVIEW` (المراجع = Claude بتفويض المالك؛ القرارات المُعلَّمة «مالك» تبقى له) · **Audited SHA:** `main @ e254b2f` (بعد D-896) · **فرعُ التدقيق:** `docs/pre-app-audit` · **التاريخ:** 2026-09-02 · بدءُ العمل 18:45 UTC بأمر المالك «أبدأ» (بعد ردّه على القرارات السبعة في الفصل ٠)
>
> **حدودُ هذه المرحلة كما في `AUDIT_PLAN.md` §9: توثيقٌ وتصميم فقط.** صفر تعديلِ تطبيق · صفر SQL/Migration · صفر إعدادِ Expo أو EAS أو Google Cloud · لا يُنشأ مستودعٌ ولا حزمة. **كلُّ رقمٍ هنا مقروءٌ من شجرة `e254b2f` بأوامرَ مذكورةٍ في §١ وسكربتٍ مرفقٍ في `evidence/`**، وكلُّ حكمٍ على حزمةٍ خارجيةٍ مبنيٌّ على وثائقها المعروفة حتى تاريخ هذا التقرير لا على تجربةِ تثبيت (لم يُثبَّت شيء).
>
> ⚠️ **ولا قيمةَ متغيّرِ بيئةٍ ولا اسمَ دالّةِ قاعدةٍ في هذا التقرير** — أعدادٌ وأسماءُ ملفاتِ التطبيق فقط.

**ما يبني عليه هذا التقرير ولا يكرّره:** `PHASE_1_INVENTORY.md` §3 (تصنيف الصفحات 49) و§8 (عوائق RN المقاسة على `f8a2b33c`) و§15 (خريطة تدفّق البيانات) و§16 (Auth/Session/Deep links) · `PHASE_5_SECURITY.md` (`0040`) · `PHASE_10D_API_NETWORK.md` §8–§17 (صفحة العمل بعد D-889…D-896).

---

## ٠. القرارات السبعة قبل هذه المرحلة (سُلِّمت في الدردشة قبل «أبدأ»)

بتفويض المالك «اتخذ الأفضل للوبز ولتجربة المستخدم»، وكلُّها قابلةٌ للعكس بسطرٍ منه:

| # | القرار | السبب في سطر |
|---|---|---|
| ١ | **D-889…D-896 كلّها تبقى** | مقيسةٌ قبل/بعد، بنقاطِ رجوعٍ مسجّلة، بلا SQL/SW |
| ٢ | **`0076` = `WONT_FIX`** | ≈2 KB على السلك؛ Sprite لكلّ الأيقونات يُحمَّل على كلّ صفحة |
| ٣ | **لا إطالةَ لـ`revalidate` تفاصيلِ العمل** | `next_episode_to_air` وعددُ الحلقات تتغيّر يوميّاً؛ ثمنُ الفتح البارد صار رحلةَ TMDB واحدة |
| ٤ | **تخطّي `append_to_response`** | بعد D-889 الثانويّات متوازية؛ الدمج لا يقصّر المسار الحرج ويغيّر مفاتيح الكاش |
| ٥ | **`0073` = `ACCEPTED_TRADEOFF`** (SW +120 ms TTFB دافئ) | لا قطعَ PWA/Offline عن كلّ زائر مقابل 120 ms؛ للتطبيق أوفلاينه |
| ٦ | **جذرُ العناوين العربية يُؤجَّل لمرحلة التطبيق** | الحلّ جدولُ كاش في Supabase = Migration خارج الصلاحية؛ D-894 كافية للويب |
| ٧ | **«الثقل» المتبقّي عند المالك يُنسب مبدئيّاً لأرضيّة JS (`0035`/`0036`) لا للبيانات** | قياسُه الأمامي غير مقيس بعد؛ خطوةٌ مستقلّة لاحقاً |

---

## ١. المنهج والأرقام على `e254b2f`

| القياس | الأمر (بالمعنى) | القيمة |
|---|---|---|
| صفحات App Router | `find src/app -name page.tsx` | **49** (تصنيفها الكامل في Phase 1 §3) |
| مسارات API | `find src/app -path '*api*' -name route.ts` | **14**: `build` · `curated` · `franchise` · `genres` · `imdb-chart` · `lang-ping` · `news-gen` · `search` · `season` · `suggest` · `title-meta` · `trailer-signal` · `trakt/start` · `trakt/callback` |
| ملفات `src` (ts/tsx) | `find src -type f` | **457** |
| ملفات `src/lib` | `ls src/lib/*.ts*` | **118** |
| Server Actions المُصدَّرة | `grep -c '^export (async )?function' src/lib/actions.ts` | **164** في **6,178** سطراً (ملفات `"use server"`: 5 — `actions.ts` + 4 صفحات إدارة/دعوات) |
| قرّاء طبقة القراءة | نفسه على `src/lib/data.ts` | **121** في **6,427** سطراً |
| دوالّ قاعدةٍ مستدعاة (`.rpc(`) | أسماءٌ مميّزة | **131** |
| جداول/عروض مستدعاة (`.from(`) | أسماءٌ مميّزة | **53** (الأكثر: `user_lists` 35 · `profiles` 29 · `follows` 26 · `watched_episodes` 24) |
| `revalidatePath(` | استدعاءات / ملفات | **182 / 4** (كانت 194 / 6 على `f8a2b33c`) |
| عميلُ المتصفّح لـSupabase (`supabase/client`) | ملفات | **9** (دخول Google · رفع صور 4 · Realtime 1 · طابور الأوفلاين · Composer · Communities) |
| عميلُ الخادم (`supabase/server`) | ملفات | **20** |
| مكوّنات `"use client"` | من 232 ملفَ مكوّن | **168** |
| `next/navigation` / `next/link` / `next/image` | ملفات | **112 / 82 / 50** |
| `window.` / `document.` / `localStorage` / `sessionStorage` / `navigator.` | ملفات | **49 / 30 / 11 / 4 / 14** |
| `cookies()` / `next/headers` | ملفات | **15 / 20** |
| `IntersectionObserver` / `matchMedia` / `indexedDB` | ملفات | **4 / 3 / 0** |
| Service Worker | `public/sw.js` + `SwRegister.tsx` | 1 + 1 |
| Middleware | `src/proxy.ts` (Next 16) | 1 — تجديدُ الجلسة فقط |
| متغيّراتُ بيئةٍ تُقرأ في `src` غير `NEXT_PUBLIC_` | `process.env.*` | **10 أسماء**: 8 مفاتيحُ خدمات (TMDB · OMDb · Trakt ×2 · Gemini ×2 · DeepL · Giphy) + `NODE_ENV` و`VERCEL_GIT_COMMIT_SHA` غيرُ سرّيين — **كلّها خادمية** |
| Storage | `storage.from(` | bucket واحد (`avatars`) من 4 مكوّنات عميل |
| Realtime | `.channel(` | ملفٌ واحد `src/lib/usePoll.ts` (الرسائل) |

**السكربت:** `evidence/P9-classify-e254b2f.py` (ناتجُه الخام `evidence/P9-lib-classification-e254b2f.txt`) يصنّف كلَّ ملفٍ في `src/lib` بعلاماتٍ آليّة: `use client` · `use server` · استيرادُ `next/*` أو `server-only` · `supabase/server` · `supabase/client` · `process.env` سرّي · DOM (`window.|document.|localStorage|…`) · React · `fetch`. ثمّ راجعتُ يدويّاً كلَّ ملفٍ لم يُحسم آليّاً (§٢.٢).

---

## ٢. مصفوفة `src/lib` — ما يُشارك وما يبقى للخادم وما يُعاد بناؤه

### ٢.١ الخلاصة (118 ملفاً · 39,939 سطراً)

| الفئة | ملفات | أسطر | المعنى |
|---|---:|---:|---|
| **SHARE — تُشارك كما هي** (لا Next، لا DOM، لا مفاتيح، لا Supabase-خادم) | **85** | **19,792** | أنواع · i18n (3,922) · التحقّق · الإحصائيات · التواريخ · التفضيلات · التصنيفات · tokens الثيمات (`themes.ts` 445) · محلّلات الاستيراد (Letterboxd/TV Time/Trakt-parse) · منطق الأقسام والقوائم الذكية |
| **SERVER — تبقى خلف الـAPI** | **16** | **17,888** | `actions.ts` 6,178 · `data.ts` 6,427 · `tmdb.ts` 2,303 · `omdb` · `imdbChart` · `trakt` · `ai` · `translate` · `gif` · `loopzNews` · `myActivity` · `newsReports` · `talkBulletins` · `titleAliases` · `locale` · `og.tsx` |
| **REWRITE — تُعاد كتابتها بواجهات RN** | **16** | **2,204** | `toast` · `haptics` · `offline` · `uiState` · `tour` · `trailerPrefs` · `loginGate` · `plusGate` · `site` · `imageFile` · `useKeyboard` · `useScrollMemory` · `useUiLocale` · `usePoll` (Realtime) · `shareCard.tsx` · `trailerCard.ts` |
| **DROP — لا مقابل لها** | 1 | 55 | `prefetchIntent.ts` (تلميح prefetch لـnext/link) |

> ⚠️ **تصحيحٌ لاحق (§١١، بعد D-897):** هذا الجدول أُنتج بمصنِّفٍ لم يفحص الاستيرادَ بين ملفّات `src/lib` ولا `import "server-only"` بلا `from`. **الأرقامُ الصحيحة: SHARE 69 / 14,874 · SERVER 32 / 22,806 · REWRITE 16 / 2,204 · DROP 1 / 55.** الجدولُ يبقى كما نُشر ليُقرأ التصحيح.

**القراءة الصحيحة:** نصفُ `src/lib` بالأسطر يُشارك بلا لمس، ونصفُه الآخر ليس «غير قابل للمشاركة» بل **منطقٌ صحيح واقفٌ خلف بابٍ لا يفتحه Expo** (Server Actions/Components + مفاتيح خادمية). هذا هو `0008` بالضبط — والحلّ في §٤.

### ٢.٢ الملفات التي احتاجت حكماً يدويّاً

| الملف | العلامة الآليّة | الحكم | لماذا |
|---|---|---|---|
| `i18n.ts` | `dom` | **SHARE** | إيجابٌ كاذب: كلمة `document` داخل نصّ ترجمة (سطر 3719) لا استدعاء |
| `profilePrefs.ts` | `use client` | **SHARE** بعد فصل نوع `IconName` | يستورد `type IconName` من مكوّن فقط؛ نقلُ النوع إلى `core` يحرّره |
| `og.tsx` | `tsx` | **SERVER** | `node:fs` — راسمُ بطاقات OG، لا شأنَ للتطبيق به |
| `shareCard.tsx` | `react,tsx` | **REWRITE** | JSX بعناصر DOM |
| `trailerCard.ts` | `use client` | **REWRITE** | Hook يستدعي Server Action + toast الويب |
| `wikidata.ts` · `anilist.ts` · `appleTrailers.ts` · `news.ts` | `fetch` بلا مفتاح | **SHARE منطقيّاً — لكنّها تُستدعى من الخادم فقط** (تستعمل خيار `next: { revalidate }` في `fetch` — 7 ملفات) | تبقى خلف الـAPI الآن؛ خيارُ `next:` يُهمَل في RN لكن الكاش يضيع — لا داعيَ لنقلها |
| `sessionCookie.ts` | — | SHARE شكلاً، **بلا استعمالٍ في التطبيق** | أداةُ فحصِ كوكي؛ التطبيق يحفظ الجلسة في SecureStore |
| `ratelimit.ts` · `validate.ts` | — | **SHARE ويُعاد استعمالُهما في الـAPI** | حدُّ المعدّل لكلّ مستخدم والتحقّق موجودان — لا يُخترع بديل |

---

## ٣. مصفوفة الحزم — التوافق مع RN / Expo (New Architecture)

`package.json` صغير عمداً (9 اعتماديّات تشغيل + 8 تطوير)، وهذا أفضل خبرٍ في هذه المرحلة:

| الحزمة | الويب | التطبيق | الحكم |
|---|---|---|---|
| `react@19.2.4` | ✓ | ✓ **بشرط مطابقة إصدار React الذي يثبّته RN/Expo المختار** | 🟡 **خطرٌ يُحسم أوّل يوم**: في workspace واحد لا يجوز نسختان من React؛ إمّا تثبيتُ الويب على إصدار RN أو عزلُ الحزم (§٥.٣) |
| `react-dom` | ✓ | ✗ | ويب فقط |
| `next@16.3.0` | ✓ | ✗ | ويب فقط — وكلّ ما يستورد `next/*` (112 + 82 + 50 + 20 ملفاً) |
| `@supabase/supabase-js@2.x` | ✓ | ✓ | **مشتركة** — في RN تحتاج: مخزنَ جلسةٍ (`expo-secure-store` أو AsyncStorage) · `autoRefreshToken` مربوطاً بـ`AppState` · `detectSessionInUrl: false` |
| `@supabase/ssr` | ✓ | ✗ | كوكيز الويب فقط؛ التطبيق يستعمل `supabase-js` مباشرةً للمصادقة |
| `@fontsource/tajawal` · `@fontsource/poppins` | ✓ | ✗ → **`expo-font` بملفات TTF نفسها** (الخطّان OFL) | نفس الخطّين، حزمةٌ مختلفة |
| `@vercel/speed-insights` | ✓ | ✗ | ويب فقط؛ للتطبيق قياسٌ آخر (قرار §٧) |
| `fast-xml-parser` | ✓ (خادم: `news.ts`) | لا حاجة | يبقى خلف الـAPI |
| `tailwindcss@4` · `@tailwindcss/postcss` | ✓ | ✗ | **الـtokens تُستخرج لا الأداة** — `themes.ts` (445 سطراً، SHARE) يحمل الألوان أصلاً؛ الزوايا والمقاسات من `globals.css` (وهما موضعُ `0024`/`0025`: سُلّمان متوازيان — **يُصحَّحان قبل الاستخراج لا بعده**) |
| `typescript` · `eslint` · `eslint-config-next` | ✓ | ✓ / ✗ | `eslint-config-next` للويب فقط؛ `core` يحتاج إعدادَ ESLint خاصّاً به (قاعدة منع `next/*` — §٥.٢) |

**لا حزمةَ في المستودع تعتمد على مكتبةٍ أصليّةٍ (native) غير متوافقة مع New Architecture** — لأنّ لا مكتبةَ أصليّةً أصلاً. التوافق يُختبر على ما سيُضاف في التطبيق (§٧)، لا على ما هو موجود.

---

## ٤. تصميم طبقة الـAPI — إغلاق `LOOPZ-AUD-0008` (P1 / App-readiness)

### ٤.١ المشكلة بدقّة

اليوم (Phase 1 §15): القراءة عبر Server Components → `data.ts`، والكتابة عبر Server Actions → `actions.ts`، والمفاتيحُ الثمانية خادمية. **Expo لا يملك Server Components ولا Server Actions**، ولا يجوز أن يحمل أيَّ مفتاح. فالتطبيق بلا بابٍ إلى 164 كتابةً و121 قراءةً وكلِّ TMDB.

### ٤.٢ الخيارات الثلاثة والحكم

| الخيار | ما هو | لماذا رُفض / قُبل |
|---|---|---|
| **B — Supabase مباشرةً من التطبيق** (`supabase-js` + RLS + استدعاء الـ131 دالّة) | التطبيق يكرّر منطق `actions.ts` بنفسه | ✗ **مرفوض**: يكرّر 6k سطر منطقٍ في مكانين؛ TMDB يحتاج API على أيّ حال؛ **ويجعل دوالّ `SECURITY DEFINER` (`0040`) هي واجهةَ التطبيق كاملةً** — توسيعُ سطحٍ لم يُغلق بعد |
| **C — Supabase Edge Functions كـAPI** | نقلُ المنطق إلى Deno | ✗ **مرفوض**: بيئةُ تشغيلٍ ثانية ومسارُ نشرٍ ثانٍ خارج Vercel الذي يعمل به المالك؛ ونقلُ 12k سطر بلا مكسب |
| **A — الـAPI داخل Next نفسه: `/api/v1/*` بـRoute Handlers فوق المنطق الموجود** | نفسُ الدوالّ، بابٌ ثانٍ | ✓ **المعتمد**: صفرُ تكرارٍ للمنطق، نفسُ الحرّاس (`getUser` + RLS + `ratelimit` + `validate`)، نفسُ النشر، **والويب لا يتغيّر سلوكيّاً** |

### ٤.٣ الشكل المعتمد (A) — أربع طبقات

```
التطبيق (Expo)                                   الويب (Next)
  fetch /api/v1/...  Authorization: Bearer <jwt>    Server Component / Server Action (كما اليوم)
        │                                                  │
        ▼                                                  ▼
  src/app/api/v1/**/route.ts  ─── غلافٌ رقيق ───    src/lib/actions.ts · page.tsx  ─── غلافٌ رقيق
   • auth: getUser(bearer)                            • auth: getUser(cookies)
   • validate.ts · ratelimit.ts                       • validate.ts · ratelimit.ts
   • لا revalidatePath — يعيد `invalidates: []`       • revalidatePath(...) كما اليوم
        └──────────────┬───────────────────────────────────┘
                       ▼
        src/core/**  (المنطق الحقيقي — دوالّ نقيّة بتوقيع واحد)
          fn(ctx: { supabase, userId, locale }, input) → Result
          • كتابات: من actions.ts (164) تُنقل إلى هنا تدريجيّاً
          • قراءات: من data.ts (121) وtmdb.ts (تركيبُ صفحة العمل كما في D-889)
                       ▼
        Supabase (RLS + دوالّ) · TMDB · OMDb · … (المفاتيح لا تغادر الخادم)
```

**قواعدُ الغلاف:**

1. **المصادقة:** `Authorization: Bearer <access_token>` من `supabase-js` على الجهاز؛ الخادم يبني عميل Supabase **بالرمز لا بالكوكي** (نفسُ `createServerClient` مع مزوّدِ كوكيز فارغ + ترويسة Authorization) فتبقى RLS بهويّة المستخدم نفسه — **لا مفتاحَ `service_role` في التطبيق ولا في الـAPI** (Phase 5 أثبتت صفر استعمال؛ يبقى صفراً).
2. **التجديد على الجهاز** (`autoRefreshToken` + `AppState`)، الخادم لا يضع كوكيز للتطبيق أبداً. **لا تغييرَ في مدّة الرموز ولا في إعدادات Auth** (خارج الصلاحية — `0040`/Phase 5 §8.1).
3. **العقد:** نوعُ الإدخال والإخراج لكلّ نقطةٍ يُعرَّف في `src/core/contracts/*.ts` ويُستورد من الجانبين — **النوعُ هو الوثيقة**، لا OpenAPI منفصل يشيخ.
4. **الإبطال بدل `revalidatePath`:** الـ182 استدعاءً لا مقابلَ لها في التطبيق (Phase 1 §8: «لا مفهوم مقابل»). الحلّ المعتمد: كلُّ كتابةٍ في `core` تعيد `invalidates: Tag[]` (نفسُ مسارات `revalidatePath` كوسومٍ مثل `title:tv:1399` · `me:library` · `user:<id>:profile`)؛ غلافُ الويب يحوّلها إلى `revalidatePath`، وغلافُ الـAPI يعيدها في الجسم ليُبطل التطبيقُ استعلاماته المحلّية (TanStack Query keys). **بهذا لا تُكتب قاعدةُ إبطالٍ مرّتين.**
5. **الأخطاء:** شكلٌ واحد `{ error: { code, message_key } }` — `message_key` مفتاحُ i18n المشترك، فالتطبيق يترجم بنفسه.
6. **الإصدار:** `/api/v1/` ثابت؛ تغييرٌ كاسر = `/v2/` لا تعديلُ `v1`، لأنّ نسخَ التطبيق في المتاجر لا تُحدَّث كلّها معاً.
7. **الحدود:** `ratelimit.ts` لكلّ مستخدم كما في `/api/season` اليوم؛ وحدٌّ للمجهول على نقاط القراءة العامّة (بحث/اكتشاف/عمل) **بنفس الأرقام الحاليّة** حتى يقرّر المالك غيرها.
8. **الـ14 مسارَ API الحاليّة** تبقى كما هي للويب؛ لا تُنقل إلى `v1` إلا حين يحتاجها التطبيق (الأرجح: `search` · `season` · `suggest` · `title-meta`).

### ٤.٤ نقاطُ `v1` الأولى (بالحاجة، لا بالكمال)

| المجموعة | نقاط | تُركَّب من |
|---|---|---|
| هويّة | `me` · `me/prefs` | `data.ts` (profile/prefs readers) |
| عمل | `title/{tv\|movie}/{id}` (hero+ratings+trailer+cast+related **في ردٍّ واحدٍ مع حدود Suspense نفسها كحقول**) · `title/tv/{id}/season/{n}` | تركيبُ `show/[id]/page.tsx` بعد D-889/D-894/D-896 + `/api/season` |
| اكتشاف وبحث | `discover/{section}` · `search` · `suggest` · `trailers` | `browse.ts` · `sections.ts` · `/api/search` |
| مكتبة | `me/library` · `me/lists` · `lists/{id}` · كتابات القوائم (create/rename/toggle/reorder/delete) | `actions.ts` (35 استدعاءً لـ`user_lists`) |
| تتبّع | `toggleEpisode` · `watchUpTo` · `setSeasonWatched` · `toggleMovieWatched` · `saveMovieProgress` | `actions.ts` |
| تقييم ومراجعة | `saveRating` · `deleteRating` · `myRatingFor` · replies | `actions.ts` |
| اجتماعي | follows (request/accept/reject/remove/block) · `people/suggest` · feed/activity readers | `actions.ts` · `myActivity.ts` |
| ملف | `updateProfile` · avatar (رفعٌ مباشر لـStorage من التطبيق كما يفعل الويب — RLS للتخزين قائمة) | كما اليوم |

**ما لا يدخل `v1` عمداً:** الإدارة (`/admin/*` — ويب) · الشريك/التوثيق · الاستيراد بملفات وOAuth Trakt (يحتاج عودةَ OAuth إلى نطاق الويب) · Plus/الفوترة · الرسائل والمجتمعات (Realtime — `v1.1` بعد استقرار الأساس). **هذا نطاقٌ مقترح؛ قرارُه للمالك (§٨).**

### ٤.٥ أثرُ التصميم على `0040`

الـAPI **لا يضيف** مستدعياً جديداً لدوالّ `SECURITY DEFINER`: كلُّ استدعاءٍ يمرّ بنفس `core` الذي يمرّ به الويب، بهويّة المستخدم. لكنّه **لا يغلق `0040`** أيضاً — لأنّ الـANON key عامٌّ اليوم وأيُّ JWT صالح يستطيع نداءَ PostgREST مباشرةً؛ فإغلاق `0040` (جرد + حراسة + مراجعة وراثة PUBLIC/authenticated في بيئةٍ معزولة) **يسبق** نشرَ أيّ تطبيق، كما تشترط بوّابةُ المرحلة 11.

---

## ٥. البنية المستهدفة

### ٥.١ الشكل

```
loopz (مستودع واحد — npm workspaces)
├── apps/web        ← Next.js كما هو (المسار الحالي src/ يُنقل هنا في خطوةٍ لاحقة، لا الآن)
├── apps/mobile     ← Expo (Expo Router)
└── packages/core   ← ما في §٢ SHARE + contracts + المنطق المستخرَج من actions/data
```

**لماذا مستودعٌ واحد لا اثنان:** `core` يتغيّر مع كلّ ميزة؛ مستودعان يعنيان نشرَ حزمةٍ وإصداراً لكلّ تغيير ودَيْنَ مزامنة. ولماذا `npm workspaces` لا pnpm/turbo: المستودع على npm أصلاً (`package-lock.json`)، وVercel يدعم workspaces npm مباشرةً؛ turbo يُضاف لاحقاً إن طال وقتُ البناء — **قرارٌ للمالك (§٨ ب-١) لأنّه يمسّ إعدادَ Vercel (`Root Directory`).**

### ٥.٢ الخطوة الأولى لا تنتظر Expo: `src/core/` داخل الويب

قبل أيّ workspace: مجلّد `src/core/` يُنقل إليه ملفاتُ SHARE (85) **بلا تغيير سلوك** (البناء يجب أن يُخرج نفسَ النتيجة)، وتُفرض عليه قاعدةُ ESLint `no-restricted-imports` تمنع `next/*` و`react-dom` و`@/lib/supabase/server` و`@/components/*`. هذا يجعل الحدَّ **قابلاً للتحقّق آليّاً** من اليوم، ويكشف التسريبات (مثل `profilePrefs.ts → IconName`) قبل أن يصبح الـcore حزمةً.

### ٥.٣ خطرُ React المزدوج

RN يثبّت إصدارَ React بنفسه. إن اختلف عن `19.2.4` الذي يستعمله الويب، فإمّا (أ) يُثبَّت الويب على إصدار RN (Next 16 يدعم 19.x) — **المفضَّل**، أو (ب) `nohoist`/عزلُ الحزم. يُحسم عند اختيار SDK (§٧) لا قبله.

### ٥.٤ ما يُعاد بناؤه في التطبيق ولا يُنقل (من `AUDIT_PLAN` §9 + الجرد)

| الويب | التطبيق | ملاحظة |
|---|---|---|
| `next/navigation` (112) · `next/link` (82) | Expo Router (`Link` · `useRouter` · `useLocalSearchParams`) | نفسُ شجرة المسارات؛ `[id]` كما هي |
| `next/image` (50) + `/i/<size>/<file>` + `imageLoader.ts` | `expo-image` **بنفس نطاق `/i/`** (D-726/D-841) — الكاش والحجمُ المختار (D-895) يبقيان قرارَ الخادم | لا يُطلب `image.tmdb.org` من الجهاز مباشرةً — يبقى المسارُ عبر نطاقنا |
| كوكيز التفضيلات (14) + `localStorage` (11) + `sessionStorage` (4) | `expo-secure-store` للجلسة فقط · `AsyncStorage` (أو MMKV) للتفضيلات · **لا تفضيلَ في SecureStore** | التفضيلات المحفوظة في القاعدة تصل عبر `me/prefs` |
| `IntersectionObserver` (4) · `matchMedia` (3) · `window.`/`document.` (49/30) | `FlatList/FlashList` viewability · `useWindowDimensions` · `Appearance` | نقطةُ `0038` (`/person` بـ219 بطاقة بلا حدّ) تصبح **إلزاميّةً** — قائمةٌ بلا `windowSize` تقتل الأداء على الجهاز |
| Sheets/Modals (DOM) | نفسُ **العائلات السبع** بعناصر RN: زرّ واحد · Sheet واحد (`@gorhom/bottom-sheet` — مرشَّح، §٧) · segmented + chip · toast واحد · أيقونات (SVG نفسها عبر `react-native-svg`) · سُلّمُ زوايا واحد · لونُ نجاحٍ واحد | **قاعدةُ المشروع تنطبق على التطبيق: نسخةٌ ثانية من أيّها عيب** |
| مشغّل الترايلر (iframe `youtube-nocookie`) | WebView بنفس التضمين — **لا مكتبةَ تشغيلٍ غير رسميّة** (شروط YouTube) | D-771 (الصوتُ مفتوح) وD-878/D-879 تُعاد صياغتُها للمس |
| Service Worker (`sw.js`) | يُسقط؛ الأوفلاين = كاشُ استعلامات (TanStack Query + persist) + طابورُ كتاباتٍ يعادل `offline.ts` | قرارُ حجم الكاش وما يُحفَظ للمالك (§٨) |
| `revalidatePath` (182) | وسومُ الإبطال من الـAPI (§٤.٣-٤) | — |
| الجولات (`tour.ts`, `TourGuide.tsx`) | تُعاد بواجهات RN؛ `0028` (بلا «رجوع») و`0034` (فشلُ الحفظ يُبتلع) **يُصلَحان في الويب أوّلاً** كي لا يُنسخ العيب | — |

---

## ٦. مصفوفة الميزات ويب ⇢ موبايل (خريطة Phase 1 §6 مُسقَطةً على التطبيق)

| المجال | صفحات الويب | القراءة | الكتابة | نقطة `v1` | **النطاق المقترح** |
|---|---|---|---|---|---|
| الرئيسية والاكتشاف | `/` · `/news` · `/discover/[section]` | `browse` · `sections` · TMDB | تفضيلات الرفوف | `discover/*` · `me/prefs` | **v1** |
| البحث | `/search` | `/api/search` · `/api/suggest` | — | `search` · `suggest` | **v1** |
| العمل (فيلم/مسلسل) | `/show/[id]` · `/movie/[id]` | TMDB + OMDb + Wikidata + Supabase (D-889…D-896) | تتبّع · تقييم · قوائم · فنّ العمل | `title/*` | **v1 — يُبنى أوّلاً** (أكبر إعادةِ استعمال، وأداؤه مقيس) |
| الشخص | `/person/[id]` | TMDB | متابعة فنّان | `person/{id}` (**مع حدٍّ للقائمة — `0038`**) | v1 |
| الترايلرات | `/trailers` | `trailers.ts` (SHARE) | إشارات | `trailers` | v1 |
| المكتبة والقوائم والقوائم الذكية | `/library` · `/lists` · `/lists/[id]` | `data.ts` | 35 استدعاءً | `me/library` · `lists/*` | **v1** |
| متتبّع الحلقات | داخل `/show` | `/api/season` | 5 أفعال | `title/tv/{id}/season/{n}` + أفعال التتبّع | **v1** |
| التقييمات والمراجعات | `/ratings` · `/review/...` | `data.ts` | rating/reply/report | `ratings/*` | v1 |
| النشاط والأشخاص | `/activity` · `/people` · `/u/[username]` · `/u/.../stats` | `myActivity` · `people` | متابعة/طلب/حظر | `feed` · `people/*` · `users/{username}` | v1 |
| التقويم والإحصائيات | `/calendar` · `/stats` · `/statistics` · `/reports` | `calendar` · `periodStats` · `reports` (**SHARE**) | — | `me/calendar` · `me/stats` | v1 (المنطق مشترك — رخيص) |
| الملف والإعدادات الأساسيّة | `/profile` · `/profile/edit` · settings: appearance/content/home/privacy/notifications | `data.ts` | `updateProfile` + prefs | `me/*` | v1 (المظهر واللغة **محلّيّان** في التطبيق) |
| الحوار والغرف والمنشورات | `/talk/...` · `/post/[key]` | `talkBulletins` | 10+ أفعال | — | **v1.1** |
| الرسائل والمشاركات | `/messages` | Realtime (`usePoll`) | shares/replies | — | **v1.1** (Realtime من التطبيق مباشرةً تحت RLS، كما الويب) |
| المجتمعات | داخل talk/people | — | join/invite/… | — | v1.1 |
| الاستيراد | `/profile/settings/import` + Trakt OAuth | ملفات + `/api/trakt/*` | `applyImportChunk`… | — | **ويب فقط في v1** (رابطٌ يفتح الويب) |
| الشريك · التوثيق · الدعوات | `settings/verify` · `invites` · `/p/[code]` · `/join/[code]` | — | — | — | ويب فقط (روابطُ عميقة تُفتح في التطبيق حين يوجد — §٧) |
| الإدارة | `/admin/*` (3) | `am_admin` | Server Actions | — | **ويب فقط، أبداً** |
| Plus والفوترة | `/plus` · `settings/billing` | — | — | — | **مالك**: الشراء داخل التطبيق يخضع لقواعد المتاجر (IAP) — قرارُ منتَجٍ لا هندسة |
| القانونيّة والتسويق | `/terms` · `/privacy` · `/features` | — | — | — | تُفتح من التطبيق كروابط ويب |
| الدخول | `/login` (GIS + احتياطُ التحويل) | — | — | — | **v1**: Google الأصليّ ⇢ `signInWithIdToken` (نفس الدالّة التي يستعملها الويب — Phase 1 §16.1) |

**لا صفحةَ ويبٍ تُترجم سطراً بسطر** (قرارُ الخطّة §9): الجدول يقول أيَّ منطقٍ يُشارك وأيَّ بابِ API يُفتح، والواجهة تُبنى بعناصر RN وفق العائلات السبع.

---

## ٧. قرارات التطبيق — من قائمة `AUDIT_PLAN` §9 (بند بند)

| القرار | المقترح | السبب في سطر | من يقرّر |
|---|---|---|---|
| SDK وNew Architecture | أحدثُ Expo SDK مستقرٌّ يومَ البدء؛ New Architecture مفعّلة (الافتراضي) | لا مكتبةَ أصليّةً قديمةً تمنع | Claude (يُسجَّل الإصدار عند البدء) |
| Router | Expo Router بنفس شجرة الويب | إعادةُ استعمال المسارات والروابط العميقة | Claude |
| Universal Links / App Links (`0013`) | `public/.well-known/apple-app-site-association` + `assetlinks.json` في الويب — **تغييرُ ويبٍ صغير يُنفَّذ قبل التطبيق** | يحتاج Team ID وبصمةَ توقيع Android | **مالك** (المعرّفات) · Claude (الملفّان) |
| OAuth | Google الأصليّ ⇢ `idToken` ⇢ `supabase.auth.signInWithIdToken` — يحتاج **معرّفَي عميلٍ iOS وAndroid** في Google Cloud بجانب معرّف الويب الحالي | نفسُ مسار الويب الأساسي؛ لا WebView للدخول | **مالك** (Google Cloud) |
| حفظ الجلسة | `expo-secure-store` (رموزٌ فقط) | الرموز حسّاسة؛ التفضيلات ليست كذلك | Claude |
| Deep links | `https://loopztv.com/...` (Universal) + `loopz://` كاحتياط | الروابطُ الحاليّة (`/show/1399` · `/u/x` · `/p/CODE`) تعمل كما هي | Claude |
| Offline cache | كاشُ قراءةٍ (TanStack Query persist إلى AsyncStorage) + طابورُ كتاباتٍ يعادل `offline.ts`؛ **لا صورَ في الكاش** إلا ما يخزّنه `expo-image` بحدّه | يعادل SW بلا SW | **مالك** لحجم الكاش وما يبقى بلا شبكة |
| App lifecycle | `AppState` لتجديد الرمز وإيقاف Realtime في الخلفيّة | استهلاكُ بطّاريّة وشبكة | Claude |
| الصور والفيديو | `expo-image` عبر `/i/` · WebView لليوتيوب | §٥.٤ | Claude |
| Push notifications وBackground tasks | **خارج v1** — لا مرسِلَ اليوم (D-462) والقاعدة لا تحمل tokens أجهزة | ميزةٌ خلفيّةٌ كاملةٌ جديدة (جدول + Migration + مرسِل) | **مالك** (متى ولماذا) |
| App identifiers | مقترح `com.loopztv.app` (iOS وAndroid) | يطابق النطاق | **مالك** — لا يُغيَّر بعد أوّل رفعٍ للمتجر |
| EAS environments | `development` · `preview` · `production` — **و`preview` يشير إلى بيئة Supabase المعزولة (`0006`) لا الإنتاج** | نفسُ مبدأ Phase 1 §17 | **مالك** (`0006` أوّلاً) |
| Build / Update / Submit | EAS Build للأصلي · EAS Update للـJS · EAS Submit للمتاجر | المسارُ القياسي | Claude ينفّذ، **مالك** يملك الحسابات |
| OTA policy | تحديثُ JS فقط عبر EAS Update لإصلاحاتٍ لا تمسّ الأصلي؛ أيُّ تغييرٍ أصليّ = إصدارُ متجر؛ **قناةٌ لكلّ إصدار runtime** | ما تسمح به المتاجر | Claude |
| Crash reporting | مرشَّح: Sentry (`@sentry/react-native` عبر Expo config plugin) **مع إسقاط IP والمعرّفات** كما تشترط قواعدُ القياس الحاليّة | لا بديلَ لتشخيص الأعطال الأصليّة | **مالك** (تكلفة ومزوّد) |
| Privacy manifests | `PrivacyInfo.xcprivacy` تولّده Expo لوحداتها؛ **إقرارُ جمع البيانات في App Store Connect/Play Console يكتبه المالك** من `PHASE_6_DATA_PRIVACY.md` | إلزاميّ للمتاجر | **مالك** |
| TestFlight / Internal testing | قناتان داخليّتان قبل أيّ نشر عام؛ اختبارُ iPhone الفعلي للمالك (كما D-882) | — | مالك |
| RTL | `I18nManager.forceRTL(locale==='ar')` + إعادةُ تشغيلٍ عند تغيير اللغة؛ **الاختبار في الاتّجاهين شرطُ الإنجاز كما في الويب** | قاعدةُ المشروع 5 | Claude |
| التصميم | tokens من `themes.ts` + `StyleSheet` — **لا NativeWind** | سبعُ عائلاتٍ فقط؛ الأداةُ تضيف طبقةً بلا حاجة | Claude (يعكسه المالك إن أراد) |
| القوائم | `FlashList` (مرشَّح) أو `FlatList` مع `windowSize` | `0038` | Claude |
| Sheet | `@gorhom/bottom-sheet` (مرشَّح — يُتحقَّق من توافق New Architecture عند البدء) | Sheet واحد للعائلة | Claude |

---

## ٨. ما يحتاج المالك — قبل وأثناء

**أ) قبل الـGO (بوّابة المرحلة 11):**
1. **`0006`** — مشروعُ Supabase ثانٍ للـPreview/الاختبار (الخطّة المجانيّة تكفي) + حسابا اختبار. **كلُّ ما يليه معلّقٌ عليه.**
2. **`0040`** — بعد (1): جردٌ آمن ⇢ حراسة ⇢ مراجعةُ وراثة PUBLIC/authenticated ⇢ SQL يشغّله المالك ⇢ تحقّقٌ في البيئة المعزولة.
3. قياساتُ Web Vitals ميدانيّة + البوّابة البصريّة (15 بنداً) من أجهزةٍ حقيقيّة (Phase 4 §موانع).
4. `0005` حذفُ جدول النسخة القديمة (SQL).

**ب) قرارات هذه المرحلة (كلٌّ منها سطر):**
1. مستودعٌ واحد بـnpm workspaces (§٥.١) — يمسّ `Root Directory` في Vercel.
2. نطاقُ v1 كما في §٦ (وخاصّةً: الرسائل/الحوار في v1.1، الاستيراد والشريك ويب فقط، Plus قرارُ IAP).
3. المعرّفات: `com.loopztv.app` · Team ID · معرّفا Google iOS/Android.
4. مزوّدُ الأعطال وحجمُ الأوفلاين.

**ج) ما لا يحتاجه المالك (ينفَّذ داخل الصلاحية بعد الـGO أو قبله حيث لا يمسّ الإنتاج):** `src/core/` + قاعدةُ ESLint (§٥.٢) · `contracts` · استخراجُ المنطق دومين بدومين · `/api/v1` · ملفّا `.well-known` (بعد المعرّفات) · إصلاحُ `0024`/`0025`/`0028`/`0034`/`0038` في الويب قبل نسخِها.

---

## ٩. ترتيب البناء (بعد الـGO)

| # | الخطوة | يُنجز حين | حدُّ الأمان |
|---|---|---|---|
| 0 | **المتطلّبات:** `0006` · `0040` · `0001` (مشغّلُ اختباراتٍ على `core` — **أوّلُ اختباراتٍ في المستودع تُكتب لما سيُشارك**) · `0004` (`engines` + `packageManager`) | بوّابة 11 خضراء | — |
| 1 | `src/core/` + ESLint حدود (§٥.٢) — نقلُ 85 ملف SHARE بلا تغيير سلوك | `tsc` · `eslint` · `next build` · **مقارنةُ ناتج البناء** | لا تغييرَ تشغيل |
| 2 | استخراجُ المنطق من `actions.ts`/`data.ts` إلى `core` **دومين بدومين** بالترتيب: تتبّع ⇢ قوائم ⇢ تقييم ⇢ اجتماعي ⇢ ملف؛ الأغلفة القديمة تبقى بنفس التوقيع | اختباراتُ `core` + اختبارُ الويب اليدوي لكلّ دومين | نقطةُ رجوعٍ لكلّ دومين |
| 3 | `contracts` + `/api/v1` (§٤.٣) — بدءاً بـ`title/*` و`me/*` | اختبارٌ بـBearer من حسابِ اختبارٍ في البيئة المعزولة | لا يمسّ مسارات الويب |
| 4 | ويب: `.well-known` (`0013`) · إصلاحُ `0024`/`0025` (سُلّمُ الزوايا والمقاسات) قبل استخراج tokens · `0028`/`0034`/`0038` | البوّابات الثلاث + RTL/LTR + daylight | — |
| 5 | Workspace: `apps/web` · `apps/mobile` · `packages/core` — Vercel Root Directory | نشرُ الويب من الجذر الجديد ومطابقةُ `/api/build` | **إعدادُ Vercel للمالك** |
| 6 | هيكلُ Expo: الدخول (Google أصلي ⇢ Supabase) · SecureStore · Router · tokens · i18n/RTL · **العائلات السبع** بـRN | تشغيلٌ على iPhone المالك (Development build) | — |
| 7 | الشاشات بترتيب §٦: **العمل أوّلاً** ⇢ اكتشاف/بحث ⇢ مكتبة/متتبّع ⇢ نشاط/أشخاص ⇢ ملف/إعدادات ⇢ تقويم/إحصائيات | كلُّ شاشةٍ: ar/en · RTL/LTR · light/dark · offline | — |
| 8 | TestFlight + Internal testing · قناةُ EAS Update · سياسةُ OTA (§٧) | اختبارُ المالك | — |
| 9 | v1.1: الرسائل (Realtime) · الحوار · المجتمعات | بعد استقرار v1 | — |

**مدّةٌ لا تُقدَّر هنا** — الخطّة لا تطلبها، وتقديرُها بلا فريقٍ محدّدٍ تخمين.

---

## ١٠. ما لم يُفعل في هذه المرحلة — صراحةً

- لم يُثبَّت Expo ولا أيُّ حزمةٍ من §٣/§٧؛ أحكامُ التوافق من الوثائق لا من تجربة.
- لم تُقَس أرضيّةُ JS للتطبيق (لا تطبيق).
- لم تُكتب أيُّ نقطة `v1`؛ §٤ تصميمٌ يُنفَّذ في الخطوة 3.
- لم تُحلّ `0008` — **حالتُها تصبح `DESIGN_APPROVED_PENDING_OWNER` عند اعتماد المالك لـ§٤، وتُغلق مع الخطوة 3.**
- `0013` تبقى `TODO` (تحتاج معرّفات المالك).
- تحديثُ ملفّات المشروع (`04/05/06/07/18/19`) **مؤجَّلٌ بأمر المالك** («أجل تحديث الملفات»).

---

## ١١. D-897 — الخطوة 1 نُفِّذت على `main` `61cb418` (20:27:03 UTC) · وتصحيحُ §٢.١

**المالك:** «تمام أكمل» ⇢ اختيرت الخطوةُ 1 من §٩ لأنّها تطبيقٌ خالص لا ينتظر الـGO ولا يمسّ الإنتاج.

**انحرافٌ مُعلَن عن §٥.٢:** لا نقلَ لملفّات — مسارُ النشر (رفعُ GitHub عبر المتصفّح) لا ينقل ولا يحذف؛ النقلُ الفعليّ مع خطوة workspaces (§٩-5). ما شُحن هو **الحدُّ نفسُه**: كتلةُ override واحدة في `eslint.config.mjs` — 69 ملفّاً مشتركاً في `src/lib` تحت `@typescript-eslint/no-restricted-imports` (error) بمجموعتين: (١) `next`/`next/*`/`react-dom`/`server-only`/`@/components/*`/`@/app/*`/`@/lib/supabase/*`؛ (٢) كلُّ وحدةِ `lib` تبقى خلف الـAPI (49 وحدة، بالهجاءين `@/lib/x` و`./x`). `allowTypeImports: true` (استيرادُ الأنواع يُمحى عند التجميع). نقطةُ الرجوع `e254b2f`. البوّابات: `tsc 0` · `eslint 0/15` · `build ✓` · **اختبارٌ سلبيّ:** حقنُ `import { cookies } from "next/headers"` في ملفٍّ مشترك ⇢ القاعدةُ تُطلق الخطأ (ثمّ أُزيل). `/api/build == 61cb418` (≈20:29 UTC من متصفّح المالك). الدليل `evidence/D-897-gates-61cb418.txt` + `evidence/P9-closure-e254b2f.py`.

**تصحيحُ §٢.١ — خطئي، اكتُشف بفرض الحدّ:** المصنِّف فحص العلاماتِ الخارجيّةَ فقط ولم يفحص (أ) الاستيرادَ بين ملفّات `src/lib`، (ب) `import "server-only"` بلا `from`. النتيجة: **16 من الـ85 ليست مشتركةً اليوم** —

| | ملفّات | أسطر | لماذا |
|---|---:|---:|---|
| تستورد **قيماً** من وحدات خادم (`data`/`tmdb`/`omdb`/`titleAliases`/`locale`/`site`) أو حزمةَ خادم | 14: `artists` · `libState` · `librarySmart` · `localize` · `news` · `periodStats` · `reports` · `sections` · `seo` · `smartLists` · `suggest` · `titleNews` · `topChart` · `trailers` | 4,729 | هي «التنسيقُ خلف الـAPI» الذي يفترضه §٤ أصلاً — تبقى على الخادم |
| تعلن `import "server-only"` | 2: `appleTrailers` · `xLink` | 189 | خادميّة بالتصريح |

**المصفوفةُ المصحَّحة (118 · 39,939):** **SHARE 69 / 14,874 · SERVER 32 / 22,806 · REWRITE 16 / 2,204 · DROP 1 / 55.**
**حوافُّ باقيةٌ داخل الـ69 (مُعلَنة، مسموحةٌ بالقاعدة):** 8 ملفّات تستورد **أنواعاً فقط** من وحداتِ خادم/مكوّنات (`calendar` · `libraryStatus` · `newsLine` · `progress` · `recommend` ⇢ أنواعُ `data`/`tmdb`؛ `features` · `homePrefs` · `profilePrefs` ⇢ `IconName` من `components/Icon`) — تُفصَل إلى أنواعِ core قبل النقل الفعليّ؛ و`siteOrigin.ts` يقرأ `process.env.NEXT_PUBLIC_SITE_URL` (Expo يقرأ `EXPO_PUBLIC_*` — محوِّلُ سطرٍ لاحقاً).
**ما لا يتغيّر بالتصحيح:** تصميمُ الـAPI (§٤) والبنية (§٥) ومصفوفةُ الميزات (§٦) وترتيبُ البناء (§٩).
