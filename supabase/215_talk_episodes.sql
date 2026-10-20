-- 215 — نقاشٌ لكلِّ حلقة (D-1495، أحمد ٢٠ أكتوبر: «فيه نقاش لكل حلقة واقدر اختار الكل ويظهر الكل»).
--
-- الغرفةُ تبقى غرفةَ العمل (D-224)، والمشاركةُ تحمل الحلقةَ التي كُتبت فيها: عمودان اختياريّان.
-- • القديمُ بلا حلقة (null) ⇒ يظهر في «الكل» وحدَه — لا تخمينَ لحلقةٍ لم يقلها كاتبُها.
-- • الردودُ لا تحمل حلقة: ترث حلقةَ جذرها في الخادم (`threadCore`) — فلا يفترق ردٌّ عن أصله.
-- • نشراتُ لوبز تحمل حلقتَها في `data.s/e` أصلاً (الهجرة ٨٠) ولا تُكرَّر هنا.
-- آمنةٌ للنسخ القديمة: عمودان يقبلان الفراغ، والدالّةُ تزيد عمودين في آخرها.

alter table public.title_posts
  add column if not exists season smallint,
  add column if not exists episode smallint;

alter table public.title_posts drop constraint if exists title_posts_episode_shape;
alter table public.title_posts add constraint title_posts_episode_shape check (
  (season is null and episode is null)
  or (season between 0 and 200 and episode between 1 and 5000 and media_type = 'tv' and parent_id is null)
);

-- نوعُ الإرجاع يتغيّر ⇒ إسقاطٌ ثمّ إنشاء (لا `create or replace`)، والصلاحياتُ كما كانت
drop function if exists public.title_thread(integer, text);

create function public.title_thread(t_id integer, m_type text)
  returns table(
    id uuid, parent_id uuid, depth smallint, author_id uuid, nickname text, username text, avatar_url text,
    hide_name boolean, body text, created_at timestamptz, kind text, data jsonb, spoiler jsonb, has_spoiler boolean,
    image_path text, gif_id text, share_tmdb_id integer, share_media_type text, share_title text, share_poster_path text,
    season smallint, episode smallint
  )
  language sql
  stable security definer
  set search_path to 'public'
as $function$
  select r.id, r.parent_id, r.depth, r.user_id as author_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false), r.body, r.created_at, r.kind, r.data, r.spoiler, coalesce(r.has_spoiler, false),
    coalesce(r.image_path, r.data ->> 'img'), r.gif_id,
    r.share_tmdb_id, r.share_media_type, r.share_title, r.share_poster_path,
    r.season, r.episode
  from public.title_posts r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null and r.tmdb_id = t_id and r.media_type = m_type and r.hidden = false
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id) or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
    )
  order by r.created_at asc
  limit 300;
$function$;

revoke all on function public.title_thread(integer, text) from public;
grant execute on function public.title_thread(integer, text) to anon, authenticated, service_role;
