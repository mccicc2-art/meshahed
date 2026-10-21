-- =====================================================================
-- 219 — «النقاش العام» · مصدرُ المشاركة (القلم) · نشراتُ «نهاية الموسم»
-- =====================================================================
-- أحمد ٢١ أكتوبر ٢٠٢٦ (R58، إذنُه: «نفذ وارفع وااذن لك بالهجرة»):
--   ١. منشورٌ بلا عملٍ من القلم يذهب إلى «النقاش العام» — غرفةٌ واحدةٌ للموقع كلّه.
--      ⚖️ **صفوفٌ في `title_posts` نفسِه** بـ`media_type = 'general'` و`tmdb_id = 0`: الإعجابُ والتصويتُ والحذفُ
--      والبلاغُ والقيدُ العمقيّ تعمل بمعرّف المشاركة فتعمل كما هي، ولا جدولَ ثانٍ يتباعد عن الأوّل (D-145).
--   ٢. «اللي ينكتب من القلم يظهر في الأنشطة، واللي ينكتب داخل الغرفة ما يظهر إلا إذا جاه تفاعل كبير» («٤ أ»: ٥ ردود
--      أو ١٠ إعجابات) — فالمصدرُ عمودٌ (`via = 'pen'`)، والقديمُ بلا قيمة = من الغرفة فلا يُغرق الأنشطة.
--   ٣. نهايةُ الموسم في النشرة (`data.fin`) — دالّتان لاستكمالها في النشرات السابقة للحقل (`healBulletinFinales`).
-- كلُّها إضافيّةٌ: عمودٌ يقبل الفراغ، وقيودٌ توسَّع لا تُضيَّق على صفٍّ قائم، ودوالُّ جديدة.
--
-- ↩️ التراجع (بالترتيب):
--   drop function if exists public.talk_feed(integer, timestamptz);
--   drop function if exists public.set_talk_bulletin_fin(jsonb);
--   drop function if exists public.talk_bulletin_unflagged(integer);
--   delete from public.title_posts where media_type = 'general';
--   alter table public.title_posts drop constraint if exists title_posts_general_shape;
--   alter table public.title_posts drop constraint if exists title_posts_via_shape;
--   drop index if exists public.title_posts_pen_idx;
--   alter table public.title_posts drop column if exists via;
--   alter table public.title_posts drop constraint if exists title_posts_media_type_check;
--   alter table public.title_posts add constraint title_posts_media_type_check check (media_type = any (array['tv','movie']));
-- =====================================================================

-- ١ · «النقاش العام» — النوعُ الثالث، وشكلُه محروس: معرّفٌ صفريّ، لا نشراتٍ ولا حلقات
alter table public.title_posts drop constraint if exists title_posts_media_type_check;
alter table public.title_posts add constraint title_posts_media_type_check
  check (media_type = any (array['tv'::text, 'movie'::text, 'general'::text]));

alter table public.title_posts drop constraint if exists title_posts_general_shape;
alter table public.title_posts add constraint title_posts_general_shape
  check (media_type <> 'general' or (tmdb_id = 0 and kind is null and season is null and episode is null));

-- ٢ · المصدر: `pen` لجذرٍ كُتب من القلم، والفراغُ = من داخل الغرفة (والقديمُ كلُّه)
alter table public.title_posts add column if not exists via text;
alter table public.title_posts drop constraint if exists title_posts_via_shape;
alter table public.title_posts add constraint title_posts_via_shape
  check (via is null or (via = 'pen' and parent_id is null and kind is null));

create index if not exists title_posts_pen_idx
  on public.title_posts (created_at desc)
  where via = 'pen' and hidden = false;

-- ٣ · الأنشطة: جذورُ القلم + جذورُ الغرف «النشطة» (٥ ردود أو ١٠ إعجابات)
--     بحارس الحظر نفسِه في `title_thread`، وللمسجَّل وحدَه، ومن ثلاثين يوماً.
create or replace function public.talk_feed(p_limit integer default 40, p_before timestamptz default null)
returns table(
  id uuid, tmdb_id integer, media_type text, title text, poster_path text,
  author_id uuid, nickname text, username text, avatar_url text, hide_name boolean,
  body text, created_at timestamptz, has_spoiler boolean, image_path text, gif_id text,
  share_tmdb_id integer, share_media_type text, share_title text, share_poster_path text,
  season smallint, episode smallint, via text, replies bigint, likes bigint, liked_by_me boolean, hot boolean
)
language sql
stable
security definer
set search_path to 'public'
as $function$
  with roots as (
    select r.*
    from public.title_posts r
    where auth.uid() is not null
      and r.parent_id is null and r.kind is null and r.hidden = false
      and r.created_at >= now() - interval '30 days'
      and (p_before is null or r.created_at < p_before)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
           or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
      )
  ),
  counted as (
    select r.*,
      (select count(*) from public.title_posts c where c.parent_id = r.id and c.hidden = false)::bigint as n_replies,
      (select count(*) from public.title_post_likes l where l.post_id = r.id)::bigint as n_likes
    from roots r
  )
  select c.id, c.tmdb_id, c.media_type, c.title, c.poster_path,
    c.user_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    c.body, c.created_at, coalesce(c.has_spoiler, false), coalesce(c.image_path, c.data ->> 'img'), c.gif_id,
    c.share_tmdb_id, c.share_media_type, c.share_title, c.share_poster_path,
    c.season, c.episode, c.via, c.n_replies, c.n_likes,
    exists (select 1 from public.title_post_likes l where l.post_id = c.id and l.user_id = auth.uid()),
    (c.via is null and (c.n_replies >= 5 or c.n_likes >= 10))
  from counted c
  join public.profiles p on p.id = c.user_id
  where c.via = 'pen' or c.n_replies >= 5 or c.n_likes >= 10
  order by c.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$function$;

revoke all on function public.talk_feed(integer, timestamptz) from public, anon;
grant execute on function public.talk_feed(integer, timestamptz) to authenticated, service_role;

-- ٤ · نهايةُ الموسم — آخرُ نشرةٍ لكلّ مسلسلٍ في الستّين يوماً لم يُكتب فيها الحقل بعد
create or replace function public.talk_bulletin_unflagged(p_limit integer default 5)
returns table(bulletin_key text, tmdb_id integer, s integer, e integer)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select x.bulletin_key, x.tmdb_id, x.s, x.e
  from (
    select distinct on (p.tmdb_id) p.bulletin_key, p.tmdb_id, p.data,
      (p.data ->> 's')::integer as s, (p.data ->> 'e')::integer as e
    from public.title_posts p
    where auth.uid() is not null
      and p.kind = 'episode' and p.media_type = 'tv' and p.bulletin_key is not null
      and p.created_at >= now() - interval '60 days'
      and (p.data ->> 's') ~ '^\d{1,4}$' and (p.data ->> 'e') ~ '^\d{1,5}$'
    order by p.tmdb_id, p.created_at desc
  ) x
  where not (x.data ? 'fin')
  limit least(greatest(coalesce(p_limit, 5), 1), 10);
$function$;

revoke all on function public.talk_bulletin_unflagged(integer) from public, anon;
grant execute on function public.talk_bulletin_unflagged(integer) to authenticated, service_role;

-- الكتابةُ للخادم وحدَه (عميلُ الخدمة، D-898) — ولا يمسّ إلا حقلاً واحداً في نشرة لوبز
create or replace function public.set_talk_bulletin_fin(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'service role required';
  end if;
  update public.title_posts t
     set data = coalesce(t.data, '{}'::jsonb) || jsonb_build_object('fin', x.fin)
    from (
      select * from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as r(bulletin_key text, fin boolean) limit 10
    ) x
   where t.bulletin_key = x.bulletin_key and t.kind = 'episode' and x.fin is not null;
  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$function$;

revoke all on function public.set_talk_bulletin_fin(jsonb) from public, anon, authenticated;
grant execute on function public.set_talk_bulletin_fin(jsonb) to service_role;
