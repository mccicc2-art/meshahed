-- 135: تصفّح الضيف (D-628) — قراءاتُ المجتمع الستّ كانت تشترط
-- `auth.uid() is not null` فتعود صفراً للزائر. الشرطُ يسقط، ويبقى
-- ترشيحُ الحظر لصاحب الجلسة وحدَه: زائرٌ بلا هويّةٍ لا حظرَ له.
-- لا حذفَ ولا drop ولا تعديلَ بيانات — CREATE OR REPLACE فقط.

-- ١) نشاطُ المجتمع كلُّه (تبويب «النشاط» للزائر)
create or replace function public.community_activity()
 returns table(id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, rating smallint, review text, title text, poster_path text, updated_at timestamp with time zone, list_id uuid, list_name text, list_slug text, has_spoiler boolean, list_cover text)
 language sql stable security definer
 set search_path to 'public'
as $function$
  with feed as (
    select
      r.user_id as id,
      r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path,
      r.updated_at,
      null::uuid as list_id, null::text as list_name, null::text as list_slug,
      coalesce(r.has_spoiler, false) as has_spoiler,
      null::text as list_cover
    from public.ratings r
    where length(btrim(coalesce(r.review, ''))) > 0
      and coalesce(r.hidden, false) = false
      and (auth.uid() is null or not public.is_blocked(auth.uid(), r.user_id))
    union all
    select
      lr.user_id, 0, 'movie', lr.rating, lr.body, ul.name, null::text,
      lr.updated_at, ul.id, ul.name, ul.source_slug,
      coalesce(lr.has_spoiler, false), ul.cover_backdrop
    from public.list_reviews lr
    join public.user_lists ul on ul.id = lr.list_id
    where length(btrim(coalesce(lr.body, ''))) > 0
      and coalesce(lr.hidden, false) = false
      and ul.is_public
      and (auth.uid() is null or not public.is_blocked(auth.uid(), lr.user_id))
  )
  select
    x.id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    x.tmdb_id, x.media_type, x.rating, x.review, x.title, x.poster_path,
    x.updated_at, x.list_id, x.list_name, x.list_slug, x.has_spoiler, x.list_cover
  from feed x
  join public.profiles p on p.id = x.id
  order by x.updated_at desc
  limit 60;
$function$;

-- ٢) غرفُ النقاش (تبويب «نقاش» للزائر — والواجهةُ تقصّه على أفضل ٥)
create or replace function public.title_talk_rooms(p_limit integer default 40)
 returns table(tmdb_id integer, media_type text, title text, poster_path text, backdrop_path text, posts bigint, posts_week bigint, last_at timestamp with time zone, faces jsonb, bulletin jsonb)
 language sql stable security definer
 set search_path to 'public'
as $function$
 with wk as ( select ( date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '2 days') - interval '2 days' ) at time zone 'Asia/Riyadh' as t0 ),
 visible as (
   select r.* from public.title_posts r
   where r.hidden = false
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
          or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
     )
 ),
 agg as (
   select v.tmdb_id, v.media_type,
     count(*) filter (where v.kind is null)::bigint as posts,
     count(*) filter ( where v.kind is null and v.created_at >= (select t0 from wk) )::bigint as posts_week,
     max(v.created_at) as last_at,
     (array_remove(array_agg(v.title order by v.created_at desc), null))[1] as title,
     (array_remove(array_agg(v.poster_path order by v.created_at desc), null))[1] as poster_path,
     (array_remove(array_agg(v.backdrop_path order by v.created_at desc), null))[1] as backdrop_path
   from visible v group by v.tmdb_id, v.media_type
 ),
 last_bulletin as (
   select distinct on (v.tmdb_id, v.media_type) v.tmdb_id, v.media_type, v.data as bulletin
   from visible v where v.kind = 'episode' and v.data is not null
   order by v.tmdb_id, v.media_type, v.created_at desc
 ),
 last_faces as (
   select d.tmdb_id, d.media_type,
     jsonb_agg( jsonb_build_object(
       'id', d.user_id,
       'nickname', case when coalesce(d.hide_name, false) then null else d.nickname end,
       'username', case when coalesce(d.hide_name, false) then null else d.username end,
       'avatar_url', case when coalesce(d.hide_name, false) then null else d.avatar_url end,
       'hide_name', coalesce(d.hide_name, false)
     ) order by d.seen desc ) as faces
   from (
     select distinct on (v.tmdb_id, v.media_type, v.user_id)
       v.tmdb_id, v.media_type, v.user_id,
       max(v.created_at) over (partition by v.tmdb_id, v.media_type, v.user_id) as seen,
       p.nickname, p.username, p.avatar_url, p.hide_name
     from visible v join public.profiles p on p.id = v.user_id
   ) d group by d.tmdb_id, d.media_type
 )
 select a.tmdb_id, a.media_type, a.title, a.poster_path, a.backdrop_path,
   a.posts, a.posts_week, a.last_at, coalesce(f.faces, '[]'::jsonb), b.bulletin
 from agg a
 left join last_faces f on f.tmdb_id = a.tmdb_id and f.media_type = a.media_type
 left join last_bulletin b on b.tmdb_id = a.tmdb_id and b.media_type = a.media_type
 order by a.last_at desc
 limit least(greatest(coalesce(p_limit, 40), 1), 100);
$function$;

-- ٣) لوحةُ الأعضاء الأسبوعيّة
create or replace function public.people_leaderboard(p_limit integer default 20)
 returns table(user_id uuid, nickname text, username text, avatar_url text, hide_name boolean, posts integer, reviews integer, total integer, prev_total integer)
 language sql stable security definer
 set search_path to 'public'
as $function$
 with anchor as ( select ( date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '2 days') - interval '2 days' ) at time zone 'Asia/Riyadh' as t0 ),
 bounds as ( select t0, t0 - interval '7 days' as t_prev, t0 - interval '7 days' + (now() - t0) as t_prev_end from anchor ),
 people as (
   select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false) as hide_name
   from public.profiles p
   where coalesce(p.is_system, false) = false
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
          or (b.blocker_id = p.id and b.blocked_id = auth.uid())
     )
 ),
 posts_now as ( select r.user_id, count(*)::int c from public.title_posts r, bounds where r.kind is null and r.hidden = false and r.created_at >= bounds.t0 group by r.user_id ),
 posts_prev as ( select r.user_id, count(*)::int c from public.title_posts r, bounds where r.kind is null and r.hidden = false and r.created_at >= bounds.t_prev and r.created_at < bounds.t_prev_end group by r.user_id ),
 reviews_now as ( select g.user_id, count(*)::int c from public.ratings g, bounds where g.review is not null and length(btrim(g.review)) > 0 and g.updated_at >= bounds.t0 group by g.user_id ),
 reviews_prev as ( select g.user_id, count(*)::int c from public.ratings g, bounds where g.review is not null and length(btrim(g.review)) > 0 and g.updated_at >= bounds.t_prev and g.updated_at < bounds.t_prev_end group by g.user_id )
 select pe.id,
   case when pe.hide_name then null else pe.nickname end,
   case when pe.hide_name then null else pe.username end,
   case when pe.hide_name then null else pe.avatar_url end,
   pe.hide_name,
   coalesce(pn.c, 0), coalesce(rn.c, 0),
   (coalesce(pn.c, 0) + coalesce(rn.c, 0))::int,
   (coalesce(pp.c, 0) + coalesce(rp.c, 0))::int
 from people pe
 left join posts_now pn on pn.user_id = pe.id
 left join posts_prev pp on pp.user_id = pe.id
 left join reviews_now rn on rn.user_id = pe.id
 left join reviews_prev rp on rp.user_id = pe.id
 where (coalesce(pn.c, 0) + coalesce(rn.c, 0)) > 0
 order by (coalesce(pn.c, 0) + coalesce(rn.c, 0)) desc, pe.id
 limit least(greatest(coalesce(p_limit, 20), 1), 50);
$function$;

-- ٤) مميّزو الفترة
create or replace function public.people_featured(p_days integer default 90, p_limit integer default 3)
 returns table(user_id uuid, nickname text, username text, avatar_url text, hide_name boolean, posts integer, reviews integer, total integer, prev_total integer)
 language sql stable security definer
 set search_path to 'public'
as $function$
 with win as ( select now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365)) as t0 ),
 people as (
   select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false) as hide_name
   from public.profiles p
   where coalesce(p.is_system, false) = false
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
          or (b.blocker_id = p.id and b.blocked_id = auth.uid())
     )
 ),
 posts_now as ( select r.user_id, count(*)::int c from public.title_posts r, win where r.kind is null and r.hidden = false and r.created_at >= win.t0 group by r.user_id ),
 reviews_now as ( select g.user_id, count(*)::int c from public.ratings g, win where g.review is not null and length(btrim(g.review)) > 0 and g.updated_at >= win.t0 group by g.user_id )
 select pe.id,
   case when pe.hide_name then null else pe.nickname end,
   case when pe.hide_name then null else pe.username end,
   case when pe.hide_name then null else pe.avatar_url end,
   pe.hide_name,
   coalesce(pn.c, 0), coalesce(rn.c, 0),
   (coalesce(pn.c, 0) + coalesce(rn.c, 0))::int, 0::int
 from people pe
 left join posts_now pn on pn.user_id = pe.id
 left join reviews_now rn on rn.user_id = pe.id
 where (coalesce(pn.c, 0) + coalesce(rn.c, 0)) > 0
 order by (coalesce(pn.c, 0) + coalesce(rn.c, 0)) desc, pe.id
 limit least(greatest(coalesce(p_limit, 3), 1), 20);
$function$;

-- ٥) أفضلُ مراجعةٍ لكلِّ عضو
create or replace function public.people_top_review(p_days integer default 30, p_limit integer default 3)
 returns table(user_id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, title text, poster_path text, backdrop_path text, review text, rating smallint, likes integer, created_at timestamp with time zone, has_spoiler boolean)
 language sql stable security definer
 set search_path to 'public'
as $function$
 with liked as (
   select g.user_id,
     case when coalesce(p.hide_name,false) then null else p.nickname end as nickname,
     case when coalesce(p.hide_name,false) then null else p.username end as username,
     case when coalesce(p.hide_name,false) then null else p.avatar_url end as avatar_url,
     coalesce(p.hide_name, false) as hide_name,
     g.tmdb_id, g.media_type, g.title, g.poster_path, g.backdrop_path,
     g.review, g.rating, coalesce(g.has_spoiler, false) as has_spoiler,
     count(l.*)::int as likes, g.updated_at
   from public.ratings g
   join public.profiles p on p.id = g.user_id
   join public.review_likes l on l.review_user_id = g.user_id and l.tmdb_id = g.tmdb_id and l.media_type = g.media_type
   where g.review is not null and length(btrim(g.review)) > 0
     and g.updated_at >= now() - make_interval(days => least(greatest(coalesce(p_days,30),1), 365))
     and coalesce(p.is_system, false) = false
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = g.user_id)
          or (b.blocker_id = g.user_id and b.blocked_id = auth.uid())
     )
   group by g.user_id, p.hide_name, p.nickname, p.username, p.avatar_url, g.tmdb_id, g.media_type, g.title, g.poster_path, g.backdrop_path, g.review, g.rating, g.has_spoiler, g.updated_at
 ),
 best as ( select distinct on (k.user_id) k.* from liked k order by k.user_id, k.likes desc, k.updated_at desc )
 select b.user_id, b.nickname, b.username, b.avatar_url, b.hide_name, b.tmdb_id, b.media_type, b.title, b.poster_path, b.backdrop_path, b.review, b.rating, b.likes, b.updated_at, b.has_spoiler
 from best b order by b.likes desc, b.updated_at desc
 limit least(greatest(coalesce(p_limit, 3), 1), 20);
$function$;

-- ٦) أكثرُ القوائم حفظاً
create or replace function public.top_saved_lists(p_days integer default 7, p_limit integer default 3)
 returns table(list_id uuid, name text, owner_id uuid, nickname text, username text, avatar_url text, hide_name boolean, saves integer, posters text[])
 language sql stable security definer
 set search_path to 'public'
as $function$
 with win as ( select now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90)) as t0 ),
 counted as ( select s.list_id, count(*)::int as saves from public.list_saves s, win where s.created_at >= win.t0 group by s.list_id )
 select l.id, l.name, l.user_id,
   case when coalesce(p.hide_name, false) then null else p.nickname end,
   case when coalesce(p.hide_name, false) then null else p.username end,
   case when coalesce(p.hide_name, false) then null else p.avatar_url end,
   coalesce(p.hide_name, false),
   c.saves,
   coalesce( ( select array_agg(i.poster_path order by i.rowid) from ( select i2.poster_path, row_number() over () as rowid from public.user_list_items i2 where i2.list_id = l.id and i2.poster_path is not null limit 3 ) i ), '{}'::text[] )
 from counted c
 join public.user_lists l on l.id = c.list_id
 join public.profiles p on p.id = l.user_id
 where l.is_public
   and not exists (
     select 1 from public.blocks b
     where (b.blocker_id = auth.uid() and b.blocked_id = l.user_id)
        or (b.blocker_id = l.user_id and b.blocked_id = auth.uid())
   )
 order by c.saves desc, l.updated_at desc
 limit least(greatest(coalesce(p_limit, 3), 1), 20);
$function$;
