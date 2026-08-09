-- 44 · مخزن تقييمات IMDb — «اسحبها واحفظها عندك وحدّثها كل يوم مرة»
--
-- الطلب (أحمد، 9 Aug): حصة OMDb ألف طلبٍ في اليوم، وخبيئة fetch تعيش
-- وتموت مع النشرة — فالأرقام تُخزَّن عندنا في جدول، وكل صفٍّ يُجدَّد من
-- OMDb مرةً واحدة كل ٢٤ ساعة عند أول عرضٍ بعد انتهاء عمره (تحديثٌ
-- يوميّ كسول: نفس أثر المجدول بلا بنيةٍ تحتية جديدة).
--
-- القراءة عامة (الأرقام علنية أصلاً)، والكتابة عبر دالة definer وحدها
-- كي لا يكتب أحدٌ في الجدول مباشرةً (قاعدة RLS في 00).
--
-- idempotent: إعادة تشغيله آمنة.

create table if not exists public.imdb_ratings (
  media_type  text not null check (media_type in ('movie', 'tv')),
  tmdb_id     bigint not null,
  imdb_id     text,
  -- null = بحثنا في OMDb فلم نجد تقييماً — يمنع إعادة السؤال قبل ٢٤ ساعة
  imdb_rating numeric,
  updated_at  timestamptz not null default now(),
  primary key (media_type, tmdb_id)
);

alter table public.imdb_ratings enable row level security;

drop policy if exists imdb_ratings_read on public.imdb_ratings;
create policy imdb_ratings_read on public.imdb_ratings
  for select using (true);

-- الكتابة دفعةً واحدة: صفوف jsonb بدل استدعاءٍ لكل عمل
create or replace function public.set_imdb_ratings(p_rows jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.imdb_ratings (media_type, tmdb_id, imdb_id, imdb_rating, updated_at)
  select
    r ->> 'media_type',
    (r ->> 'tmdb_id')::bigint,
    nullif(r ->> 'imdb_id', ''),
    nullif(r ->> 'imdb_rating', '')::numeric,
    now()
  from jsonb_array_elements(p_rows) as r
  where (r ->> 'media_type') in ('movie', 'tv')
    and (r ->> 'tmdb_id') ~ '^\d+$'
  on conflict (media_type, tmdb_id) do update
    set imdb_id     = excluded.imdb_id,
        imdb_rating = excluded.imdb_rating,
        updated_at  = now();
$$;

revoke all on function public.set_imdb_ratings(jsonb) from public;
grant execute on function public.set_imdb_ratings(jsonb) to authenticated;
