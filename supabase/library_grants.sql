-- ============================================================
--  Loopz — مشاركة المكتبة الخاصة مع شخصٍ بعينه (40)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّله **قبل** نشر واجهة «من يرى مكتبتي».
--
--  «حساب خاص» يحجب عن الجميع (D-061) — وهذا الجدول استثناؤه المنضبط:
--  منحةٌ فرديّة من صاحب الحساب لشخصٍ يختاره، تُطوى داخل الحارس الواحد
--  can_view_profile فتفتح الدوال الخمس نفسها بلا بابٍ جديد. الحارس واحد
--  يبقى واحداً — من يرى المكتبة يراها كلّها من المسار المحروس نفسه.
-- ============================================================

create table if not exists public.library_grants (
  owner_id   uuid not null references auth.users (id) on delete cascade,
  grantee_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (owner_id, grantee_id),
  check (owner_id <> grantee_id)
);

alter table public.library_grants enable row level security;

create index if not exists library_grants_grantee_idx
  on public.library_grants (grantee_id);

-- المالك يمنح ويسحب ويرى منحه — صفوفه وحدها
drop policy if exists "owner manages grants" on public.library_grants;
create policy "owner manages grants" on public.library_grants
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- والممنوح يرى منحته — ليعرف أن الباب مفتوحٌ له (لا كتابة)
drop policy if exists "grantee reads own grant" on public.library_grants;
create policy "grantee reads own grant" on public.library_grants
  for select to authenticated
  using (auth.uid() = grantee_id);

-- ============================================================
--  الحارس الواحد يتعلّم المنحة — يستبدل نسخة profile_visibility.sql (29)
--  (النسخة القانونية في ذلك الملف حُدِّثت في نفس اللقطة)
-- ============================================================
create or replace function public.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = auth.uid()
      or not coalesce((select is_private from public.profiles where id = target), false)
      or exists (
        select 1 from public.user_follows uf
        where uf.follower_id = auth.uid() and uf.following_id = target
      )
      -- منحة المكتبة: بابُ الاستثناء الفرديّ للحساب الخاص (library_grants, 40)
      or exists (
        select 1 from public.library_grants g
        where g.owner_id = target and g.grantee_id = auth.uid()
      );
$$;

revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to authenticated;

-- التحقّق:
select tablename, policyname from pg_policies
where schemaname='public' and tablename = 'library_grants';
