-- ============================================================
--  Meshahed — لوحة الصدارة: الأعلى تقييماً والأكثر مشاهدة
--  شغّله في Supabase → SQL Editor
-- ============================================================

-- فهارس تخدم النافذة الزمنية للوحة الصدارة
create index if not exists ratings_updated_idx
  on public.ratings (updated_at desc);
create index if not exists follows_added_idx
  on public.follows (added_at desc);
create index if not exists watched_ep_time_idx
  on public.watched_episodes (watched_at desc);
create index if not exists watched_mv_time_idx
  on public.watched_movies (watched_at desc);

-- ---------- الأعلى تقييماً ----------
-- top_rated_period نسختها القانونية في security.sql (صارت security definer
-- بعد إغلاق قراءة جدول التقييمات) — حُذفت النسخة القديمة invoker من هنا
-- حتى لا يعيد تشغيلُ هذا الملف تعريفَها فتنكسر اللوحة بصمت.

-- ---------- الأكثر مشاهدة ----------
-- «مشاهدة» = مَن أضافه لمكتبته + مَن أشّر حلقاته/شاهده فعلاً.
--
-- جداول follows و watched_* مقصورة على صاحبها بسياسات RLS، فلا يمكن
-- تجميعها بـ security invoker. الدالة security definer لكنها لا تُرجع
-- أي معرّف مستخدم — أعداداً مجمّعة فقط، فلا تتسرّب مكتبة أحد.
create or replace function public.most_watched_period(days integer default 7)
returns table (
  tmdb_id      integer,
  media_type   text,
  title        text,
  poster_path  text,
  followers    integer,
  viewers      integer,
  episodes     integer,
  score        numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with cutoff as (
    select case
             when coalesce(days, 7) <= 0 then '-infinity'::timestamptz
             else now() - make_interval(days => least(days, 3650))
           end as since
  ),
  adds as (
    select f.tmdb_id, f.media_type,
           count(distinct f.user_id)::integer as followers
    from public.follows f, cutoff c
    where f.added_at >= c.since
    group by f.tmdb_id, f.media_type
  ),
  eps as (
    select w.show_tmdb_id as tmdb_id, 'tv'::text as media_type,
           count(distinct w.user_id)::integer as viewers,
           count(*)::integer                  as episodes
    from public.watched_episodes w, cutoff c
    where w.watched_at >= c.since
    group by w.show_tmdb_id
  ),
  mvs as (
    select w.movie_tmdb_id as tmdb_id, 'movie'::text as media_type,
           count(distinct w.user_id)::integer as viewers,
           0::integer                         as episodes
    from public.watched_movies w, cutoff c
    where w.watched_at >= c.since
    group by w.movie_tmdb_id
  ),
  seen as (
    select * from eps
    union all
    select * from mvs
  ),
  merged as (
    select
      coalesce(a.tmdb_id, s.tmdb_id)       as tmdb_id,
      coalesce(a.media_type, s.media_type) as media_type,
      coalesce(a.followers, 0)             as followers,
      coalesce(s.viewers, 0)               as viewers,
      coalesce(s.episodes, 0)              as episodes
    from adds a
    full outer join seen s
      on s.tmdb_id = a.tmdb_id and s.media_type = a.media_type
  ),
  -- العنوان والملصق من أي صف متابعة للعمل نفسه (لا يخص مستخدماً بعينه)
  named as (
    select
      m.*,
      (select f.title       from public.follows f
        where f.tmdb_id = m.tmdb_id and f.media_type = m.media_type
        order by f.added_at desc limit 1) as title,
      (select f.poster_path from public.follows f
        where f.tmdb_id = m.tmdb_id and f.media_type = m.media_type
        order by f.added_at desc limit 1) as poster_path
    from merged m
  )
  select
    n.tmdb_id,
    n.media_type,
    n.title,
    n.poster_path,
    n.followers,
    n.viewers,
    n.episodes,
    -- المتابع أثقل من المشاهد الواحد، والحلقات وزنها خفيف حتى لا يتصدّر
    -- شخصٌ واحد أنهى ستّين حلقة في ليلة على عملٍ تابعه عشرة أشخاص
    round(n.followers * 3 + n.viewers * 2 + n.episodes * 0.2, 2) as score
  from named n
  where n.title is not null
  order by score desc, n.followers desc
  limit 40;
$$;

revoke all on function public.most_watched_period(integer) from public;
grant execute on function public.most_watched_period(integer) to authenticated;
