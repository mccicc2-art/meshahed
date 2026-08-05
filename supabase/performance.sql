-- ============================================================
--  Meshahed — فهارس أداء
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ملاحظة: دالة watch_summary نسختها القانونية في rewatch.sql (تعرف
--  «إعادة المشاهدة»)، وreaction_counts في security.sql (definer) —
--  حُذفت نسخهما القديمة من هنا حتى لا يعيد تشغيلُ هذا الملف تعريفها.
-- ============================================================

-- فهرس يخدم الترتيب الزمني في «آخر ما شاهدت»
create index if not exists watched_ep_user_time_idx
  on public.watched_episodes (user_id, watched_at desc);
