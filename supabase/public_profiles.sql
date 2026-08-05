-- ============================================================
--  Loopz — إغلاق قراءة جدول الملفات الشخصية
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  العرض public_profiles ودوال search_people / following_activity /
--  title_reviews نسخها القانونية في security.sql و security2.sql —
--  هذا الملف يبقي خطوة الإغلاق فقط.
-- ============================================================

drop policy if exists "read all profiles" on public.profiles;
