-- ============================================================
--  Meshahed — تفاعلات صفحة الأخبار (🔥)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ملاحظة أمنية: سياسة القراءة المفتوحة القديمة حُذفت — القراءة الآن
--  «صفوف المالك» وسياسة UPDATE والعدّاد المجمّع كلها في security.sql.
-- ============================================================

create table if not exists public.post_reactions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  tmdb_id    integer not null,
  media_type text not null check (media_type in ('tv', 'movie')),
  reaction   text not null default 'fire',
  created_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type, reaction)
);

alter table public.post_reactions enable row level security;

drop policy if exists "insert own reaction" on public.post_reactions;
create policy "insert own reaction" on public.post_reactions
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "delete own reaction" on public.post_reactions;
create policy "delete own reaction" on public.post_reactions
  for delete to authenticated using (auth.uid() = user_id);

create index if not exists post_reactions_item_idx
  on public.post_reactions (tmdb_id, media_type);
