-- ============================================================
--  Meshahed — صورة الغلاف (الهيدر) + ثيم الواجهة + لغة الحساب
--  شغّله في Supabase → SQL Editor
-- ============================================================

alter table public.profiles add column if not exists cover_url text;
alter table public.profiles add column if not exists theme text default 'amber';
alter table public.profiles add column if not exists locale text default 'ar';

-- الأغلفة تُرفع لنفس مخزن الصور الشخصية تحت مجلد covers/
-- (سياسات المخزن موجودة أصلاً من ملف profile.sql)
