-- ============================================================
-- 131 — محفوظاتُ صاحبِ ملفٍّ أزوره · D-588
--
-- **طلبُ أحمد بلقطةٍ على تبويب Lists**: «اعرض الليستات الموجودة عنده
-- كاملة — حتى الي معطيها قلب وماهي حقّته».
--
-- **الناقصُ معرّفاتٌ لا بطاقات**: القوائمُ المحفوظةُ **معلنةٌ أصلاً
-- وتقرؤها سياسةُ `read public lists` القائمة**، وبطاقاتُها يشكّلها
-- `shapeListCards` كما يشكّل محفوظاتِ صاحبها (`getSavedLists`) —
-- **وما تحجبه RLS هو صفُّ الربط وحدَه** (`list_saves` «صفوفي أنا»).
-- **فالدالّةُ تعيد المعرّفَ وتاريخَ الحفظ ولا شيءَ غيرهما.**
--
-- **إضافةٌ خالصة** (لا `drop` ولا تعديلَ بيانات ولا سياسة)،
-- **والبوّابةُ `can_view_profile`** (نمطُ ١٢٩/١٣٠/٥٩ حرفاً).
-- ⚠️ **والمعلنةُ وحدَها تخرج**: قلبٌ على قائمةٍ أعادها صاحبُها خاصّةً
-- **يسقط من هنا بالشرط نفسِه الذي يُسقط بطاقتَها** — فلا معرّفَ يَعِد
-- ببطاقةٍ لا تُقرأ (D-217).
--
-- rollback: drop function if exists public.profile_saved_lists(uuid);
-- ============================================================

create or replace function public.profile_saved_lists(p_user uuid)
returns table (list_id uuid, saved_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select s.list_id, s.created_at
  from public.list_saves s
  join public.user_lists l on l.id = s.list_id
  where s.user_id = p_user
    and l.is_public
    and (auth.uid() = p_user or public.can_view_profile(p_user))
  order by s.created_at desc
  limit 200
$$;
revoke all on function public.profile_saved_lists(uuid) from public;
grant execute on function public.profile_saved_lists(uuid) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select proname from pg_proc where proname = 'profile_saved_lists';  -- صفٌّ واحد
-- select count(*) from public.profile_saved_lists(auth.uid());        -- رقمٌ لا خطأ
-- set local role anon; select count(*) from public.profile_saved_lists('<uuid>'); -- صفر
--
-- ⚠️ السياسات المفتوحة تبقى **أربعاً**.
