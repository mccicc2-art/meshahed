-- ============================================================================
-- 161_smart_lists.sql — القوائمُ الذكيّة (D-818)
-- ============================================================================
--
-- **حكمُ أحمد**: «نفّذ الـ٢٤» — البندُ الثالث: **قوائمُ تتحدّث بشروطٍ
-- يضعها صاحبُها.**
--
-- 🔑 **والشرطُ يسكن صفَّ القائمة لا جدولاً ثانياً**: **شرطٌ واحدٌ لقائمةٍ
-- واحدة** — **وجدولٌ بصفٍّ لكلِّ قائمةٍ علاقةُ واحدٍ لواحدٍ مكتوبةً
-- جدولاً**، وهي نسخةٌ ثانيةٌ من مفتاح القائمة بلا مقابل.
--
-- 🔑 **ومفرداتُ الشرط هي مفرداتُ الفلاتر بعينها** (`FILTER_KEYS` في
-- `lib/savedFilters.ts`، D-816) — **ولغةُ شروطٍ ثانيةٌ تعني مطهِّرَين
-- ومترجمَين يفترقان عند أوّل محورٍ جديد** (D-145).
--
-- ⚖️ **والمصدرُ «كتالوج Loopz» وحدَه في هذه الدفعة** — ولا «من مكتبتي»:
-- **قائمةٌ شرطُها «ما لم أُكمله» تُشارَك فيراها القارئُ فارغةً أو يرى
-- مكتبةَ غيره** — **ورابطٌ يعني شيئين لكلِّ فاتحٍ ليس رابطاً** (حجّةُ
-- `browseHref` في D-179). **والعمودُ يقبل الثانيةَ اليوم بلا هجرة**،
-- فتلحق بقاعدةٍ مكتوبةٍ لا بعمودٍ جديد.
--
-- ⚠️ **ولا صفَّ قائمٌ يُمسّ**: `add column` وحدَها بلا قيمةٍ افتراضيّة —
-- **والغائبُ يعني «قائمةٌ عاديّة»** كما كان قبل هذه الهجرة تماماً.
--
-- ⚠️ **ولا سياسةَ جديدة**: `user_lists` محروسٌ منذ يومه بسياساته،
-- **والعمودان يرثانها بلا سطر** — **ولا يزيد `open_policies` واحداً.**

-- ============================================================
--  ١) نوعٌ خامسٌ للقائمة
-- ============================================================
-- ⚠️ **والقيدُ يُعاد كتابتُه كاملاً لا يُضاف إليه** — نمطُ `favorites.sql`
--    بعينه: `check` ليست قابلةً للتوسيع، **وقيدان بالاسم نفسِه لا يجتمعان.**
alter table public.user_lists drop constraint if exists user_lists_kind_check;
alter table public.user_lists
  add constraint user_lists_kind_check
  check (kind in ('regular', 'ranked', 'watch_order', 'favorites', 'smart'));

-- ============================================================
--  ٢) الشرطُ ومصدرُه
-- ============================================================
alter table public.user_lists add column if not exists rule jsonb;
alter table public.user_lists add column if not exists rule_source text;

-- **ومصدرٌ لا يُعرف يُرفض عند الكتابة لا يُصحَّح عند القراءة**:
-- `catalog` = كتالوج Loopz (يُحسب لكلِّ قارئ) · `library` = مكتبةُ صاحبها
-- (**غيرُ مبنيٍّ بعد — والقيدُ يقبله كي لا تُعاد الهجرةُ يومَ يُبنى**).
alter table public.user_lists drop constraint if exists user_lists_rule_source_check;
alter table public.user_lists
  add constraint user_lists_rule_source_check
  check (rule_source is null or rule_source in ('catalog', 'library'));

-- 🔴 **وقائمةٌ ذكيّةٌ بلا شرطٍ قائمةٌ فارغةٌ إلى الأبد** — **والقاعدةُ
--    تمنع الحالةَ المستحيلة بدل أن يحرسها كلُّ قارئ** (D-636: اسألِ
--    البياناتِ لا السطح).
alter table public.user_lists drop constraint if exists user_lists_smart_needs_rule;
alter table public.user_lists
  add constraint user_lists_smart_needs_rule
  check (kind <> 'smart' or (rule is not null and rule_source is not null));

-- ============================================================
--  ٣) الأذونُ بالاسم — **وهجرةٌ تَعِد بحقلٍ لا يُكتب هجرةٌ نصفُها**
-- ============================================================
-- 🔴 **درسُ الهجرة ١٦٠ بحرفه**: `profiles` تُمنح بالعمود، **و`user_lists`
--    ممنوحةٌ على الجدول** — **فُحص قبل كتابة هذا السطر ولم يُفترض.**
--    وإن كانت المنحةُ على الجدول فهذان العمودان يرثانها، **وهذا السطرُ
--    لا يضرّ ويصرّح بالنيّة.**
grant update (rule, rule_source) on public.user_lists to authenticated;

comment on column public.user_lists.rule is
  'شرطُ القائمة الذكيّة — مفاتيحُ FILTER_KEYS نفسُها (lib/savedFilters.ts). null = قائمةٌ عاديّة.';
comment on column public.user_lists.rule_source is
  'catalog = كتالوج Loopz · library = مكتبةُ صاحبها (غيرُ مبنيٍّ بعد).';

-- ═══ فحصٌ صحّيّ — تُنسخ نتائجُه إلى claude/PLAN-24-plus-features.md ═══
-- select column_name, data_type from information_schema.columns
--   where table_schema='public' and table_name='user_lists'
--     and column_name in ('rule','rule_source');            -- المتوقَّع صفّان
-- select conname from pg_constraint
--   where conrelid = 'public.user_lists'::regclass
--     and conname like 'user_lists_%check' or conname = 'user_lists_smart_needs_rule';
-- select count(*) from public.user_lists where kind = 'smart';   -- المتوقَّع 0
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';              -- المتوقَّع خمسٌ (بلا زيادة)
