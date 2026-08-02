-- ============================================================
--  Meshahed — تتبّع موضع التوقف في الأفلام
--  شغّله في Supabase → SQL Editor
-- ============================================================

create table if not exists public.movie_progress (
  user_id          uuid not null references auth.users (id) on delete cascade,
  movie_tmdb_id    integer not null,
  position_minutes integer not null default 0 check (position_minutes >= 0),
  runtime_minutes  integer,
  title            text,
  poster_path      text,
  updated_at       timestamptz not null default now(),
  primary key (user_id, movie_tmdb_id)
);

alter table public.movie_progress enable row level security;

drop policy if exists "own movie progress" on public.movie_progress;
create policy "own movie progress" on public.movie_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists movie_progress_user_idx
  on public.movie_progress (user_id, updated_at desc);
