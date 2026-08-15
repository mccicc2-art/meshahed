-- ============================================================
--  ٨٢ — people_page2 · «أعلى تعليق» تقبل سقفاً (D-264)
--  تُشغَّل بعد people_page.sql (81)
--
--  **طلبُ أحمد:** «وأعلى تعليق أظهر ٣ بدل واحد» — **و«عرض الكل» عشرة.**
--
--  ================= لماذا هجرةٌ لا تعديلُ واجهة =================
--
--  **السقفُ كان `limit 1` مكتوباً في جسم الدالّة**، لا معاملاً — **فلا
--  تستطيع الواجهةُ أن تطلب ثلاثة مهما فعلت.** وهذا هو الفرقُ بين
--  «الحدّ في القاعدة» (D-193) وبين **حدٍّ متجمّد**: الأوّلُ يحرس،
--  **والثاني يقرّر عن الواجهة قراراً ليس له.**
--
--  ⚠️ **وتُحذف أوّلاً ثم تُنشأ**: إضافةُ معاملٍ **توقيعٌ جديد** لا تعديل،
--  و`create or replace` كانت ستترك النسختين معاً — **فيبقى نداءُ
--  `{p_days}` يذهب إلى القديمة ذاتِ الصفّ الواحد**، وهو عطلٌ صامتٌ
--  يمرّ من الفحوص كلِّها (D-037/D-214).
--
--  **ولا شيءَ آخر يتغيّر:** نفسُ الأعمدة · نفسُ الحرّاس (`hide_name`
--  والحظر و`is_system`) · نفسُ النافذة · **ولا سياسةَ قراءةٍ خامسة.**
--  آمنةٌ للإعادة، ولا تُنشئ جدولاً ولا عموداً.
-- ============================================================

begin;

drop function if exists public.people_top_review(integer);

--  **والسقفُ الأعلى عشرون** كسقف `people_leaderboard`: «عرض الكل» عشرة،
--  **وما فوق ذلك ليس قسماً بل صفحةَ أرشيف** لم تُطلب.
create or replace function public.people_top_review(
  p_days  integer default 30,
  p_limit integer default 3
)
returns table (
  user_id     uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  title       text,
  poster_path text,
  review      text,
  rating      smallint,
  likes       integer,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.user_id,
    case when coalesce(p.hide_name,false) then null else p.nickname end,
    case when coalesce(p.hide_name,false) then null else p.username end,
    case when coalesce(p.hide_name,false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    g.tmdb_id, g.media_type, g.title, g.poster_path,
    g.review, g.rating,
    count(l.*)::int as likes,
    g.updated_at
  from public.ratings g
  join public.profiles p on p.id = g.user_id
  join public.review_likes l
    on l.review_user_id = g.user_id and l.tmdb_id = g.tmdb_id and l.media_type = g.media_type
  where auth.uid() is not null
    and g.review is not null and length(btrim(g.review)) > 0
    and g.updated_at >= now() - make_interval(days => least(greatest(coalesce(p_days,30),1), 365))
    and coalesce(p.is_system, false) = false
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = g.user_id)
         or (b.blocker_id = g.user_id and b.blocked_id = auth.uid())
    )
  group by g.user_id, p.hide_name, p.nickname, p.username, p.avatar_url,
           g.tmdb_id, g.media_type, g.title, g.poster_path, g.review, g.rating, g.updated_at
  order by count(l.*) desc, g.updated_at desc
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

revoke all on function public.people_top_review(integer, integer) from public;
grant execute on function public.people_top_review(integer, integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname in
--      ('people_leaderboard','people_top_review','people_watching'))        as fns,
--   (select count(*)::int from pg_proc where proname = 'people_top_review') as top_review_overloads,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                           as open_policies;
--
--  **المتوقَّع:** `fns=3 | top_review_overloads=1 | open_policies=4`.
--  ⚠️ **و`top_review_overloads` هو بيتُ القصيد**: اثنان يعني أن القديمة
--  بقيت، **وأن نداءَ الواجهة سيذهب إليها ويعود بصفٍّ واحد.**
