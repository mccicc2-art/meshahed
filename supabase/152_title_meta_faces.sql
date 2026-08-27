-- ============================================================
-- 152 — وجوهُ المخرجين والممثّلين في بطاقة الهويّة (D-718)
--
-- **حكمُ أحمد**: «نفّذها» — بعد أن قُرئ عليه ثمنُ صور الممثّلين
-- والمخرجين صريحاً: `title_meta` يخزّن أسماءَهم لا معرّفاتِهم، **فعمودٌ
-- جديدٌ وهجرةٌ وإعادةُ تعبئةٍ لكلِّ الأعمال.**
--
-- 🔑 **والمخزَّنُ مسارُ الصورة لا معرّفُ الشخص**: **الغرضُ وجهٌ يُرسم لا
-- صفحةُ شخصٍ تُفتح** — ومعرّفٌ يُخزَّن ثمّ يُترجَم إلى مسارٍ بنداءٍ ثانٍ
-- وقتَ العرض هو بعينه ما بُني `title_meta` ليمنعه (D-649).
-- **ويومَ نحتاج صفحةَ الشخص يُضاف عمودُه بهجرةٍ كهذه.**
--
-- ⚠️ **و«الناقصُ» صار يُقاس بنسخةِ الكاتب لا بغياب القيمة**: كثيرٌ من
-- الأشخاص بلا صورةٍ في TMDB أصلاً، **وشرطُ «الصورةُ فارغة» يعيدهم في
-- كلِّ دفعةٍ إلى الأبد** (نفسُ فخِّ الهجرة ١٥١، وقد كلّفنا هناك ساعةً).
-- **فالنسخةُ تحسم**: `meta_version` يكتبه الكاتبُ ثابتاً، والباحثُ يطلب
-- ما دونه — **ويومَ يزيد عمودٌ آخرُ تُرفع النسخةُ في الهجرة نفسِها
-- فيلتقيان دائماً** (وهما في ملفٍّ واحدٍ فلا يفترقان).
--
-- rollback:
--   alter table public.title_meta
--     drop column if exists director_profile,
--     drop column if exists cast_profiles,
--     drop column if exists meta_version;
--   (وأعد جسمَي الدالّتين من 150 و151)
-- ============================================================

alter table public.title_meta
  add column if not exists director_profile text,
  add column if not exists cast_profiles    text[],
  add column if not exists meta_version     smallint not null default 1;

-- ============ الكاتبُ يكتب وجهَه ونسختَه ============
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
    (media_type, tmdb_id, release_year, original_language, origin_countries,
     director, director_profile, top_cast, cast_profiles, meta_version, updated_at)
  select r.media_type, r.tmdb_id, r.release_year, r.original_language,
         r.origin_countries, r.director, r.director_profile,
         r.top_cast, r.cast_profiles, 2, now()
  from jsonb_to_recordset(p_rows) as r(
    media_type text, tmdb_id integer, release_year integer,
    original_language text, origin_countries text[],
    director text, director_profile text,
    top_cast text[], cast_profiles text[]
  )
  where r.media_type in ('movie','tv') and r.tmdb_id is not null
  on conflict (media_type, tmdb_id) do update set
    release_year      = excluded.release_year,
    original_language = excluded.original_language,
    origin_countries  = excluded.origin_countries,
    director          = excluded.director,
    director_profile  = excluded.director_profile,
    top_cast          = excluded.top_cast,
    cast_profiles     = excluded.cast_profiles,
    meta_version      = excluded.meta_version,
    updated_at        = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.set_title_meta(jsonb) from public;
grant execute on function public.set_title_meta(jsonb) to authenticated;

-- ============ والباحثُ يطلب ما دون النسخة ============
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
  where (
      m.tmdb_id is null
      or m.meta_version < 2
      or (
        m.updated_at < now() - interval '1 hour'
        and (
          coalesce(m.director, '') ~ '[؀-ۿ]'
          or exists (
            select 1 from unnest(coalesce(m.top_cast, array[]::text[])) c
            where c ~ '[؀-ۿ]'
          )
        )
      )
    )
    and public.am_admin()
  group by f.tmdb_id, f.media_type
  order by count(*) desc, f.tmdb_id
  limit greatest(1, least(coalesce(lim, 100), 300));
$$;

-- الفحص بعد التعبئة:
-- select count(*) filter (where meta_version >= 2) as v2,
--        count(*) filter (where director_profile is not null) as with_face,
--        count(*) from public.title_meta;
