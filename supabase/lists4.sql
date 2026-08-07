-- ==========================================================================
-- lists4.sql — عدّاد المسلسلات/الأفلام لكل قائمة، وغلافٌ أوسع للبطاقة
--
-- بطاقة القائمة صارت تعرض «س مسلسل · ص فيلم» بدل رقمٍ كلّي أصمّ، فالعميل
-- يحتاج العدّين مفصولين لا مجموعهما. و`user_list_items.media_type` يحمل
-- 'tv' أو 'movie'، فالعدّ مباشر: صفٌّ لكلٍّ بشرطه.
--
-- ورفعنا سقف الملصقات من ٣ إلى ١٢: البطاقة صارت صفَّ غلافٍ أفقياً يمرّر،
-- فثلاثةٌ لا تملؤه. و`row_number()` يثبّت ترتيبها بحسب الأحدث داخل التجميع.
--
-- `my_lists` يُسقط ويُعاد إنشاؤه لا `create or replace`: تغيّر أعمدة
-- الإرجاع يرفضه Postgres في الاستبدال. الأعمدة الجديدة (shows_count ثم
-- movies_count) أُضيفت قبل `posters` — والعميل يقرأ بالاسم لا بالموضع.
--
-- يُنفَّذ مرّةً واحدة في لوحة Supabase، بعد lists3.sql وقبل نشر الكود.
-- آمنٌ للإعادة.
-- ==========================================================================

drop function if exists public.my_lists();

create function public.my_lists()
returns table (
  id          uuid,
  name        text,
  subtitle    text,
  kind        text,
  is_public   boolean,
  created_at  timestamptz,
  item_count  integer,
  -- عدّ المسلسلات والأفلام منفصلاً — البطاقة تُسقط الطرف الصفري
  shows_count  integer,
  movies_count integer,
  -- حتى ١٢ ملصقاً لصفّ الغلاف الأفقي (كان ٣)
  posters     text[]
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.subtitle,
    l.kind,
    l.is_public,
    l.created_at,
    (select count(*)::integer
       from public.user_list_items i
      where i.list_id = l.id),
    (select count(*)::integer
       from public.user_list_items i
      where i.list_id = l.id and i.media_type = 'tv'),
    (select count(*)::integer
       from public.user_list_items i
      where i.list_id = l.id and i.media_type = 'movie'),
    (select array_agg(p order by ord)
       from (select i.poster_path as p,
                    row_number() over (order by i.added_at desc) as ord
               from public.user_list_items i
              where i.list_id = l.id and i.poster_path is not null
              order by i.added_at desc
              limit 12) s)
  from public.user_lists l
  where l.user_id = auth.uid()
  order by l.created_at desc;
$$;

revoke all on function public.my_lists() from public;
grant execute on function public.my_lists() to authenticated;
revoke execute on function public.my_lists() from anon;
