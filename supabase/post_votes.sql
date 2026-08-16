-- ============================================================
--  ٩٤ — أسهمُ التصويت على مشاركات النقاش (D-305)
--  طلبُ أحمد بلقطةٍ من Reddit: «سهم فوق وسهم تحت يكونون يسار
--  القلب، وهدفها أكثر ردّ عنده أسهم يكون فوق واللي بالسالب ينزل
--  تحت — فهذا شي يسهّل القراءة».
--
--  ================= وليس اللايك باسمٍ ثانٍ =================
--
--  القلبُ «أحببتُ هذا» — إشارةٌ لصاحب الردّ. والسهمان «هذا يستحق
--  مكاناً أعلى/أدنى» — إشارةٌ للترتيب يقرؤها الجميع. **معنيان
--  فمعموران** (D-224)، والقلبُ باقٍ في مكانه بطلب أحمد نفسِه
--  («يكونون يسار القلب» — فالقلبُ إذن موجود).
--
--  ================= السياساتُ المفتوحة تبقى أربعاً =================
--
--  نمطُ ٩٠ حرفاً (D-013/D-140): **صفوفُك أنت قراءةً وكتابةً
--  وتعديلاً وحذفاً، والمجموعُ من دالّة `definer`.** لا سياسةَ
--  قراءةٍ مفتوحة.
--
--  ⚠️ **ولا `drop` في هذا الملفّ إطلاقاً** — السياساتُ داخل
--  `do $$` بشرط الغياب (D-252/D-270/D-285)، والملفُّ يُعاد تشغيله
--  بلا أثرٍ مزدوج.
-- ============================================================

begin;

-- **صفٌّ لكلِّ صوتٍ لا عمودُ عدّاد** (D-263): المجموعُ يُحسب من
-- صفوفٍ قائمة. **و`smallint` بقيدٍ ثنائيّ**: صوتٌ إمّا فوق (١)
-- وإمّا تحت (-١) — **وتغييرُ الرأي تعديلٌ لا صفٌّ ثانٍ** (المفتاحُ
-- يمنعه أصلاً).
create table if not exists public.title_post_votes (
  post_id    uuid not null references public.title_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  vote       smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.title_post_votes enable row level security;

create index if not exists title_post_votes_post_idx
  on public.title_post_votes (post_id);

do $$
begin
  -- **قراءةُ صفوفك وحدَها** — لا «من صوّت بماذا» لكلِّ الموقع (D-011)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_post_votes'
      and policyname = 'read own post votes'
  ) then
    create policy "read own post votes" on public.title_post_votes
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  -- **ولا يصوّت المرءُ لمشاركة نفسه** — شرطُ اللايك حرفاً (٩٠):
  -- سهمُك على كلامك ترتيبٌ تكتبه لنفسك، والقاعدةُ تمنع لا الواجهة
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_post_votes'
      and policyname = 'insert own post vote'
  ) then
    create policy "insert own post vote" on public.title_post_votes
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

  -- **وتبديلُ الرأي تعديلٌ في مكانه** — فوق تصير تحت بلا حذفٍ
  -- وإدراج، والمفتاحُ المركَّب يبقى هو هو
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_post_votes'
      and policyname = 'update own post vote'
  ) then
    create policy "update own post vote" on public.title_post_votes
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  -- **«تراجَع بعد» لا «أكِّد قبل»** (D-047)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'title_post_votes'
      and policyname = 'delete own post vote'
  ) then
    create policy "delete own post vote" on public.title_post_votes
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end
$$;

-- **المجموعُ وصوتي في نداءٍ واحدٍ للغرفة كلِّها** (D-164/D-205) —
-- نمطُ `post_like_counts` حرفاً، **وحارسُ الحظر في جسم الدالّة**:
-- من حظرتَه لا يرفع كلامَك ولا يُنزله عندك (D-261).
create or replace function public.post_vote_scores(ids uuid[])
returns table (post_id uuid, score integer, mine smallint)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.post_id,
    sum(v.vote)::int,
    coalesce(max(v.vote) filter (where v.user_id = auth.uid()), 0)::smallint
  from public.title_post_votes v
  where auth.uid() is not null
    and v.post_id = any (ids)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = v.user_id)
         or (b.blocker_id = v.user_id and b.blocked_id = auth.uid())
    )
  group by v.post_id;
$$;

revoke all on function public.post_vote_scores(uuid[]) from public;
grant execute on function public.post_vote_scores(uuid[]) to authenticated;

commit;

-- ============================================================
--  فحصُ الصحّة بعد التشغيل — يُتوقَّع:
--  tbl = 1 · pol = 4 · fn = 1 · open_here = 0 · open_policies = 4
-- ============================================================
-- select
--   (select count(*)::int from pg_tables
--     where schemaname='public' and tablename='title_post_votes') as tbl,
--   (select count(*)::int from pg_policies
--     where schemaname='public' and tablename='title_post_votes') as pol,
--   (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and p.proname='post_vote_scores') as fn,
--   (select count(*)::int from pg_policies
--     where schemaname='public' and tablename='title_post_votes' and qual='true') as open_here,
--   (select count(*)::int from pg_policies where qual='true') as open_policies;
