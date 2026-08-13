-- ============================================================
--  Loopz — عدّادُ المفضّلة على بطاقة العمل (هجرة 70، D-216)
--  شغّلها في Supabase → SQL Editor بعد news_cadence.sql (69)
--
--  **طلبُ أحمد:** «هذا الكارد يحتاج تحسين… فيه عدد المشاهدة للفلم وعدد
--  التعليقات وعدد المقيمين وعدد المفضلة».
--
--  **وثلاثةٌ من الأربعة موجودةٌ أصلاً**: الردودُ والمشاهدون في هذه الدالّة
--  منذ D-193، **وعددُ المقيّمين لا يأتي من هنا عمداً** — انظر أدناه.
--  **فالجديدُ عمودٌ واحد: `favorites`.**
--
--  ⚠️ **ولماذا لا يُحسب «المقيّمون» هنا:** النجمةُ على البطاقة **متوسّطُ
--  من تكلّم عن العمل في هذا الخطّ** لا تقييمُ الجميع (قرارُ D-193،
--  ومكتوبٌ في `WorksTalk.tsx`). **فلو وضعنا تحتها عدَّ كلِّ من قيّم في
--  التطبيق لصار الكسرُ بسطُه من قومٍ ومقامُه من قومٍ آخرين** — رقمٌ يبدو
--  دقيقاً وهو غلط. **والمقامُ الصحيح يُحسب في الواجهة من نفس الآراء
--  المعروضة، بلا نداءٍ ولا عمود.**
--
--  **والمفضّلةُ ليست جدولاً:** هي قائمةٌ في `user_lists` علامتُها
--  `kind = 'favorites'` (هجرة ٥٥) — **فالعدُّ ربطٌ لا عمودٌ جديد.**
--
--  ⚠️ **وما يُكشف يُقال:** أرقامٌ مجمَّعة بلا هوية — **لا تقول من فضّل**،
--  كما أن `watchers` لا تقول من تابع. **وهي لِمن سجّل دخوله وحده**
--  (`auth.uid() is not null` كما كانت).
--
--  آمنٌ للإعادة.
-- ============================================================

begin;

/* تغييرُ شكل الإرجاع يوجب الحذف أوّلاً — والدالّةُ تُعاد كاملةً في نفس
   المعاملة فلا تمرّ لحظةٌ بلا دالّة */
drop function if exists public.title_talk_stats();

create function public.title_talk_stats()
returns table (
  tmdb_id     integer,
  media_type  text,
  replies     bigint,
  watchers    bigint,
  favorites   bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select tmdb_id, media_type, count(*)::bigint as n
      from public.review_replies
     where hidden = false
     group by 1, 2
  ),
  f as (
    select tmdb_id, media_type, count(*)::bigint as n
      from public.follows
     group by 1, 2
  ),
  v as (
    /* المفضّلةُ قائمةٌ لا جدول (هجرة ٥٥) — والعدُّ ربطٌ على `kind` */
    select i.tmdb_id, i.media_type, count(*)::bigint as n
      from public.user_list_items i
      join public.user_lists l on l.id = i.list_id
     where l.kind = 'favorites'
     group by 1, 2
  ),
  /* **مفاتيحُ الأعمال التي فيها شيءٌ يُعدّ** — فالدالّةُ تكبر بحجم
     استعمالنا لا بحجم TMDB (نفسُ مبدأ D-193) */
  keys as (
    select tmdb_id, media_type from r
    union
    select tmdb_id, media_type from f
    union
    select tmdb_id, media_type from v
  )
  select
    k.tmdb_id,
    k.media_type,
    coalesce(r.n, 0) as replies,
    coalesce(f.n, 0) as watchers,
    coalesce(v.n, 0) as favorites
  from keys k
  left join r on r.tmdb_id = k.tmdb_id and r.media_type = k.media_type
  left join f on f.tmdb_id = k.tmdb_id and f.media_type = k.media_type
  left join v on v.tmdb_id = k.tmdb_id and v.media_type = k.media_type
  where auth.uid() is not null;
$$;

revoke all on function public.title_talk_stats() from public;
grant execute on function public.title_talk_stats() to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select count(*)::int as rows from public.title_talk_stats();
-- select * from public.title_talk_stats()
--   order by favorites desc, watchers desc limit 5;   -- خمسةُ أعمدة
-- -- والتوقيعُ يُقرأ نصّاً:
-- select pg_get_function_result(oid) from pg_proc
--  where proname = 'title_talk_stats';   -- يجب أن يضمّ favorites bigint
--
-- ⚠️ والسياساتُ المفتوحة تبقى **أربعاً**:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
