-- 214 — الأكثرُ إضافةً في مكتبات أعضاء Loopz (D-1486 · أحمد ٢٠ أكتوبر ٢٠٢٦: «3 ب»).
--
-- لماذا: الدرجةُ الثالثة من اقتراحات الأفلام والمسلسلات («رائج الآن») تبدأ بما أضافه أعضاءُ Loopz أكثر،
-- ومكتبةُ كلِّ عضوٍ مقصورةٌ على صاحبها بسياسات `follows` — فالعدُّ عبر الأعضاء لا يُقرأ إلّا من دالّةٍ
-- مالكة، كأختها `user_public_follows` (security2.sql).
-- ⚖️ لا هويّة: الدالّةُ تعيد رقمَ العمل ونوعَه وعددَ الأعضاء فقط — لا معرّفَ ولا اسمَ ولا تاريخ.
-- ⚖️ وعملٌ أضافه عضوٌ واحدٌ لا يظهر (الحدُّ الأدنى عضوان): رقمٌ واحدٌ قد يكشف مكتبةَ شخصٍ بعينه في قاعدةٍ صغيرة.
-- `genres` أنواعُ العمل كما سُجّلت في إحدى المكتبات (`max` على المصفوفات يختار صفّاً واحداً، و`array_agg` على مصفوفاتٍ يبني مصفوفةً ثنائيّة) — يكفي الخادمَ ليُسقط الرسومَ المتحرّكة من تبويبَي الأفلام والمسلسلات قبل أيِّ نداء.

create or replace function public.loopz_popular_titles(kind text, max_rows integer default 40)
returns table (tmdb_id integer, members integer, genres integer[])
language sql
stable
security definer
set search_path = public
as $$
  select f.tmdb_id,
         count(distinct f.user_id)::integer as members,
         max(f.genres) as genres
  from public.follows f
  where f.media_type = kind
    and kind in ('movie', 'tv')
    and coalesce(f.dropped, false) = false
  group by f.tmdb_id
  having count(distinct f.user_id) >= 2
  order by members desc, max(f.added_at) desc
  limit least(greatest(coalesce(max_rows, 40), 1), 100);
$$;

revoke all on function public.loopz_popular_titles(text, integer) from public;
revoke all on function public.loopz_popular_titles(text, integer) from anon;
grant execute on function public.loopz_popular_titles(text, integer) to authenticated;
