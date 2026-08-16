-- ============================================================
--  ٩٥ — إغلاقُ تأسيس المجتمعات (D-306)
--  نصُّ أحمد: «احنا حاذفين الكومينتي، فالمفروض ما أحد يقدر
--  يأسس كومينتي جديد».
--
--  ⚠️ شُغِّلت بإذنٍ صريحٍ (خارج الإذن الدائم — تمسّ صلاحيات
--  دالّةٍ قائمة)، وهذا الملفُّ سجلُّها (D-028: هجرةُ الإسقاط
--  تُشغَّل قبل ملفّها).
--
--  **سحبُ صلاحيةٍ لا حذفُ دالّة**: الدالّةُ تبقى في الكتالوج
--  ليوم يُعاد فتحُ الباب، **وما أُسّس من مجتمعاتٍ يبقى يُقرأ
--  ويعمل** — يُغلق بابُ الجديد وحدَه (D-219: يُخفى ولا يُحذف
--  ما يقصده رابطٌ حيّ).
--  وأبوابُ الواجهة (الورقة · الدليل · `createCommunity` في
--  actions) سقطت في دفعة D-306 نفسِها.
-- ============================================================

begin;
revoke execute on function public.create_community(text, boolean) from authenticated;
revoke execute on function public.create_community(text, boolean) from anon;
revoke all on function public.create_community(text, boolean) from public;
commit;

-- ============================================================
--  فحصُ الصحّة بعد التشغيل — يُتوقَّع: can_exec = 0
--  (✅ وتحقَّق: 0)
-- ============================================================
-- select count(*)::int as can_exec
--   from information_schema.routine_privileges
--  where routine_schema='public' and routine_name='create_community'
--    and grantee in ('authenticated','PUBLIC','anon');
