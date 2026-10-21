-- ============================================================
--  217 — تقييمُ الحلقة يُرى عند من يتابعك (D-1503، أحمد ٢١ أكتوبر: «اذا انا قيمت حلقة ما يظهر لاي احد حاليا
--  ولا حتى فالانشطة صحيح؟» → «ب»: التقييمُ المكتوبُ في الأنشطة، والرقمُ وحده في شارة «يشاهده أصدقاؤك»).
--
--  ١) `following_activity_v2` — نوعٌ خامس `ep_rate`: تقييمُ حلقةٍ **معه نصّ** (الرقمُ المجرّد لا يدخل الأنشطة — «ب»).
--     صفٌّ واحدٌ لكلّ (شخص + عمل + يوم) كبقيّة الأنواع: آخرُ حلقةٍ قُيّمت بنصّ (رقمُها ونصُّها) + عددُ ما قُيّم بنصٍّ ذلك اليوم.
--     أولويّتُه ٣ — فوق «شاهد حلقات» (٢) وتحت تقييم العمل كلِّه (٤): رأيٌ في الحلقة أغنى من «شاهد ٣ حلقات»، ورأيٌ في العمل أغنى منه.
--     🔑 **الحرقُ رايةُ الكاتب، ومن شاهد الحلقة لا يُحجب عنه** (البند ٣): `has_spoiler` = رايتُه **و** لا صفَّ للقارئ في
--     `watched_episodes` لتلك الحلقة.
--     ثلاثةُ أعمدةٍ في آخر الردّ (`ep_season` · `ep_episode` · `ep_count`)، فارغةٌ لبقيّة الأنواع.
--  ٢) `friends_title_state` — عمودٌ في آخره `ep_rating`: تقييمُ صديقك للحلقة التي وصلها (آخرُ حلقةٍ شاهدها)، إن قيّمها —
--     فتقول الشارةُ «★ ٩ · E3» بدل «▶ S1 · E3» حين لا تقييمَ للعمل كلِّه.
--
--  ٣) 🆕 **مفتاحُ «حرق أحداث» لتقييم الحلقة** (أحمد: «يضاف مفتاح سبويلر، إذا فعّله الكاتب النصّ يتغطّى عالجميع، إذا أنا
--     شفت الحلقة ما يتغطّى عني»): عمود `episode_ratings.has_spoiler`، و`set_episode_rating` يقبله (`p_spoiler`، الغيابُ يُبقي
--     القيمةَ السابقة فلا تمحوها نسخةٌ قديمة من التطبيق)، و`episode_ratings_of` تعيده. وفي الأنشطة: محجوبٌ = رايةُ الكاتب
--     **و** القارئُ لم يشاهد الحلقة.
--
--  الحراسةُ نفسُها: من أتابعه · ملفُّه يُرى (`can_view_profile`) · لا حظر. نوعُ الإرجاع يتغيّر ⇒ إسقاطٌ ثمّ إنشاء في معاملةٍ واحدة،
--  والصلاحياتُ كما كانت. الواجهةُ تعمل قبلها وبعدها (الأعمدةُ الجديدة اختياريّة في القراءة، و`p_spoiler` اختياريّ في الكتابة).
--  الرجوع: الدوالُّ الأربع بشكلها السابق محفوظةٌ في `claude/217-rollback.sql` في ملفّات المشروع؛ والعمودُ يبقى (لا يضرّ).
-- ============================================================

-- ------------------------------------------------------------
--  ٣) رايةُ الحرق لتقييم الحلقة
-- ------------------------------------------------------------
alter table public.episode_ratings add column if not exists has_spoiler boolean not null default false;

drop function if exists public.set_episode_rating(integer, integer, integer, integer, text, integer);
create or replace function public.set_episode_rating(p_show integer, p_season integer, p_episode integer, p_rating integer,
  p_review text default null, p_runtime integer default null, p_spoiler boolean default null)
returns void
language plpgsql security definer set search_path to 'public'
as $function$
declare
  uid uuid := auth.uid();
  txt text := nullif(btrim(p_review), '');
begin
  if uid is null then raise exception 'auth required'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 10 then raise exception 'rating out of range'; end if;

  insert into public.episode_ratings (user_id, show_tmdb_id, season_number, episode_number, rating, review, has_spoiler)
  values (uid, p_show, p_season, p_episode, p_rating, txt, txt is not null and coalesce(p_spoiler, false))
  on conflict (user_id, show_tmdb_id, season_number, episode_number) do update
    set rating = excluded.rating,
        review = excluded.review,
        /* نصٌّ فارغٌ لا يُحرق شيئاً؛ وغيابُ الراية (نسخةٌ قديمة) يُبقي ما كان */
        has_spoiler = case when excluded.review is null then false
                           when p_spoiler is null then public.episode_ratings.has_spoiler
                           else p_spoiler end,
        updated_at = now();

  /* المشاهدةُ تتبع التقييم ولا تُعاد كتابتها إن سبقت (`do nothing`) */
  insert into public.watched_episodes (user_id, show_tmdb_id, season_number, episode_number, runtime)
  values (uid, p_show, p_season, p_episode, p_runtime)
  on conflict (user_id, show_tmdb_id, season_number, episode_number) do nothing;
end;
$function$;
revoke all on function public.set_episode_rating(integer, integer, integer, integer, text, integer, boolean) from public, anon;
grant execute on function public.set_episode_rating(integer, integer, integer, integer, text, integer, boolean) to authenticated;

drop function if exists public.episode_ratings_of(uuid, integer);
create function public.episode_ratings_of(p_user uuid, p_show integer)
returns table(season_number smallint, episode_number smallint, rating smallint, review text, updated_at timestamp with time zone,
              has_spoiler boolean)
language sql stable security definer set search_path to 'public'
as $function$
  select er.season_number, er.episode_number, er.rating, er.review, er.updated_at, er.has_spoiler
  from public.episode_ratings er
  where er.user_id = p_user and er.show_tmdb_id = p_show and public.can_view_profile(p_user)
  order by er.season_number, er.episode_number;
$function$;
/* الصلاحياتُ كما كانت حرفاً (anon و authenticated) */
revoke all on function public.episode_ratings_of(uuid, integer) from public;
grant execute on function public.episode_ratings_of(uuid, integer) to anon, authenticated;

-- ------------------------------------------------------------
--  ١) الأنشطة
-- ------------------------------------------------------------
drop function if exists public.following_activity_v2();

create function public.following_activity_v2()
returns table(id uuid, nickname text, username text, avatar_url text, hide_name boolean, kind text, tmdb_id integer,
              media_type text, rating smallint, review text, title text, poster_path text, day date, episode_count integer,
              top_season integer, at timestamp with time zone, has_spoiler boolean,
              ep_season integer, ep_episode integer, ep_count integer)
language sql
stable security definer
set search_path to 'public'
as $function$
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
  where f.added_at >= now() - interval '30 days' and coalesce(f.dropped, false) = false
),
/* تقييماتُ الحلقات المكتوبة — الأحدثُ في اليوم يمثّله، والعددُ معه */
eprs as (
  select er.user_id, er.show_tmdb_id, (er.updated_at)::date as day, er.season_number, er.episode_number, er.rating,
         er.review, er.has_spoiler, er.updated_at,
         row_number() over (partition by er.user_id, er.show_tmdb_id, (er.updated_at)::date order by er.updated_at desc) as rn,
         count(*) over (partition by er.user_id, er.show_tmdb_id, (er.updated_at)::date) as n
  from public.episode_ratings er
  join circle c on c.uid = er.user_id
  where er.updated_at >= now() - interval '30 days'
    and nullif(btrim(coalesce(er.review, '')), '') is not null
),
ev as (
  select r.user_id as uid, 4 as pri, 'rate'::text as kind, r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path,
         (r.updated_at)::date as day, 0 as episode_count, 0 as top_season, r.updated_at as at,
         coalesce(r.has_spoiler, false) as has_spoiler,
         null::integer as ep_season, null::integer as ep_episode, null::integer as ep_count
  from public.ratings r
  join circle c on c.uid = r.user_id
  where r.updated_at >= now() - interval '30 days' and coalesce(r.hidden, false) = false
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
  union all
  select w.user_id, 3, 'movie', w.movie_tmdb_id, 'movie', null::smallint, null::text, f.title, f.poster_path,
         (w.watched_at)::date, 0, 0, w.watched_at, false, null, null, null
  from public.watched_movies w
  join circle c on c.uid = w.user_id
  join public.follows f on f.user_id = w.user_id and f.tmdb_id = w.movie_tmdb_id and f.media_type = 'movie'
  where w.watched_at >= now() - interval '30 days'
  union all
  select w.user_id, 2, 'episodes', w.show_tmdb_id, 'tv', null::smallint, null::text, f.title, f.poster_path,
         (w.watched_at)::date, count(*)::integer, max(w.season_number)::integer, max(w.watched_at), false, null, null, null
  from public.watched_episodes w
  join circle c on c.uid = w.user_id
  join public.follows f on f.user_id = w.user_id and f.tmdb_id = w.show_tmdb_id and f.media_type = 'tv'
  where w.watched_at >= now() - interval '30 days'
  group by w.user_id, w.show_tmdb_id, f.title, f.poster_path, (w.watched_at)::date
  union all
  select a.user_id, 1, 'add', a.tmdb_id, a.media_type, null::smallint, null::text, a.title, a.poster_path,
         (a.added_at)::date, 0, 0, a.added_at, false, null, null, null
  from adds a
  where a.day_adds <= 20
)
select r.id, r.nickname, r.username, r.avatar_url, r.hide_name, r.kind, r.tmdb_id, r.media_type, r.rating, r.review,
       r.title, r.poster_path, r.day, r.episode_count, r.top_season, r.at, r.has_spoiler,
       r.ep_season, r.ep_episode, r.ep_count
from (
  select x.*, row_number() over (partition by x.id, x.day order by x.pri desc, x.raw_at desc) as rn
  from (
    select distinct on (e.uid, e.tmdb_id, e.media_type, e.day)
      e.uid as id,
      case when coalesce(p.hide_name, false) then null else p.nickname end as nickname,
      case when coalesce(p.hide_name, false) then null else p.username end as username,
      case when coalesce(p.hide_name, false) then null else p.avatar_url end as avatar_url,
      coalesce(p.hide_name, false) as hide_name,
      e.kind, e.tmdb_id, e.media_type, e.rating, e.review, e.title, e.poster_path, e.day,
      max(e.episode_count) over w as episode_count,
      max(e.top_season) over w as top_season,
      max(e.at) over w as at,
      e.has_spoiler as has_spoiler,
      e.ep_season, e.ep_episode, e.ep_count,
      e.pri as pri, e.at as raw_at
    from ev e
    join public.profiles p on p.id = e.uid
    window w as (partition by e.uid, e.tmdb_id, e.media_type, e.day)
    order by e.uid, e.tmdb_id, e.media_type, e.day, e.pri desc, e.at desc
  ) x
) r
where r.rn <= 5
order by r.at desc
limit 60;
$function$;

revoke all on function public.following_activity_v2() from public, anon;
grant execute on function public.following_activity_v2() to authenticated;

drop function if exists public.friends_title_state(uuid[], integer[], text[]);

create function public.friends_title_state(p_users uuid[], p_tmdb integer[], p_media text[])
returns table (user_id uuid, tmdb_id integer, media_type text, rating smallint, last_season integer, last_episode integer,
               done boolean, ep_rating smallint)
language sql
stable security definer
set search_path to 'public'
as $function$
  with circle as (
    select uf.following_id as uid
    from public.user_follows uf
    where auth.uid() is not null
      and uf.follower_id = auth.uid()
      and uf.following_id = any (p_users[1:60])
      and public.can_view_profile(uf.following_id)
      and not public.is_blocked(auth.uid(), uf.following_id)
  ),
  titles as (
    select t.tmdb_id, t.media_type
    from unnest(p_tmdb[1:60], p_media[1:60]) as t(tmdb_id, media_type)
    where t.media_type in ('tv', 'movie')
  ),
  pairs as (
    select c.uid, t.tmdb_id, t.media_type from circle c cross join titles t
  )
  select
    p.uid, p.tmdb_id, p.media_type,
    (select r.rating from public.ratings r
      where r.user_id = p.uid and r.tmdb_id = p.tmdb_id and r.media_type = p.media_type and coalesce(r.hidden, false) = false
      limit 1),
    le.season_number, le.episode_number,
    case
      when p.media_type = 'movie' then exists (
        select 1 from public.watched_movies w where w.user_id = p.uid and w.movie_tmdb_id = p.tmdb_id)
      else coalesce((
        select f.aired_episodes > 0 and (
          select count(*) from public.watched_episodes w
          where w.user_id = p.uid and w.show_tmdb_id = p.tmdb_id and w.season_number > 0
        ) >= f.aired_episodes
        from public.follows f where f.user_id = p.uid and f.tmdb_id = p.tmdb_id and f.media_type = 'tv'), false)
    end,
    /* 🆕 217 — تقييمُه للحلقة التي وصلها (رقمٌ وحده يكفي هنا — «ب») */
    (select er.rating from public.episode_ratings er
      where p.media_type = 'tv' and er.user_id = p.uid and er.show_tmdb_id = p.tmdb_id
        and er.season_number = le.season_number and er.episode_number = le.episode_number
      limit 1)
  from pairs p
  left join lateral (
    select w.season_number, w.episode_number
    from public.watched_episodes w
    where p.media_type = 'tv' and w.user_id = p.uid and w.show_tmdb_id = p.tmdb_id and w.season_number > 0
    order by w.season_number desc, w.episode_number desc
    limit 1
  ) le on true;
$function$;

revoke all on function public.friends_title_state(uuid[], integer[], text[]) from public, anon;
grant execute on function public.friends_title_state(uuid[], integer[], text[]) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل:
--    select pg_get_function_result('public.following_activity_v2'::regproc) like '%ep_count integer%' as v2,
--           pg_get_function_result('public.friends_title_state(uuid[],integer[],text[])'::regprocedure) like '%ep_rating%' as fts,
--           has_function_privilege('anon','public.following_activity_v2()','execute') as anon_v2,   -- true · true · false
--           (select count(*) from information_schema.columns where table_name='episode_ratings' and column_name='has_spoiler') as col; -- 1
-- ============================================================
