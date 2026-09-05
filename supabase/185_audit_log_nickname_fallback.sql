-- ============================================================
--  ١٨٥ — قارئُ سجلِّ الإدارة واحدٌ لا اثنان (D-926)
-- ============================================================
-- 🔴 **العيبُ لي**: الهجرة ١٧٢ أنشأت `admin_audit_log(lim)` بالتوقيع نفسِه
--    الذي أنشأتُه في ١٨٣ باسم `admin_audit_recent(p_limit)` — **بحثتُ عن
--    قارئٍ في الشيفرة فلم أجد، ولم أبحث في `pg_proc`.** ونسخةٌ ثانيةٌ من
--    شيءٍ واحدٍ عيبٌ لا خيار (القاعدة ٣ في تعليمات المشروع).
--
-- 🔑 **والدرسُ أعمّ من الحادثة**: **قدرةٌ في القاعدة بلا قارئٍ في الشيفرة
--    تبدو غائبةً لمن يفتّش بـgrep وحدَه** — فالجردُ قبل البناء يسأل
--    `pg_proc` كما يسأل `src/`.
--
-- ⚖️ **والتوقيعُ لم يتغيّر فلا `drop`**: تُحسَّن الدالّةُ القديمةُ في مكانها
--    (اسمٌ مستعارٌ بديلٌ عن اسم المستخدم كما في ١٨٣) ويُوجَّه القارئُ إليها.
--    **و`admin_audit_recent` تبقى حتّى يأذن أحمد بحذفها** — الحذفُ يُطلب
--    بذاته (القاعدة ٤ في `12_Database`).

create or replace function public.admin_audit_log(lim int default 100)
returns table (at timestamptz, actor uuid, actor_name text, action text,
               target uuid, target_name text, detail jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.at, a.actor,
         coalesce(ap.nickname, ap.username, left(a.actor::text, 8)),
         a.action, a.target,
         coalesce(tp.nickname, tp.username, left(a.target::text, 8)),
         a.detail
  from public.admin_audit a
  left join public.profiles ap on ap.id = a.actor
  left join public.profiles tp on tp.id = a.target
  where public.am_admin()
  order by a.at desc
  limit least(greatest(coalesce(lim, 100), 1), 500);
$$;
revoke all on function public.admin_audit_log(int) from public, anon;
grant execute on function public.admin_audit_log(int) to authenticated;

-- ============ فحوصٌ بعد التشغيل ============
--   select count(*) from public.admin_audit_log(5);   -- ≤ ٥ صفوف بأسمائها
--   select proacl::text from pg_proc where proname='admin_audit_log';  -- بلا anon
