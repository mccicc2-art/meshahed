-- ============================================================
--  Loopz — إزالةُ الأخبار المجمَّعة (هجرة 68، D-214)
--  شغّلها في Supabase → SQL Editor بعد news_reports.sql (67)
--
--  **طلبُ أحمد: «نعم احذفها».** بعد أن صارت الأخبارُ من عندنا (D-211 →
--  D-213) لم يبقَ لجدول `news_items` مستهلكٌ واحد — **وجدولٌ حيٌّ بلا
--  قارئ دَينٌ صامت**: يظهر في كل جردة، ويُقرأ يوماً على أنه ميزةٌ قائمة.
--
--  ⚠️ **وما يبقى، ويُقال بالاسم كي لا يُحذف بعد حين:**
--    **`news_host_ok` تبقى** — لم تعد تحرس ابتلاعَ العناوين، **بل صارت
--    حارسَ روابط `report`** في `set_news_posts` (هجرة ٦٧). **حذفُها يكسر
--    الخبرَ المنسوب لمصدره.**
--
--  **وما يُحذف:** الجدولُ ودوالُّه الثلاث (`news_feed` · `news_last_at` ·
--  `news_is_stale`) — وكلُّها بلا مستدعٍ في الشيفرة بعد هذه الدفعة.
--
--  ⚠️ **وحذفُ الجدول يُتلف صفوفَه** (١٢١ عنواناً مجمَّعاً كُتبت اليوم من
--  فيدات عامّة) — **لا بياناتِ مستخدمٍ ولا شيءَ كتبه إنسان.**
--
--  آمنٌ للإعادة.
-- ============================================================

begin;

drop function if exists public.news_feed(text, integer);
drop function if exists public.news_last_at();
drop function if exists public.news_is_stale(integer);

drop table if exists public.news_items;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select count(*)::int as tbl from pg_tables
--  where schemaname='public' and tablename='news_items';          -- 0
-- select count(*)::int as gone from pg_proc
--  where proname in ('news_feed','news_last_at','news_is_stale');  -- 0
-- select count(*)::int as guard from pg_proc where proname='news_host_ok'; -- 1  ← تبقى
-- select public.news_host_ok('https://deadline.com/x');            -- true
--
-- ⚠️ والسياساتُ المفتوحة تبقى **أربعاً**:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
