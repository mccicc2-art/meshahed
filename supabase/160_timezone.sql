-- ============================================================================
-- 160_timezone.sql — منطقةُ القارئ الزمنيّة (D-806)
-- ============================================================================
--
-- 🔴 **العطلُ الذي تُغلقه**: «وقتُ الذروة» في التقرير و«خريطةُ المشاهدة»
-- في تبويب العادات **تُحسبان بتوقيت غرينتش** — `getUTCHours()` هو كلُّ
-- ما يملكه الخادم. **فقارئٌ في UTC+3 ذروتُه ١١ص–١م يقرأ «٨–١٠ صباحاً»**،
-- **وخانةُ «آخر الليل» في خريطته ليست ليلَه.** **ورقمٌ يُعرض خطأً أسوأُ
-- من رقمٍ لا يُعرض** (D-063/D-217).
--
-- 🔑 **ولماذا عمودٌ لا كوكي**: **الكوكي يضيع بين الأجهزة**، **والصورةُ
-- المشارَكة (`/api/share`) تُولَّد على الخادم بلا طلبٍ من متصفّحه** —
-- **فبطاقةٌ تُشارَك بساعةٍ خاطئةٍ تكذب على من يراها لا على صاحبها وحده.**
--
-- ⚠️ **ولا بياناتٍ شخصيّةً جديدة**: اسمُ منطقةٍ من قائمة IANA
-- (`Asia/Riyadh`) — **لا موقعَ ولا إحداثيّاتٍ ولا عنوان** — **وهو ما
-- يرسله كلُّ متصفّحٍ لكلِّ موقعٍ في `Intl` أصلاً.**
--
-- ⚠️ **ولا سياسةَ جديدة**: `profiles` محروسٌ منذ يومه، **وصاحبُ الصفّ
-- وحدَه يكتب صفَّه** — والعمودُ يرث ذلك بلا سطر.
--
-- ⚠️ **ولا صفَّ قائمٌ يُمسّ**: `add column` وحدَها، **والغائبُ يعني
-- غرينتش** — وهو سلوكُ اليوم بالضبط، فلا يتغيّر شيءٌ لمن لم يُملأ عموده.

alter table public.profiles
  add column if not exists timezone text;

-- 🔴 **ومنحُ العمود بالاسم — وإلّا فالعمودُ للقراءة وحدَها.**
-- **`profiles` محروسٌ بمنحٍ على مستوى الأعمدة** (منذ ١٥٦): `authenticated`
-- يملك `update` على **أربعةٍ وعشرين عموداً مسمّى** لا على الجدول —
-- **فلا يمنح أحدٌ نفسَه `plan` ولا `founder` ولا `verified_at`.**
-- 🔴 **وعمودٌ جديدٌ لا يرث ذلك المنح**: **شُحن هذا الملفُّ أوّلَ مرّةٍ
-- بلا هذا السطر فسقطت الكتابةُ ثلاثَ مرّاتٍ صامتة** — **وكشفها
-- `runtime_errors` لا الشاشة** (D-668 يعمل).
-- 🔑 **والقاعدةُ للجولات القادمة**: **كلُّ عمودٍ جديدٍ على `profiles`
-- يكتبه صاحبُه يحتاج سطرَ `grant update (col)` بجانب `add column`** —
-- **وهجرةٌ تَعِد بحقلٍ لا يُكتب هي هجرةٌ نصفُها.**
grant update (timezone) on public.profiles to authenticated;

comment on column public.profiles.timezone is
  'اسمُ منطقة IANA من متصفّح صاحب الحساب (Asia/Riyadh) — يملؤه TimezoneSync مرّةً. null = غرينتش.';

-- ═══ فحصٌ صحّيّ ═══
-- select column_name, data_type from information_schema.columns
-- where table_schema = 'public' and table_name = 'profiles' and column_name = 'timezone';
-- select tablename, policyname from pg_policies
-- where schemaname = 'public' and qual = 'true';   -- المتوقَّع خمسٌ
-- select privilege_type, column_name from information_schema.column_privileges
-- where table_schema='public' and table_name='profiles'
--   and grantee='authenticated' and column_name='timezone';   -- المتوقَّع SELECT + UPDATE
