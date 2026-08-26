-- ============================================================
--  Loopz — الهجرة ١٤٩: رايةُ التشغيل على المحفوظة (D-674)
--  شغّلها في Supabase → SQL Editor
--
--  حكمُ أحمد (٢٦ أغسطس): «نعم الكل له مفتاح تشغيل و إيقاف» — بعد أن
--  سُئل: أيكفي المفتاحُ على قوائمك أنت أم يشمل ما حفظتَه من غيرك؟
--
--  ولماذا عمودٌ على `list_saves` لا على `user_lists`:
--  رايةُ ١٢٢ (`user_lists.is_playlist`) صفةٌ للقائمة يكتبها **مالكُها**،
--  وسياسةُ «own lists» تمنع غيرَه — فلو كُتبت هناك لقلب حافظُ القائمة
--  رايةَ صاحبها على كلِّ الناس. **وهذه رايةُ قارئٍ لا رايةُ قائمة**:
--  «شغّلْ لي أنا هذه المحفوظة في تابِع المشاهدة» — فمكانُها صفُّ حفظه.
--
--  ولا سياسةَ جديدة: سياسةُ «own list saves» (ALL على auth.uid()=user_id)
--  تغطّي التحديث، **وشرطُ `with check` القائم يبقى حارساً**: الصفُّ لا
--  يوجد أصلاً إلا لقائمةٍ عامّةٍ ليست لك.
--
--  والكودُ يحتملها غائبة: قبل تشغيلها يعيد `eq("is_playlist")` خطأَ
--  عمودٍ مجهول فتعود القراءةُ فارغةً — بلا مفتاحٍ وبلا شاشة خطأ.
-- ============================================================

alter table public.list_saves
  add column if not exists is_playlist boolean not null default false;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- ١) العمود (المتوقَّع صفٌّ واحد: is_playlist | boolean | false):
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema='public' and table_name='list_saves'
--   and column_name='is_playlist';
--
-- ٢) لا صفَّ قائمٍ تبدّل (المتوقَّع 0):
-- select count(*) from public.list_saves where is_playlist;
--
-- ٣) السياساتُ المفتوحة كما هي (المتوقَّع 4):
-- select count(*) from pg_policies where schemaname='public' and qual='true';
--
-- rollback: alter table public.list_saves drop column if exists is_playlist;
