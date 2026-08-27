-- ============================================================
-- 150 — بطاقةُ هويّة العمل المشتركة (`title_meta`) · D-700
--
-- **طلبُ أحمد بصورة «Your taste» كاملة**: سنواتٌ ولغاتٌ وتنوّعُ بلدانٍ
-- ومخرجون وممثلون — **وكلُّها حقائقُ كتالوجٍ لا حقائقُ مستخدم**:
-- سنةُ Inception واحدةٌ عند كلِّ من تابعه.
--
-- 🔑 **فجدولٌ مشتركٌ بمفتاح العمل لا أعمدةٌ في `follows`** (خلافاً
-- للهجرة ١٤٢ حيث كان العمودُ زينةَ صفٍّ قائم): «صراع العروش» عند
-- عشرة أعضاءٍ **صفٌّ واحدٌ هنا لا عشرةُ صفوفٍ تُملأ** — وقاعدةُ
-- `imdb_pool`/`imdb_chart` نفسُها: كتالوجٌ علنيٌّ يُبنى بالإدارة
-- ويُقرأ للجميع.
--
-- ⚠️ **سياسةٌ مفتوحةٌ خامسة** (`qual = 'true'`) — **حدِّث الفحصَ
-- الصحّيَّ**: `open_policies` صار **٥** لا ٤ (أخواتُها الأربع:
-- imdb_ratings · imdb_chart · وأختاها).
--
-- rollback:
--   drop function if exists public.admin_titles_missing_meta(integer);
--   drop function if exists public.set_title_meta(jsonb);
--   drop table if exists public.title_meta;
-- ============================================================

-- ============ ١) الجدول والقراءة ============
create table if not exists public.title_meta (
  media_type        text    not null check (media_type in ('movie','tv')),
  tmdb_id           integer not null,
  release_year      integer,
  original_language text,
  origin_countries  text[],
  -- مخرجُ الفيلم أو صانعُ المسلسل — اسمٌ واحدٌ يُعرض، لا طاقمٌ كامل
  director          text,
  -- أوّلُ ثلاثةٍ في التسمية — لعدّ «الممثلين» في الذوق، لا صفحةَ طاقم
  top_cast          text[],
  updated_at        timestamptz not null default now(),
  primary key (media_type, tmdb_id)
);

alter table public.title_meta enable row level security;

drop policy if exists title_meta_read on public.title_meta;
create policy title_meta_read on public.title_meta
  for select using (true);

-- ============ ٢) ما ينقص — بالأعمال لا بالصفوف (وصفة ١٤٤ حرفاً) ============
create or replace function public.admin_titles_missing_meta(lim integer default 100)
returns table (tmdb_id integer, media_type text, rows_waiting bigint)
language sql
stable
security definer
set search_path = 'public'
as $$
  select f.tmdb_id, f.media_type, count(*)
  from public.follows f
  left join public.title_meta m
    on m.media_type = f.media_type and m.tmdb_id = f.tmdb_id
  where m.tmdb_id is null
    and public.am_admin()
  group by f.tmdb_id, f.media_type
  order by count(*) desc, f.tmdb_id
  limit greatest(1, least(coalesce(lim, 100), 300));
$$;

revoke all on function public.admin_titles_missing_meta(integer) from public;
grant execute on function public.admin_titles_missing_meta(integer) to authenticated;

-- ============ ٣) الكتابة — دفعةٌ واحدةٌ jsonb (وصفة `set_imdb_pool`) ============
--  ⚠️ upsert لا تعبئةً فقط: بطاقةُ الهويّة تُصحَّح من TMDB متى أُعيد
--  تشغيلُ الدورة — **وليست رأيَ مستخدمٍ يُحفَظ من الدهس.**
create or replace function public.set_title_meta(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  n integer;
begin
  if not public.am_admin() then
    raise exception 'forbidden';
  end if;
  insert into public.title_meta
    (media_type, tmdb_id, release_year, original_language, origin_countries, director, top_cast, updated_at)
  select r.media_type, r.tmdb_id, r.release_year, r.original_language,
         r.origin_countries, r.director, r.top_cast, now()
  from jsonb_to_recordset(p_rows) as r(
    media_type text, tmdb_id integer, release_year integer,
    original_language text, origin_countries text[], director text, top_cast text[]
  )
  where r.media_type in ('movie','tv') and r.tmdb_id is not null
  on conflict (media_type, tmdb_id) do update set
    release_year      = excluded.release_year,
    original_language = excluded.original_language,
    origin_countries  = excluded.origin_countries,
    director          = excluded.director,
    top_cast          = excluded.top_cast,
    updated_at        = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.set_title_meta(jsonb) from public;
grant execute on function public.set_title_meta(jsonb) to authenticated;

-- ============ الفحص بعد التشغيل ============
-- select count(*) from public.title_meta;                                  -- 0 قبل التعبئة
-- select proname from pg_proc where proname in ('admin_titles_missing_meta','set_title_meta');
-- select (select count(*)::int from pg_policies where qual = 'true') as open_policies;  -- 5
