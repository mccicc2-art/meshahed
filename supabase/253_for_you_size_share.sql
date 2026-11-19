-- 253 — «تناسبك» بنسبة التطابق لا بعدده (أحمد ١٩ نوفمبر: «طفشت وأنا أشوف توب ٢٥٠» · «ولا الجوائز كمان»)
--
-- 🔴 العطل: الدرجةُ كانت عددَ أعمال القائمة التي في مكتبتك (+ ضعفُ الحديث منها). القوائمُ الضخمة — «Top 250»
-- الثلاث والجوائز وAFI — تشترك مع أيِّ مكتبةٍ في عشرات الأعمال لمجرّد حجمها، فتسبق كلَّ قائمةٍ أصغرَ وأقربَ
-- إلى ذوقك، والقرعةُ اليوميّة (٠٫٥–١٫٥) لا تكفي لتنزلها: «Top 250» في الثاني كلَّ يوم.
--
-- 🔑 الدرجةُ الآن نسبةٌ ممهَّدة: (المتطابق + ٢×الحديث) ÷ (حجم القائمة + ٢٠).
--   · النسبةُ تُنصف القائمةَ الصغيرة القريبة من ذوقك أمام الضخمة التي تتقاطع معك بالحجم وحدَه.
--   · و«+٢٠» تمهيد: قائمةٌ من خمسة أعمالٍ تطابق منها اثنان (٢÷٢٥) لا تقفز فوق كلِّ شيءٍ بنسبة ٤٠٪.
--   · مثال: «Top 250» بمئة متطابق = ١٠٠÷٢٧٠ ≈ ٠٫٣٧ · قائمةٌ من ٣٧ بعشرين متطابقاً = ٢٠÷٥٧ ≈ ٠٫٣٥ — تتجاوران
--     وتتناوبان بالقرعة، بعد أن كانت الأولى ١٠٠ والثانية ٢٠.
-- القرعةُ اليوميّة (توقيت الرياض) والحارسان (العامّة · لا قوائمك · لا المحجوبين) والتوقيعُ والأعمدةُ كما هي في ٢٥٠.
-- ⚠️ قوائمُ الجوائز تصعد في شهر حفلها من الخادم (`forYouWithEvents`) لا من هنا — هنا الترتيبُ العامُّ وحده.

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
  ),
  /* 🆕 253 — حجمُ كلِّ قائمةٍ مرشّحة: المقامُ الذي يحوّل العدَّ إلى نسبة */
  sized as (
    select s.list_id, s.matched, s.recent, count(*)::int as size
    from scored s
    join public.user_list_items i on i.list_id = s.list_id
    group by s.list_id, s.matched, s.recent
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
  from sized s
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
    ((s.matched + 2 * s.recent)::numeric / (s.size + 20))
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
--  التحقّق بعد التشغيل
-- ============================================================
-- select pg_get_functiondef('public.for_you_lists(integer)'::regprocedure) ~ 's.size \+ 20' as normalised, -- = true
--        has_function_privilege('anon', 'public.for_you_lists(integer)', 'execute')        as anon_exec;   -- = false
