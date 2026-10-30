-- 227 — D-1596 (stage 2): «النشاط» صفحةً صفحة — نسختان بمؤشّر من دالّتَي الخطّ.
--
-- أحمد ٣٠ أكتوبر: «يعرض جزء وإذا الشخص نزل يعرض زيادة» (قرار «٤ أ»: تُجرَّب على المعاينة ثمّ تُشغَّل على الإنتاج بإذنه).
-- الدالّتان القديمتان (`community_activity()` و`following_activity_v2()`) **باقيتان كما هما** بلا معاملات وبسقف ٦٠ —
-- الصفحةُ الأولى ونسخُ التطبيق كلُّها تقرؤهما. هنا **تحميلٌ زائدٌ بمعاملين** (overload): Postgres يميّز الدالّة بمعاملاتها،
-- و PostgREST يختار النسخة بأسماء المعاملات المرسلة، فلا شيءَ قائمٌ يتغيّر.
--   p_before — «أقدمُ ممّا رأيتُ»: الطابعُ الزمنيُّ لآخر صفٍّ وصل الجهاز (حصريّ).
--   p_limit  — حجمُ الصفحة (١…٦٠، الافتراضيُّ ٣٠).
-- ⚖️ خطُّ المتابَعين: نافذةُ الثلاثين يوماً **تنزلق مع المؤشّر** (٣٠ يوماً قبل `p_before`) فالتمريرُ يبلغ ما هو أقدم من شهر،
-- والصفحاتُ التالية **للمكتوب وحدَه** (تقييمٌ بنصٍّ وتقييمُ حلقةٍ بنصّ) — الخطُّ لا يرسم غيرَه (`orderCommunityFeed`)،
-- فصفحةٌ من «شاهد حلقتين» كانت ستصل فارغةً على الشاشة.

create or replace function public.community_activity(p_before timestamptz, p_limit integer default 30)
returns table(id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, rating smallint, review text, title text, poster_path text, updated_at timestamp with time zone, list_id uuid, list_name text, list_slug text, has_spoiler boolean, list_cover text)
language sql
stable security definer
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
      and r.updated_at < coalesce(p_before, 'infinity'::timestamptz)
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
      and lr.updated_at < coalesce(p_before, 'infinity'::timestamptz)
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
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$function$;

create or replace function public.following_activity_v2(p_before timestamptz, p_limit integer default 30)
returns table(id uuid, nickname text, username text, avatar_url text, hide_name boolean, kind text, tmdb_id integer, media_type text, rating smallint, review text, title text, poster_path text, day date, episode_count integer, top_season integer, at timestamp with time zone, has_spoiler boolean, ep_season integer, ep_episode integer, ep_count integer)
language sql
stable security definer
set search_path to 'public'
as $function$
with bounds as (
  select coalesce(p_before, now()) as hi, coalesce(p_before, now()) - interval '30 days' as lo
),
circle as (
  select uf.following_id as uid
  from public.user_follows uf
  where auth.uid() is not null
    and uf.follower_id = auth.uid()
    and public.can_view_profile(uf.following_id)
    and not public.is_blocked(auth.uid(), uf.following_id)
),
eprs as (
  select er.user_id, er.show_tmdb_id, (er.updated_at)::date as day, er.season_number, er.episode_number, er.rating,
         er.review, er.has_spoiler, er.updated_at,
         row_number() over (partition by er.user_id, er.show_tmdb_id, (er.updated_at)::date order by er.updated_at desc) as rn,
         count(*) over (partition by er.user_id, er.show_tmdb_id, (er.updated_at)::date) as n
  from public.episode_ratings er
  join circle c on c.uid = er.user_id, bounds b
  where er.updated_at >= b.lo and er.updated_at < b.hi
    and nullif(btrim(coalesce(er.review, '')), '') is not null
),
ev as (
  select r.user_id as uid, 4 as pri, 'rate'::text as kind, r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path,
         (r.updated_at)::date as day, 0 as episode_count, 0 as top_season, r.updated_at as at,
         coalesce(r.has_spoiler, false) as has_spoiler,
         null::integer as ep_season, null::integer as ep_episode, null::integer as ep_count
  from public.ratings r
  join circle c on c.uid = r.user_id, bounds b
  where r.updated_at >= b.lo and r.updated_at < b.hi and coalesce(r.hidden, false) = false
    and nullif(btrim(coalesce(r.review, '')), '') is not null
  union all
  select e.user_id, 3, 'ep_rate', e.show_tmdb_id, 'tv', e.rating, e.review, f.title, f.poster_path, e.day, 0,
         e.season_number::integer, e.updated_at,
         e.has_spoiler and not exists (
           select 1 from public.watched_episodes me
           where me.user_id = auth.uid() and me.show_tmdb_id = e.show_tmdb_id
             and me.season_number = e.season_number and me.episode_number = e.episode_number
         ),
         e.season_number::integer, e.episode_number::integer, e.n::integer
  from eprs e
  join public.follows f on f.user_id = e.user_id and f.tmdb_id = e.show_tmdb_id and f.media_type = 'tv'
  where e.rn = 1
)
select
  e.uid,
  case when coalesce(p.hide_name, false) then null else p.nickname end,
  case when coalesce(p.hide_name, false) then null else p.username end,
  case when coalesce(p.hide_name, false) then null else p.avatar_url end,
  coalesce(p.hide_name, false),
  e.kind, e.tmdb_id, e.media_type, e.rating, e.review, e.title, e.poster_path, e.day,
  e.episode_count, e.top_season, e.at, e.has_spoiler, e.ep_season, e.ep_episode, e.ep_count
from ev e
join public.profiles p on p.id = e.uid
order by e.at desc
limit least(greatest(coalesce(p_limit, 30), 1), 60);
$function$;

-- الصلاحياتُ كالنسختين القديمتين حرفاً: لا `public`، والزائرُ يقرأ خطَّ المجتمع وحدَه
revoke execute on function public.community_activity(timestamptz, integer) from public;
revoke execute on function public.following_activity_v2(timestamptz, integer) from public;
-- الصلاحياتُ الافتراضيّة في Supabase تمنح `anon` كلَّ دالّةٍ جديدة — خطُّ المتابَعين للعضو وحدَه كالقديم
revoke execute on function public.following_activity_v2(timestamptz, integer) from anon;
grant execute on function public.community_activity(timestamptz, integer) to anon, authenticated, service_role;
grant execute on function public.following_activity_v2(timestamptz, integer) to authenticated, service_role;
