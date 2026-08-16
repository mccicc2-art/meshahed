-- ============================================================
--  ٩٨ — ratings_backdrop · **غلافُ «أعلى التعليقات» الحقيقيّ** (D-313)
--  تُشغَّل بعد news_by_title_and_cleanups.sql (97)
--
--  دَينُ D-283 المكتوبُ في بطاقة القسم نفسِها: «المصدرُ هو الملصقُ لا
--  الغلافُ العريض — `ratings` لا تحمل `backdrop_path`، وإضافتُه تغيّر
--  أعمدةَ الدالّة أي `drop` وهو خارج الإذن». **وأذن أحمد اليومَ.**
--
--  **العمودُ يُضاف، والدالّةُ تُحذف وتُعاد بعموده** (D-037).
--  **ولا تدويرَ للصفوف القائمة**: الغلافُ لا يُشتقّ من الملصق، **وقيمةٌ
--  تُخترع أسوأُ من غياب** (D-216) — الصفوفُ القديمة تبقى فارغةً
--  **والواجهةُ تعود لملصقها الممدود كما كانت** (D-179)، وكلُّ حفظٍ
--  جديدٍ من صفحة العمل يملأ عمودَه.
--
--  آمنةٌ للإعادة، ولا سياسةَ قراءةٍ خامسة.
-- ============================================================

begin;

alter table public.ratings
  add column if not exists backdrop_path text;

drop function if exists public.people_top_review(integer, integer);

create or replace function public.people_top_review(
  p_days  integer default 30,
  p_limit integer default 3
)
returns table (
  user_id       uuid,
  nickname      text,
  username      text,
  avatar_url    text,
  hide_name     boolean,
  tmdb_id       integer,
  media_type    text,
  title         text,
  poster_path   text,
  backdrop_path text,
  review        text,
  rating        smallint,
  likes         integer,
  created_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with liked as (
    select
      g.user_id,
      case when coalesce(p.hide_name,false) then null else p.nickname end   as nickname,
      case when coalesce(p.hide_name,false) then null else p.username end   as username,
      case when coalesce(p.hide_name,false) then null else p.avatar_url end as avatar_url,
      coalesce(p.hide_name, false)                                          as hide_name,
      g.tmdb_id, g.media_type, g.title, g.poster_path, g.backdrop_path,
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
             g.tmdb_id, g.media_type, g.title, g.poster_path, g.backdrop_path,
             g.review, g.rating, g.updated_at
  ),
  best as (
    select distinct on (k.user_id) k.*
    from liked k
    order by k.user_id, k.likes desc, k.updated_at desc
  )
  select
    b.user_id, b.nickname, b.username, b.avatar_url, b.hide_name,
    b.tmdb_id, b.media_type, b.title, b.poster_path, b.backdrop_path,
    b.review, b.rating, b.likes, b.updated_at
  from best b
  order by b.likes desc, b.updated_at desc
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

revoke all on function public.people_top_review(integer, integer) from public;
grant execute on function public.people_top_review(integer, integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — صفٌّ واحدٌ مجمّع (D-247)
-- ============================================================
-- select
--   (select count(*)::int from information_schema.columns
--      where table_schema='public' and table_name='ratings'
--        and column_name='backdrop_path')                                  as col,
--   (select count(*)::int from pg_proc
--      where proname='people_top_review'
--        and pg_get_functiondef(oid) like '%backdrop_path%')               as fn_has_col,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                          as open_policies;
--
--  **المتوقَّع:** `col=1 | fn_has_col=1 | open_policies=4`.
