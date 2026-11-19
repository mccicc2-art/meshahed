-- 252 — وجهُ بطاقة القائمة: عددُها الحقيقيُّ وأوّلُ أربعة ملصقات، لكلِّ قائمةٍ وحدَها (T451)
--
-- 🔴 العطل (بلاغُ أحمد ١٩ نوفمبر بفيديو من حساب khld): بطاقةُ «طريقك إلى Avengers: Doomsday» مثبّتةٌ في صدر
-- «تناسبك» في الخادم، ولا تظهر في التطبيق. السجلُّ أثبت أنّ الخادم وضعها أوّلاً في كلِّ طلب — وسقطت في
-- `shapeListCards`: كان يجلب أعمالَ القوائم كلِّها في طلبٍ واحدٍ سقفُه ١٠٠٠ صفّ، الأحدثُ أوّلاً. قوائمُ خالد
-- الاثنتا عشرة فيها أكثرُ من ألف عمل («Top 250» الثلاث وAFI والجوائز)، فأعمالُ دومزداي (أُضيفت في أغسطس)
-- وقعت خارج السقف ⇒ عددُها صفر ⇒ البطاقةُ تُحذف. والسقفُ نفسُه كان يقصّ الأعداد: «Top 250 Movies · 217».
--
-- 🔑 العدُّ والملصقاتُ تُحسب لكلِّ قائمةٍ في القاعدة، فلا سقفَ مشتركٌ تتزاحم عليه القوائم.
-- 🔒 `security invoker`: سياساتُ `user_list_items` نفسُها تحكم — القائمةُ العامّة يقرؤها الجميع (١٣٦)،
-- والخاصّةُ صاحبُها وأعضاؤها (٢٣٤). لا رؤيةَ جديدةَ لأحد.
-- 🔑 والتعادلُ في وقت الإضافة يحسمه الترتيبُ اليدويّ (`sort_order`): قوائمُ لوبز تُبذر دفعةً بوقتٍ واحد، فغلافُها
-- يُظهر رقم ١–٤ من ترتيبها لا أصغرَ المعرّفات. والملصقُ الفارغ ('') لا يأخذ خانة.
-- ⚠️ السقفُ مئتا معرّفٍ في النداء الواحد — حارسٌ لا قيد (أكبرُ قارئٍ اليوم يطلب أقلَّ منها بكثير).

create or replace function public.list_card_faces(p_ids uuid[])
returns table (list_id uuid, item_count integer, posters text[])
language sql
stable
security invoker
set search_path = public
as $$
  select i.list_id,
         count(*)::integer as item_count,
         coalesce(
           (array_agg(i.poster_path order by i.added_at desc, i.sort_order nulls last, i.tmdb_id) filter (where i.poster_path is not null and i.poster_path <> ''))[1:4],
           '{}'::text[]
         ) as posters
  from public.user_list_items i
  where i.list_id = any (p_ids[1:200])
  group by i.list_id
$$;

revoke all on function public.list_card_faces(uuid[]) from public;
grant execute on function public.list_card_faces(uuid[]) to anon, authenticated;
