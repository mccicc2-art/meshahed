-- ==========================================================================
-- lists3.sql — وصفٌ قصير للقائمة، و`my_lists` يحمل النوع والوصف
--
-- الاسم يقول «ما هذه القائمة»، والوصف يقول «لماذا هي». «سبايدرمان» لا تخبر
-- أحداً إن كانت ترتيب مشاهدةٍ للمبتدئ أم ترتيباً يتجنّب الحرق — وسطرٌ واحد
-- يفعل. وهو ملكُ القائمة لا القارئ: من يفتح رابطها المعلن يرى الوصف نفسه.
--
-- و`my_lists` يُسقط ويُعاد إنشاؤه لا `create or replace`: تغيّر أعمدة
-- الإرجاع يرفضه Postgres في الاستبدال. الأعمدة الجديدة مضافةٌ في الوسط
-- عمداً (الاسم ثم الوصف ثم النوع) لأن العميل يقرأ بالاسم لا بالموضع.
--
-- يُنفَّذ مرّةً واحدة في لوحة Supabase، قبل نشر الكود. آمنٌ للإعادة.
-- ==========================================================================

alter table public.user_lists
  add column if not exists subtitle text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_lists_subtitle_check') then
    alter table public.user_lists
      add constraint user_lists_subtitle_check
      check (subtitle is null or length(subtitle) <= 120);
  end if;
end $$;

drop function if exists public.my_lists();

create function public.my_lists()
returns table (
  id         uuid,
  name       text,
  subtitle   text,
  kind       text,
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
    l.subtitle,
    l.kind,
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
