-- ============================================================
--  Loopz — القوائم الشخصية
--  شغّله في Supabase → SQL Editor
-- ============================================================

create table if not exists public.user_lists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 60),
  is_public  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_list_items (
  list_id     uuid not null references public.user_lists (id) on delete cascade,
  tmdb_id     integer not null,
  media_type  text not null check (media_type in ('tv', 'movie')),
  title       text,
  poster_path text,
  added_at    timestamptz not null default now(),
  primary key (list_id, tmdb_id, media_type)
);

create index if not exists user_lists_user_idx on public.user_lists (user_id, created_at desc);
create index if not exists user_list_items_list_idx on public.user_list_items (list_id, added_at desc);

alter table public.user_lists enable row level security;
alter table public.user_list_items enable row level security;

-- ---------- القوائم ----------
-- صاحب القائمة يملكها كاملةً، والقوائم المعلنة تُقرأ فقط
drop policy if exists "own lists" on public.user_lists;
create policy "own lists" on public.user_lists
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "read public lists" on public.user_lists;
create policy "read public lists" on public.user_lists
  for select to authenticated using (is_public);

-- ---------- عناصر القوائم ----------
-- الصلاحية تُشتقّ من القائمة الأمّ لا تُكرَّر: قائمة تخصّ صاحبها فعناصرها
-- كذلك، ولو غيّر صاحبها الإعلان تبعتها العناصر بلا تحديث ثانٍ.
drop policy if exists "own list items" on public.user_list_items;
create policy "own list items" on public.user_list_items
  for all to authenticated
  using (
    exists (select 1 from public.user_lists l
            where l.id = list_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.user_lists l
            where l.id = list_id and l.user_id = auth.uid())
  );

drop policy if exists "read public list items" on public.user_list_items;
create policy "read public list items" on public.user_list_items
  for select to authenticated
  using (
    exists (select 1 from public.user_lists l
            where l.id = list_id and l.is_public)
  );

-- ---------- عدّاد العناصر ----------
-- استعلام واحد يرجّع القوائم مع أعدادها، بدل استعلام لكل قائمة
create or replace function public.my_lists()
returns table (
  id         uuid,
  name       text,
  is_public  boolean,
  created_at timestamptz,
  item_count integer,
  -- ملصقات أول ثلاثة عناصر، لعرض غلاف مصغّر للقائمة
  posters    text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.is_public,
    l.created_at,
    (select count(*)::integer from public.user_list_items i where i.list_id = l.id),
    (select array_agg(p order by p)
       from (select i.poster_path as p
               from public.user_list_items i
              where i.list_id = l.id and i.poster_path is not null
              order by i.added_at desc
              limit 3) s)
  from public.user_lists l
  where l.user_id = auth.uid()
  order by l.created_at desc;
$$;

revoke all on function public.my_lists() from public;
grant execute on function public.my_lists() to authenticated;

revoke execute on function public.my_lists() from anon;
