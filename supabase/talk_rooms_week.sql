-- ============================================================
--  ٩٦ — talk_rooms_week · **العدُّ بشريٌّ، وأسبوعٌ يُحسب** (D-311)
--  تُشغَّل بعد close_community_creation.sql (95)
--
--  **دَينان قديمان يُقفلان معاً** (بندا `05_Todo` منذ D-273 وD-291):
--  ١) «N مشاركة» كانت تعدّ نشراتِ Loopz مع كلام الناس — **والعدّادُ
--     الذي يخلط صوتَ النظام بصوت الناس يضخّم الغرفةَ بلا متكلّم**
--     (D-216). **والسابقةُ قائمة**: `people_leaderboard` تعدّ
--     `kind is null` منذ ولادتها — **فالمعيارُ واحدٌ الآن.**
--  ٢) **و`posts_week` عمودٌ جديد** ليقول سطحُ D-291 «هذا الأسبوع»
--     بصدق — العنوانُ أسقط «هذا الأسبوع» يومَها **لأن الرقم كان
--     عمرَ الغرفة كلَّه** — والمرساةُ سبتُ الرياض حرفاً كما في
--     `people_leaderboard` (D-265): **أسبوعان بتعريفين كذبةٌ ثالثة.**
--
--  ⚠️ **و`drop` واجبٌ** (D-037): العائدُ يتغيّر بعمود.
--  **والقارئُ القديمُ لا يسقط**: الشيفرةُ المنشورة تقرأ أعمدتَها
--  بأسمائها وتتجاهل الجديد، **فالهجرةُ تسبق النشر** (D-028).
--  **وغرفةُ نشراتٍ بلا كلامٍ تعرض صفراً** — وهو الصدقُ لا العطل.
--  **والوجوهُ كما هي عمداً** (D-152): الطلبُ عن العدّ لا عن الوجوه.
--
--  آمنةٌ للإعادة، ولا سياسةَ قراءةٍ خامسة.
-- ============================================================

begin;

drop function if exists public.title_talk_rooms(integer);

create or replace function public.title_talk_rooms(p_limit integer default 40)
returns table (
  tmdb_id       integer,
  media_type    text,
  title         text,
  poster_path   text,
  backdrop_path text,
  posts         bigint,
  posts_week    bigint,
  last_at       timestamptz,
  faces         jsonb,
  bulletin      jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with wk as (
    /* **مرساةُ السبت** — منسوخةٌ حرفاً من `people_leaderboard` (D-265) */
    select (
      date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '2 days')
      - interval '2 days'
    ) at time zone 'Asia/Riyadh' as t0
  ),
  visible as (
    select r.*
    from public.title_posts r
    where auth.uid() is not null
      and r.hidden = false
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
           or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
      )
  ),
  agg as (
    select
      v.tmdb_id,
      v.media_type,
      /* **كلامُ الناس وحدَه يُعدّ** — النشراتُ `kind='episode'` والصورُ
         بمميّزها تبقى تُعرض ولا تُحسب مشاركات */
      count(*) filter (where v.kind is null)::bigint as posts,
      count(*) filter (
        where v.kind is null and v.created_at >= (select t0 from wk)
      )::bigint as posts_week,
      max(v.created_at)           as last_at,
      (array_remove(array_agg(v.title order by v.created_at desc), null))[1]         as title,
      (array_remove(array_agg(v.poster_path order by v.created_at desc), null))[1]   as poster_path,
      (array_remove(array_agg(v.backdrop_path order by v.created_at desc), null))[1] as backdrop_path
    from visible v
    group by v.tmdb_id, v.media_type
  ),
  last_bulletin as (
    select distinct on (v.tmdb_id, v.media_type)
      v.tmdb_id, v.media_type, v.data as bulletin
    from visible v
    where v.kind = 'episode' and v.data is not null
    order by v.tmdb_id, v.media_type, v.created_at desc
  ),
  last_faces as (
    select
      d.tmdb_id, d.media_type,
      jsonb_agg(
        jsonb_build_object(
          'id', d.user_id,
          'nickname',   case when coalesce(d.hide_name, false) then null else d.nickname end,
          'username',   case when coalesce(d.hide_name, false) then null else d.username end,
          'avatar_url', case when coalesce(d.hide_name, false) then null else d.avatar_url end,
          'hide_name',  coalesce(d.hide_name, false)
        )
        order by d.seen desc
      ) as faces
    from (
      select distinct on (v.tmdb_id, v.media_type, v.user_id)
        v.tmdb_id, v.media_type, v.user_id,
        max(v.created_at) over (partition by v.tmdb_id, v.media_type, v.user_id) as seen,
        p.nickname, p.username, p.avatar_url, p.hide_name
      from visible v
      join public.profiles p on p.id = v.user_id
    ) d
    group by d.tmdb_id, d.media_type
  )
  select
    a.tmdb_id, a.media_type, a.title, a.poster_path, a.backdrop_path,
    a.posts, a.posts_week, a.last_at,
    coalesce(f.faces, '[]'::jsonb),
    b.bulletin
  from agg a
  left join last_faces f
    on f.tmdb_id = a.tmdb_id and f.media_type = a.media_type
  left join last_bulletin b
    on b.tmdb_id = a.tmdb_id and b.media_type = a.media_type
  order by a.last_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function public.title_talk_rooms(integer) from public;
grant execute on function public.title_talk_rooms(integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — صفٌّ واحدٌ مجمّع (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname='title_talk_rooms')     as room_overloads,
--   (select count(*)::int from pg_proc
--      where proname='title_talk_rooms'
--        and pg_get_functiondef(oid) like '%posts_week%')                    as has_week,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                            as open_policies;
--
--  **المتوقَّع:** `room_overloads=1 | has_week=1 | open_policies=4`.
