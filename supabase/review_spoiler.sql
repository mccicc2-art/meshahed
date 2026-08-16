-- ============================================================
--  ١٠٠ — review_spoiler · **«رسالتي فيها حرق» في الريفيو** (D-315)
--  تُشغَّل بعد global_room_pins.sql (99)
--
--  الدفعةُ الثانية المؤجَّلة من D-271 («والنقاشُ أوّلاً باختياره،
--  والريفيو في دفعةٍ ثانية لأن نصَّه يُقرأ من دوالَّ حيّةٍ عدّة») —
--  وأذن أحمد («نفّذ كل شي»).
--
--  ================= العمودُ والحَملة =================
--
--  **`ratings.has_spoiler` كأخيه في `title_posts` حرفاً** (الهجرة ٨٤):
--  `not null default false` — الصفوفُ القديمة لم يُعلن أصحابُها حرقاً،
--  **والعَلَمُ من الكاتب وحدَه لا استنتاجُنا** (D-268).
--
--  **وخمسُ دوالَّ تُحذف وتُعاد** (D-037) لأن نصَّ الريفيو يخرج منها:
--  `title_reviews` · `following_activity_v2` · `community_activity` ·
--  `user_ratings` · `people_top_review` — **والعمودُ في ذيل كلٍّ منها**
--  فالقارئُ المنشور لا يراه ولا يسقط (D-028).
--  ⚠️ **و`title_reviews` تُمنح لـ`anon` أيضاً** — غرفةُ العمل تُقرأ بلا
--  حساب (D-221/public_reads)، **وحذفُ الدالّة يُسقط منحَها فيُعاد.**
--
--  آمنةٌ للإعادة، ولا سياسةَ قراءةٍ خامسة.
-- ============================================================

begin;

alter table public.ratings
  add column if not exists has_spoiler boolean not null default false;

-- ============ ١ · title_reviews — صفحةُ العمل ============
drop function if exists public.title_reviews(integer, text);

create or replace function public.title_reviews(t_id integer, m_type text)
returns table (
  id          uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  rating      smallint,
  review      text,
  updated_at  timestamptz,
  has_spoiler boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.user_id as id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.rating, r.review, r.updated_at,
    coalesce(r.has_spoiler, false)
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where r.tmdb_id = t_id
    and r.media_type = m_type
    and (coalesce(r.hidden, false) = false or r.user_id = auth.uid())
    and public.can_view_profile(r.user_id)
  order by r.updated_at desc
  limit 50;
$$;

revoke all on function public.title_reviews(integer, text) from public;
grant execute on function public.title_reviews(integer, text) to authenticated;
grant execute on function public.title_reviews(integer, text) to anon;

-- ============ ٢ · community_activity — خطُّ «الكل» ============
drop function if exists public.community_activity();

create or replace function public.community_activity()
returns table (
  id          uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  rating      smallint,
  review      text,
  title       text,
  poster_path text,
  updated_at  timestamptz,
  has_spoiler boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.user_id as id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path, r.updated_at,
    coalesce(r.has_spoiler, false)
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and length(btrim(coalesce(r.review, ''))) > 0
    and coalesce(r.hidden, false) = false
  order by r.updated_at desc
  limit 60;
$$;

revoke all on function public.community_activity() from public;
grant execute on function public.community_activity() to authenticated;

-- ============ ٣ · user_ratings — الملفُّ العامّ ============
drop function if exists public.user_ratings(uuid);

create or replace function public.user_ratings(target uuid)
returns table (
  user_id     uuid,
  tmdb_id     integer,
  media_type  text,
  rating      smallint,
  review      text,
  title       text,
  poster_path text,
  updated_at  timestamptz,
  has_spoiler boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select r.user_id, r.tmdb_id, r.media_type, r.rating, r.review,
         r.title, r.poster_path, r.updated_at,
         coalesce(r.has_spoiler, false)
  from public.ratings r
  where r.user_id = target
    and public.can_view_profile(target)
  order by r.rating desc, r.updated_at desc
  limit 200;
$$;

revoke all on function public.user_ratings(uuid) from public;
grant execute on function public.user_ratings(uuid) to authenticated;

-- ============ ٤ · people_top_review — لوحةُ الأعضاء ============
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
  created_at    timestamptz,
  has_spoiler   boolean
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
      coalesce(g.has_spoiler, false) as has_spoiler,
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
             g.review, g.rating, g.has_spoiler, g.updated_at
  ),
  best as (
    select distinct on (k.user_id) k.*
    from liked k
    order by k.user_id, k.likes desc, k.updated_at desc
  )
  select
    b.user_id, b.nickname, b.username, b.avatar_url, b.hide_name,
    b.tmdb_id, b.media_type, b.title, b.poster_path, b.backdrop_path,
    b.review, b.rating, b.likes, b.updated_at, b.has_spoiler
  from best b
  order by b.likes desc, b.updated_at desc
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

revoke all on function public.people_top_review(integer, integer) from public;
grant execute on function public.people_top_review(integer, integer) to authenticated;

-- ============ ٥ · following_activity_v2 — خطُّ «لك» ============
drop function if exists public.following_activity_v2();

create or replace function public.following_activity_v2()
returns table (
  id            uuid,
  nickname      text,
  username      text,
  avatar_url    text,
  hide_name     boolean,
  kind          text,
  tmdb_id       integer,
  media_type    text,
  rating        smallint,
  review        text,
  title         text,
  poster_path   text,
  day           date,
  episode_count integer,
  top_season    integer,
  at            timestamptz,
  has_spoiler   boolean
)
language sql
stable
security definer
set search_path = public
as $$
with circle as (
  select uf.following_id as uid
  from public.user_follows uf
  where auth.uid() is not null
    and uf.follower_id = auth.uid()
    and public.can_view_profile(uf.following_id)
    and not public.is_blocked(auth.uid(), uf.following_id)
),
adds as (
  select f.user_id, f.tmdb_id, f.media_type, f.title, f.poster_path, f.added_at,
         count(*) over (partition by f.user_id, (f.added_at)::date) as day_adds
  from public.follows f
  join circle c on c.uid = f.user_id
  where f.added_at >= now() - interval '30 days'
    and coalesce(f.dropped, false) = false
),
ev as (
  select r.user_id                        as uid,
         4                                as pri,
         'rate'::text                     as kind,
         r.tmdb_id, r.media_type,
         r.rating, r.review, r.title, r.poster_path,
         (r.updated_at)::date             as day,
         0                                as episode_count,
         0                                as top_season,
         r.updated_at                     as at,
         coalesce(r.has_spoiler, false)   as has_spoiler
  from public.ratings r
  join circle c on c.uid = r.user_id
  where r.updated_at >= now() - interval '30 days'
    and coalesce(r.hidden, false) = false

  union all

  select w.user_id, 3, 'movie',
         w.movie_tmdb_id, 'movie',
         null::smallint, null::text, f.title, f.poster_path,
         (w.watched_at)::date, 0, 0, w.watched_at, false
  from public.watched_movies w
  join circle c on c.uid = w.user_id
  join public.follows f
    on  f.user_id    = w.user_id
    and f.tmdb_id    = w.movie_tmdb_id
    and f.media_type = 'movie'
  where w.watched_at >= now() - interval '30 days'

  union all

  select w.user_id, 2, 'episodes',
         w.show_tmdb_id, 'tv',
         null::smallint, null::text, f.title, f.poster_path,
         (w.watched_at)::date,
         count(*)::integer,
         max(w.season_number)::integer,
         max(w.watched_at), false
  from public.watched_episodes w
  join circle c on c.uid = w.user_id
  join public.follows f
    on  f.user_id    = w.user_id
    and f.tmdb_id    = w.show_tmdb_id
    and f.media_type = 'tv'
  where w.watched_at >= now() - interval '30 days'
  group by w.user_id, w.show_tmdb_id, f.title, f.poster_path, (w.watched_at)::date

  union all

  select a.user_id, 1, 'add',
         a.tmdb_id, a.media_type,
         null::smallint, null::text, a.title, a.poster_path,
         (a.added_at)::date, 0, 0, a.added_at, false
  from adds a
  where a.day_adds <= 20
)
select r.id, r.nickname, r.username, r.avatar_url, r.hide_name,
       r.kind, r.tmdb_id, r.media_type, r.rating, r.review,
       r.title, r.poster_path, r.day, r.episode_count, r.top_season, r.at,
       r.has_spoiler
from (
select x.*,
       row_number() over (partition by x.id, x.day order by x.pri desc, x.raw_at desc) as rn
from (
  select distinct on (e.uid, e.tmdb_id, e.media_type, e.day)
    e.uid                                                   as id,
    case when coalesce(p.hide_name, false) then null else p.nickname end   as nickname,
    case when coalesce(p.hide_name, false) then null else p.username end   as username,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end as avatar_url,
    coalesce(p.hide_name, false)                            as hide_name,
    e.kind, e.tmdb_id, e.media_type, e.rating, e.review,
    e.title, e.poster_path, e.day,
    max(e.episode_count) over w                             as episode_count,
    max(e.top_season)    over w                             as top_season,
    max(e.at)            over w                             as at,
    e.has_spoiler                                           as has_spoiler,
    e.pri                                                   as pri,
    e.at                                                    as raw_at
  from ev e
  join public.profiles p on p.id = e.uid
  window w as (partition by e.uid, e.tmdb_id, e.media_type, e.day)
  order by e.uid, e.tmdb_id, e.media_type, e.day, e.pri desc, e.at desc
) x
) r
where r.rn <= 5
order by r.at desc
limit 60;
$$;

revoke all on function public.following_activity_v2() from public;
grant execute on function public.following_activity_v2() to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — صفٌّ واحدٌ مجمّع (D-247)
-- ============================================================
-- select
--   (select count(*)::int from information_schema.columns
--      where table_schema='public' and table_name='ratings'
--        and column_name='has_spoiler')                                     as col,
--   (select count(*)::int from pg_proc
--      where proname in ('title_reviews','community_activity','user_ratings',
--                        'people_top_review','following_activity_v2')
--        and pg_get_functiondef(oid) like '%has_spoiler%')                  as fns_with_flag,
--   (select count(*)::int from information_schema.routine_privileges
--      where routine_schema='public' and routine_name='title_reviews'
--        and grantee='anon')                                                as anon_back,
--   (select count(*)::int from public.ratings where has_spoiler)            as flagged,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                           as open_policies;
--
--  **المتوقَّع:** `col=1 | fns_with_flag=5 | anon_back>=1 | flagged=0 |
--  open_policies=4`. **و`flagged=0` صحيحٌ يومَ التشغيل.**
