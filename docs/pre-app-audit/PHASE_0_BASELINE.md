# Phase 0 — Baseline

- الحالة: `READY_FOR_REVIEW`
- المنفّذ: Claude
- التاريخ: 2026-09-01 UTC
- النطاق: جرد وتثبيت نقطة الرجوع فقط. **لم يُعدَّل أي سطر من كود التطبيق، ولم يُمسّ `main`.**
- طريقة الجمع: `git clone` للقراءة فقط + قراءة الملفات + استعلامات metadata للقراءة فقط.
- لم تُنفَّذ أي عملية كتابة على GitHub خارج فرع `docs/pre-app-audit`، ولا أي عملية كتابة على Supabase أو Vercel.

---

## 1. نقطة الرجوع — رأس `main`

| الحقل | القيمة |
|---|---|
| SHA | `64bd1d41851c0cc05f93a8444eaadd41d47f9108` |
| المختصر | `64bd1d41` |
| التاريخ | 2026-09-01T01:03:35Z (04:03:35 +03) |
| المؤلف | mccicc2-art |
| الرسالة | `D-852: صفّا الإعدادات يُشتقّان من سجلّ الجولات [deploy]` |
| عدد commits على main | 2907 |
| حجم `.git` | 9.6 MB |

آخر ثلاثة commits قبله: `36787c25` ← `730dc3cd` (كلاهما D-852، بلا `[deploy]`).

**هذه هي نقطة الرجوع المعتمدة لكامل التدقيق.**

---

## 2. حالة الفروع

14 فرعاً على origin. المقارنة `origin/main...origin/<branch>`:

| الفرع | خلف main | أمام main | آخر commit | التصنيف |
|---|---:|---:|---|---|
| `main` | 0 | 0 | 2026-09-01 | نقطة الرجوع |
| `docs/pre-app-audit` | 11 | 7 | 2026-09-01 | فرع التنسيق (هذا العمل) |
| `mccicc2-art-patch-1` | 320 | **4** | 2026-08-29 | ⚠️ **غير مصنَّف** |
| `fix/ios-perf-probe-standalone-gate` | 948 | **1** | 2026-08-21 | ⚠️ **غير مصنَّف** |
| `codex/trailer-stability-20260828` | 397 | 0 | 2026-08-28 | مدموج/متجاوَز |
| `d771` | 305 | 0 | 2026-08-29 | مدموج/متجاوَز |
| `d772` | 301 | 0 | 2026-08-29 | مدموج/متجاوَز |
| `trailers-rebuild` | 354 | 0 | 2026-08-28 | مدموج/متجاوَز |
| `rollback-2026-08-28-7c4b900` | 379 | 0 | 2026-08-28 | لقطة رجوع |
| `stable-2026-08-19-perf` | 1085 | 0 | 2026-08-19 | لقطة |
| `checkpoint-2026-08-19-pre-launch-round` | 1039 | 0 | 2026-08-20 | لقطة |
| `checkpoint-2026-08-20-pre-perf-round` | 982 | 0 | 2026-08-20 | لقطة |
| `checkpoint-2026-08-23-pre-perf-audit` | 851 | 0 | 2026-08-23 | لقطة |
| `checkpoint-2026-08-25-pre-provider-links` | 722 | 0 | 2026-08-25 | لقطة |

### التغييرات غير المصنَّفة (المطلوب حسمها قبل Phase 1)

**أ. `mccicc2-art-patch-1` — 4 commits ليست في `main`:**
```
94a455b7 2026-08-29 trailer-lab: 28 tests — snd=1 page, no-pause surface, sound carried on foreground
c53c8cb7 2026-08-29 D-771: cleanup — drop the transitional pause members (D-028)
b909a62a 2026-08-29 D-771: sound-on default (his reversal of D-726) + drop dead pause key
b962af35 2026-08-29 D-771: feed drops the pause label — surface only reveals controls
```
**ب. `fix/ios-perf-probe-standalone-gate` — commit واحد ليس في `main`:**
```
ab95ca8c 2026-08-21 fix perf probe visibility in iOS standalone PWA
```

مطلوب من ChatGPT قرار لكل منهما: `مهجور` / `يُدمج ضمن التدقيق` / `مؤجَّل`. لا أحذف ولا أدمج شيئاً قبل قراره.

**ج. عشرة فروع لقطات/rollback بصفر commits أمام main** — مرشّحة للتنظيف في Phase 7 لا الآن.

**د. `audit/integration` غير موجود بعد** — يُنشأ عند أول `VERIFIED`.

**هـ. `docs/pre-app-audit` متأخّر 11 commit عن `main`** — لا أثر له على ملفات التوثيق، لكنه يعني أن أي Diff من هذا الفرع نحو `main` سيُظهر ضجيجاً. مقترح: rebase أو تحديث الفرع قبل بدء فروع الإصلاح.

---

## 3. الإصدارات

مصدر الأرقام: `package-lock.json` (lockfileVersion 3، 459 حزمة محلولة) — لا تخمين من نطاقات `^`.

| الحزمة | المُعلَن في package.json | المحلول في lockfile |
|---|---|---|
| next | `16.3.0` | **16.3.0** |
| react | `19.2.4` | **19.2.4** |
| react-dom | `19.2.4` | **19.2.4** |
| typescript | `^5` | **5.9.3** |
| tailwindcss | `^4` | **4.3.3** |
| @tailwindcss/postcss | `^4` | **4.3.3** |
| eslint | `^9` | **9.39.5** |
| eslint-config-next | `16.2.12` | **16.2.12** |
| @supabase/supabase-js | `^2.111.0` | **2.111.0** |
| @supabase/ssr | `^0.12.4` | **0.12.4** |
| @vercel/speed-insights | `^2.0.0` | **2.0.0** |
| fast-xml-parser | `^5.10.1` | **5.10.1** |
| @types/node | `^20` | **20.19.43** |
| @types/react | `^19` | **19.2.18** |
| @types/react-dom | `^19` | **19.2.4** |

### Node.js
- **لا يوجد حقل `engines` ولا `packageManager` في `package.json`** — إصدار Node غير مثبَّت في المستودع، والمرجع الوحيد هو إعداد Vercel.
- بيئة التنفيذ التي جُمعت منها هذه الأدلة: Node **v22.22.2**، npm **10.9.7**.
- ⚠️ **مرشّح مشكلة (P3):** عدم تثبيت Node يعني أن البناء المحلي والبناء على Vercel قد يختلفان صامتاً. الحسم في Phase 8.

### ملاحظات إصدارات
- ⚠️ **مرشّح مشكلة (P3):** `eslint-config-next@16.2.12` أقدم من `next@16.3.0`. غير مطابق للتوصية الرسمية بمزامنة الاثنين، وقد يُسقِط قواعد lint جديدة.
- `@types/react-dom@19.2.4` و`react-dom@19.2.4` متطابقان — سليم.
- Postgres على Supabase: **17.6.1.155** (engine 17، قناة ga).

---

## 4. Scripts المتاحة

من `package.json`:

| Script | الأمر | الغرض |
|---|---|---|
| `dev` | `next dev` | تشغيل محلي |
| `build` | `next build` | بناء الإنتاج |
| `start` | `next start` | تشغيل المبني |
| `lint` | `eslint` | فحص |

**لا يوجد script للاختبار، ولا أي مشغّل اختبارات في `devDependencies`** (لا jest ولا vitest ولا playwright ولا cypress).

> ⚠️ **حقيقة تشغيلية يجب أن يبني عليها التدقيق:** «الاختبارات» في هذا المشروع تعني اليوم ثلاثة أشياء فقط:
> 1. `npx tsc --noEmit`
> 2. `npx next build`
> 3. رحلات يدوية في المتصفح.
>
> أي معيار قبول يطلب «نجاح الاختبارات» يجب أن يُصاغ بهذه الأدوات، أو أن تُسجَّل مهمة مستقلة لإدخال مشغّل اختبارات (وهي **ميزة جديدة** خارج نطاق التدقيق حسب القواعد — قرارها لـ ChatGPT).

**أدوات إضافية خارج npm scripts:**
- `scripts/test-session-cookie.mjs` — فحص كوكي الجلسة.
- `scripts/trailer-lab/run.mjs` + `README.md` — مختبر الترايلر (يستخدم `LAB_REPO` و`LAB_CHROMIUM`).

### نتيجة البناء الأساسية (baseline gates)
- `npm ci` — **نجح** (exit 0).
- `npx tsc --noEmit` على `64bd1d41` — **نجح، صفر أخطاء** (exit 0).
- `npx next build` على `64bd1d41` — **نجح، صفر تحذيرات** (exit 0). `✓ Compiled successfully in 35.9s`، و`✓ Generating static pages (58/58) in 1157ms`، و**81 مسار** في جدول البناء.
  - شُغِّل بقيم بيئة **نائبة** (`NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-not-a-real-key`) — لا أملك قيماً حقيقية ولا يجوز أن أملكها. لذلك هذا يثبت **سلامة الترجمة والتوليد الثابت**، ولا يثبت سلوك البيانات الحيّة.
  - **المرجع النهائي للبناء يبقى Preview deployment على Vercel، لا جهازي.**

---

## 5. البيئات (أسماء فقط — بلا أي قيمة سرية)

| البيئة | الوصف | الحالة |
|---|---|---|
| Local | `.env.example` هو العقد؛ `.env*` مستبعَد في `.gitignore` | متاح |
| Preview | Vercel — فروع غير `main` | متاح، وهو المكان الوحيد المسموح فيه باختبارات الأمن النشطة |
| Production | `https://loopztv.com` + `https://meshahed.vercel.app` | **مجمَّد حتى بوابة GO** |
| Staging | — | **غير موجود** |

> ⚠️ قاعدة `AUDIT_PLAN` تقول «التغييرات القابلة للرجوع تُختبر على Staging أولاً»، و**لا Staging في المشروع**. عملياً: Preview هو البديل الوحيد، وقاعدة بيانات واحدة فقط (Production) تخدم كل البيئات. **هذا قيد جوهري على Phase 5 وPhase 6: لا اختبار أمنٍ نشط يكتب في قاعدة البيانات.** مطلوب قرار من ChatGPT.

### أسماء متغيرات البيئة المرجعية في الكود (بلا قيم)
`NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `NEXT_PUBLIC_SITE_URL` · `NEXT_PUBLIC_GOOGLE_CLIENT_ID` · `TMDB_API_KEY` · `TRAKT_CLIENT_ID` · `TRAKT_CLIENT_SECRET` · `GEMINI_API_KEY` · `GEMINI_MODEL` · `OMDB_API_KEY` · `DEEPL_API_KEY` · `GIPHY_API_KEY` · `LAB_REPO` · `LAB_CHROMIUM` · (من المنصّة: `NODE_ENV`، `VERCEL_GIT_COMMIT_SHA`).

### فجوة `.env.example` — مرشّح مشكلة (P2)
ستة أسماء تُقرأ في الكود ولا تظهر في `.env.example`:
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` · `OMDB_API_KEY` · `DEEPL_API_KEY` · `GIPHY_API_KEY` · `LAB_REPO` · `LAB_CHROMIUM`.

الأثر: من يجهّز بيئة محلية من الملف وحده يحصل على تطبيق ناقص بصمت. الإصلاح توثيقي بحت وبلا خطر.

### نظافة الأسرار — فحص أوّلي (سطحي)
- لا ملف `.env` ولا `.pem` ولا `.key` ولا أي ملف باسم credential/secret **متتبَّع في Git**.
- `.gitignore` يستبعد `.env*` و`*.pem`.
- `.env.example` متتبَّع ويحوي **قيماً نائبة فقط** — تُحقّق بفحص الشكل والطول لا بطباعة القيم؛ لم تُطبع أي قيمة في أي مخرَج.
- ⚠️ **هذا فحص للحالة الراهنة فقط، لا لتاريخ Git.** مسح تاريخ الـ2907 commit وفحص Secret Scanning يبقى ضمن **Phase 5** ولا يُعتبر مُنجزاً هنا.

---

## 6. آخر Deploy معروف

- `vercel.json` يحوي:
  `ignoreCommand: case "$VERCEL_GIT_COMMIT_MESSAGE" in *"[deploy]"*) exit 1;; *) exit 0;; esac`
  أي أن **البناء لا يُطلَب إلا للـcommit الذي تحمل رسالته `[deploy]`** (حارس تكلفة D-840).
- المنطقة: `regions: ["bom1"]`.
- آخر commit موسوم `[deploy]` على `main` هو **`64bd1d41` — وهو رأس `main` نفسه**، أي أن أحدث نسخة مطلوبة للنشر تطابق نقطة الرجوع.
- آخر ثمانية commits موسومة `[deploy]`: `64bd1d41` (D-852) · `ed358dd8` (D-850) · `9046288e` (D-848) · `a7e555ca` و`630ab92b` (D-847) · `74e7432d` و`789a7730` (D-846) · `9da4157f` (D-845).

### ⚠️ لم أستطع تأكيد حالة النشر الحيّة — سببان موثّقان
1. **Vercel MCP يرفض القراءة:** `list_deployments` على المشروع `meshahed` أعاد **403 Forbidden**، و`list_projects` على الفريق `mccicc2-arts-projects` أعاد قائمة فارغة. أي أن رمز الوصول المتاح لي لا يملك صلاحية قراءة عمليات النشر.
2. **`https://loopztv.com/api/build` محجوب عن أداة الجلب لديّ** بقاعدة robots.

النتيجة: «آخر deploy» أعلاه **مستنتَج من المستودع، غير مؤكَّد من المنصّة**. لا أدّعي أن Production تشغّل `64bd1d41`.

**مطلوب:** إما صلاحية قراءة Vercel، أو أن يتحقق ChatGPT بنفسه من مطابقة `loopztv.com/api/build` لرأس `main`.

---

## 7. Supabase — الخط الأساسي

| الحقل | القيمة |
|---|---|
| Project ref | `uvgmvrdrxzpudoldjxaa` |
| الاسم | meshahed |
| المنطقة | `ap-south-1` |
| Postgres | 17.6.1.155 (engine 17، ga) |
| الحالة | `ACTIVE_HEALTHY` |
| جداول `public` | **72** |
| RLS مفعّل | **72 من 72 (100%)** |

> **حدّ هذا الادّعاء بحرفه:** `rls_enabled = true` على كل الجداول المكشوفة. **هذا ليس ادّعاء أن السياسات صحيحة** — صحّة `USING`/`WITH CHECK` والملكية وViews وRPC وSECURITY DEFINER كلها **Phase 6** ولم تُفحص.

جداول ملفتة عند الخط الأساسي (لتوجيه المراحل اللاحقة لا للحكم الآن):
- `watched_episodes_backup_133` (3510 صفاً) — جدول نسخة احتياطية مكشوف في `public`؛ مرشّح لـ Phase 6/7.
- `runtime_errors` (1607 صفاً) — مصدر أدلة جاهز لـ Phase 2/8.
- جداول بصفر صفوف: `partners`, `partner_applications`, `partner_clicks`, `verification_requests`, `subscriptions`, `weekly_top`, `blocks`, `follow_requests`, وكل جداول `*_reports`. أي أن **مسارات Partner والاشتراك والإبلاغ والحظر بلا بيانات حقيقية** — اختبارها في Phase 2 يحتاج بيانات اختبار تُنشأ عمداً.

---

## 8. الأدوار وحسابات الاختبار المطلوبة

الأدوار مستخرجة من مخطط `public.profiles` (أسماء أعمدة فقط، بلا أي بيانات مستخدم):
`plan` · `plus_until` · `founder` · `is_admin` · `is_system` · `is_private` · `hide_follow_lists` · `verified_at` · `verified_kind` · `x_verified_at`.

| # | الدور | كيف يتحدد | مطلوب لـ |
|---|---|---|---|
| 1 | زائر (غير مسجّل) | لا جلسة | كل صفحة عامة، الروابط المباشرة |
| 2 | مجاني | `plan` افتراضي، `plus_until` منتهٍ أو فارغ | خط الأساس |
| 3 | Plus | `plus_until > now()` | فروق Plus، الجولات، الإحصائيات |
| 4 | Founder | `founder = true` | الشارات والامتيازات |
| 5 | Verified | `verified_at`/`verified_kind` | الشارة ومسار التوثيق |
| 6 | X-Verified | `x_verified_at` | شارة منفصلة |
| 7 | Admin | `is_admin = true` | عمليات الإشراف والتثبيت |
| 8 | System | `is_system = true` | حسابات النظام/القوائم المنسّقة |
| 9 | حساب خاص | `is_private = true` | العزل، طلبات المتابعة |
| 10 | Partner | جداول `partners`/`partner_applications` | مسار الشراكة (فارغ اليوم) |
| 11 | زوج A/B | حسابان مستقلان + `blocks` | اختبارات IDOR والعزل في Phase 5 |

### ⚠️ مانع تشغيلي على هذا البند
- **لا أعرف أي حسابات اختبار موجودة فعلاً**، ولم أستطع حتى عدّها: استعلام تجميعي للقراءة فقط على `profiles` (أعداد فقط، بلا أي بيانات) **رُفض من حاجز الأمان في بيئتي**.
- **ولا يجوز لي أصلاً تسجيل الدخول بحساب أحمد** ولا إدخال أي بيانات اعتماد — قاعدة ثابتة.
- المطلوب: أن يوفّر أحمد أو ChatGPT **حسابات اختبار مخصّصة** (لا حسابات حقيقية) تغطي الأدوار 2–11، أو أن يُصرّح بإنشائها على Preview.
- بدونها: **Phase 2 وPhase 5 لا يمكن تنفيذهما بالكامل.** هذا أهم مانع في التدقيق كله.

---

## 9. حجم المشروع (لتقدير المراحل)

| المقياس | العدد |
|---|---:|
| ملفات متتبَّعة | 668 |
| ملفات `src/` | 453 |
| ملفات `supabase/*.sql` | 173 |
| ملفات `public/` | 25 |
| `page.tsx` | 49 |
| `route.ts` (API) | 19 |
| `layout.tsx` | 1 |
| `loading` / `error` / `not-found` | 25 |
| `proxy.ts` (بديل middleware في Next 16) | 1 — `src/proxy.ts` |

جدول البناء يعدّ **81 مسار**، وجميعها ديناميكية (`ƒ`) عدا `/sitemap.xml` وقلّة ثابتة (`○`)؛ و`Proxy (Middleware)` مفعّل من `src/proxy.ts`.

مسارات API: `build` · `curated` · `franchise` · `genres` · `imdb-chart` · `lang-ping` · `news-gen` · `search` · `season` · `suggest` · `title-meta` · `trakt/callback` · `trakt/start`.

أكبر الملفات (مؤشّر لـ Phase 7 لا حكم): `src/lib/actions.ts` 264K · `src/lib/data.ts` 256K · `src/lib/i18n.ts` 212K · `src/app/news/page.tsx` 120K · `src/app/page.tsx` 116K · `src/app/u/[username]/page.tsx` 112K · `src/lib/tmdb.ts` 104K.

`tsconfig.json`: `strict: true`، `skipLibCheck: true`، target ES2017، alias `@/* → ./src/*`.

`next.config.ts` عند خط الأساس: CSP كاملة + HSTS + `X-Frame-Options: DENY` + `nosniff` + `Referrer-Policy` + `Permissions-Policy` + `COOP: same-origin-allow-popups` · `poweredByHeader: false` · محمّل صور مخصّص `src/lib/imageLoader.ts` · `qualities: [75]` · `deviceSizes` أقصاها 2048 · `minimumCacheTTL` شهر · `staleTimes` 180/300.
**ملاحظة مسجّلة للمرحلة 5 لا مشكلة الآن:** `script-src` يحوي `'unsafe-inline'`، والتعليق في الملف نفسه يقرّ بذلك ويؤجّل التشديد بـnonce.

---

## 10. الموانع

**لا شيء يمنع بدء التدقيق.** لا حالة `BLOCKED` — لم أواجه أياً من محفّزات التوقف الخمسة (حذف بيانات Production، migration تدميرية، سرّ مكشوف، هدف غير محدد، صلاحية جوهرية مفقودة تمنع العمل كلياً).

الموانع الجزئية المسجّلة، مرتّبة بالأثر:

| # | المانع | يمنع | المخرج |
|---|---|---|---|
| 1 | لا حسابات اختبار للأدوار 2–11 | Phase 2 و5 بالكامل | حسابات مخصّصة أو تصريح بإنشائها على Preview |
| 2 | لا Staging وقاعدة بيانات واحدة | اختبارات الأمن النشطة الكاتبة (Phase 5/6) | قرار: قراءة فقط، أو فرع Supabase، أو تصريح موثّق |
| 3 | Vercel MCP يرد 403 | تأكيد النشر والبناء (Phase 8) | صلاحية قراءة، أو يتحقق ChatGPT بنفسه |
| 4 | `loopztv.com` محجوب عن أداة الجلب لديّ | الفحص الحيّ للصفحات | استخدام المتصفح، أو يجلب ChatGPT |
| 5 | لا مشغّل اختبارات في المشروع | صياغة معايير القبول | اعتماد `tsc` + `next build` + رحلات يدوية كتعريف رسمي |
| 6 | فرعان بتغييرات غير مصنَّفة | نظافة نقطة الرجوع | قرار ChatGPT لكل فرع |

---

## 11. أوامر Read-only مقترحة لـ Phase 1

كلها قراءة محضة، لا تكتب ولا تنشر ولا تلمس Production:

**جرد المسارات**
```bash
find src/app -name 'page.tsx'   | sed 's|src/app||;s|/page.tsx||' | sort
find src/app -name 'route.ts'   | sed 's|src/app||;s|/route.ts||'  | sort
find src/app \( -name 'loading.tsx' -o -name 'error.tsx' -o -name 'not-found.tsx' -o -name 'global-error.tsx' \) | sort
grep -rn 'export const dynamic\|revalidate\|force-static' src/app --include=*.tsx --include=*.ts
```

**جرد الميزات وطبقة البيانات**
```bash
grep -rn 'use server' src/lib src/app --include=*.ts --include=*.tsx | wc -l
grep -rnoE '\.from\("[a-z_]+"\)' src/lib | sed -E 's/.*from\("([a-z_]+)"\).*/\1/' | sort | uniq -c | sort -rn
grep -rnoE '\.rpc\("[a-z_]+"' src | sed -E 's/.*rpc\("([a-z_]+).*/\1/' | sort | uniq -c | sort -rn
grep -rn 'createClient' src/lib --include=*.ts
```

**عوائق React Native (تمهيد Phase 9)**
```bash
grep -rn 'localStorage\|sessionStorage\|document\.\|window\.' src --include=*.tsx --include=*.ts | wc -l
grep -rln 'next/image\|next/link\|next/navigation' src | wc -l
grep -rn 'serviceWorker\|navigator\.' src --include=*.ts --include=*.tsx | head -40
```

**كود ميت مرشّح (إثبات فقط — بلا حذف)**
```bash
grep -rn 'TODO\|FIXME\|console\.log' src --include=*.ts --include=*.tsx | wc -l
git log --oneline -1 -- supabase/   # آخر migration
```

**Supabase — metadata فقط**
- `list_tables` (تم)
- `get_advisors type=security` و`type=performance` — **مقترح لـ Phase 5/6، غير منفَّذ الآن** لأنه خارج نطاق Phase 0.
- `list_migrations`

**Vercel — عند توفر الصلاحية**
- `list_deployments` · `get_deployment` · `get_deployment_build_logs`.

**لن أشغّل أي أمر يكتب، ولا `next build` على Production، ولا أي استعلام يقرأ بيانات مستخدمين حقيقية.**

---

## 12. إقرار

- ✅ لم أعدّل أي ملف في `src/` أو `supabase/` أو أي إعداد تطبيق.
- ✅ لم أدفع أي commit إلى `main`، ولم أفتح أي PR نحو `main`.
- ✅ لم أنشر أي Deploy، ولم أنشئ Preview.
- ✅ لم أكتب أي صفّ في قاعدة البيانات، ولم أشغّل أي DDL.
- ✅ لم تظهر أي قيمة سرّية ولا token ولا بيانات مستخدم في هذا الملف ولا في أي مخرَج.
- ✅ الكتابة الوحيدة كانت ملفات توثيق على فرع `docs/pre-app-audit`.

**المطلوب من ChatGPT:** مراجعة هذا الخط الأساسي، وحسم البنود 1–6 من جدول الموانع، وتسجيل أرقام `LOOPZ-AUD-XXXX` للمرشّحات الواردة أعلاه، ثم تسجيل مهمة Phase 1 بمعيار قبولها. **لن أبدأ Phase 1 قبل ذلك.**
