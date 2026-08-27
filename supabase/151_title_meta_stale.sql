-- ============================================================
-- 151 — «الناقصُ» يشمل المعرَّبَ القديم (D-702)
--
-- **بلاغُ أحمد**: «الأسماء خلها تظهر بالإنجلش» — التعبئةُ الأولى لبطاقات
-- الهويّة (الهجرة ١٥٠) جرت من جلسةٍ إداريّةٍ عربيّةٍ، **فخزّن TMDB
-- أسماءَ المخرجين والممثلين معرّبةً** («جورج ر. ر. مارتن»). **ولغةُ
-- الكتالوج قرارُ الكتالوج لا لغةُ من شغّل الدورة** — فالبابُ صار يطلب
-- `en-US` صراحةً (D-702)، وهذه الدالّةُ صارت تُعيد أيضاً كلَّ صفٍّ
-- يحمل حرفاً عربيّاً في المخرج أو الطاقم **فيُعاد كتابتُه بالإنجليزيّة**
-- (`set_title_meta` upsert).
--
-- ⚠️ **واستثناءُ الساعة شرطُ توقّف**: عملان سعوديّان اسمُ صانعِهما
-- عربيٌّ في TMDB حتى بالإنجليزيّة — بلا `updated_at < now() - 1h`
-- تُعيدهما كلُّ دفعةٍ إلى الأبد ولا تنتهي الدورة.
--
-- rollback: أعد جسم الدالّة من 150_title_meta.sql
-- ============================================================
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

-- الفحص: صفر أعمالٍ منتظرة بعد إعادة التعبئة (سوى العربيَّين خلال ساعتهما)
-- select count(*) from public.admin_titles_missing_meta(300);
