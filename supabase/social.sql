-- ============================================================
--  Meshahed — التقييمات والتعليقات + متابعة المستخدمين
--  شغّله في Supabase → SQL Editor
-- ============================================================

-- ---------- التقييمات والمراجعات ----------
create table if not exists public.ratings (
  user_id     uuid not null references auth.users (id) on delete cascade,
  tmdb_id     integer not null,
  media_type  text not null check (media_type in ('tv', 'movie')),
  rating      smallint not null check (rating between 1 and 10),
  review      text,
  title       text,
  poster_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

alter table public.ratings enable row level security;

-- التقييمات عامة للقراءة (حتى يراها من يتابعك)، والكتابة لصاحبها فقط
drop policy if exists "read all ratings" on public.ratings;
create policy "read all ratings" on public.ratings
  for select to authenticated using (true);

drop policy if exists "insert own rating" on public.ratings;
create policy "insert own rating" on public.ratings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "update own rating" on public.ratings;
create policy "update own rating" on public.ratings
  for update to authenticated using (auth.uid() = user_id);

drop policy if exists "delete own rating" on public.ratings;
create policy "delete own rating" on public.ratings
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists ratings_user_rating_idx
  on public.ratings (user_id, rating desc, updated_at desc);

-- ---------- متابعة المستخدمين ----------
create table if not exists public.user_follows (
  follower_id  uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.user_follows enable row level security;

drop policy if exists "read all user follows" on public.user_follows;
create policy "read all user follows" on public.user_follows
  for select to authenticated using (true);

drop policy if exists "follow as self" on public.user_follows;
create policy "follow as self" on public.user_follows
  for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "unfollow as self" on public.user_follows;
create policy "unfollow as self" on public.user_follows
  for delete to authenticated using (auth.uid() = follower_id);

create index if not exists user_follows_following_idx
  on public.user_follows (following_id);

-- ---------- الملفات الشخصية تصبح قابلة للقراءة للجميع ----------
-- (مطلوب حتى تظهر صفحة أي مستخدم لمن يتابعه)
drop policy if exists "read all profiles" on public.profiles;
create policy "read all profiles" on public.profiles
  for select to authenticated using (true);
