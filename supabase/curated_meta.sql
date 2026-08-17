-- ============================================================
--  Loopz — عدُّ قائمةِ لوبز وهويّتُها (الهجرة ١٠٧)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  بلاغُ أحمد: بطاقةُ «أفضل ٢٥٠ أنمي» تقول **٢٥٠** ومن يفتحها يجد
--  **١٤٠**.
--
--  ============ رقمٌ كان يُقرأ من الاسم لا من القائمة ============
--
--  `count = u.topLimit ?? 250` — **وعدٌ لا عدّ**. **وعتبةُ العشرين ألف
--  صوت** (D-323) أسقطت من الأنمي مئةً وعشرة، **فصار العنوانُ يَعِد ما لا
--  يجده من يفتح**. وهو حرفاً حكمُ D-219 (رقمٌ يكذب أسوأُ من لا رقم)
--  وحكمُ D-216 (المقامُ من البسط نفسِه).
--
--  **ولماذا دالّةٌ لا عدٌّ في الكود:** اثنتان وأربعون قائمةً فيها آلافُ
--  الصفوف — **وجلبُها كلِّها لرسم رقمٍ على بطاقةٍ إسراف** (D-205).
--  **والدالّةُ تأخذ مصفوفةَ معرّفات** فنداءٌ واحدٌ للصفحة كلِّها،
--  **والقائمةُ التي لا صفَّ لها يعود قارئُها إلى رقم القاموس** (D-028).
--
--  ============ و`curated_slug_of` تسدّ دَينَ D-328 عند الزائر ============
--
--  اسمُ قائمةِ لوبز مخزَّنٌ بالعربية **والهويّةُ في `source_slug`**،
--  فيُترجَم عند العرض (D-147/D-273). **والمسجَّلُ يأخذ العمودَ مع صفّه**
--  — **والزائرُ بلا حساب يقرأ عبر `public_list` وحدَها** (D-053) **وهي
--  لا تحمله**، فرابطُ «Top 250 Movies» المُشارَك كان يفتح عنواناً عربيّاً
--  لقارئٍ إنجليزيّ. **ونداءٌ خفيفٌ بمعرّفٍ واحد أرخصُ من تعديل دالّةِ
--  قراءةٍ مُشغَّلة** — وسياساتُ القراءة تبقى في `security*.sql` وحدَها
--  كما هي القاعدة.
--
--  ⚠️ **والعامّةُ وحدَها في الاثنتين**: عددُ عناصر قائمةٍ خاصّةٍ أو
--  هويّتُها تسريبٌ بثوب إحصاء (نصُّ `top_saved_lists` حرفاً).
--  ⚠️ **ولا `drop` ولا جدولَ ولا سياسة** — دالّتان جديدتان لا غير،
--  **فالسياساتُ المفتوحة تبقى أربعاً.**
-- ============================================================

begin;

create or replace function public.curated_list_counts(p_ids uuid[])
returns table (list_id uuid, items integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    (select count(*)::int from public.user_list_items i where i.list_id = l.id)
  from public.user_lists l
  where l.id = any(p_ids) and l.is_public;
$$;

revoke all on function public.curated_list_counts(uuid[]) from public;
grant execute on function public.curated_list_counts(uuid[]) to authenticated;

create or replace function public.curated_slug_of(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select l.source_slug
  from public.user_lists l
  where l.id = p_id and l.is_public;
$$;

-- **والزائرُ بلا حساب يحتاجها** — هذا سببُ وجودها أصلاً (D-053)
revoke all on function public.curated_slug_of(uuid) from public;
grant execute on function public.curated_slug_of(uuid) to anon, authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc
--      where proname in ('curated_list_counts','curated_slug_of'))  as fns,
--   (select count(*)::int from pg_policies where qual = 'true')     as open_policies;
-- المتوقّع: fns = 2 · open_policies = 4
--
-- والعددُ الحقيقيُّ لقوائم لوبز الثلاث الكبرى:
--   select ul.source_slug, c.items
--   from public.curated_list_ids() ci
--   join public.user_lists ul on ul.id = ci.list_id
--   join lateral public.curated_list_counts(array[ci.list_id]) c on true
--   where ul.source_slug like 'top250%';
