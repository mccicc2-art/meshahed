-- ============================================================
--  Loopz — «تناسبك» تتجدّد كلَّ يوم وتتفاعل مع ما أضفتَه (الهجرة ٢٥٠ · المهمّة ٤٤٢)
--  شغّله في Supabase → SQL Editor (طُبّق على الإنتاج ١٩ نوفمبر ٢٠٢٦ بإذن أحمد: «ااذن لك بالهجره»)
--
--  بلاغُ أحمد: «ليست فور يو لها فتره ثابته .. لازم تتجدد وتتفاعل»، ثمّ «٤ ب».
--
--  ============ لماذا كانت ثابتة ============
--
--  الهجرة ١٠٢ رتّبت بـ`matched desc, updated_at desc` — **عددُ أعمالك في القائمة وحدَه**.
--  ومكتبةُ القارئ تكبر ببطء والقوائمُ العامّة قليلة (٥٩ يومَ البلاغ، ٤٨ منها لِلوبز) — **فالقوائمُ
--  الكبيرة (أفضل ٢٥٠، الجوائز) تتصدّر للأبد**، ولا شيءَ في الترتيب اسمُه وقتٌ أو حدث.
--
--  ============ ما يتغيّر — الترتيبُ وحدَه ============
--
--  ١. **ترجيحُ الحديث**: العملُ الذي أضفتَه في آخر ١٤ يوماً (`follows.added_at`) يُحسب ثلاثاً لا
--     واحداً — **فالرفُّ يتبع ما تفعله هذا الأسبوع**، لا ما جمعتَه منذ سنة.
--  ٢. **تدويرٌ يوميّ**: معاملٌ بين ٠٫٥ و١٫٥ يُشتقّ من (القائمة، القارئ، يوم الرياض) — **ثابتٌ طولَ
--     اليوم** فلا يتقافز الرفُّ بين فتحتين، **ويتبدّل مع منتصف ليل الرياض**، ومختلفٌ لكلِّ قارئ.
--     وهو ضربٌ لا جمع: القائمةُ الأقوى تبقى أرجحَ، والضعيفةُ لا تقفز فوق ثلاثة أضعافها.
--
--  ⚠️ **وكلُّ ما عدا الترتيب منسوخٌ حرفاً من ١٠٢**: الأعمدةُ والعائدُ وعتبةُ «عملين» والحرّاسُ
--  (`hide_name` والحظر وإخراجُ قائمتي) والصلاحيّات — **والتوقيعُ نفسُه** فلا يتغيّر مستدعٍ.
--  ⚠️ **وعمودُ `saves` يبقى «كم منها عندك»** (`matched`) كما قرأه المكوّن منذ ١٠٢ — لا الدرجة.
-- ============================================================

begin;

create or replace function public.for_you_lists(
  p_limit integer default 12
)
returns table (
  list_id    uuid,
  name       text,
  owner_id   uuid,
  nickname   text,
  username   text,
  avatar_url text,
  hide_name  boolean,
  saves      integer,
  posters    text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select f.tmdb_id, f.media_type,
           (f.added_at > now() - interval '14 days') as recent
    from public.follows f
    where auth.uid() is not null and f.user_id = auth.uid()
  ),
  scored as (
    select i.list_id,
           count(*)::int as matched,
           count(*) filter (where m.recent)::int as recent
    from public.user_list_items i
    join mine m on m.tmdb_id = i.tmdb_id and m.media_type = i.media_type
    group by i.list_id
    having count(*) >= 2
  )
  select
    l.id,
    l.name,
    l.user_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    s.matched,
    coalesce(
      (
        select array_agg(i.poster_path order by i.rowid)
        from (
          select i2.poster_path, row_number() over () as rowid
          from public.user_list_items i2
          where i2.list_id = l.id and i2.poster_path is not null
          limit 3
        ) i
      ),
      '{}'::text[]
    )
  from scored s
  join public.user_lists l on l.id = s.list_id
  join public.profiles  p on p.id = l.user_id
  where l.is_public
    and l.user_id <> auth.uid()
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = l.user_id)
         or (b.blocker_id = l.user_id and b.blocked_id = auth.uid())
    )
  order by
    (s.matched + 2 * s.recent)::numeric
      * (0.5 + ((('x' || substr(md5(
            l.id::text || auth.uid()::text
            || to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD')
          ), 1, 7))::bit(28)::int)::numeric / 268435456)) desc,
    l.updated_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

revoke all on function public.for_you_lists(integer) from public;
/* ⚠️ **و`anon` يُسحب منه صراحةً**: منحُ Supabase الافتراضيُّ للأدوار مباشرةً لا عبر `public`، فبقي
   للزائر تنفيذُها منذ ١٠٢ (يعود فارغاً بلا `auth.uid()` — لا تسريب، لكنه بابٌ لا قارئَ له). */
revoke execute on function public.for_you_lists(integer) from anon;
grant execute on function public.for_you_lists(integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — صفٌّ واحدٌ مجمَّع (D-247)
-- ============================================================
-- select
--   (select count(*) from pg_proc where proname = 'for_you_lists')                                   as fn,        -- = 1
--   (select pg_get_functiondef('public.for_you_lists(integer)'::regprocedure) ~ 'Asia/Riyadh')        as rotates,   -- = true
--   has_function_privilege('anon', 'public.for_you_lists(integer)', 'execute')                         as anon_exec; -- = false
