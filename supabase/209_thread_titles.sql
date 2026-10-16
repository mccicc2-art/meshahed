-- ============================================================
--  Loopz — 209: بطاقةُ عملٍ في ردود النقاش (D-1443)
--  أحمد ١٦ أكتوبر: «كل المزايا اللي عملناها في الرسائل الخاصة اعملها في المناقشات حتى طريقة الكيبورد» — «٢ أ».
--  شغّله في Supabase → SQL Editor. آمنٌ لإعادة التشغيل. **الواجهةُ تعمل قبله وبعده**: قبله يُرفض إرسالُ عملٍ رفضاً مقروءاً
--  وتُقرأ الغرفةُ كما كانت؛ بعده تظهر البطاقات.
--
--  - أربعةُ أعمدةٍ `share_*` كبطاقة القروب (الهجرة ٢٠٧) — **غيرُ** `title`/`poster_path` الموجودَين (هما اسمُ الغرفة نفسِها).
--  - قيدُ المتن يُوسَّع: العملُ متنٌ رابعٌ (نصٌّ · صورة · GIF · عمل)، ولا يجتمع مع صورةٍ أو GIF، وتعليقُه اختياريّ.
--  - `title_thread` تعيد الأعمدةَ الأربعة. **تغييرُ ما تعيده يوجب `drop`** — فالدالّةُ تُعاد بنصّها حرفاً وبصلاحياتها نفسِها.
-- ============================================================

begin;

alter table public.title_posts add column if not exists share_tmdb_id integer;
alter table public.title_posts add column if not exists share_media_type text;
alter table public.title_posts add column if not exists share_title text;
alter table public.title_posts add column if not exists share_poster_path text;

alter table public.title_posts drop constraint if exists title_posts_share_shape;
alter table public.title_posts add constraint title_posts_share_shape check (
  (share_tmdb_id is null and share_media_type is null and share_title is null and share_poster_path is null)
  or (
    -- «is not null» صريحة: مقارنةٌ مع null تعطي null والقيدُ يمرّرها (درسُ ٢٠٧)
    share_tmdb_id is not null and share_tmdb_id > 0
    and share_media_type is not null and share_media_type in ('tv', 'movie')
    and (share_title is null or length(share_title) <= 300)
    and (share_poster_path is null or share_poster_path ~ '^/[A-Za-z0-9_.-]{1,100}$')
    and image_path is null and gif_id is null and kind is null
  )
);

alter table public.title_posts drop constraint if exists title_posts_body_or_kind;
alter table public.title_posts add constraint title_posts_body_or_kind check (
  (
    kind is null
    and (
      (body is not null and length(btrim(body)) >= 1 and length(btrim(body)) <= 2000)
      or (
        (image_path is not null or (data ->> 'img') is not null or gif_id is not null or share_tmdb_id is not null)
        and (body is null or length(btrim(body)) <= 2000)
      )
    )
  )
  or (kind is not null and body is null)
);

drop function if exists public.title_thread(integer, text);
create function public.title_thread(t_id integer, m_type text)
returns table(
  id uuid, parent_id uuid, depth smallint, author_id uuid, nickname text, username text, avatar_url text,
  hide_name boolean, body text, created_at timestamp with time zone, kind text, data jsonb, spoiler jsonb,
  has_spoiler boolean, image_path text, gif_id text,
  share_tmdb_id integer, share_media_type text, share_title text, share_poster_path text
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
    r.share_tmdb_id, r.share_media_type, r.share_title, r.share_poster_path
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

commit;

-- تحقّق:
--   select pg_get_function_result('public.title_thread(integer,text)'::regprocedure);
--   select conname from pg_constraint where conrelid = 'public.title_posts'::regclass and conname = 'title_posts_share_shape';
