-- ============================================================
-- 192 — D-1201 / D-1207 · «الأكثر تفاعلاً» في «النقاشات»: تفاعلُ آخر ٣٠ يوماً + وقتُ آخر مشاركةِ عضو
-- ------------------------------------------------------------
-- **يشغّله أحمد في لوحة Supabase** (DDL الإنتاج له). **آمنٌ قبل التطبيق وبعده**: الويبُ والتطبيقُ يقرآن
-- الأعمدةَ الجديدة بقارئٍ متسامح (D-179) — قبل هذه الهجرة يُرتَّب «الأكثر تفاعلاً» بمشاركات الأسبوع وحدَها.
--
-- 🔑 **التفاعلُ = مشاركاتُ آخر ٣٠ يوماً + إعجاباتُ آخر ٣٠ يوماً** (قرارا أحمد: «المشاركات والردود والإعجابات» ·
--   «حتى النقاش آخر ٣٠ يوم» — D-1207، كالنشاط):
--   - `posts_month`: المشاركاتُ تشمل الردودَ أصلاً (`title_posts` بـ`parent_id`)، بلا إشعارات الحلقات (`kind is null`).
--   - `likes_month`: `title_post_likes` على مشاركاتٍ **ظاهرةٍ** في الغرفة (`visible` نفسُه — المخفيُّ والمحظورُ لا يُعدّ)، وُضعت في
--     آخر ٣٠ يوماً (الإعجابُ بتاريخه — نقاشٌ قديمٌ نال إعجاباً اليوم حيٌّ اليوم).
--   - `posts_week` باقٍ كما كان حرفاً (سطحُ «نقاشُ الأسبوع» D-291/D-311).
-- 🔑 **`last_post_at` — آخرُ مشاركةٍ من عضو** (لقطةُ أحمد: «last post 1d» على غرفةٍ آخرُ عضوٍ كتب فيها في أغسطس — كانت تُحسب من
--   إشعار الحلقة). `last_at` يبقى للترتيب «الأحدث» (الإشعارُ الجديدُ خبرٌ يرفع الغرفة)، والبطاقةُ تقرأ `last_post_at` — `null` بلا مشاركة.
-- ⚠️ **تغييرُ أعمدة الناتج يحتاج `drop` ثمّ `create`** (Postgres لا يبدّل `returns table` بـ`create or replace`) — والمنحُ
--   تُعاد كما كانت حرفاً (anon · authenticated · service_role). في معاملةٍ واحدة فلا لحظةَ بلا دالّة.
-- ============================================================
begin;

drop function if exists public.title_talk_rooms(integer);

create function public.title_talk_rooms(p_limit integer default 40)
returns table(tmdb_id integer, media_type text, title text, poster_path text, backdrop_path text, posts bigint, posts_week bigint, posts_month bigint, likes_month bigint, last_at timestamp with time zone, last_post_at timestamp with time zone, faces jsonb, bulletin jsonb)
language sql
stable security definer
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
     count(*) filter ( where v.kind is null and v.created_at >= now() - interval '30 days' )::bigint as posts_month,
     max(v.created_at) as last_at,
     max(v.created_at) filter (where v.kind is null) as last_post_at,
     (array_remove(array_agg(v.title order by v.created_at desc), null))[1] as title,
     (array_remove(array_agg(v.poster_path order by v.created_at desc), null))[1] as poster_path,
     (array_remove(array_agg(v.backdrop_path order by v.created_at desc), null))[1] as backdrop_path
   from visible v group by v.tmdb_id, v.media_type
 ),
 likes as (
   select v.tmdb_id, v.media_type, count(*)::bigint as likes_month
   from public.title_post_likes l
   join visible v on v.id = l.post_id
   where l.created_at >= now() - interval '30 days'
   group by v.tmdb_id, v.media_type
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
   a.posts, a.posts_week, a.posts_month, coalesce(k.likes_month, 0)::bigint, a.last_at, a.last_post_at, coalesce(f.faces, '[]'::jsonb), b.bulletin
 from agg a
 left join likes k on k.tmdb_id = a.tmdb_id and k.media_type = a.media_type
 left join last_faces f on f.tmdb_id = a.tmdb_id and f.media_type = a.media_type
 left join last_bulletin b on b.tmdb_id = a.tmdb_id and b.media_type = a.media_type
 order by a.last_at desc
 limit least(greatest(coalesce(p_limit, 40), 1), 100);
$function$;

revoke all on function public.title_talk_rooms(integer) from public;
grant execute on function public.title_talk_rooms(integer) to anon, authenticated, service_role;

commit;
