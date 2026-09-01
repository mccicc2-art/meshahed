# Phase 5 — Security & Protection Audit

**المستودع:** `mccicc2-art/meshahed` · **Audited SHA:** `f8a2b33cd036cffd1e7a0b9bc3e5ced0e19b8bfa`
**التاريخ:** 2026-09-01 · **المنهج:** `Static / Read-only / Passive` حصراً
**المنفّذ:** Claude · **المراجع:** ChatGPT

> ⚠️ **نسخة مُنقَّحة.** هذا مستودع **عامّ**، وصنفُ الثغرة **ما زال مفتوحاً**. فالتفاصيل التشغيلية — أسماء الدوالّ وتواقيعها وأجسامها وأوامر الصلاحيات وترتيب الاستدعاء — **ليست هنا**، وهي في قناة أحمد الخاصّة. **وما في هذا الملف تجميعٌ فئويّ آمن.**
>
> **وأقرّ:** نسخةٌ سابقة من هذا الملف (Commit `6977868`) نشرت تفصيلاً أوسع، بحجّة أن المسار الأخطر عولج. **والحجّة خاطئة** — عولج مسارٌ واحد **والصنف مفتوح**، فالتفصيل يبقى خريطةً لما لم يُعالَج. **نُقِّح، ولا يُعاد.**

---

## 0. قبل أي نتيجة — الحدود، وما لم أفعله

**سبب الحدود مسجَّل لا مفترَض:** لا بيئة بيانات معزولة ولا حسابات اختبار (`LOOPZ-AUD-0006`)، فكل فحصٍ نشطٍ يقع على Production بمستخدمين حقيقيين.

| فعلٌ محظور | هل وقع؟ |
|---|---|
| brute force · payloads هجومية نشطة | ❌ لم يقع |
| **أي `POST` كاتب · أي مسار كاتب** | ❌ لم يقع |
| **استدعاء أيّ دالّة قاعدة بيانات** | ❌ **لم يقع ولن يقع** — كل ما جرى قراءةُ بيانات وصفية (`pg_proc` · `pg_policy` · `pg_class` · `storage.buckets`) |
| رفع ملفات · تغيير بيانات · mass actions | ❌ لم يقع |
| تغيير كود أو حزم أو إعدادات GitHub/Vercel/Supabase | ❌ لم يقع |
| `npm audit fix` | ❌ لم يُشغَّل — `npm audit` قراءةً فقط |
| استخدام جلسة أحمد أو طلب بيانات اعتماد منه | ❌ لم يقع |
| **إظهار قيمة أي سرّ** | ❌ **صفر قيمة** — الأسماء والمواقع والأطوال والبصمات المختصرة فقط |

**مفردات الحالة:** `SOURCE_VERIFIED` (من المصدر أو البيانات الوصفية) · `PASSIVE_VERIFIED` (فحص حيّ آمن غير كاتب) · `BLOCKED_BY_TEST_ENV` · `NOT_APPLICABLE`. **ولا `PASS` غير مثبت.**

---

## 1. نموذج التهديد وحدود الثقة

| # | الحدّ | من ← إلى | ما يحرسه | الحالة |
|---|---|---|---|---|
| T1 | المتصفّح ← Next Server Components | كوكيز الجلسة · `src/proxy.ts` يجدّدها | جلسة Supabase | `SOURCE_VERIFIED` |
| T2 | المتصفّح ← Server Actions | فحص الأصل التلقائي في Next (لا `allowedOrigins` مخصّص) + حرّاس داخل كل فعل | 162 فعلاً | `SOURCE_VERIFIED` (يتّكئ على افتراض الإطار) |
| T3 | المتصفّح ← Route Handlers | جلسة + حدّ معدّل + تحقّق مدخلات (جدول Phase 4 §12.1) | 21 مساراً | `SOURCE_VERIFIED` |
| **T4** | **المتصفّح ← Supabase مباشرةً** | **RLS وحده** — بمفتاح `anon` المشحون لكل متصفّح | 71 جدولاً · 143 دالّة `SECURITY DEFINER` معروضة | 🔴 **`SEC-ALERT-01`** |
| T5 | الخادم ← الخدمات الخارجية | مفاتيح خادميّة لا تصل العميل | 11 عائلة | `SOURCE_VERIFIED` |
| T6 | المتصفّح ← التخزين | سياستا `storage.objects` + قيود الدلو | دلو `avatars` | `SOURCE_VERIFIED` |
| T7 | GitHub/Vercel · Cron | `pg_cron` داخل Postgres · بناء Vercel | وظيفة واحدة | `SOURCE_VERIFIED` جزئياً |

> **وأهمّ حدٍّ في التطبيق هو `T4`** — كما قالت Phase 1 §15 — **وهو الحدّ الذي وجدت فيه Phase 5 خللها الأكبر.**

---

## 2. الأسرار والمفاتيح — `SOURCE_VERIFIED`

### 2.1 الجرد

**أربعة عشر اسم متغيّر تُقرأ في الكود** — عشرة خادميّة وأربعة `NEXT_PUBLIC_*`.

| المفتاح | الطبقة | ملاحظة |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `NEXT_PUBLIC_SITE_URL` · `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | **عميل** | **معروضة للمتصفّح بحكم التصميم** — وهذا صحيح لهذه الأربعة تحديداً |
| `TMDB_API_KEY` · `OMDB_API_KEY` · `DEEPL_API_KEY` · `GIPHY_API_KEY` · `GEMINI_API_KEY` · `GEMINI_MODEL` · `TRAKT_CLIENT_ID` · `TRAKT_CLIENT_SECRET` | **خادم** | لا إشارة إليها في أي ملف عميل |
| `VERCEL_GIT_COMMIT_SHA` · `NODE_ENV` | منصّة | — |

### 2.2 🟢 `service_role` — **غير موجود إطلاقاً**

**صفر إشارة** إلى `SERVICE_ROLE` أو `service_role` في `src` و`next.config.ts` و`.env.example`.

> **الصياغة الدقيقة — وقد كانت أوسع مما يحتمله الدليل:** غيابُ المفتاح يعني **أنه لا يوجد تجاوزٌ لـRLS بمفتاح service-role في كود التطبيق**، وهو انضباطٌ حقيقيّ. **ولا يعني «لا مسار تطبيقيّ يتجاوز RLS إطلاقاً»** — فالتقرير نفسه يثبت أن دوالّ `SECURITY DEFINER` تتجاوزها، **وهي موضوع `LOOPZ-AUD-0040`**. صُحّحت بناءً على اعتراض المراجع.

### 2.3 قالب البيئة — لا سرّ فيه

| المفتاح | الطول | الإثبات البنيويّ | الحكم |
|---|---:|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 32 | نطاق `supabase.co` · **ولا يحوي مُعرّف المشروع الحقيقي** · وشكله نائب | **نائب** |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 22 | **ليس بشكل JWT** (لا `ey` ولا نقطتان) · وأقصر من مفتاح حقيقي بمراتب | **نائب** |
| `TMDB_API_KEY` | 20 | **ليس 32 خانة ستّ عشرية** كما هو مفتاح TMDB v3 | **نائب** |
| `NEXT_PUBLIC_SITE_URL` | 21 | `http://localhost:3000` بالضبط | **قيمة تطوير** |
| `TRAKT_CLIENT_ID` · `TRAKT_CLIENT_SECRET` · `GEMINI_API_KEY` · `GEMINI_MODEL` | 0 | فارغة | — |

**ولم تُطبع قيمةٌ واحدة** — الفحص بالأطوال والأنماط وبصمات `sha256` مقتطعة.

### 2.4 مسح تاريخ Git — **14,893 كائناً**

فُحص **كل blob في `git rev-list --objects --all`** (باستثناء الصور والوسائط و`package-lock.json`) بأنماط: JWT (`eyJ…`) · Google `AIza…` · GitHub/Slack tokens · AWS `AKIA…` · ترويسة مفتاح خاصّ.

**النتيجة: صفر إصابة.** ولم يُضَف إلى المستودع في تاريخه كلّه ملفُّ بيئةٍ غير `.env.example`.

### 2.5 الفجوة

**`LOOPZ-AUD-0002` مؤكَّد:** أربعة من المفاتيح المقروءة غائبة عن `.env.example` (`OMDB_API_KEY` · `DEEPL_API_KEY` · `GIPHY_API_KEY` · `NEXT_PUBLIC_GOOGLE_CLIENT_ID`). **فجوةُ إعدادٍ لا فجوةُ سرّ.**

---

## 3. الدخول والجلسات — `SOURCE_VERIFIED`

| البند | النتيجة | الدليل |
|---|---|---|
| المزوّد | **Google وحده** — لا كلمة مرور في المشروع | Phase 1 §16 |
| كوكيز الجلسة | **`sameSite: "lax"` · `secure: true` · `path: "/"` صريحةً لا افتراضاتِ مكتبة** | `supabase/server.ts:20` · `proxy.ts:122` |
| تجديد الجلسة | في `src/proxy.ts` (بديل middleware في Next 16) | Phase 1 §16 |
| **`safeNext()`** | يرفض ما ليس مساراً نسبياً · ويحجب `//` و`\` و`^/<scheme>:` | `auth/callback/route.ts:10–16` |
| **قائمة الأصول** | **مغلقة بأسمائها** (نطاقان)، والأصل الغريب يُرَدّ إلى النطاق القانونيّ | `lib/siteOrigin.ts` |
| الخروج | **`POST` فقط** + مقارنة ترويسة `origin` | `auth/signout/route.ts` |
| كوكي `trakt_state` | `httpOnly` · `secure` · `sameSite=lax` · 600s — **حارس CSRF لتدفّق OAuth** | `api/trakt/start/route.ts:25–27` |
| **استعادة/تغيير كلمة المرور · تغيير البريد · CAPTCHA · «خروج من كل الأجهزة»** | **`NOT_APPLICABLE`** — لا وجود لها في المشروع | Phase 1 §16 |
| تنبيه Supabase `auth_leaked_password_protection` | **`NOT_APPLICABLE`** — لا كلمات مرور أصلاً | مستشارو Supabase |

### 🟡 `S-01` — **P3** · حارس CSRF في `/auth/signout` يسقط عند غياب الترويسة

**الدليل:** `if (origin && origin !== self)` — **فالطلب بلا ترويسة `origin` يمرّ.**
**الأثر:** خروجٌ قسريّ فقط — **لا كتابة بيانات ولا وصول إليها**. **ومخفَّف فعلياً** بأن كوكي الجلسة `sameSite=lax` فلا تُرسَل مع `POST` من موقع آخر، فالهجوم لا يجد جلسةً أصلاً.
**معيار القبول:** رفض الطلب عند غياب `origin` أيضاً، أو الاكتفاء بـ`sec-fetch-site: same-origin`.

### 🟡 `S-02` — **P3** · حدّ المعدّل محلّيٌّ لكل نسخة، لا موزّع

**الدليل:** `lib/ratelimit.ts` — خريطة في ذاكرة العملية. **والملفّ نفسه يقرّ بذلك في أول سطرين ويقترح مخزناً خارجياً.**
**الأثر:** على Vercel تتعدّد النسخ، **فالحدّ الفعليّ = الحدّ × عدد النسخ**. يحمي حصّة TMDB من مستخدمٍ واحدٍ ساذج، **ولا يصمد أمام موزَّعٍ متعمّد**.
**معيار القبول:** مخزن حدٍّ مشترك (Upstash أو ما يعادله) للمسارات الحسّاسة، أو قبولٌ موثَّق للحدّ الحالي بوصفه حماية حصّة لا حماية أمن.

---

## 4. التحكّم بالوصول

### 4.1 طبقة الجداول — **`SOURCE_VERIFIED` · وسليمة**

| المقياس | القيمة |
|---|---:|
| جداول `public` | **71** |
| **عليها RLS** | **71 — مئة بالمئة** |
| بلا RLS | **0** |
| مجموع السياسات | **126** على **56** جدولاً |
| سياسات تستعمل `auth.uid()` | **84** |
| سياسات تُسمّي `anon` | **3** |
| جداول عليها RLS **بلا سياسة** = **منعٌ افتراضيّ كامل** | **15** |

> **والخمسة عشر ليست ثغرة بل عكسها:** RLS مفعّلة بلا سياسة تعني **صفر صفٍّ يمرّ** عبر REST لأي دور. **ومنها `watched_episodes_backup_133`** — فـ**`LOOPZ-AUD-0005` يُصحَّح نطاقه: الجدول غير مقروء عبر REST إطلاقاً**، ويبقى مشكلة **احتفاظٍ ببيانات قديمة** لا مشكلة انكشافٍ مباشر. **وهذا تخفيفٌ في التوصيف لا في وجوب حذفه.**

**ملاحظة دقّة:** `relforcerowsecurity = 0` في الجداول كلّها — أي أن **مالك الجدول لا تنطبق عليه RLS**، وهو سلوك Postgres الافتراضي. **وهذا بالضبط ما يجعل دوالّ `SECURITY DEFINER` تتجاوز RLS**، وينقل ثقل الحراسة إليها — وهو موضوع §4.3.

### 4.2 التخزين — **`SOURCE_VERIFIED` · وسليم**

| البند | القيمة |
|---|---|
| الدِّلاء | **واحد: `avatars`** |
| قراءة عامّة | نعم (سياسة `avatar images are public`) — **بالتصميم** |
| **الكتابة** | سياسة `users manage own avatar` — **`ALL` لدور `authenticated` فقط، مقيَّدة بـ`auth.uid()` عبر `storage.foldername`** |
| **حدّ الحجم على الخادم** | **2,097,152 بايت** |
| **أنواع مسموحة على الخادم** | **`image/jpeg` · `image/png` · `image/webp` · `image/gif` — و`image/svg+xml` مستثنى** |

> **والاستثناء الأخير مهمّ:** الكود يمرّر `contentType: file.type` **من العميل**، ولو قُبل SVG في دلوٍ عامّ لصار متجهاً لـXSS مخزَّن. **والدلو يرفضه على الخادم**، فالحماية في المكان الصحيح لا في المتصفّح. **وعزل الكتابة بمجلّد المستخدم مفروضٌ بالسياسة لا بالمسار الذي يبنيه العميل** — فلا IDOR في الرفع.

### 4.3 طبقة الدوالّ — `LOOPZ-AUD-0040` · **P1 · مفتوحة**

> **تجميع فئويّ فقط.** لا أسماء ولا تواقيع ولا أجسام ولا أوامر ولا ترتيب استدعاء. التفاصيل في القناة الخاصّة.

| المقياس | القيمة |
|---|---:|
| دوالّ `SECURITY DEFINER` في `public` في متناول دور مجهول | **عشراتٌ منها** — الرقم الدقيق ودلالته في القناة الخاصّة |
| منها **تكتب** | مجموعة فرعية |
| منها **تكتب بلا تحقّق من هويّة المنادي** | مجموعة أصغر — **وواحدة منها كانت تمسّ استحقاقاً** |
| منها **تقرأ بلا تحقّق من هويّة المنادي** | **لم تُصنَّف بعد** — §8.5 |
| دوالّ الإدارة | ✅ **كلّها تحمل حارسها في جسمها** — فُحصت واحدةً واحدة |

**الجذر — ويُقال بأمان لأنه نمطٌ لا مسار:** منحُ `EXECUTE` الافتراضيّ العريض على دوالّ `public` في Supabase، **مع تصميمٍ يفترض أن خادم التطبيق وحده هو المنادي** — **بينما مفتاح الدور المجهول يُشحن إلى كل متصفّح بحكم التصميم.** فالافتراض لا يصمد، والحارس يجب أن يكون **داخل** الدالّة لا في طبقة التطبيق.

**والمنهج `SOURCE_VERIFIED` لا أكثر:** تعريفات الدوالّ + جداول الصلاحيات + مستشارو المنصّة. **ولم يُستدعَ شيء — فالخطوة الأخيرة غير مؤكَّدة حيّاً، وأقولها بدل ادّعاء تأكيدٍ لم يجرِ.**

#### حالة المعالجة

**المسار الأعلى خطراً عولج** بسحب صلاحيات تنفيذ، **بإذن أحمد الصريح بعد أن عرضتُ عليه أن ذلك يخالف ثلاث قواعد قائمة** (تعليماته أن SQL يُشغَّل في لوحته · وقيد Phase 5 «لا تغيّر إعدادات Supabase» · و«Production دون تغيير حتى بوابة GO»).

**وحكم المراجع على ذلك — وأسجّله كما ورد لا كما أحبّ:** «لا يمكن اعتماد هذا التحديث ضمن Phase 5… سحب `EXECUTE` يغيّر حالة صلاحيات Production فعلياً، حتى لو كان قابلاً للرجوع… والإذن الخاصّ غير قابل للتحقّق من أدلة الـPR.» **مقبول.** وقد **توقّفت عن أي تغيير إضافي**، **ولم أُنفّذ ولن أُنفّذ rollback ولا `GRANT` ولا أي SQL آخر** — فتثبيت الحالة أقلّ خطراً من تغييرٍ ثانٍ بلا بوابة مستقلّة.

**و`LOOPZ-AUD-0040` تبقى مفتوحة بدرجة P1** حتى: يكتمل الجرد الآمن لكل الاستثناءات العامّة · وتُثبَت الحراسة والحدود ومقاومة الإساءة لكل استثناء · **وتُراجَع وراثة `PUBLIC` و`authenticated` لا الدور المجهول وحده** · **ويجري تحقّق مستقلّ في بيئة معزولة لا على Production.**

**وأيّ إصلاح صلاحيات لاحق مهمّة أمنية منفصلة وخاصّة** بخطّة رجوع واختبار معزول واعتماد موثَّق — **لا جزءٌ من PR التدقيق العامّ.**

#### 🔴 `S-05` — **P2** · وراثة الصلاحيات تُبطل السحب الموجَّه

**تجميع آمن:** بعض الدوالّ المكشوفة تحمل منحاً على مستوى `PUBLIC` لا على مستوى دورٍ بعينه. **والدور المجهول يرث تلك الصلاحية**، فسحبٌ موجَّه إليه وحده **لا يُبطل الإرث ويفشل صامتاً**.

**الدليل (metadata آمن):** قوائم التحكّم (`proacl`) التي تبدأ بمُدخَل بلا اسم دور — وهو تمثيل `PUBLIC` في Postgres. **والعدد ودلالته في القناة الخاصّة.**

**واكتُشف بالتحقّق بعد التنفيذ لا قبله** — ولولاه لسُجِّل نجاحٌ لم يقع. **وهو الدرس نفسه المتكرّر: فحصٌ يثبت الإرسال لا يثبت الأثر.**

**معيار القبول:** أي مراجعة صلاحيات لاحقة تفحص **`PUBLIC` و`authenticated`** لا الدور المجهول وحده، **وتتحقّق من الأثر بعد كل خطوة**.

#### التحقّق الوظيفي — `BLOCKED_BY_TEST_ENV`

فُحصت خمسة مسارات عامّة كزائر بعد التغيير فردّت 200 بأحجام مطابقة لخطّ أساس Phase 4. **وهذا لا يكفي اعتماداً، وأقولها صراحةً:** نجاح عدّة `GET` لا يثبت سلامة الـRPCs ولا العمليات الموثَّقة ولا صلاحيات المستخدم المسجَّل. **والتحقّق الوظيفي الكامل `BLOCKED_BY_TEST_ENV` حتى تتوفّر بيئة معزولة** (`LOOPZ-AUD-0006`) — **ولا يُوسَّع الاختبار على Production.**

### 4.4 تنبيهات Supabase — 334، مصنَّفةً

| المستوى | العدد | البند | قراءتي |
|---|---:|---|---|
| **ERROR** | 1 | `security_definer_view` — عرضٌ واحد، **الاسم محجوب** | **مرشّح `S-03`**: عرضٌ بامتياز المُعرِّف يتجاوز RLS للجداول تحته. **الدرجة مؤجَّلة حتى تُدقَّق أعمدته ومصادره وgrants** |
| WARN | 168 + 143 | دوالّ `SECURITY DEFINER` قابلة للتنفيذ من `authenticated` و`anon` | **جوهر `SEC-ALERT-01`** |
| WARN | 5 | `function_search_path_mutable` — **الأسماء محجوبة في النسخة العامّة** | **مرشّح `S-04` — الدرجة مؤجَّلة**: `search_path` القابل للتغيير في دالّة بامتياز المُعرِّف مسارٌ معروف، **لكنه لا يصير ثغرةً مؤكَّدة إلا بإثبات صلاحية `CREATE` لدورٍ عامّ على مخطَّطٍ في المسار، وعدم تأهيل أسماء الكائنات داخل الدالّة** — ولم يكتمل ذلك بعد (§8.5). **والبقيّة تضبطه صراحةً، فهذه شواذّ لا قاعدة** |
| WARN | 1 | `auth_leaked_password_protection` | **`NOT_APPLICABLE`** — لا كلمات مرور |
| INFO | 16 | `rls_enabled_no_policy` | **ليست عيباً** — منعٌ افتراضيّ (§4.1) |

---

## 5. فئات الهجوم

| الفئة | السطح | الحماية المرصودة | الحالة |
|---|---|---|---|
| **XSS مُنعكس/DOM** | 453 ملفاً | **صفر `innerHTML =`** · **صفر `eval`** · **صفر `new Function`** · و`dangerouslySetInnerHTML` **سبع مرّات كلّها بمدخلٍ نبنيه** (JSON-LD من كائن · CSS الثيم من جدول ثابت · سكربتات الإقلاع) | `SOURCE_VERIFIED` |
| **XSS مخزَّن عبر رفع SVG** | دلو `avatars` العامّ | **مغلق على الخادم**: `allowed_mime_types` بلا `svg` (§4.2) | `SOURCE_VERIFIED` |
| **SQLi** | كود التطبيق | **صفر SQL نصّيّ** — الوصول كلّه عبر `.from()`/`.rpc()` بمعاملات مُمرَّرة. (مطابقات `.sql` في الشيفرة كلّها تعليقات تشير إلى ملفّات الهجرة) | `SOURCE_VERIFIED` |
| **CSRF — Server Actions** | 162 فعلاً | فحص الأصل التلقائي في Next (لا `allowedOrigins` مخصّص يوسّعه) | `SOURCE_VERIFIED` (يتّكئ على الإطار) |
| **CSRF — Route Handlers** | `/auth/signout` · `/api/lang-ping` | مقارنة `origin` · وكوكيز `sameSite=lax` | ⚠️ **`S-01`** |
| **CSRF — OAuth** | `/api/trakt/*` | كوكي `trakt_state` httpOnly/secure/lax/600s | `SOURCE_VERIFIED` |
| **Open redirect** | `/auth/callback` | `safeNext()` + قائمة أصول مغلقة | `SOURCE_VERIFIED` |
| **IDOR — التخزين** | `avatars` | سياسة مقيَّدة بـ`auth.uid()` وبمجلّد المستخدم | `SOURCE_VERIFIED` |
| **IDOR — الجداول** | 71 جدولاً | RLS على الجميع · 84 سياسة تستعمل `auth.uid()` | `SOURCE_VERIFIED` بنيوياً · **والتحقّق الفعليّ A/B `BLOCKED_BY_TEST_ENV`** |
| **IDOR/BOLA — الدوالّ** | 143 دالّة | — | 🔴 **`SEC-ALERT-01`** |
| **SSRF** | 11 عائلة خارجية | **العناوين كلّها من ثوابت أو قوالب ثابتة**؛ وأقربها إلى مدخلٍ خارجيّ مصادرُ الأخبار، **ولها دالّة تحقّق مضيفٍ في القاعدة** | `SOURCE_VERIFIED` |
| **الرفع: النوع والحجم والمسار** | 3 مواضع | تصغير قبل القياس · حدّ عميل · **وحدّا الخادم 2MB وقائمة أنواع** | `SOURCE_VERIFIED` |
| **الترويسات** | كل مسار | CSP (`default-src 'self'` · `base-uri` · `form-action` · `frame-ancestors 'none'` · `object-src 'none'`) · HSTS سنتان + preload · `DENY` · nosniff · Referrer · Permissions · COOP | `PASSIVE_VERIFIED` (Phase 2) |
| **CSP — الثغرة الوحيدة** | `script-src` | **`'unsafe-inline'`** | ⚠️ **`LOOPZ-AUD-0007`** — **مُقَرٌّ به في الملف نفسه ومؤجَّل بـnonce** |
| **حدّ المعدّل / bots** | 13 مساراً | حدّ لكل مستخدم وبالـIP للزائر | ⚠️ **`S-02`** |
| **CAPTCHA** | — | لا وجود | **`NOT_APPLICABLE`** — قرار مشروع (Phase 1 §16) |

---

## 6. سلسلة التوريد — `SOURCE_VERIFIED`

| البند | القيمة |
|---|---|
| `npm audit` (قراءةً فقط، **بلا `fix`**) | **critical 0 · high 0 · moderate 0 · low 0 · info 0** |
| الحزم في القفل | **459** · `lockfileVersion 3` · **والقفل مُودَع في المستودع** |
| التبعيات المباشرة | **10** إنتاج · **8** تطوير |
| **سكربتات التثبيت** | **لا `preinstall` ولا `postinstall` ولا `prepare`** — **صفر تنفيذ كودٍ وقت التثبيت** |
| السكربتات المعرَّفة | `dev` · `build` · `start` · `lint` — **ولا `test`** (وهو `LOOPZ-AUD-0001`) |
| عدم تطابق إصدار | `eslint-config-next@16.2.12` مقابل `next@16.3.0` — **`LOOPZ-AUD-0003`** |
| تثبيت إصدار Node | **غائب** (`engines` · `packageManager`) — **`LOOPZ-AUD-0004`** |

**والأداة والتاريخ:** `npm audit` من سجلّ npm العام، 2026-09-01، على `package-lock.json` الخاصّ بـ`f8a2b33c`. **صفر Advisory، فلا معرّفات تُذكر ولا قابلية استغلال تُقيَّم.**

---

## 7. الفحص الحيّ الآمن — `PASSIVE_VERIFIED`

| ما فُحص | النتيجة |
|---|---|
| ترويسات الأمن السبع على Production | **مُسلَّمة حيّاً** (Phase 2) |
| مسارات `GET` عامّة غير كاتبة | **21 مساراً بجدول Phase 4 §12.1** — ونداءٌ واحد لكلٍّ |
| ثمانية مسارات تفرض الجلسة | **401 بجسمٍ من 12–16 بايت** — **الحارس يعمل قبل أي حمولة** |
| **نقطة Supabase REST** | ❌ **لم تُفحص عمداً** — وهي بعينها سطح `SEC-ALERT-01`، **وفحصها كان سيعني استغلالاً لا تدقيقاً** |
| اختبار عزل مستخدم A/B | **`BLOCKED_BY_TEST_ENV`** — ولا يُستبدل باستنتاج ثابت، **ولا يخفّض ذلك خطورة `LOOPZ-AUD-0006`** |

---

## 8. النتائج

### 8.1 مرشّحات Phase 5

| المرشّح | الدرجة | الخلاصة | معيار القبول |
|---|---|---|---|
| **`LOOPZ-AUD-0040`** | **P1 · مفتوحة** | صلاحيات تنفيذ عريضة على دوالّ `SECURITY DEFINER` (§4.3) | المسار الأعلى خطراً عولج، **والمعالجة لم تُعتمد ضمن Phase 5** · **والصنف باقٍ مفتوحاً** ولا يُغلق إلا بالشروط الأربعة في §4.3 |
| **`S-05`** | **P2 (مقترَحة)** | **وراثة الصلاحيات تُبطل السحب الموجَّه**: مجموعةٌ من الدوالّ المكشوفة تحمل منحاً على مستوى `PUBLIC` لا على مستوى دور، **فسحبٌ موجَّه إلى دورٍ بعينه يفشل عليها صامتاً** (اكتُشف بالتحقّق **بعد** التنفيذ لا قبله). **العدد والأسماء في القناة الخاصّة** | أي مراجعة صلاحيات لاحقة تفحص **`PUBLIC` و`authenticated`** لا الدور المجهول وحده · **وتحقّقٌ من الأثر بعد كل خطوة** |
| `S-01` | P3 | حارس CSRF في `/auth/signout` يمرّ عند غياب `origin`؛ الأثر خروجٌ قسريّ ومخفَّف بـ`sameSite=lax` | رفض الطلب عند غياب `origin` |
| `S-02` | P3 | حدّ المعدّل محلّيٌّ لكل نسخة لا موزّع — **مُقَرٌّ به في الملفّ** | مخزن حدٍّ مشترك للمسارات الحسّاسة، أو قبولٌ موثَّق |
| 🔴 **`S-03`** | **P2 — رُفعت** | **العرض المميّز بلا `WHERE` إطلاقاً** و`security_invoker=off` و`SELECT` لـ`anon`: **حقولُ ملفّ الحسابات الخاصّة مقروءةٌ لأيِّ زائر** عبر Data API؛ و`is_private` عمودٌ مُخرَجٌ لا شرط (§9.6) — **نقضٌ لتخفيضي السابق** | `security_invoker=on` أو شرطُ ظهورٍ في العرض · ثم تحقّقٌ معزول |
| ~~`S-04`~~ | **يسقط — لا بند** | 170/170 دالّة `DEFINER` لها `search_path` مثبَّت، **ولا `CREATE` لأيِّ دورٍ عامّ على أيِّ مخطَّطٍ في المسار** (§9.6) | — |
| `S-06` | **P3** | تبعية غير مستخدمة: حزمة خطٍّ استُبدلت (D-454) وبقيت في `package.json` (§9.5) | إزالتها من التبعيات |
| `S-07` | P3 | **ستّ سياسات RLS مُسنَدة إلى `PUBLIC` بدل `authenticated`** (صُحِّح من «خمس» بعد الجرد الصفّيّ) — الأثر الأمنيّ صفر (الشرط `auth.uid()` لا يتحقّق للزائر)، **لكنها نظافةُ أقلِّ صلاحية** (§9.1) | إعادة الإسناد إلى `authenticated` بلا تغيير الشرط |
| `S-08` | P3 | **أربع دوالّ قياسٍ مجهولةٍ مقصودة** كاتبةٌ بلا هويّة (نقرات · لغات · أحداث مزوّد · أخطاء عميل) — الخطرُ إغراقٌ لا تصعيد (§9.2أ) | حدُّ معدّل أو تحقّقٌ خفيف على مسارات القياس |
| `S-09` | **P2** | **دالّةٌ كاتبةٌ بلا حارس هويّة في مخبأ تقييمات الكتالوج** — تسميمُ بيانات عرضٍ لا خصوصيّة (§9.2أ) | حارسُ هويّة أو حصرُ التنفيذ بالخادم |
| `S-10` | P3 | **لا إبطالَ ذاتيّاً للجلسات**؛ والرموز المُصدَرة تبقى صالحةً حتى `exp` بعد حذف الحساب (§9.3) | خروجٌ عامّ عند الحذف وبطلب المستخدم · توثيق مدّة الرمز |
| 🔴 **`S-11`** | **P2 · عمليّاتيّ** | **لا مراقبةَ لمعدّل أخطاء القاعدة** — ≈15,420 خطأً في 24 ساعة مرّت بلا إنذار، واكتُشفت ببلاغ مستخدم (§9.7) | إنذارٌ على معدّل أخطاء Postgres قبل بوابة GO |

### 8.1.1 حالة `LOOPZ-AUD-0040` — **مفتوحة P1**

| البند | الحالة |
|---|---|
| المسار الأعلى خطراً (مسّ استحقاق بلا تحقّق هويّة) | 🟢 **عولج** — والمعالجة **لم تُعتمد ضمن Phase 5** بحكم المراجع |
| صنف الصلاحيات الواسع | 🔴 **مفتوح** — جردٌ آمن لكل الاستثناءات لم يكتمل |
| الدوالّ القارئة بلا حارس | 🟠 **صُنِّفت صفّاً بصفّ (§9.2ب): 109 قارئةً متاحةً للزائر · منها 32 تلمس جداولَ مستخدم · وصفرٌ يستشير `is_private`** — **ومنها سبعٌ فقط تُخرج بياناتِ عضوٍ بمعرّفه**، وهي وحدُها رأسُ `0040`. (الأرقامُ القديمةُ «46 / 17 / حتى 16» **خاطئة** وصُحِّحت في جولة 17:20 UTC) |
| وراثة `PUBLIC` و`authenticated` | 🟠 **رُوجعت تحليلياً (§9.1 · §4.3): `S-05` يثبت أنها تُبطل السحب الموجَّه** — والعلاج يجب أن يشملها. لا تغيير صلاحيات مُنفَّذ |
| تحقّق مستقلّ في بيئة معزولة | 🔴 **`BLOCKED_BY_TEST_ENV`** (`LOOPZ-AUD-0006`) |
| **أيّ تغيير إضافي على Production** | ⛔ **موقوف** — لا rollback ولا `GRANT` ولا `REVOKE` ولا Migration |

### 8.2 وما ثبت انضباطه — لأن تقريراً أمنيّاً لا يقول إلا العيوب يكذب

- **صفر مفتاح `service_role` في المشروع** — **فلا تجاوز لـRLS بمفتاح service-role في كود التطبيق** (ولا يُقرأ ذلك «لا تجاوز إطلاقاً»: مسار `SECURITY DEFINER` قائم وهو `LOOPZ-AUD-0040`).
- **RLS على 71 جدولاً من 71**، و126 سياسة، و84 منها تستعمل `auth.uid()`.
- **عزل التخزين مفروضٌ بالسياسة** لا بمسارٍ يبنيه العميل، **وSVG مرفوض على الخادم**، **وحدّ 2MB على الخادم**.
- **14,893 كائناً في تاريخ Git بلا إصابة سرّ واحدة.**
- **صفر ثغرة في 459 حزمة، وصفر سكربت تثبيت.**
- **دوالّ `admin_*` التسع كلّها تحمل حارسها الحقيقيّ في القاعدة** — كما وثّقت Phase 1 (D-011)، وقد تحقّق ذلك هنا واحدةً واحدة.
- **صفر `eval` وصفر `innerHTML` وصفر SQL نصّيّ** في 453 ملفاً.

### 8.3 تصحيح توصيف — لا تخفيف واجب

**`LOOPZ-AUD-0005`** (`watched_episodes_backup_133`): **غير مقروء عبر REST** — RLS مفعّلة بلا سياسة. **فهو دَينُ احتفاظٍ ببيانات لا انكشافٌ مباشر.** ويبقى واجبَ الحذف بعد التحقّق، **ويبقى الوصول إليه ممكناً عبر دالّة `SECURITY DEFINER` إن وُجدت** — وهو ما يجعله جزءاً من نطاق `LOOPZ-AUD-0040` لا خارجه.

### 8.4 الترحيل — بلا تخفيف

`LOOPZ-AUD-0023` (P1) · **Visual Verification Gate (15 بنداً · صفر `PASS`)** · **وقياسات Web Vitals الصالحة** — ثلاثتها **موانع إلزامية قبل الـGO**. و`0006` و`0007` يُرحَّلان بحالتهما، و`0005` بتوصيفه المصحَّح أعلاه.

### 8.5 حالة الاكتمال — `ANALYSIS_IN_PROGRESS`

> ⚖️ **صُحّحت هذه اللوحة بعد مراجعة 09:59.** كانت تضع «✅ مكتمل» على أدلّة تجميعيّة، وتقول إن البيئة المعزولة هي «المانع الوحيد». **وكلاهما كان أوسعَ من الدليل.**

| البند | الحالة الحقيقيّة بعد §9 |
|---|---|
| مصفوفة الوصول صفّاً بصفّ | ✅ **§9.1** — أُعيدت صفّاً لكل سطح حسّاس بـ`roles`/`cmd`/`USING`/`WITH CHECK` |
| تصنيف الدوالّ | ✅ **§9.2** — أُعيد بمسار الاستدعاء والحارس والأثر، **ونقض تعدادي السابق** |
| دورة الجلسة والحذف والإبطال | ✅ **§9.3** — والإبطالُ فجوةٌ أمنيّةٌ مسمّاة لا `NOT_APPLICABLE` |
| GitHub/Vercel/Cron/Webhooks | ✅ **§9.4** |
| التبعيات المباشرة إنتاجاً وتطويراً | ✅ **§9.5** — الثمانيةَ عشرةَ كلّها |
| حسم `S-03` و`S-04` | ✅ **§9.6** — **`S-04` سقط، و`S-03` ثبت عيباً** |
| **انحدارُ إنتاجٍ من إصلاح Phase 5 نفسِه** | 🔴 **§9.7 — جديد** |
| تحقّق `0040` في بيئة معزولة · عزل A/B · صلاحيات GitHub/Vercel الإدارية | 🔴 **`BLOCKED_BY_TEST_ENV`** |

---

## 9. استكمال التحليل الثابت — بالأدلّة الصفّية

> **المصدر:** البيانات الوصفية للقاعدة (`pg_policies` · `pg_policy` · `pg_proc` · `pg_namespace` · `aclexplode` · `pg_get_functiondef` · `pg_get_viewdef`) وسجلّات Postgres وشجرةُ المصدر. **صفر استدعاءِ دالّةٍ تطبيقيّة · صفر كتابة · صفر DDL · صفر تغييرِ صلاحيات.**
>
> **قاعدةُ الحجب المطبَّقة هنا** (والمستودعُ عامّ): **أسماءُ الدوالّ محجوبةٌ بمعرّفاتٍ ثابتة** `FW-nn`/`FR-nn`، والعرضُ `V-01` — لأنّها **سطحُ RPC القابلُ للنداء**، فاسمُها وحدَه خريطةُ هجوم. **وأسماءُ الجداول والسياسات تُكتب صريحةً** لأنّ **173 ملفَّ SQL في المستودع نفسِه تحملها أصلاً**، **وحجبُ ما هو منشورٌ يخفي الدليلَ عن المراجع ولا يخفيه عن المهاجم.**

### 9.1 مصفوفة الوصول — صفٌّ لكلِّ سياسة

**البنية:** **73 جدولاً في `public` · RLS مفعَّل على 73/73 · 128 سياسة.**

**و15 جدولاً بصفر سياسة** = **منعٌ افتراضيٌّ مغلق** (fail-closed): `featured_lists` · `imdb_pool` · `news_posts` · `partner_clicks` · `plus_rewards` · `provider_content_links` · `provider_events` · `referral_events` · `runtime_errors` · `title_room_global_pins` · `title_snapshots` · `user_active_days` · `visit_langs` · `watched_episodes_backup_133` · `weekly_top`. **لا قراءةَ ولا كتابةَ من العميل إليها إطلاقاً** — وكلُّ ما يمسّها يمرّ بطبقةٍ مميّزة، **فتدخل نطاق `LOOPZ-AUD-0040` لا نطاق RLS.** (و`watched_episodes_backup_133` هو `LOOPZ-AUD-0005` بعينه: **صفر سياسة يعني صفر قراءة عبر Data API** — الخطرُ فيه بقاءُ نسخةٍ لا كشفُها.)

**والمستهلِكُ عمودٌ مستقلٌّ لأن السياسةَ وحدَها لا تصف السطح:**

| الجدول | المستهلِك في الشيفرة |
|---|---|
| `activity_likes` · `blocks` · `library_grants` · `list_reply_reports` · `list_review_likes` · `list_review_replies` · `list_review_reports` · `news_post_replies` · `news_reply_reports` · `post_views` · `reply_reports` · `review_likes` · `review_replies` · `review_reports` · `title_post_likes` · `title_post_reports` · `title_post_votes` · `title_posts` · `user_reports` | `lib/actions.ts` (Server Actions فقط) |
| `communities` · `community_invites` · `community_join_requests` · `community_members` · `dismissed_titles` · `follow_requests` · `list_reviews` · `list_saves` · `movie_progress` · `partner_details` · `person_follows` · `post_reactions` · `profiles` · `title_art` · `title_room_pins` · `user_follows` · `user_list_items` · `user_lists` | `lib/actions.ts` + `lib/data.ts` |
| `community_messages` · `list_shares` · `share_replies` · `title_shares` | + مكوّنُ عميلٍ واحد (`Communities.tsx` / `Inbox.tsx`) |
| `follows` · `ratings` · `watched_episodes` · `watched_movies` | + `app/api/trakt/callback/route.ts` (مسارُ الاستيراد) وطبقاتُ التوصية |
| `imdb_chart` · `imdb_ratings` · `title_meta` · `title_aliases` | كتالوجٌ عامٌّ — `lib/data.ts` / `lib/omdb.ts` / `lib/titleAliases.ts` |
| `partners` | `app/profile/settings/invites/page.tsx` |
| 🔑 `episode_ratings` · `profile_views` · `referral_codes` · `referrals` · `subscriptions` · `verification_requests` | **صفر استعلامٍ مباشرٍ في الشيفرة** — تُقرأ حصراً عبر RPC مميّزة. **فالسياسةُ هنا حارسٌ احتياطيٌّ لا الحارسَ العامل** |

**المصفوفة الكاملة — 128 صفّاً، صفٌّ لكلِّ سياسة، بلا تجميع:**

| الجدول | العملية | الدور | `USING` | `WITH CHECK` |
|---|---|---|---|---|
| `activity_likes` | DELETE | `authenticated` | `auth.uid() = liker_id` | `—` |
| `activity_likes` | INSERT | `authenticated` | `—` | `auth.uid() = liker_id` |
| `activity_likes` | SELECT | `authenticated` | `auth.uid() = liker_id` | `—` |
| `blocks` | DELETE | `authenticated` | `auth.uid() = blocker_id` | `—` |
| `blocks` | INSERT | `authenticated` | `—` | `auth.uid() = blocker_id` |
| `blocks` | SELECT | `authenticated` | `auth.uid() = blocker_id` | `—` |
| `communities` | DELETE | `authenticated` | `auth.uid() = owner_id` | `—` |
| `communities` | INSERT | `authenticated` | `—` | `auth.uid() = owner_id` |
| `communities` | SELECT | `authenticated` | `true` ⚠️ | `—` |
| `communities` | UPDATE | `authenticated` | `auth.uid() = owner_id` | `auth.uid() = owner_id` |
| `community_invites` | DELETE | `authenticated` | `(auth.uid() = user_id) OR EXISTS(communities c WHERE c.id = community_id AND c.owner_id = auth.uid())` | `—` |
| `community_invites` | INSERT | `authenticated` | `—` | `EXISTS(communities c WHERE c.id = community_id AND c.owner_id = auth.uid())` |
| `community_invites` | SELECT | `authenticated` | `(auth.uid() = user_id) OR EXISTS(communities c WHERE c.id = community_id AND c.owner_id = auth.uid())` | `—` |
| `community_join_requests` | DELETE | `authenticated` | `(auth.uid() = user_id) OR EXISTS(communities c WHERE c.id = community_id AND c.owner_id = auth.uid())` | `—` |
| `community_join_requests` | INSERT | `authenticated` | `—` | `(auth.uid() = user_id) AND EXISTS(communities c WHERE c.id = community_id AND c.is_private = true)` |
| `community_join_requests` | SELECT | `authenticated` | `(auth.uid() = user_id) OR EXISTS(communities c WHERE c.id = community_id AND c.owner_id = auth.uid())` | `—` |
| `community_members` | DELETE | `authenticated` | `(auth.uid() = user_id) AND NOT EXISTS(communities c WHERE c.id = community_id AND c.owner_id = auth.uid())` | `—` |
| `community_members` | INSERT | `authenticated` | `—` | `(auth.uid() = user_id) AND EXISTS(communities c WHERE c.id = community_id AND c.is_private = false)` |
| `community_members` | SELECT | `authenticated` | `is_community_member(community_id, auth.uid())` | `—` |
| `community_messages` | DELETE | `authenticated` | `auth.uid() = author_id` | `—` |
| `community_messages` | INSERT | `authenticated` | `—` | `(auth.uid() = author_id) AND is_community_member(community_id, auth.uid())` |
| `community_messages` | SELECT | `authenticated` | `is_community_member(community_id, auth.uid()) OR is_open_title_room(community_id)` | `—` |
| `dismissed_titles` | ALL | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `episode_ratings` | ALL | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `follow_requests` | DELETE | `authenticated` | `(auth.uid() = requester_id) OR (auth.uid() = target_id)` | `—` |
| `follow_requests` | INSERT | `authenticated` | `—` | `auth.uid() = requester_id` |
| `follow_requests` | SELECT | `authenticated` | `(auth.uid() = requester_id) OR (auth.uid() = target_id)` | `—` |
| `follows` | ALL | `public` ⚠️ | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `imdb_chart` | SELECT | `public` | `true` | `—` |
| `imdb_ratings` | SELECT | `public` | `true` | `—` |
| `library_grants` | ALL | `authenticated` | `auth.uid() = owner_id` | `auth.uid() = owner_id` |
| `library_grants` | SELECT | `authenticated` | `auth.uid() = grantee_id` | `—` |
| `list_reply_reports` | INSERT | `authenticated` | `—` | `auth.uid() = reporter_id` |
| `list_reply_reports` | SELECT | `authenticated` | `auth.uid() = reporter_id` | `—` |
| `list_review_likes` | DELETE | `authenticated` | `auth.uid() = liker_id` | `—` |
| `list_review_likes` | INSERT | `authenticated` | `—` | `(auth.uid() = liker_id) AND (auth.uid() <> review_user_id)` |
| `list_review_likes` | SELECT | `authenticated` | `auth.uid() = liker_id` | `—` |
| `list_review_replies` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `list_review_replies` | INSERT | `authenticated` | `—` | `(auth.uid() = user_id) AND EXISTS(user_lists l WHERE l.id = list_id AND l.is_public)` |
| `list_review_replies` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `list_review_reports` | INSERT | `authenticated` | `—` | `(auth.uid() = reporter_id) AND (auth.uid() <> review_user_id)` |
| `list_review_reports` | SELECT | `authenticated` | `auth.uid() = reporter_id` | `—` |
| `list_reviews` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `list_reviews` | INSERT | `authenticated` | `—` | `(auth.uid() = user_id) AND EXISTS(user_lists l WHERE l.id = list_id AND l.is_public AND l.user_id <> auth.uid())` |
| `list_reviews` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `list_reviews` | UPDATE | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `list_saves` | ALL | `authenticated` | `auth.uid() = user_id` | `(auth.uid() = user_id) AND EXISTS(user_lists l WHERE l.id = list_id AND l.is_public AND l.user_id <> auth.uid())` |
| `list_shares` | INSERT | `authenticated` | `—` | `(auth.uid() = sender_id) AND are_mutual(sender_id, recipient_id) AND EXISTS(user_lists l WHERE l.id = list_id AND l.user_id = auth.uid() AND l.is_public)` |
| `list_shares` | SELECT | `authenticated` | `((auth.uid() = sender_id) AND sender_hid = false) OR ((auth.uid() = recipient_id) AND recipient_hid = false)` | `—` |
| `list_shares` | UPDATE | `authenticated` | `(auth.uid() = sender_id) OR (auth.uid() = recipient_id)` | `(auth.uid() = sender_id) OR (auth.uid() = recipient_id)` |
| `movie_progress` | ALL | `public` ⚠️ | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `news_post_replies` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `news_post_replies` | INSERT | `authenticated` | `—` | `auth.uid() = user_id` |
| `news_post_replies` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `news_reply_reports` | INSERT | `authenticated` | `—` | `auth.uid() = reporter_id` |
| `news_reply_reports` | SELECT | `authenticated` | `auth.uid() = reporter_id` | `—` |
| `partner_applications` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `partner_details` | ALL | `authenticated` | `auth.uid() = user_id` | `(auth.uid() = user_id) AND EXISTS(partners p WHERE p.user_id = auth.uid())` |
| `partner_details` | SELECT | `authenticated` | `am_admin()` | `—` |
| `partners` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `person_follows` | ALL | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `post_reactions` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `post_reactions` | INSERT | `authenticated` | `—` | `auth.uid() = user_id` |
| `post_reactions` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `post_reactions` | UPDATE | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `post_views` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `post_views` | INSERT | `authenticated` | `—` | `auth.uid() = user_id` |
| `post_views` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `profile_views` | INSERT | `authenticated` | `—` | `auth.uid() = viewer_id` |
| `profiles` | ALL | `public` ⚠️ | `auth.uid() = id` | `auth.uid() = id` |
| `ratings` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `ratings` | INSERT | `authenticated` | `—` | `auth.uid() = user_id` |
| `ratings` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `ratings` | UPDATE | `authenticated` | `auth.uid() = user_id` | `—` 🟠 |
| `referral_codes` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `referrals` | SELECT | `authenticated` | `(auth.uid() = inviter_id) OR (auth.uid() = invitee_id)` | `—` |
| `reply_reports` | INSERT | `authenticated` | `—` | `auth.uid() = reporter_id` |
| `reply_reports` | SELECT | `authenticated` | `auth.uid() = reporter_id` | `—` |
| `review_likes` | DELETE | `authenticated` | `auth.uid() = liker_id` | `—` |
| `review_likes` | INSERT | `authenticated` | `—` | `(auth.uid() = liker_id) AND (auth.uid() <> review_user_id)` |
| `review_likes` | SELECT | `authenticated` | `(auth.uid() = liker_id) OR (auth.uid() = review_user_id)` | `—` |
| `review_replies` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `review_replies` | INSERT | `authenticated` | `—` | `auth.uid() = user_id` |
| `review_replies` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `review_reports` | DELETE | `authenticated` | `auth.uid() = reporter_id` | `—` |
| `review_reports` | INSERT | `authenticated` | `—` | `(auth.uid() = reporter_id) AND (auth.uid() <> review_user_id)` |
| `review_reports` | SELECT | `authenticated` | `auth.uid() = reporter_id` | `—` |
| `share_replies` | DELETE | `authenticated` | `auth.uid() = author_id` | `—` |
| `share_replies` | INSERT | `authenticated` | `—` | `(auth.uid() = author_id) AND EXISTS(title_shares s WHERE s.id = share_id AND (auth.uid() = s.sender_id OR auth.uid() = s.recipient_id) AND are_mutual(s.sender_id, s.recipient_id))` |
| `share_replies` | SELECT | `authenticated` | `EXISTS(title_shares s WHERE s.id = share_id AND (auth.uid() = s.sender_id OR auth.uid() = s.recipient_id))` | `—` |
| `subscriptions` | SELECT | `authenticated` | `user_id = auth.uid()` | `—` |
| `title_aliases` | SELECT | `anon,authenticated` | `verified` | `—` |
| `title_art` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_art` | INSERT | `authenticated` | `—` | `auth.uid() = user_id` |
| `title_art` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_art` | UPDATE | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `title_meta` | SELECT | `public` | `true` | `—` |
| `title_post_likes` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_post_likes` | INSERT | `authenticated` | `—` | `(auth.uid() = user_id) AND can_touch_post(post_id)` |
| `title_post_likes` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_post_reports` | INSERT | `authenticated` | `—` | `auth.uid() = reporter_id` |
| `title_post_reports` | SELECT | `authenticated` | `auth.uid() = reporter_id` | `—` |
| `title_post_votes` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_post_votes` | INSERT | `authenticated` | `—` | `(auth.uid() = user_id) AND can_touch_post(post_id)` |
| `title_post_votes` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_post_votes` | UPDATE | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `title_posts` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_posts` | INSERT | `authenticated` | `—` | `auth.uid() = user_id` |
| `title_posts` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_room_pins` | DELETE | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_room_pins` | INSERT | `authenticated` | `—` | `auth.uid() = user_id` |
| `title_room_pins` | SELECT | `authenticated` | `auth.uid() = user_id` | `—` |
| `title_shares` | INSERT | `authenticated` | `—` | `(auth.uid() = sender_id) AND are_mutual(sender_id, recipient_id)` |
| `title_shares` | SELECT | `authenticated` | `((auth.uid() = sender_id) AND sender_hid = false) OR ((auth.uid() = recipient_id) AND recipient_hid = false)` | `—` |
| `title_shares` | UPDATE | `authenticated` | `(auth.uid() = sender_id) OR (auth.uid() = recipient_id)` | `(auth.uid() = sender_id) OR (auth.uid() = recipient_id)` |
| `user_follows` | DELETE | `authenticated` | `auth.uid() = follower_id` | `—` |
| `user_follows` | INSERT | `authenticated` | `—` | `auth.uid() = follower_id` |
| `user_follows` | SELECT | `authenticated` | `true` ⚠️ | `—` |
| `user_list_items` | ALL | `authenticated` | `EXISTS(user_lists l WHERE l.id = list_id AND l.user_id = auth.uid())` | `EXISTS(user_lists l WHERE l.id = list_id AND l.user_id = auth.uid())` |
| `user_list_items` | SELECT | `anon,authenticated` | `EXISTS(user_lists l WHERE l.id = list_id AND l.is_public)` | `—` |
| `user_lists` | ALL | `authenticated` | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `user_lists` | SELECT | `anon,authenticated` | `is_public` | `—` |
| `user_reports` | DELETE | `authenticated` | `auth.uid() = reporter_id` | `—` |
| `user_reports` | INSERT | `authenticated` | `—` | `(auth.uid() = reporter_id) AND (auth.uid() <> target_id)` |
| `user_reports` | SELECT | `authenticated` | `auth.uid() = reporter_id` | `—` |
| `verification_requests` | SELECT | `public` ⚠️ | `auth.uid() = user_id` | `—` |
| `watched_episodes` | ALL | `public` ⚠️ | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `watched_movies` | ALL | `public` ⚠️ | `auth.uid() = user_id` | `auth.uid() = user_id` |

**قراءةُ المصفوفة — أربع نتائج، اثنتان جديدتان:**

1. ✅ **صفر سياسةِ كتابةٍ تسمح بالكتابة فوق صفٍّ ليس لصاحب الجلسة.** كلُّ `WITH CHECK` يربط الصفَّ بـ`auth.uid()`، **وثمانٍ تزيد شرطاً أقوى من الملكيّة**: `are_mutual()` (المشاركات) · عضويّةُ المجتمع · شراكةٌ قائمة · عموميّةُ القائمة الأمّ · `l.user_id <> auth.uid()` (لا تحفظ ولا تراجع قائمتَك) · `auth.uid() <> review_user_id` · `auth.uid() <> target_id` (لا تُبلّغ عن نفسك) · `can_touch_post()`.
2. ℹ️ **`ratings/UPDATE` بلا `WITH CHECK` ليست ثغرة**: Postgres يستعمل تعبيرَ `USING` نفسَه للصفوف الجديدة حين يُحذف `WITH CHECK` من سياسة `UPDATE`. **مذكورٌ لأنّ الجدولَ يُقرأ فيبدو ناقصاً.**
3. ⚠️ **ستُّ سياساتٍ مُسنَدةٌ إلى `PUBLIC` بدل `authenticated`** (`profiles` · `follows` · `movie_progress` · `watched_episodes` · `watched_movies` · `verification_requests`). **أثرُها الأمنيُّ صفر** — الشرطُ `auth.uid() = …` لا يتحقّق لزائرٍ بلا هويّة — **لكنّها نظافةُ أقلِّ صلاحيّةٍ ناقصة**: **`S-07` · P3**. معيار القبول: إعادةُ الإسناد إلى `authenticated` بلا تغيير الشرط.
4. 🟠 **جديد — وخرج من هذا العمل الصفّيّ نفسِه:** **سياستان تقرآن `true` لكلِّ مصادَق**: `user_follows/SELECT` و`communities/SELECT`.
   - **`user_follows` = خريطةُ المتابعة كلُّها مقروءةٌ لأيِّ مسجَّل.** **والتطبيقُ يملك عَلَمَ `hide_follow_lists`** — **وهو عمودٌ في الصفّ لا شرطٌ في السياسة**، فيُحترم في الطبقة الأعلى ولا يُفرض في القاعدة. **وهذا صنفُ `S-03` نفسُه بحرفه** (عَلَمُ خصوصيّةٍ لا تفرضه الطبقةُ التي تحرس البيانات).
   - `communities/SELECT true` **مقصودٌ ظاهراً** (الاكتشاف)، **والخاصّةُ منها تُميَّز بعمود `is_private` لا تُحجب** — والعضويّةُ والرسائلُ محروستان فعلاً.
   - **`S-12` · P3-CANDIDATE** — معيار القبول: شرطُ ظهورٍ في سياسة `user_follows/SELECT` يحترم `hide_follow_lists` و`is_private`، **أو** قرارٌ موثَّقٌ بأن خريطةَ المتابعة عامّةٌ للمسجَّلين وإسقاطُ العَلَم من الواجهة (D-030: **لا وعدَ بلا باب**). **لا أرفعه فوق P3 قبل التحقّق الحيّ** — وهو `BLOCKED_BY_TEST_ENV`.

**والاستنتاج البنيويّ يثبت:** ثلاثةُ أسطحٍ عامّةٍ بطبيعتها (الملفّات · تعليقاتُ الأعمال · المراجعات) **قراءتُها ليست من الجداول** — سياساتُها كلُّها «صاحبُ الصفّ»، وستّةُ جداولَ لا تُستعلَم من الشيفرة إطلاقاً. **فالقراءةُ العامّةُ كلُّها تمرّ بطبقةٍ مميّزة** — وهو ما يجعل §9.2 و§9.6 قلبَ هذه المرحلة.

### 9.2 تدقيق الدوالّ — بمسار الاستدعاء والحارس والأثر

**الجرد:** 177 دالّة في `public` · 170 `SECURITY DEFINER` · 7 `INVOKER` · **130 غيرُ trigger يملك `anon` تنفيذَها**.

**🔴 تصحيحُ منهجٍ قبل الأرقام — وقعتُ في الخطأ الذي حذّرتَ منه ثمّ ضبطتُه:**

بنيتُ تصنيفَ «كاتبة/قارئة» على regex، **وأوّلُ صيغةٍ كتبتُها اليوم كانت `update <جدول> set`** — **فأسقطت دالّةً جسمُها `update public.user_list_items i set …`** لأنّ **الاسمَ المستعارَ `i` يفصل الجدولَ عن `set`**. **ودالّةٌ كاتبةٌ صُنّفت قارئةً هي بالضبط صنفُ الخطأ الذي قلتَ إن البحثَ عن الكلمات لا يكفي لتفاديه.** الصيغةُ المصحَّحة `update <جدول>( <مستعار>)? set`، **وأعدتُ التصنيفَ كلَّه عليها.** والدالّةُ المعنيّةُ هي `FW-05` نفسُها — **كانت مصنَّفةً كاتبةً في التسليم السابق، فالنتيجةُ المنشورةُ لم تتأثّر، والمنهجُ تأثّر.**

**وجوابان مباشران على اعتراضك:**

| سؤالك | الفحص | النتيجة |
|---|---|---|
| «قد تستخدم SQL ديناميكياً» | `execute ` في أجسام الـ130 كلِّها | **صفر** — **لا SQL ديناميكيَّ إطلاقاً في السطح المتاح للزائر** |
| «قد تستدعي دالّة أخرى كاتبة» | مطابقةُ اسمِ كلِّ كاتبةٍ (بحدود الكلمة) داخل جسم كلِّ قارئة | **صفر قارئةٍ تنادي كاتبة** |

**أ) الكاتبةُ المتاحةُ للزائر — 21 بعد إسقاط الـtrigger**

| المعرّف | ما تكتب فيه | الحارس | التصنيف | الدرجة |
|---|---|---|---|---|
| ٣ دوالّ | جداولُ إدارة | `am_admin()` + `raise exception` | ✅ | — |
| ١٢ دالّة | صفوفُ صاحب الجلسة | `auth.uid()` في الجسم | ✅ | — |
| `FW-01`…`FW-04` | نقراتُ شريك · لغاتُ زيارة · أحداثُ مزوّد · أخطاءُ عميل | **بلا حارسِ هويّة** | 🟢 قياسٌ مجهولٌ مقصود (append-only) — لا تصعيدَ صلاحية؛ الخطرُ إغراق | **`S-08` · P3** |
| **`FW-05`** | **جدولُ عناصرِ قوائمِ المستخدمين** | **بلا حارسِ هويّة** | 🔴 **كتابةٌ في محتوى مستخدم** | **قلبُ `LOOPZ-AUD-0040` · P1** |
| `FW-06` | مخبأُ تقييماتِ كتالوج | **بلا حارسِ هويّة** | 🟠 تسميمُ بياناتِ كتالوج لا خصوصيّة | **`S-09` · P2** |

**ب) القارئةُ المتاحةُ للزائر — 109، ومنها 32 تلمس جداولَ مستخدم**

> 🔴 **وهنا تصحيحٌ ثانٍ لعددٍ نشرتُه:** قلتُ في التسليم السابق **«21 قارئة تلمس جداول مستخدم»**. **والرقمُ الصحيح 32.** **والسببُ أنّ قائمةَ «جداول المستخدم» التي طابقتُ عليها كانت أقصرَ من الواقع** — أُسقطت منها جداولُ المجتمع والحظر والتفاعلات وزياراتِ الملفّ. **فالسطحُ أوسعُ ممّا أعلنتُ بخمسينَ بالمئة، وهذا يُسجَّل لا يُبتلع.**

**صفٌّ لكلِّ `FR-nn`** (الترقيمُ أبجديٌّ ثابت على أسماء الدوالّ المحجوبة · **كلُّها `SECURITY DEFINER` فكلُّها تتجاوز RLS** ما لم يُذكر خلافُه):

| المعرّف | المخرَج | الجداول الملموسة | حارسُ الظهور | المستهلِك | الحكم |
|---|---|---|---|---|---|
| `FR-01` | `boolean` | `user_follows` | لا | **دالّةُ سياسةٍ** (تُستدعى داخل RLS) | ✅ **جوابٌ بولياني عن علاقةٍ بين معرّفَين — لا بيانات** |
| `FR-02` | `integer` | `community_members` | لا | `lib/data.ts` | ✅ عدٌّ مجرّد |
| `FR-03` | `avg_rating, votes` | `ratings` | لا | `lib/data.ts` | ✅ **تجميعٌ فوق الجمهور** — لا صفَّ فرد |
| `FR-04` | `list_id, items` | `user_lists` · `user_list_items` | **`is_public`** | `lib/data.ts` | ✅ |
| `FR-05` | `source_slug, list_id` | `profiles` · `user_lists` | **`is_public`** | `lib/data.ts` | ✅ |
| `FR-06` | `text` | `user_lists` | **`is_public`** | `lib/data.ts` | ✅ |
| `FR-07` | تقييماتُ حلقاتِ عضوٍ بعينه | `episode_ratings` | **لا** | `lib/data.ts` | 🟠 **يعرض تقييماتِ عضوٍ بمعرّفه بلا مرشِّح خصوصيّة** — داخل `0040` |
| `FR-08` | `list_id, rank` | `user_lists` | **`is_public`** | **لا مستدعيَ في الشيفرة** | ✅ محتوًى منسَّق |
| `FR-09` | `followers, following` | `user_follows` | لا | `lib/data.ts` | 🟠 **عدّادان لأيِّ معرّف** — **وهو ما يحجبه `hide_follow_lists` في الواجهة** (انظر `S-12`) |
| `FR-10` | `boolean` | `blocks` | لا | **دالّةُ سياسة** | ✅ |
| `FR-11` | `boolean` | `community_members` | لا | **دالّةُ سياسة** | ✅ |
| `FR-12` | `boolean` | `communities` | لا | **دالّةُ سياسة** | ✅ |
| `FR-13` | `saves, reviews, avg` | `user_lists` · `list_reviews` · `list_saves` | **`is_public`** | `lib/data.ts` | ✅ |
| `FR-14` | `avg_rating, reviews` | `user_lists` · `list_reviews` | **`is_public`** | `lib/data.ts` | ✅ |
| `FR-15` | صفُّ الأكثرِ مشاهدةً في مدّة | `follows` · `watched_*` | لا | **لا مستدعيَ في الشيفرة** | ✅ **تجميعٌ فوق الجمهور** — لا معرّفَ عضوٍ في المخرَج |
| `FR-16` | شريحةُ متابعةٍ للأخبار | `follows` | لا | `lib/loopzNews.ts` | ✅ تجميع |
| `FR-17` | `json` عدّاداتٍ تشغيليّة | تسعةُ جداول | لا | **لا مستدعيَ في الشيفرة** | 🟠 **عدّاداتُ منصّةٍ متاحةٌ للزائر** — أرقامٌ إجماليّةٌ لا صفوف · **`S-13` · P3-CANDIDATE** |
| `FR-18` | `json` توزيعِ لغات | `profiles` | لا | **لا مستدعيَ في الشيفرة** | 🟠 كسابقتها — **`S-13`** |
| `FR-19` | `person_id, name, path` | `person_follows` | لا | `lib/data.ts` | 🟠 **فنّانو عضوٍ بمعرّفه بلا مرشِّح** — داخل `0040` |
| `FR-20` | `integer` | `profile_views` | لا | `lib/data.ts` | ✅ عدٌّ مجرّد |
| `FR-21` | القائمةُ العامّة كاملةً | `profiles` · `user_lists` · `user_list_items` | **`is_public` + `hide_name`** | `lib/data.ts` | ✅ **أدقُّ حارسٍ في الجدول** |
| `FR-22` | `tmdb_id, n` | `post_reactions` | لا | `lib/data.ts` | ✅ تجميع |
| `FR-23` | `integer` | `review_likes` | لا | `lib/data.ts` | ✅ عدٌّ مجرّد |
| `FR-24` | `boolean` | `title_posts` | لا | `lib/data.ts` | ✅ |
| `FR-25` | `hearts, votes, avg` | `user_lists` · `user_list_items` · `ratings` | لا | `lib/data.ts` | ✅ تجميع |
| `FR-26` | `id, member_count` | `communities` · `community_members` | لا | `lib/data.ts` | ✅ |
| `FR-27` | صفُّ الأعلى تقييماً في مدّة | `ratings` | لا | **لا مستدعيَ في الشيفرة** | ✅ تجميع |
| `FR-28` | `tmdb_id, genres` | `follows` | لا | `lib/data.ts` | ✅ تجميع |
| `FR-29` | متابعاتُ عضوٍ العامّة | `follows` | لا | `lib/data.ts` | 🟠 **مكتبةُ عضوٍ بمعرّفه بلا مرشِّح خصوصيّة** — داخل `0040` |
| `FR-30` | تقييماتُ عضو | `ratings` | لا | `lib/data.ts` | 🟠 **كسابقتها** — داخل `0040` |
| `FR-31` | ملخّصُ مشاهدةِ عضو | `watched_episodes` | لا | `lib/data.ts` | 🟠 **كسابقتها** — داخل `0040` |
| `FR-32` | أفلامُ عضوٍ المشاهَدة | `watched_movies` | لا | `lib/data.ts` | 🟠 **كسابقتها** — داخل `0040` |

**والخلاصةُ الصفّيّةُ تنقض تعميمي السابق:**

- **صفر دالّةٍ من الاثنتين والثلاثين تستشير `is_private`** — **العَلَمُ لا يُنفَّذ في طبقة الدوالّ إطلاقاً.** ثابتٌ محسوم، لا ينتظر بيئة.
- **لكنّ «حتى 16 قد تتجاوز الخصوصيّة» كان تعميماً.** **الفرزُ الصفّيُّ يقول: سبعُ دوالَّ تُخرج بياناتِ عضوٍ بعينه بمعرّفه** — **`FR-07` · `FR-09` · `FR-19` · `FR-29` · `FR-30` · `FR-31` · `FR-32`** — **والخمسُ والعشرون الباقيةُ تجميعٌ فوق الجمهور أو جوابٌ بولياني أو محروسٌ بـ`is_public`**، وتلك لا تتجاوز خصوصيّةَ أحدٍ لأنها لا تُخرج صفَّ أحد.

> ⚖️ **وتصحيحٌ حسابيٌّ ضبطه المراجع:** كتبتُ «تسع» **وسردتُ سبعاً** — **وحسبتُ `FR-17`/`FR-18` في العدد وهما تجميعيّتان لا تُخرجان صفَّ عضو**، وقد وضعتُهما بنفسي تحت `S-13` لا تحت الخصوصيّة. **العدد سبع، والاثنتان تبقيان في `S-13` وحدَه.**
- **فرأسُ `LOOPZ-AUD-0040` يضيق ويحدّ**: **سبعُ دوالِّ قراءةٍ بمعرّف + دالّةُ كتابةٍ واحدة (`FW-05`) + العرض `V-01`.** **P1 كما هي** — **والتضييقُ توصيفٌ أدقُّ لا تخفيف.**

### 9.3 دورة الجلسة والحذف والإبطال

**بلا تغيير عن التسليم الذي أجزتَ تصحيحَه** — مُبقًى كما هو: الحذفُ يُسقط `auth.sessions`/`identities`/`mfa_factors` بـ`ON DELETE CASCADE`، **والرموزُ المُصدَرةُ سلفاً تبقى صالحةً حتى `exp`**، ومدّةُ الرمز `BLOCKED_BY_TEST_ENV`، والخروجُ محلّيٌّ لا عامّ — **`S-10` · P3**.

### 9.4 GitHub / Vercel / Cron / Webhooks

بلا تغيير: لا مجلّد `.github/` ولا workflow · `vercel.json` بلا أسرار · وظيفةُ `pg_cron` واحدة بدور `postgres` · ولا webhook وارد عدا callbacks OAuth المحروسة. **وإعداداتُ المشروعَين الإداريّة `BLOCKED_BY_TEST_ENV`.**

### 9.5 سلسلة التوريد — الثمانيةَ عشرةَ كلُّها، بحالةِ إهجارٍ وتاريخ

**🟢 المانعُ ارتفع.** كان فحصُ الإهجار `BLOCKED_BY_TEST_ENV` لانقطاع سجلّ npm عن الحاوية؛ **الاستعلامُ نجح اليوم**، فالجدولُ مكتمل.

**المنهج — مصحَّحٌ بعد اعتراض المراجع:** كان `npm view <pkg> deprecated`، **وهو يفحص أحدثَ إصدارٍ لا المثبَّت** — **فحزمةٌ مثبَّتةٌ مهجورةٌ وأحدثُها غيرُ مهجورةٍ تمرّ صامتة.** أُعيد الفحصُ بصيغة **`npm view <pkg>@<الإصدار المثبَّت> deprecated`** للثمانيةَ عشرَ كلِّها · **تاريخ الفحص 2026-09-01** · **وضبطُ صحّةٍ مزدوج**: إصدارٌ قديمٌ غيرُ مهجور (`react@16.0.0`) أعاد فراغاً، وإصدارٌ مهجورٌ معروف (`request@2.88.0`) أعاد نصَّ الإهجار — **فغيابُ الحقل غيابُ إهجارٍ لا غيابُ فحص.**

> 🔴 **واعتراضُك أصاب صيداً**: الصيغةُ الأولى كانت ستُمرِّر **حزمةً مهجورةً فعلاً** أدناه.

| التبعية | النوع | المثبَّت | الأحدث | آخرُ نشر | مهجورة؟ | الاستعمال |
|---|---|---|---|---|---|---|
| `next` | prod | 16.3.0 | 16.3.4 | 2026-08-31 | **لا** | 267 مرجعاً |
| `react` | prod | 19.2.4 | 19.2.8 | 2026-09-01 | **لا** | 183 |
| `react-dom` | prod | 19.2.4 | 19.2.8 | 2026-09-01 | **لا** | 2 |
| `@supabase/supabase-js` | prod | 2.111.0 | 2.112.4 | 2026-09-01 | **لا** | 2 |
| `@supabase/ssr` | prod | 0.12.4 | 0.12.5 | 2026-08-24 | **لا** | 3 |
| `@vercel/speed-insights` | prod | 2.0.0 | 2.0.0 | 2026-07-03 | **لا** | 1 |
| `fast-xml-parser` | prod | 5.10.1 | 5.11.1 | 2026-08-27 | **لا** | 1 (RSS) |
| `@fontsource/poppins` | prod | 5.3.0 | 5.3.0 | 2026-07-19 | **لا** | `globals.css` |
| `@fontsource/tajawal` | prod | 5.3.0 | 5.3.0 | 2026-07-19 | **لا** | `globals.css` |
| 🟡 `@fontsource/cairo` | prod | 5.3.0 | 5.3.0 | 2026-07-19 | **لا** | **صفر مرجع** — `S-06` |
| `tailwindcss` | dev | 4.3.3 | 4.3.3 | 2026-08-31 | **لا** | `postcss.config.mjs` |
| `@tailwindcss/postcss` | dev | 4.3.3 | 4.3.3 | 2026-08-31 | **لا** | `postcss.config.mjs` |
| 🔴 **`eslint`** | dev | **9.39.5** | 10.9.1 | 2026-08-24 | **نعم — المثبَّتُ مهجور** («this version is no longer supported») | `eslint.config.mjs` |
| `eslint-config-next` | dev | 16.2.12 | **16.3.4** | 2026-08-31 | **لا** | `eslint.config.mjs` — `LOOPZ-AUD-0003` |
| 🟡 `typescript` | dev | 5.9.3 | **7.0.2** | 2026-09-01 | **لا** | مُصرِّف |
| 🟡 `@types/node` | dev | 20.19.43 | **26.4.0** | 2026-08-27 | **لا** | أنواع |
| `@types/react` | dev | 19.2.18 | 19.2.18 | 2026-07-30 | **لا** | أنواع |
| `@types/react-dom` | dev | 19.2.4 | 19.2.5 | 2026-08-23 | **لا** | أنواع |

**النتيجة — وهي غيرُ ما نشرتُه قبل ساعة:** **17 من 18 غيرُ مهجورة**، وأحدثُ نشرٍ لكلٍّ منها خلال ستّة أسابيع وأكثرُها خلال أسبوع، و`npm audit` = صفر تنبيه. **و`S-06` يبقى مرشَّحاً بدليله** (غيرُ مستعمَلة، لا مهجورة).

🔴 **والثامنةَ عشرةَ مهجورة: `eslint@9.39.5` — المثبَّتُ نفسُه.** npm يقول عنه حرفاً **«this version is no longer supported»**. **وهذا لا يكسر بناءً ولا يفتح ثغرةً في الإنتاج** (تطويريٌّ لا يُشحن)، **لكنّه يعني أن المُدقِّقَ الذي يحرس شيفرةَ التطبيق لم يعد يتلقّى إصلاحاتٍ ولا تصحيحاتِ قواعد** — **وأداةُ الحراسة إذا شاخت شاخ ما تحرسه معها.**

🆕 **وبندٌ خرج من الجرد — ورُفعت درجتُه بعد فحص المثبَّت:** **أربعُ تبعياتٍ متأخّرةٌ إصدارةً رئيسيّةً أو أكثر** — `typescript` (5 ← 7) · **`eslint` (9 ← 10، والمثبَّتُ مهجور)** · `@types/node` (20 ← 26) · و`eslint-config-next` أقدمُ من `next` (`0003`). **كلُّها تطويريّة فلا أثرَ على حزمة الإنتاج.**

**`S-14` · P2** (رُفعت من P3): **ليست تأخّرَ إصدارةٍ وحدَه، بل مُدقِّقٌ مهجورٌ صراحةً في سلسلة أدوات البناء.**

🔴 **ومعيارُ القبول الذي كتبتُه أوّلاً غيرُ قابلٍ للتنفيذ — جرّبتُه فسقط.** تثبيتُ `eslint@10.9.1` مع `eslint-config-next@16.3.0` **يُفشل التدقيقَ كلَّه** بـ`TypeError: … 'react/display-name': contextOrFilename.getFilename is not a function`. **والسببُ بنيويّ**: إضافاتُ إعدادِ Next (`eslint-plugin-react` · `eslint-plugin-import` · `eslint-plugin-jsx-a11y`) **مداها الأقصى `^9`** — **فالإصدارةُ المهجورةُ هي الوحيدةُ التي يدعمها الإعداد.** **والتجربةُ جرت في الحاوية ونُقضت، ولم يُشحن منها شيء.**

**فالمعيارُ المصحَّح:** **تثبيتٌ موثَّقٌ على `eslint@9`** يذكر صراحةً أنه لا يتلقّى إصلاحات، **ومتابعةُ `eslint-config-next` حتى تشحن إضافاتٍ متوافقةً مع 10**. **والدرجةُ تبقى P2 لأن العجزَ أعلى في السلسلة لا عندنا** — **وبندٌ لا نملك إصلاحَه لا يُخفَّض لأنه غيرُ قابلٍ للإصلاح.**

### 9.6 `S-03` و`S-04`

| المرشّح | الحسم | الحالة |
|---|---|---|
| 🔴 **`S-03`** (`V-01`) | `security_invoker = off` ⇒ **يتجاوز RLS** · `SELECT` ممنوحٌ لـ`anon` و`authenticated` · **و`pg_get_viewdef` بلا `WHERE` إطلاقاً** ⇒ يُرجع كلَّ الصفوف · و`is_private`/`hide_name` **عمودان مُخرَجان لا شرطان** | **`S-03` · P2 · مفتوحة** — بلا تخفيف |
| 🟢 **`S-04`** (`search_path`) | **الأدلّةُ الأربعةُ التي طلبتَها — أدناه** | **يسقط كعيبٍ، ويبقى ثابتاً واجبَ الحفظ** |

**`S-04` — المنهجُ والأدلّة، لا نتيجةٌ واحدةٌ على `public`:**

1. **ACL الفعليّ لا `has_schema_privilege` وحدَه:** فُحص **كلُّ مخطَّطٍ في القاعدة** (11 مخطَّطاً غيرَ نظاميّ) بـ**`aclexplode` على `nspacl`** مع `acldefault` للمخطّطات بلا ACL صريح — **بحثاً عن `grantee = 0`** (وهو `PUBLIC` في ACL) بامتياز `CREATE`. **النتيجة: صفر مخطَّطٍ يمنح `CREATE` لـ`PUBLIC`**، و`has_schema_privilege` لـ`anon` و`authenticated` = **`false` على الأحد عشر جميعاً**. مالكو المخطّطات: `supabase_admin` · `postgres` · `pg_database_owner`.
2. 🔴 **`TEMP` ممنوحٌ فعلاً — وهذا ما لم أوثّقه سابقاً:** `has_database_privilege('anon'|'authenticated', current_database(), 'TEMP') = **true**` (وهو الافتراضُ في Postgres: `TEMP` لـ`PUBLIC`). **فالمخطَّطُ المؤقّتُ قابلٌ للكتابة من دورٍ غير مميّز** — والادّعاءُ بأن المسارَ آمنٌ لأن `CREATE` ممنوعٌ **كان ناقصاً**.
3. **المسارُ الفعّال:** ستُّ صيغِ `search_path` مثبَّتةٍ على **170/170** دالّةِ `DEFINER` — `public` · `public, auth` · `public, pg_temp` · `public, auth, pg_temp` · `public, storage, pg_temp` · `ops, pg_temp`. **و`pg_temp` حيثما ورد فهو آخرُ المسار** (10 دوالّ)، **و160 دالّةً لا تذكره** — **وحين لا يُذكر يبحثه Postgres أوّلاً للعلاقات** (لا للدوالّ ولا للعوامل، فهذه لا تُبحث في المخطَّط المؤقّت أبداً). **فالسطحُ النظريُّ = تظليلُ جدولٍ لا تظليلُ دالّة.**
4. **تأهيلُ الأسماء — وهو الحاسم:** استُخرجت **كلُّ** مراجع العلاقات في أجسام الـ170 (`FROM`/`JOIN`/`UPDATE`/`INTO`) = **549 مرجعاً**: **396 مؤهَّلٌ بـ`public.` · 20 بـ`auth.` · وبقيّتُها أسماءُ CTE ومستعارات ودوالّ مولِّدةِ صفوف** (`generate_series` · `unnest` · `jsonb_to_recordset` …) **فُحصت واحداً واحداً**. **والعدد الحاسم: صفر مرجعٍ غيرِ مؤهَّلٍ إلى جدولٍ في `public`.**

> **الحكم:** **التظليلُ ممكنٌ نظريّاً (TEMP ممنوح) وغيرُ قابلٍ للتطبيق عمليّاً (لا اسمَ غيرَ مؤهَّلٍ يُظلَّل).** **فـ`S-04` يسقط كعيب** — **ويتحوّل إلى ثابتٍ واجبِ الحفظ**: **أيُّ دالّةِ `DEFINER` جديدةٍ تذكر جدولاً بلا `public.` تفتح البابَ فوراً.** معيار القبول: **فحصٌ آليٌّ قبل الدمج** يرفض دالّةَ `DEFINER` فيها مرجعٌ غيرُ مؤهَّل، **أو** إلحاقُ `pg_temp` بذيل مسار الـ160. **وأسحب صياغتي السابقة «اختطافُ المسار غيرُ ممكن» — الصوابُ: ممكنٌ ومُبطَلٌ بالتأهيل، لا ممتنعٌ بالصلاحيات.**

### 9.7 🔴 انحدارُ الإنتاج — دلتا قابلةٌ للتحقّق، ومغلقة

| الحقل | القيمة |
|---|---|
| **السبب** | سحبُ `EXECUTE` عن `anon` لدالّةٍ قارئةٍ لقوائم المستخدم — **نُفِّذ خارج حدود المرحلة على قاعدة الإنتاج** |
| **السطحُ المتأثّر** | صفحاتُ الأعمال العامّة (`/movie/[id]` · `/show/[id]`) لكلِّ **زائرٍ غيرِ مسجَّل** |
| **الأثرُ الوظيفيّ** | **صفر على المسجَّلين** (الدورُ المصادَق احتفظ بالتنفيذ) · القائمةُ تعود فارغةً للزائر (السلوكُ نفسُه) **+ ضجيجُ سجلّات** |
| **القياس** | ≈500–1000 خطأ/ساعة · **الذروة 1021** الساعة 10:00 UTC · ≈15,420/24h |
| **الاكتشاف** | **بلاغُ مستخدمٍ حقيقيّ عبر أحمد — لا بمراقبةٍ منّي** |
| **الإصلاح** | **حارسٌ في طبقة التطبيق** يمنع النداءَ أصلاً لغير المسجَّل — **لا منحةَ ثانية ولا تغييرَ صلاحيّات** |
| **SHA الإصلاح** | **`1b9ccd95`** على `main` · [`mccicc2-art/meshahed@1b9ccd95`](https://github.com/mccicc2-art/meshahed/commit/1b9ccd95) · موسومٌ `[deploy]` |
| 🔑 **ليس من Audited SHA** | **`f8a2b33c` لم يُمسّ · وفرعُ التدقيق لم يُمسّ · وهذا ليس دليلَ اجتيازٍ لـPhase 5 بحال** |
| **حالةُ الإنتاج الآن** | 🟢 **مغلق** — آخرُ ساعةٍ بأخطاءٍ **11:00 UTC (383)**، **وصفرٌ منذ 12:00 UTC حتى وقت هذا التسليم** (استعلامُ سجلّات Postgres بالساعة) |
| **حالةُ الصلاحيّة** | **السحبُ قائمٌ ولم يُعكَس**: `EXECUTE` لـ`anon` = **`false`** · لـ`authenticated` = **`true`** (مفحوصٌ بـ`has_function_privilege`) |

> ⚖️ **وهذا برهانٌ ميدانيٌّ على اعتراضك حرفاً.** قلتَ إن نجاحَ عدّةِ GETs لا يثبت سلامةَ RPCs. **فحصتُ خمسةَ مسارات GET وأعلنتُ السلامة — والكسرُ كان في مسارٍ لم يشمله الفحص.** **فالتحقّقُ الوظيفيُّ الكاملُ بعد أيِّ تغييرِ صلاحيات هو `BLOCKED_BY_TEST_ENV` بحقّ.**

**`S-11` · P2 — عمليّاتيّ:** لا مراقبةَ لمعدّل أخطاء القاعدة. **15 ألف خطأ يوميّاً مرّت 24 ساعة بلا إنذار.** معيار القبول: إنذارٌ على معدّل أخطاء Postgres قبل بوّابة GO.

### 9.8 حالةُ الاكتمال — `ANALYSIS_IN_PROGRESS`

**ما اكتمل في هذه الجولة:** المصفوفةُ الصفّيّةُ (128 سياسة + المستهلِك + جداولُ الصفر) · تدقيقُ الدوالّ صفّاً بصفّ (21 كاتبة + 32 قارئةً بمعرّفاتها) · **نفيُ الـSQL الديناميكيّ ونفيُ استدعاءِ القارئةِ لكاتبة** · سلسلةُ التوريد بتواريخها · و`S-04` بأدلّته الأربعة.

**وما يبقى مفتوحاً — ولا أسمّي المرحلةَ مكتملة:**

| البند | لماذا لم يكتمل |
|---|---|
| `LOOPZ-AUD-0040` · **P1** | **التحقّقُ الحيُّ من تسعِ دوالِّ القراءةِ بمعرّف و`FW-05` و`V-01` يحتاج حسابَين في بيئةٍ معزولة** — `BLOCKED_BY_TEST_ENV` |
| `S-03` · **P2** | كسابقه — الثابتُ محسوم، والتحقّقُ الحيُّ محجوب |
| `S-12` · P3-CANDIDATE | **جديدٌ من هذه الجولة** — يحتاج تحقّقاً حيّاً |
| `S-13` · P3-CANDIDATE | **جديدٌ** — دالّتا عدّاداتٍ تشغيليّةٍ متاحتان للزائر بلا مستدعٍ في الشيفرة |
| مدّةُ رمز الوصول (`S-10`) | إعدادُ Auth إداريّ — لا يُقرأ من المصدر ولا من البيانات الوصفية |
| إعداداتُ GitHub/Vercel الإدارية | خارجَ صلاحيتي، ولا أطلبها |

**المرشّحاتُ المسجَّلةُ في هذه الجولة:** `S-07` (P3) · `S-08` (P3) · `S-09` (P2) · `S-10` (P3) · `S-11` (P2) · **`S-12` (P3-CANDIDATE، جديد)** · **`S-13` (P3-CANDIDATE، جديد)** · **`S-14` (P2، جديد — رُفعت من P3 بعد فحص الإصدار المثبَّت)** — بانتظار أرقام `LOOPZ-AUD` منك.

## 10. إقرار

- ✅ **لم أستدعِ أيّ دالّة قاعدة بيانات، ولم أنفّذ أيّ كتابة، ولم ألمس نقطة Supabase REST.**
- ✅ **صفر قيمة سرّ وصفر بيان مستخدم** في هذا التقرير — والاستعلامات كلّها بيانات وصفية.
- ✅ **رفعت المرشَّح P1 فوراً** بملخّص آمن **قبل أيّ إصلاح**، وحجبت تفصيله ما دام مفتوحاً لأن المستودع عامّ. **وكُتب التفصيل بعد الإغلاق لا قبله.**
- ⚠️ **وشغّلت السحب على قاعدة الإنتاج** — **وهذا يخالف ثلاث قواعد قائمة** أعرضها كما هي: تعليمات أحمد المكتوبة «أُصرّح بتشغيل SQL في لوحة Supabase الخاصة بي» · وقيد ChatGPT في Phase 5 «لا تغيّر إعدادات Supabase» · وقاعدة «Production دون تغيير حتى بوابة GO». **عرضتُ الثلاث على أحمد صراحةً وخيّرته، فاختار «شغّلها أنت الآن».** فالنقض بإذن مالكٍ صريحٍ مسبوقٍ ببيان ما يُنقَض، **لا باجتهادٍ منّي ولا باستنتاجٍ من كلمة**.
- ✅ **ولم أتجاوز ما أُذن فيه**: خمسة أوامر سحبِ صلاحيات فقط — **صفر تعديل بيانات · صفر تعديل مخطَّط · صفر كود · صفر نشر · ولا `npm audit fix`**. وكلّها قابلة للرجوع بـ`GRANT`.
- ✅ **وتحقّقت بعد كل أمر لا قبله** — ولولا ذلك لسجّلت نجاحاً لم يقع في إحداها (`S-05`).
- ✅ لم أستخدم جلسة أحمد ولم أطلب منه بيانات اعتماد.
- ✅ **فصلت `SOURCE_VERIFIED` عن `PASSIVE_VERIFIED` عن `BLOCKED_BY_TEST_ENV` عن `NOT_APPLICABLE`، ولم أسمِّ محجوباً ناجحاً.**
- ✅ **وأعلنت ما لم يكتمل** في §8.5 بدل السكوت عنه.

- ✅ **استكملتُ التحليل الثابت الذي طلبه المراجع** (§9): مصفوفة الوصول · تصنيف الدوالّ القارئة · دورة الجلسة والحذف · GitHub/Vercel/Cron · التبعيات · وحسم `S-03`/`S-04` بالدليل — **كلّه بيانات وصفية ومصدر، صفر استدعاء وصفر تغيير**.
- ⚖️ **ونقضتُ استنتاجَين لي بالدليل**: **`S-03` يثبت عيباً P2** بعد أن كنتُ خفّضتُه استنتاجاً من وجود عمود — **وهو الفخُّ الذي حذّرتَ منه حرفاً** · **و`S-04` يسقط كعيبٍ لا لأن `CREATE` ممنوع**: **`TEMP` ممنوحٌ فعلاً لـ`anon` و`authenticated`، فالتظليلُ ممكنٌ نظريّاً** — **والذي يُبطله أن مراجعَ العلاقات مؤهَّلةٌ كلُّها** (549 مرجعاً · صفر غيرِ مؤهَّلٍ إلى `public`). **فهو ثابتٌ واجبُ الحفظ لا بندٌ ساقط** (§9.6).
- 🔴 **وسجّلت انحدارَ إنتاجٍ سبّبَه إصلاحي** (§9.7): ≈15,420 خطأً في 24 ساعة، اكتُشف ببلاغ مستخدمٍ لا بمراقبتي. **تحذيرُك من كفاية فحص الـGET تحقّق ميدانيّاً.**
- 🔴 **ولستُ أدّعي أن البيئة المعزولة هي المانع الوحيد.** المحسومُ ثابتاً محسوم (§9.2ب: صفر دالّة تستشير `is_private`؛ §9.6: العرض بلا `WHERE`)، **والباقي محجوبٌ بحقّ**.

**متوقّف عند البوابة. لن أبدأ Phase 6 قبل المراجعة، ولا أُجري أيّ تغيير على Production.**
