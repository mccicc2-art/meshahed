-- ═══════════════════════════════════════════════════════════════════════
--  الهجرة ١١٢ — **العتبةُ تدخل البناء، فالمخزَّنُ يساوي المعروض** (D-365)
-- ═══════════════════════════════════════════════════════════════════════
--
-- **دَينٌ مُعلَنٌ منذ D-323** (طلبُ أحمد بنصّه: «أي فلم أو مسلسل لم يصل
-- 20 الآف صوت يسقط»): **العتبةُ طُبِّقت عند القراءة** (`MIN_CHART_VOTES`
-- في `topChartRows`) **ولم تُطبَّق عند البناء** — فبقي `build_imdb_chart`
-- يُدخل الأنمي والمسلسلات بخمسة آلاف.
--
-- ================= ولماذا يُهمّ أن يتساويا =================
--
-- 🔴 **لأن ما يُولَّد من الجدول لا يمرّ بمرشِّح القراءة**: قوائمُ لوبز
-- المنسّقة (D-330) تُبنى من `imdb_chart` نفسِه، **فقائمةُ «أفضل ٢٥٠
-- أنمي» خرجت بمئةٍ وخمسةٍ وأربعين** بينما الرفُّ يعرض ما فوق العتبة.
-- **ومخزَّنٌ أوسعُ من المعروض هو كيف يفترق الرقمان** (D-219: رقمٌ يُقرأ
-- خطأً أسوأ من لا رقم) — **والعلاجُ عند المصدر لا عند كل قارئ** (D-148).
-- **والمقيس:** ٢٠٦ صفَّ أنمي في الجدول، **منها ٧٠ دون العتبة** (أدناها
-- ٥٬٦١٤ صوتاً).
--
-- ================= وحدُّ الفيلم يبقى أعلى =================
--
-- ⚠️ **٢٥٬٠٠٠ للأفلام كما هي** — **العتبةُ أرضيّةٌ لا سقف**، وخفضُها
-- إلى عشرين ألفاً كان سيُدخل أفلاماً لم يطلب أحدٌ إدخالها: **أيُّ تفضيلٍ
-- جديد افتراضُه السلوكُ القائم** (D-152). **فالأرضيّةُ الجديدة تُرفع
-- حيث كانت أدنى وحدَها.**
--
-- ⚠️ **وثابتُ بايز `m` لم يُمَسّ**: ذاك يرتّب المؤهَّلين، **وهذه تقرّر
-- من يدخل** — **معنيان فرقمان، وخلطُهما يبدّل الترتيب بلا طلب**
-- (D-224).
--
-- ⚠️ **ولا `drop`**: العائدُ نفسُه `(kind, n)` والجسمُ وحدَه تغيّر
-- بسطر (D-037).
-- ═══════════════════════════════════════════════════════════════════════

begin;

create or replace function public.build_imdb_chart(p_limit integer default 250)
returns TABLE (kind text, n integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 250), 10), 500);
begin
  delete from public.imdb_chart where true;

  insert into public.imdb_chart
    (kind, rank, tconst, tmdb_id, media_type, title, poster_path, rating, votes, is_doc)
  select k.kind, k.rn, k.tconst, k.tmdb_id, k.media_type, k.title,
         k.poster_path, k.rating, k.votes, k.is_doc
  from (
    select
      c.kind,
      row_number() over (
        partition by c.kind
        order by (c.votes::numeric / (c.votes + c.m)) * c.rating
               + (c.m::numeric / (c.votes + c.m)) * c.avg_rating desc,
                 c.votes desc
      ) as rn,
      c.tconst, c.tmdb_id, c.media_type, c.title, c.poster_path,
      c.rating, c.votes, c.is_doc
    from (
      select
        p.*,
        case when p.is_anime then 'anime'
             when p.media_type = 'movie' then 'movie'
             else 'tv' end as kind,
        case when p.is_anime then 5000
             when p.media_type = 'movie' then 25000
             else 5000 end as m,
        avg(p.rating) over (
          partition by case when p.is_anime then 'anime'
                            when p.media_type = 'movie' then 'movie'
                            else 'tv' end
        ) as avg_rating
      from public.imdb_pool p
      where p.votes >= case when p.is_anime then 20000
                            when p.media_type = 'movie' then 25000
                            else 20000 end
    ) c
  ) k
  where k.rn <= lim;

  return query
    select ic.kind, count(*)::integer from public.imdb_chart ic group by ic.kind;
end;
$$;

revoke all on function public.build_imdb_chart(integer) from public;
grant execute on function public.build_imdb_chart(integer) to authenticated;

commit;

-- ═══════════════════════ التحقّق (يُشغَّل بعدها) ═══════════════════════
-- ١) أن العتبة دخلت التعريف:
-- select count(*)::int as floor_in_body
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname = 'build_imdb_chart'
--    and pg_get_functiondef(p.oid) like '%then 20000%';
-- ٢) ثم إعادةُ البناء وقراءةُ الأثر:
-- select * from public.build_imdb_chart(250);
-- select kind, count(*), min(votes) from public.imdb_chart group by kind;
-- المتوقَّع: لا صفَّ تحت ٢٠٬٠٠٠ في `anime`/`tv`، ولا تحت ٢٥٬٠٠٠ في `movie`.
