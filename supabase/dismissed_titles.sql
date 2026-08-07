-- ============================================================
--  Loopz — «غير مهتم»: عملٌ لا يعود يظهر في «مقترح لك»
--  شغّله في Supabase → SQL Editor (الترتيب في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر زرّ «غير مهتم» وتحديث «مقترح لك».
--
--  زرُّ «غير مهتم» على زاوية الملصق يخزّن صفّاً هنا، ومحرّك الاقتراحات
--  (getSuggestions) يستبعد ما فيه — فالعمل المرفوض لا يعود مع كل تحديث.
--  الجدول صغير: معرّف العمل ونوعه لكل مستخدم، لا أكثر.
-- ============================================================
create table if not exists public.dismissed_titles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  tmdb_id    integer not null,
  media_type text not null check (media_type in ('tv', 'movie')),
  created_at timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type)
);

alter table public.dismissed_titles enable row level security;
create index if not exists dismissed_titles_user_idx on public.dismissed_titles (user_id);

-- صفوفك أنت فقط — قراءةً وكتابةً وحذفاً (لو أردت التراجع لاحقاً)
drop policy if exists "own dismissed" on public.dismissed_titles;
create policy "own dismissed" on public.dismissed_titles
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- التحقّق: select policyname from pg_policies
--   where schemaname='public' and tablename='dismissed_titles';
