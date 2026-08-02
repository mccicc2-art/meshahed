-- ============================================================
--  Meshahed — اسم المستخدم (@handle) في البروفايل
--  شغّله في Supabase → SQL Editor بعد profile.sql
-- ============================================================

alter table public.profiles add column if not exists username text;

-- اسم المستخدم فريد (مع تجاهل الفراغات)
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- توليد اسم مستخدم مبدئي لمن لا يملك واحداً
update public.profiles p
set username = regexp_replace(
      lower(coalesce(split_part(u.email, '@', 1), 'user')) || '_' || substr(p.id::text, 1, 4),
      '[^a-z0-9_]', '', 'g'
    )
from auth.users u
where u.id = p.id and p.username is null;
