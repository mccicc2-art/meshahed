-- ============================================================
--  Loopz — نبضُ العمل: قلوبٌ وتقييمات في نداءٍ واحد (هجرة 118، D-408)
--  شغّلها في Supabase → SQL Editor بعد community_spoiler_restore.sql (117)
--
--  الطلب (أحمد، بلقطةٍ على الفراغ جنب الملصق): «في هذي المساحة أحتاج
--  أعرف كم واحد معطيه قلب وكم تقييمه».
--
--  ولماذا دالّةٌ واحدةٌ لا اثنتان:
--    · التقييمُ موجودٌ أصلاً (`community_rating`) — **وهو نصفُ الجواب.**
--    · والقلوبُ لا تُقرأ بلا `definer`: المفضّلةُ قائمةٌ في `user_lists`
--      بعلامة `kind='favorites'` (هجرة 55)، **وسياساتُها تُظهر قوائمَ
--      صاحبها وحدَه** — فالعدُّ عبر الجدول يعود واحداً دائماً (قلبُك أنت).
--    · **وسطرٌ واحد في الترويسة يُقرأ بنداءٍ واحد**: نداءان متسلسلان
--      لحقيقتين تُعرضان معاً كلفةٌ بلا مقابل (D-071).
--
--  ⚠️ ولا جدولَ ولا سياسة: السياساتُ المفتوحة تبقى **أربعاً**.
--  ⚠️ ولا هويّةَ تُكشف: **عددٌ فقط** — لا مَن أحبَّ ولا مَن قيَّم.
--     والقوائمُ الخاصّةُ تُعدُّ كالعامّة عمداً: **الرقمُ نبضُ العمل لا
--     قائمةُ أسماء**، وكشفُ العدد لا يكشف صاحبَه.
-- ============================================================

create or replace function public.title_pulse(t_id integer, m_type text)
returns table (hearts integer, votes integer, avg_rating numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      select count(*)::integer
      from public.user_list_items i
      join public.user_lists l on l.id = i.list_id
      where l.kind = 'favorites'
        and i.tmdb_id = t_id
        and i.media_type = m_type
    ),
    (
      select count(*)::integer
      from public.ratings r
      where r.tmdb_id = t_id and r.media_type = m_type
    ),
    (
      select coalesce(avg(r.rating), 0)::numeric
      from public.ratings r
      where r.tmdb_id = t_id and r.media_type = m_type
    );
$$;

revoke all on function public.title_pulse(integer, text) from public;
grant execute on function public.title_pulse(integer, text) to authenticated;
-- **وتُقرأ بلا حساب** كأختها في `public_reads.sql` (D-221): صفحةُ العمل
-- تُفتح من رابطٍ مشارَك، **ونبضُها جزءٌ ممّا يراه الزائر.**
grant execute on function public.title_pulse(integer, text) to anon;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select * from public.title_pulse(125988, 'tv');     -- ثلاثةُ أعمدة
-- select count(*) from pg_proc where proname = 'title_pulse';   -- 1
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';        -- **أربعٌ بالضبط**
