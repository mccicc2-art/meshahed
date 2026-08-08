-- ============================================================
--  Loopz — صورة المجتمع (هجرة 41)
--  شغّلها في Supabase → SQL Editor
-- ============================================================

-- عمودٌ واحد: رابط صورة المجتمع في مخزن `avatars` العام.
-- التحقق من أن الرابط رابطُ مخزننا يجري في فعل الخادم (safeImageUrl —
-- نفس مسار صورة الملف الشخصي)، والتعديل محكومٌ أصلاً بسياسة
-- «owner edits community» القائمة، فلا سياسة جديدة هنا.
alter table public.communities add column if not exists photo_url text;

-- الدالتان تعيدان الصورة أيضاً — العمود الجديد في **ذيل** جدول الإرجاع
-- (نفس قاعدة الإطلالات D-037)، وتغييرُ نوع الإرجاع يستلزم إسقاطاً أولاً:
-- create or replace لا يقبل تغيير التوقيع.

drop function if exists public.search_communities(text);
create function public.search_communities(q text)
returns table (
  id           uuid,
  name         text,
  is_private   boolean,
  owner_id     uuid,
  member_count integer,
  my_status    text,
  photo_url    text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id, c.name, c.is_private, c.owner_id,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    case
      when exists (select 1 from public.community_members m where m.community_id = c.id and m.user_id = auth.uid()) then 'member'
      when exists (select 1 from public.community_join_requests r where r.community_id = c.id and r.user_id = auth.uid()) then 'requested'
      else 'none'
    end,
    c.photo_url
  from public.communities c
  where btrim(q) = '' or c.name ilike '%' || btrim(q) || '%'
  order by (select count(*) from public.community_members m where m.community_id = c.id) desc
  limit 30;
$$;
revoke all on function public.search_communities(text) from public;
grant execute on function public.search_communities(text) to authenticated;

drop function if exists public.my_communities();
create function public.my_communities()
returns table (id uuid, name text, is_private boolean, owner_id uuid, member_count integer, photo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.is_private, c.owner_id,
    (select count(*)::int from public.community_members m2 where m2.community_id = c.id),
    c.photo_url
  from public.communities c
  join public.community_members m on m.community_id = c.id and m.user_id = auth.uid()
  order by c.created_at desc;
$$;
revoke all on function public.my_communities() from public;
grant execute on function public.my_communities() to authenticated;

-- التحقّق بعد التشغيل:
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'communities' and column_name = 'photo_url';
select proname, pg_get_function_result(oid) from pg_proc
  where proname in ('search_communities', 'my_communities');
