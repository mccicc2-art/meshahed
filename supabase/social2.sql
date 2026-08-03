-- ============================================================
--  Meshahed — الطبقة الاجتماعية: إخفاء الاسم، عدّاد الزوّار، بحث الأشخاص
--  شغّله في Supabase → SQL Editor
-- ============================================================

-- ---------- خيار إخفاء الاسم في التقييمات ----------
alter table public.profiles
  add column if not exists hide_name boolean not null default false;

-- ---------- زوّار الملف الشخصي ----------
-- صف واحد لكل (صاحب الملف، الزائر، اليوم) — فالعدّاد «زوّار فريدون»
-- لا «عدد فتحات»، وإعادة تحميل الصفحة لا تضخّم الرقم.
create table if not exists public.profile_views (
  profile_id uuid not null references auth.users (id) on delete cascade,
  viewer_id  uuid not null references auth.users (id) on delete cascade,
  day        date not null default current_date,
  primary key (profile_id, viewer_id, day)
);

alter table public.profile_views enable row level security;

-- العدّاد ظاهر للجميع، والتسجيل باسم الزائر نفسه فقط
drop policy if exists "read view counts" on public.profile_views;
create policy "read view counts" on public.profile_views
  for select to authenticated using (true);

drop policy if exists "record own visit" on public.profile_views;
create policy "record own visit" on public.profile_views
  for insert to authenticated with check (auth.uid() = viewer_id);

create index if not exists profile_views_profile_idx
  on public.profile_views (profile_id);

-- تسجيل زيارة: يتجاهل زيارة الشخص لصفحته، ويتجاهل التكرار في نفس اليوم
create or replace function public.record_profile_view(target uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = target then
    return;
  end if;
  insert into public.profile_views (profile_id, viewer_id)
  values (target, auth.uid())
  on conflict do nothing;
end;
$$;

revoke all on function public.record_profile_view(uuid) from public;
grant execute on function public.record_profile_view(uuid) to authenticated;

-- عدد الزوّار الفريدين لملف معيّن
create or replace function public.profile_view_count(target uuid)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct viewer_id)::integer
  from public.profile_views
  where profile_id = target;
$$;

revoke all on function public.profile_view_count(uuid) from public;
grant execute on function public.profile_view_count(uuid) to authenticated;

-- ---------- بحث الأشخاص ----------
-- البحث داخل دالة حتى لا تُمرَّر أحرف البحث البديلة (% و _) من المستخدم
-- مباشرةً إلى LIKE، ولتُرجَع الأعمدة العامة فقط.
create or replace function public.search_people(q text)
returns table (
  id uuid,
  nickname text,
  username text,
  avatar_url text,
  hide_name boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false)
  from public.profiles p
  where p.username is not null
    and length(coalesce(q, '')) >= 2
    and (
      p.username ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
      or (coalesce(p.hide_name, false) = false
          and p.nickname ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%')
    )
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by p.username
  limit 20;
$$;

revoke all on function public.search_people(text) from public;
grant execute on function public.search_people(text) to authenticated;

-- ---------- نشاط من تتابعهم ----------
-- آخر التقييمات والمراجعات ممن يتابعهم المستخدم الحالي، مع بيانات صاحبها.
create or replace function public.following_activity()
returns table (
  id          uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  rating      smallint,
  review      text,
  title       text,
  poster_path text,
  updated_at  timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.user_id as id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false),
    r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path, r.updated_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where r.user_id in (
    select following_id from public.user_follows where follower_id = auth.uid()
  )
  order by r.updated_at desc
  limit 40;
$$;

revoke all on function public.following_activity() from public;
grant execute on function public.following_activity() to authenticated;

-- ---------- أصحاب التقييمات على صفحة عمل ----------
-- يرجّع المراجعات مع اسم صاحبها (أو بلا اسم لمن أخفاه).
create or replace function public.title_reviews(t_id integer, m_type text)
returns table (
  id          uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  rating      smallint,
  review      text,
  updated_at  timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    r.user_id as id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false),
    r.rating, r.review, r.updated_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where r.tmdb_id = t_id and r.media_type = m_type
  order by (r.review is null), r.updated_at desc
  limit 30;
$$;

revoke all on function public.title_reviews(integer, text) from public;
grant execute on function public.title_reviews(integer, text) to authenticated;
