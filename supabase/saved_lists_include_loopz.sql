-- ============================================================
--  ٩١ — قوائمُ Loopz تدخل قسمَ «ما يحفظه الناس» (D-290)
--  تُشغَّل بعد reply_likes_and_saved_lists.sql (٩٠)
--
--  **بلاغُ أحمد بنصّه:** «خلّه يشتغل حتى على قوائم لوبز، حالياً شغّال فقط
--  على قوائم الأعضاء، وتوجد قوائم كثيرة بالنظام نفسه».
--
--  ================= لماذا كانت مستثناة أصلاً =================
--
--  **لأنّي نسختُ حارسَ أقسام الأشخاص كما هو**: `coalesce(p.is_system,
--  false) = false` — **وهو صحيحٌ هناك وخطأٌ هنا.**
--  **حجّةُ D-252 أن حسابَ النظام خارج سطوح اكتشاف الناس**: لا يُتابَع ولا
--  يُرتَّب في لوحةٍ بين الأعضاء، **لأنه ليس عضواً يُنافَس.**
--  **وقائمةٌ ليست شخصاً.** القسمُ يرتّب **ما يحفظه الناس**، والحافظون
--  أعضاءٌ حقيقيّون في الحالتين — **فاستثناءُ صاحب القائمة يحذف نصفَ
--  المحتوى بحجّةٍ لا تخصّه.**
--  **والقاعدةُ التي تبقى: حارسٌ يُنسخ يُقرأ بحجّته لا بشكله** (D-145).
--
--  ⚠️ **ولا `drop`**: الأعمدةُ التسعةُ نفسُها حرفاً، والجسمُ وحدَه تغيّر
--  (D-037). **ولا جدولَ ولا سياسة** — والسياساتُ المفتوحة تبقى أربعاً.
--
--  ⚠️ **وحارسا الحظر و`hide_name` باقيان كما هما**: حسابُ Loopz لا يُحظر
--  ولا يُخفي اسمَه، **فالحارسان يمرّان عليه بلا أثر** — ولا يُحذفان
--  لأجله (D-011: الحارسُ في جسم الدالّة لا في الاستثناء).
-- ============================================================

begin;

create or replace function public.top_saved_lists(
  p_days  integer default 7,
  p_limit integer default 3
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
  with win as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90)) as t0
  ),
  counted as (
    select s.list_id, count(*)::int as saves
    from public.list_saves s, win
    where auth.uid() is not null
      and s.created_at >= win.t0
    group by s.list_id
  )
  select
    l.id,
    l.name,
    l.user_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    c.saves,
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
  from counted c
  join public.user_lists l on l.id = c.list_id
  join public.profiles  p on p.id = l.user_id
  where l.is_public
    --  ⚖️ **وسقط `is_system = false`** (D-290) — انظر الرأس.
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = l.user_id)
         or (b.blocker_id = l.user_id and b.blocked_id = auth.uid())
    )
  order by c.saves desc, l.updated_at desc
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

revoke all on function public.top_saved_lists(integer, integer) from public;
grant execute on function public.top_saved_lists(integer, integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname='top_saved_lists')        as tsl,
--   (select count(*)::int from pg_proc
--      where proname='top_saved_lists'
--        and pg_get_functiondef(oid) like '%is_system%')                       as still_excludes,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                             as open_policies;
--
--  **المتوقَّع:** `tsl=1 | still_excludes=0 | open_policies=4`.
--
--  ⚠️ **والحَكَمُ بعدها الصفحةُ الحيّة** (D-247): تُشغَّل بدور `postgres`
--  فتعود فارغةً (`auth.uid()` فارغ). **الدليلُ أن تظهر قائمةُ Loopz في
--  القسم إن كان أحدٌ حفظها في النافذة.**
-- ============================================================
