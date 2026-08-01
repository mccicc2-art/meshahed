-- ============================================================
--  Meshahed — Supabase schema
--  شغّل هذا الملف في: Supabase Dashboard > SQL Editor > New query
-- ============================================================

-- المتابَعات: المسلسلات والأفلام التي يتابعها المستخدم
create table if not exists public.follows (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  tmdb_id     integer not null,
  media_type  text not null check (media_type in ('tv', 'movie')),
  title       text not null,
  poster_path text,
  added_at    timestamptz not null default now(),
  unique (user_id, tmdb_id, media_type)
);

-- الحلقات المشاهَدة
create table if not exists public.watched_episodes (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  show_tmdb_id   integer not null,
  season_number  integer not null,
  episode_number integer not null,
  watched_at     timestamptz not null default now(),
  runtime        integer,
  unique (user_id, show_tmdb_id, season_number, episode_number)
);

-- الأفلام المشاهَدة
create table if not exists public.watched_movies (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  movie_tmdb_id  integer not null,
  watched_at     timestamptz not null default now(),
  runtime        integer,
  unique (user_id, movie_tmdb_id)
);

create index if not exists follows_user_idx on public.follows (user_id);
create index if not exists watched_ep_user_idx on public.watched_episodes (user_id, show_tmdb_id);
create index if not exists watched_mv_user_idx on public.watched_movies (user_id);

-- ============================================================
--  Row Level Security — كل مستخدم يرى بياناته فقط
-- ============================================================
alter table public.follows enable row level security;
alter table public.watched_episodes enable row level security;
alter table public.watched_movies enable row level security;

drop policy if exists "own follows" on public.follows;
create policy "own follows" on public.follows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own watched episodes" on public.watched_episodes;
create policy "own watched episodes" on public.watched_episodes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own watched movies" on public.watched_movies;
create policy "own watched movies" on public.watched_movies
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
