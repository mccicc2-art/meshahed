-- ============================================================
--  ٩٠ — إعجابٌ على كلِّ ردّ · وأكثرُ القوائم حفظاً (D-289)
--  تُشغَّل بعد people_actions_no_likes.sql (٨٩)
--
--  **طلبان لأحمد تأخّرا، والسببُ يُكتب لا يُخفى:** الأوّل طلبه في
--  ١٥ أغسطس («لازم فيه لايك عند كل رد») والثاني في اليوم نفسِه («ضيف
--  أكثر الليستات حفظاً وأظهر أعلى ٣ آخر ٧ أيام») — **وأنا حوّلتُ طلبَيه
--  إلى سؤالين بدل أن أنفّذهما.** **وطلبُ صاحب المنتج ليس اقتراحاً ينتظر
--  موافقته.**
--
--  ================= السياساتُ المفتوحة تبقى أربعاً =================
--
--  **وهو الشرطُ الذي أخّر الجدولَ الجديد** (D-013): جدولٌ جديد يعني
--  سياساتٍ جديدة، **فإن كانت إحداها `qual = true` صرن خمساً.**
--  **والحلُّ هو نمطُ `review_likes` نفسُه** (D-140/security.sql):
--  **صفوفُك أنت قراءةً وكتابةً وحذفاً، والعددُ من دالّة `definer`.**
--  **فلا سياسةَ قراءةٍ مفتوحة، والأربعُ تبقى أربعاً.**
--
--  ⚠️ **ولا `drop` في هذا الملفّ إطلاقاً** — لا لجدولٍ ولا لدالّةٍ ولا
--  لسياسة. **السياساتُ تُنشأ داخل `do $$` بشرطِ الغياب** بدل
--  `drop policy if exists` المعتاد، **لأن الإذنَ الدائم لا يشمل `drop`**
--  (D-252/D-270/D-285). **والأثرُ واحد، والملفُّ يبقى قابلاً لإعادة
--  التشغيل.**
-- ============================================================

begin;

-- ============ ١ · إعجابٌ على مشاركةٍ في غرفة النقاش ============
--
-- **مفتاحٌ مركَّب لا عمودُ عدّاد** (D-263): «كم إعجاباً» يُحسب من صفوفٍ
-- قائمة، **وعمودٌ ثانٍ يحمل الرقمَ نفسَه يفترق عنه يوماً.**
-- **وحذفُ المشاركة يحذف إعجاباتِها** — مرجعٌ إلى لا شيء ليس مرجعاً.
create table if not exists public.title_post_likes (
  post_id    uuid not null references public.title_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.title_post_likes enable row level security;

create index if not exists title_post_likes_post_idx
  on public.title_post_likes (post_id);

do $$
begin
  -- **قراءةُ صفوفك وحدَها** — لا «من أعجب بماذا» لكلِّ الموقع (D-011)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_post_likes'
      and policyname = 'read own post likes'
  ) then
    create policy "read own post likes" on public.title_post_likes
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  -- **لا يُعجب أحدٌ نيابةً عن غيره، ولا يُعجب المرء بمشاركة نفسه**
  -- (شرطُ `review_likes` نفسُه — والقاعدةُ تمنع لا الواجهة، D-193)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_post_likes'
      and policyname = 'insert own post like'
  ) then
    create policy "insert own post like" on public.title_post_likes
      for insert to authenticated
      with check (
        auth.uid() = user_id
        and exists (
          select 1 from public.title_posts p
          where p.id = post_id
            and p.hidden = false
            and p.user_id <> auth.uid()
        )
      );
  end if;

  -- **«تراجَع بعد» لا «أكِّد قبل»** (D-047): الإعجابُ يُسحب من مكانه
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_post_likes'
      and policyname = 'delete own post like'
  ) then
    create policy "delete own post like" on public.title_post_likes
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

-- **العدّادُ وحالتي في نداءٍ واحدٍ للصفحة كلِّها** (D-205): الغرفةُ فيها
-- عشراتُ المشاركات، **ونداءٌ لكلِّ صفٍّ هو العطلُ الذي تمنعه D-164.**
-- **و`mine` تأتي معه** — سؤالان عن صفٍّ واحد نداءٌ واحد (D-198).
create or replace function public.post_like_counts(ids uuid[])
returns table (post_id uuid, n integer, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.post_id,
    count(*)::int,
    bool_or(l.user_id = auth.uid())
  from public.title_post_likes l
  where auth.uid() is not null
    and l.post_id = any (ids)
    -- **ومن حظرتَه لا يُعدّ إعجابُه لك** — حارسُ الحظر في جسم الدالّة
    -- لا في الدور الممنوح (D-261)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = l.user_id)
         or (b.blocker_id = l.user_id and b.blocked_id = auth.uid())
    )
  group by l.post_id;
$$;

revoke all on function public.post_like_counts(uuid[]) from public;
grant execute on function public.post_like_counts(uuid[]) to authenticated;

-- ============ ٢ · أكثرُ القوائم حفظاً ============
--
-- **نافذةٌ لها بداية ونهاية** (D-216/D-265): «آخر ٧ أيام» متدحرجة هنا
-- عمداً — **القسمُ عن قوائمَ لا عن سباقٍ أسبوعيّ**، فلا مرساةَ سبتيّة.
-- **والعامّةُ وحدَها**: قائمةٌ خاصّةٌ لا تُقرأ أصلاً، **وعرضُ اسمها
-- وعددِ من حفظها تسريبٌ بثوب إحصاء.**
-- **وصاحبُها يمرّ بحارسَي `hide_name` والحظر** (D-011)، **وحسابُ النظام
-- خارجَها** (D-252).
-- **والملصقاتُ الثلاثةُ للغلاف تأتي معها** — بطاقةٌ بلا صورةٍ لا تُقرأ،
-- **ونداءٌ ثانٍ لصورها كان سيصير نداءً لكلِّ صفّ** (D-164).
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
    and coalesce(p.is_system, false) = false
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
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_tables
--      where schemaname='public' and tablename='title_post_likes')      as tbl,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and tablename='title_post_likes')      as pol,
--   (select count(*)::int from pg_proc where proname='post_like_counts') as plc,
--   (select count(*)::int from pg_proc where proname='top_saved_lists')  as tsl,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                       as open_policies;
--
--  **المتوقَّع:** `tbl=1 | pol=3 | plc=1 | tsl=1 | open_policies=4`.
--
--  ⚠️ **و`open_policies=4` هو بيتُ القصيد** — ثلاثُ سياساتٍ جديدة، **ولا
--  واحدةَ منها مفتوحة.**
-- ============================================================
