-- ============================================================
--  Loopz — إعجابات المراجعات
--  شغّله في Supabase → SQL Editor مرّةً واحدة
-- ============================================================

-- المفتاح يشير إلى مراجعةٍ بعينها: صاحبها والعمل ونوعه — وهو مفتاح
-- جدول `ratings` نفسه. و`liker_id` جزءٌ من المفتاح الأساسي، فلا يُعجَب
-- بالمراجعة مرّتين ولا يحتاج التطبيق فحصاً قبل الإدراج.
create table if not exists public.review_likes (
  review_user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id        integer not null,
  media_type     text not null check (media_type in ('tv', 'movie')),
  liker_id       uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (review_user_id, tmdb_id, media_type, liker_id),
  -- حذف المراجعة يحذف إعجاباتها معها
  foreign key (review_user_id, tmdb_id, media_type)
    references public.ratings (user_id, tmdb_id, media_type) on delete cascade
);

alter table public.review_likes enable row level security;

-- القراءة عامّة: العدد يظهر لكل من يرى المراجعة
drop policy if exists "read all review likes" on public.review_likes;
create policy "read all review likes" on public.review_likes
  for select to authenticated using (true);

-- لا يُعجب أحدٌ نيابةً عن غيره، ولا يُعجب المرء بمراجعة نفسه
drop policy if exists "insert own review like" on public.review_likes;
create policy "insert own review like" on public.review_likes
  for insert to authenticated
  with check (auth.uid() = liker_id and auth.uid() <> review_user_id);

drop policy if exists "delete own review like" on public.review_likes;
create policy "delete own review like" on public.review_likes
  for delete to authenticated using (auth.uid() = liker_id);

-- الفهرس على صاحب المراجعة: سؤال الترويسة هو «كم إعجاباً تلقّيتُ؟»
create index if not exists review_likes_received_idx
  on public.review_likes (review_user_id);

create index if not exists review_likes_liker_idx
  on public.review_likes (liker_id);
