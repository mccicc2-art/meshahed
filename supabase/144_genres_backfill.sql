-- ============================================================
--  Loopz — الهجرة ١٤٤ (D-648): بابُ تعبئةِ التصنيفات، إداريّاً
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ بنيةٌ فقط: لا حذفَ ولا `drop`. **ولا تعديلَ بياناتٍ قائمة**:
--  الدالّةُ الكاتبةُ مقيّدةٌ بـ`genres is null` — **تعبئةٌ لا استبدال**،
--  فلا قيمةَ قائمةٌ تُمسّ ولو أُعيد تشغيلُها ألفَ مرّة.
--  والسياساتُ المفتوحةُ تبقى أربعاً.
-- ============================================================

-- ============ ١) ما ينقصه تصنيفٌ، بالأكثرِ تكراراً أوّلاً ============
--
--  🔑 **والتجميعُ بالعمل لا بالصفّ**: «صراع العروش» عند عشرةِ أعضاءٍ
--  عشرةُ صفوفٍ **ونداءُ TMDB واحد** — **والدفعةُ تُقاس بالأعمال لا
--  بالصفوف** (D-580: لا تُدفع كلفةُ نداءٍ مرّتين لشيءٍ واحد).
--
--  ⚠️ **والأكثرُ تكراراً أوّلاً**: نداءٌ واحدٌ يملأ عشرةَ صفوفٍ أنفعُ من
--  نداءٍ يملأ صفّاً — **فأثرُ أوّلِ دفعةٍ أكبرُ ما يمكن.**
create or replace function public.admin_titles_missing_genres(lim integer default 200)
returns table (tmdb_id integer, media_type text, rows_waiting bigint)
language sql
stable
security definer
set search_path = 'public'
as $$
  select f.tmdb_id, f.media_type, count(*)
  from public.follows f
  where f.genres is null
    and public.am_admin()
  group by f.tmdb_id, f.media_type
  order by count(*) desc, f.tmdb_id
  limit greatest(1, least(coalesce(lim, 200), 500));
$$;

-- ============ ٢) كتابةُ تصنيفِ عملٍ في كلِّ صفوفه ============
--
--  🔴 **والحارسُ في جسم الدالّة لا في الباب** (D-011/D-193/D-314):
--  **مسارٌ في التطبيق ليس حارساً** — **ودالّةٌ تكتب صفوفَ غيرِك تُسأل
--  عن `am_admin()` بنفسها**، فمسجَّلٌ عاديٌّ ينادي الباب يأخذ خطأً لا صفّاً.
--
--  ⚠️ **و`genres is null` شرطٌ لا زينة**: بدونه تصير الدالّةُ سلاحَ
--  استبدالٍ جماعيّ — **وتشغيلٌ خاطئٌ يمسح تصنيفَ كلِّ المكتبات.**
--  **وبه: أسوأُ ما يفعله تشغيلٌ مكرَّرٌ لا شيء.**
create or replace function public.admin_set_title_genres(
  p_tmdb_id    integer,
  p_media_type text,
  p_genres     integer[]
)
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
  update public.follows f
     set genres = coalesce(p_genres, '{}'::integer[])
   where f.tmdb_id = p_tmdb_id
     and f.media_type = p_media_type
     and f.genres is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.admin_titles_missing_genres(integer) from public;
revoke all on function public.admin_set_title_genres(integer, text, integer[]) from public;
grant execute on function public.admin_titles_missing_genres(integer) to authenticated;
grant execute on function public.admin_set_title_genres(integer, text, integer[]) to authenticated;
