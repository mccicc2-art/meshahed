-- ============================================================
--  Meshahed — اسم المستخدم (@handle) في البروفايل
--  شغّله في Supabase → SQL Editor بعد profile.sql
-- ============================================================

alter table public.profiles add column if not exists username text;

-- اسم المستخدم فريد (مع تجاهل الفراغات)
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- توليد اسم مستخدم مبدئي لمن لا يملك واحداً.
-- عشوائي لا مشتقّ من الإيميل: بداية الإيميل كانت تُنشر وتُبحث كمعرّف —
-- تسريبُ هويةٍ لمن لم يخترها.
update public.profiles p
set username = 'user_' || substr(md5(p.id::text || random()::text), 1, 8)
where p.username is null;
