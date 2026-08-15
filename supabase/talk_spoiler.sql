-- ============================================================
--  ٨٤ — talk_spoiler · «رسالتي فيها حرق» (D-268)
--  تُشغَّل بعد people_page3.sql (83)
--
--  **طلبُ أحمد:** «حتى الأعضاء وقت كتابتهم لريفيو أو في النقاشات ضِف له
--  زرّ يختاره إذا رسالته فيها حرق» — **والنقاشُ أوّلاً باختياره**،
--  والريفيو في دفعةٍ ثانية لأن نصَّه يُقرأ من ستّ دوالَّ حيّة.
--
--  ================= ⚠️ عمودٌ ثانٍ لا استعمالٌ للأوّل =================
--
--  **`title_posts.spoiler` موجودةٌ منذ الهجرة ٨٠** — **ولا تصلح هنا.**
--  تلك `jsonb` تحمل **النصَّ المحجوب نفسَه بلغتيه** لنشرة Loopz
--  (وصفُ TMDB)، **والمتنُ الظاهر شيءٌ آخر يبقى مرئيّاً.**
--  **وهنا العكسُ تماماً**: المتنُ هو المحجوب، ولا نصَّ ثانياً.
--  **فعمودان لمعنيين، لا عمودٌ واحدٌ بمعنيين** — وحقلٌ يعني شيئين
--  بحسب صاحب الصفّ هو كيف يولد العطلُ الصامت (D-224 تُقرأ بحجّتها لا
--  بعنوانها: «صِلْ ما هو قائم» تعني القائمَ لمعناه هو).
--
--  ================= والحارسُ في القاعدة =================
--
--  **`not null default false`**: صفوفُ البشر القديمة تصير `false`
--  **وهي الحقيقة** — من كتب قبل اليوم لم يُعلن حرقاً.
--  **ونشراتُ Loopz تبقى `false`** كذلك: حجبُها في `spoiler` لا هنا،
--  **ولا يجتمع الحاجبان على صفٍّ واحد.**
--
--  ⚠️ **و`title_thread` تُحذف وتُعاد** (D-037): عائدُها يتغيّر بعمود.
--  **وهي المرّة الثانية** — أوّلاها في ٨٠، **وأثبت الفحصُ الحيُّ يومَها
--  أن حذفَها لا يكسر غرفة.**
--
--  آمنةٌ للإعادة، ولا سياسةَ قراءةٍ خامسة.
-- ============================================================

begin;

alter table public.title_posts
  add column if not exists has_spoiler boolean not null default false;

--  **ولا فهرس**: العمودُ يُقرأ مع الصفّ ولا يُرشَّح به — **وفهرسٌ بلا
--  استعلامٍ يستعمله كلفةُ كتابةٍ بلا مقابل** (D-036: قِس قبل أن تقسّم).

drop function if exists public.title_thread(integer, text);

create or replace function public.title_thread(t_id integer, m_type text)
returns table (
  id          uuid,
  parent_id   uuid,
  depth       smallint,
  author_id   uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  body        text,
  created_at  timestamptz,
  kind        text,
  data        jsonb,
  spoiler     jsonb,
  has_spoiler boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.parent_id,
    r.depth,
    r.user_id as author_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.body,
    r.created_at,
    r.kind,
    r.data,
    r.spoiler,
    coalesce(r.has_spoiler, false)
  from public.title_posts r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and r.tmdb_id = t_id
    and r.media_type = m_type
    and r.hidden = false
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
         or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
    )
  order by r.created_at asc
  limit 300;
$$;

revoke all on function public.title_thread(integer, text) from public;
grant execute on function public.title_thread(integer, text) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from information_schema.columns
--      where table_schema='public' and table_name='title_posts'
--        and column_name='has_spoiler')                                   as col,
--   (select count(*)::int from pg_proc where proname='title_thread')      as thread_overloads,
--   (select count(*)::int from public.title_posts where has_spoiler)      as flagged,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                         as open_policies;
--
--  **المتوقَّع:** `col=1 | thread_overloads=1 | flagged=0 | open_policies=4`
--  **و`flagged=0` صحيحٌ يومَ التشغيل** — لا أحدَ أعلن حرقاً بعد.
