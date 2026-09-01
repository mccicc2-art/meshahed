-- ============================================================
-- SEC-ALERT-01 — سحب صلاحيات التنفيذ الزائدة عن دور anon
-- Loopz · مشروع Supabase: uvgmvrdrxzpudoldjxaa
-- Audited SHA: f8a2b33cd036cffd1e7a0b9bc3e5ced0e19b8bfa
-- الحالة: ✅ شُغِّل وتُحقِّق منه — 2026-09-01 09:14 UTC، بإذن أحمد الصريح.
--
-- كل أمر هنا قابل للرجوع بسطر GRANT مقابل (في آخر الملف).
-- ولا يمسّ كوداً ولا نشراً ولا بيانات — صلاحيات فقط.
-- ============================================================

begin;

-- ١) الأخطر — منحُ اشتراك Plus لأي مُعرّف يُمرَّر، بلا تحقّق هويّة.
--    صفر مُنادٍ في كود التطبيق. ومناديها الوحيد داخل القاعدة
--    qualify_referral وهي SECURITY DEFINER ولا يملك anon تنفيذها أصلاً،
--    فهي تعمل بامتياز مالكها ولا تتأثّر بهذا السحب.
revoke execute on function public.grant_plus_days(uuid, integer, text, uuid)
  from anon, authenticated;

-- ٢) وظيفتا صيانة يناديهما pg_cron وحده (يعمل بدور postgres).
--    صفر مُنادٍ في كود التطبيق وصفر مُنادٍ داخل القاعدة.
revoke execute on function public.prune_news_posts()
  from anon, authenticated;
-- ⚠️ هذه وحدها لم تكفِها الأسطر أعلاه: proacl كان يبدأ بـ'=X/postgres'
--    أي أن PUBLIC يملك EXECUTE وanon يرثها. والسحب الموجَّه لا يُبطل الإرث.
--    خمسٌ وعشرون دالّة في المشروع تحمل منح PUBLIC مثلها.
revoke execute on function public.prune_news_posts() from public;
revoke execute on function public.maintain_title_communities()
  from anon, authenticated;

-- ٣) كتابةُ كتالوج خلف مسارٍ يفرض الجلسة.
--    /api/imdb-chart يردّ 401 للزائر (مقيس حيّاً)، فدور authenticated يكفيه.
--    يُسحب من anon وحده — ولا يُسحب من authenticated وإلا انكسر المسار.
revoke execute on function public.build_imdb_chart(integer)   from anon;
revoke execute on function public.set_imdb_pool(jsonb)        from anon;

commit;

-- ============================================================
-- التحقّق — شغّله بعد الـcommit
-- ============================================================
select p.proname,
       has_function_privilege('anon',          p.oid, 'EXECUTE') as anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('grant_plus_days','prune_news_posts','maintain_title_communities',
                    'build_imdb_chart','set_imdb_pool')
order by p.proname;

-- المتوقَّع:
--   build_imdb_chart            anon=false  authenticated=true
--   grant_plus_days             anon=false  authenticated=false
--   maintain_title_communities  anon=false  authenticated=false
--   prune_news_posts            anon=false  authenticated=false
--   set_imdb_pool               anon=false  authenticated=true


-- ============================================================
-- ⛔ لا تُشغَّل هذه — دوالّ يناديها الزائر فعلاً، وسحبُها يكسر التطبيق
-- ============================================================
--   bump_partner_click   ← /p/[code]        مسار إحالة عامّ للزائر
--   bump_visit_lang      ← /api/lang-ping   بلا جلسة، محدود بالـIP
--   log_provider_event   ← Server Action    موثَّق أن الزائر يضغط البطاقة (D-608)
--   log_runtime_error    ← instrumentation  تسجيل أخطاء صفحات الزائر
--   set_imdb_ratings     ← HeroRatings/topChart على /movie و/show و/ — يُرسم للزائر


-- ============================================================
-- الرجوع (إن لزم)
-- ============================================================
-- grant execute on function public.grant_plus_days(uuid, integer, text, uuid) to anon, authenticated;
-- grant execute on function public.prune_news_posts()                          to anon, authenticated;
-- grant execute on function public.maintain_title_communities()                to anon, authenticated;
-- grant execute on function public.build_imdb_chart(integer)                   to anon;
-- grant execute on function public.set_imdb_pool(jsonb)                        to anon;
