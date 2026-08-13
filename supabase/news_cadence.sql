-- ============================================================
--  Loopz — إيقاعُ الأخبار: من يُفحص، ومتى (هجرة 69، D-215)
--  شغّلها في Supabase → SQL Editor بعد news_items_drop.sql (68)
--
--  **سؤالُ أحمد:** «الآن الأخبار متى تُكتب؟ كيف تتحدّث؟ لأن لها ٨ ساعات
--  مثل ما هي».
--
--  **والجواب الصادق: الإيقاعُ كان بطيئاً بمقدارٍ يُحسب.** الدورةُ الواحدة
--  تفحص ٢٦ عملاً، **وقائمةُ المراقبة أكثرُ من ألف** (أفضل ٥٠ + كلُّ ما في
--  مكتبات المستخدمين) — فالمرورُ الكامل عليها يحتاج **أربعين زيارة**.
--  ومعظمُ ما تفحصه في كل دورة **أعمالٌ انتهت منذ سنين ولن تتغيّر أبداً**.
--
--  **فالعلاجُ ليس فحصاً أكثر بل فحصاً أذكى:**
--    **الحيُّ يُفحص كلَّ ستّ ساعات، والميتُ كلَّ أسبوع.**
--  و«الحيّ» تعريفٌ لا شعور: مسلسلٌ عائدٌ أو قيد الإنتاج · أو له موسمٌ
--  قادمٌ بموعد · أو فيلمٌ لم يصدر بعد. **وهؤلاء وحدهم من يصنع خبراً.**
--
--  **والأثر بالحساب:** إن كان الحيُّ مئتَي عملٍ من ألف، صار المرورُ عليهم
--  **خمسَ دورات** بدل أربعين — **أي أن الخبر يصل في ساعاتٍ لا في أيام.**
--
--  آمنٌ للإعادة.
-- ============================================================

begin;

drop function if exists public.news_watch_slice(integer);

create function public.news_watch_slice(p_limit integer default 25)
returns table (tmdb_id integer, media_type text, checked_at timestamptz, chart_rank integer)
language sql
stable
security definer
set search_path = public
as $$
  with watch as (
    select c.tmdb_id::integer as tmdb_id, c.media_type
      from public.imdb_chart c
    union
    select f.tmdb_id::integer, f.media_type
      from public.follows f
  ),
  ranked as (
    select c.tmdb_id::integer as tmdb_id, c.media_type, min(c.rank)::integer as rank
      from public.imdb_chart c
     group by 1, 2
  ),
  joined as (
    select
      w.tmdb_id,
      w.media_type,
      s.updated_at,
      r.rank,
      /* **الحيُّ** — من يُتوقَّع منه خبر:
         مسلسلٌ لم ينتهِ، أو له موسمٌ قادمٌ بموعد،
         أو فيلمٌ لم يصدر بعد (أو له تاريخُ صالاتٍ آتٍ).
         **ولقطةٌ غائبة حيّةٌ بالضرورة** — لم نرَه بعد. */
      (
        s.updated_at is null
        or (w.media_type = 'tv' and coalesce(s.status, '') in
              ('Returning Series', 'In Production', 'Planned', 'Pilot'))
        or (w.media_type = 'tv' and s.next_season_date is not null)
        or (w.media_type = 'movie' and coalesce(s.status, '') <> 'Released')
        or (w.media_type = 'movie' and coalesce(s.theatrical_date, '') > to_char(now(), 'YYYY-MM-DD'))
      ) as alive
    from watch w
    left join public.title_snapshots s
      on s.tmdb_id = w.tmdb_id and s.media_type = w.media_type
    left join ranked r
      on r.tmdb_id = w.tmdb_id and r.media_type = w.media_type
  )
  select j.tmdb_id, j.media_type, j.updated_at, j.rank
  from joined j
  /* **الاستحقاق قبل الترتيب:** ما لم يحن دورُه لا يُفحص أصلاً —
     فلا تُنفق الميزانيةُ على «The Godfather» كلَّ ساعة */
  where j.updated_at is null
     or (j.alive and j.updated_at < now() - interval '6 hours')
     or (not j.alive and j.updated_at < now() - interval '7 days')
  order by j.alive desc, j.updated_at asc nulls first
  limit least(greatest(coalesce(p_limit, 25), 1), 60);
$$;

revoke all on function public.news_watch_slice(integer) from public;
grant execute on function public.news_watch_slice(integer) to authenticated;

/* **و«هل حان الرصد؟» تُسأل عن المستحقّ لا عن الأقدم.**
   الصيغةُ القديمة قارنت **أقدمَ لقطةٍ** بالمهلة، **فكانت تقول «نعم» أبداً**
   ما دام في القائمة عملٌ قديمٌ لا يُفحص — أو «لا» لو لم يكن. والصحيح:
   **هل يوجد عملٌ حان دورُه؟** */
create or replace function public.news_gen_stale(p_minutes integer default 30)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.news_watch_slice(1));
$$;

revoke all on function public.news_gen_stale(integer) from public;
grant execute on function public.news_gen_stale(integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select count(*)::int as due_now from public.news_watch_slice(60);
-- select public.news_gen_stale(30) as should_run;
-- -- توزيعُ اللقطات: كم حيٌّ وكم ميت؟
-- select media_type, status, count(*)::int
--   from public.title_snapshots group by 1,2 order by 3 desc limit 12;
--
-- ⚠️ والسياساتُ المفتوحة تبقى **أربعاً**.
