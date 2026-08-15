-- ============================================================
--  ٨٧ — talk_rooms_episode · **آخرُ حلقةٍ نشرها Loopz على بطاقة الغرفة**
--  (D-273) · تُشغَّل بعد people_cleanup.sql (86)
--
--  **طلبُ أحمد:** «مكانه تحط رقم الموسم والحلقة وعنوانها، ويتحدّث دوريّاً
--  مع كل نشرٍ للوبز».
--
--  ================= ولا جدولَ ولا عمودَ جديد =================
--
--  **الرقمُ والعنوانُ موجودان منذ الهجرة ٨٠**: نشرةُ Loopz صفٌّ في
--  `title_posts` بـ`kind='episode'` و`data` تحمل `s` و`e` و`name_ar`
--  و`name_en`. **فالمطلوبُ إظهارُ ما نملك لا تخزينُ ما نملك ثانيةً**
--  (D-263: لا عمودَ عدّادٍ لِما يُحسب من صفوفٍ قائمة).
--
--  **و«يتحدّث دوريّاً» يقع مجّاناً**: الدالّةُ تقرأ **أحدثَ** نشرةٍ في
--  الغرفة، **فأيُّ نشرٍ جديدٍ يزيح ما قبله بلا cron ولا كتابة.**
--
--  ================= وحرفٌ واحدٌ يُقال عن الصدق =================
--
--  **هذا «آخرُ حلقةٍ نشرها Loopz هنا» لا «الحلقةُ التي يناقشونها»** —
--  ولا نعلم الثانية. **والواجهةُ تكتب ما نعلمه ولا تدّعي غيرَه** (D-216).
--
--  ⚠️ **و`title_talk_rooms` تُحذف وتُعاد** (D-037): عائدُها يتغيّر بعمود.
--  **وهي المرّة الأولى منذ ٧٨**، والاسمُ لا يزال غيرَ `title_rooms`.
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
  last_at       timestamptz,
  faces         jsonb,
  bulletin      jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
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
      count(*)::bigint            as posts,
      max(v.created_at)           as last_at,
      /* **العنوانُ والملصقُ من أحدث صفٍّ يحملهما** — كما في ٧٨ */
      (array_remove(array_agg(v.title order by v.created_at desc), null))[1]         as title,
      (array_remove(array_agg(v.poster_path order by v.created_at desc), null))[1]   as poster_path,
      (array_remove(array_agg(v.backdrop_path order by v.created_at desc), null))[1] as backdrop_path
    from visible v
    group by v.tmdb_id, v.media_type
  ),
  /* **أحدثُ نشرةِ حلقةٍ في الغرفة — صفٌّ واحدٌ لا أكثر** (D-164):
     `distinct on` تقصّ في القاعدة، **ولا تُسلَّم الواجهةُ صفوفاً ترفضها.** */
  last_bulletin as (
    select distinct on (v.tmdb_id, v.media_type)
      v.tmdb_id, v.media_type, v.data as bulletin
    from visible v
    where v.kind = 'episode' and v.data is not null
    order by v.tmdb_id, v.media_type, v.created_at desc
  ),
  /* **الوجوهُ أشخاصٌ لا مشاركات** — أحدثُ خمسةِ متكلّمين، كلٌّ مرّةً */
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
    a.posts, a.last_at,
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
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname='title_talk_rooms')  as room_overloads,
--   (select count(*)::int from pg_proc where proname='title_rooms')       as old_title_rooms_intact,
--   (select count(*)::int from public.title_posts
--      where kind='episode' and data is not null)                         as bulletins,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                         as open_policies;
--
--  **المتوقَّع:** `room_overloads=1 | old_title_rooms_intact=1 |
--  open_policies=4`، **و`bulletins` عددُ نشرات Loopz القائمة**.
--  ⚠️ **و`old_title_rooms_intact=1` ليس حشواً**: `title_rooms` جارٌ
--  مختلفٌ تماماً، **وقد رُدّت محاولةُ الكتابة فوقه مرّةً فعلاً** (٧٨).
