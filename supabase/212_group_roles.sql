-- ============================================================
--  Loopz — 212: أدوارُ القروب — المؤسس · المؤسس الشريك · المشرف · العضو (D-1453)
--  أحمد ١٧ أكتوبر: «المؤسس هو الأعلى صلاحية… محد معه إدارة يقدر يطرده وهو يقدر يطرد أي شخص حتى لو عطاه مشرف»
--  ثمّ «ضيف مؤسس شريك له جميع صلاحيات المؤسس لكن ما يقدر يطرد المؤسس، والمؤسس عادي يطرده»، وأجوبتُه:
--  ١أ المشرفُ يطرد الأعضاء وحدهم · ٢أ المؤسسُ (وشريكُه) يعيّن المشرفين · ٣أ خروجُ المؤسس ينقلها لأقدم شريكٍ ثمّ مشرفٍ ثمّ عضو ·
--  ٤أ شارةُ «المؤسس» · وتعيينُ الشريك وطردُه للمؤسس وحدَه.
--  شغّله في Supabase → SQL Editor. آمنٌ لإعادة التشغيل.
--
--  الرتب: owner ٣ · co_owner ٢ · admin ١ · member ٠ — في عمود `role` نفسِه (لا جدولَ جديد).
--  - `is_dm_group_admin` يبقى «مشرفٌ فما فوق» ⇒ الإضافةُ والتعديلُ وما يقرؤه بلا تغيير.
--  - الطرد: المؤسسُ لا يُمسّ · الشريكُ يطرده المؤسس وحده · المشرفُ يطرده المؤسس والشريك · العضوُ يطرده أيُّ مشرف.
--  - الدور (`dm_group_set_role`): تعيينُ الشريك وإلغاؤه للمؤسس وحده · المشرفُ يعيّنه ويلغيه المؤسس والشريك · لا أحدَ يغيّر دورَ نفسه.
--    وسطرُ نظامٍ جديد `role` (الدورُ الجديد في `body`).
--  - القروباتُ القائمة: منشئُها (`created_by`) إن بقي عضواً يصير مؤسساً، وإلّا أقدمُ مشرفٍ ثمّ أقدمُ عضو. المشرفون الباقون مشرفون.
-- ============================================================

-- ١) الأدوارُ الأربعة وسطرُ النظام الجديد
alter table public.dm_group_members drop constraint if exists dm_group_members_role_check;
alter table public.dm_group_members add constraint dm_group_members_role_check check (role in ('owner', 'co_owner', 'admin', 'member'));
alter table public.dm_group_messages drop constraint if exists dm_group_messages_sys_check;
alter table public.dm_group_messages add constraint dm_group_messages_sys_check check (sys in ('created', 'added', 'left', 'removed', 'renamed', 'photo', 'role'));

-- ٢) الرتبةُ رقماً — أساسُ كلّ مقارنة
create or replace function public.dm_group_rank(p_group uuid, p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case role when 'owner' then 3 when 'co_owner' then 2 when 'admin' then 1 else 0 end
      from public.dm_group_members where group_id = p_group and user_id = p_user
  ), -1);
$$;
revoke all on function public.dm_group_rank(uuid, uuid) from public, anon, authenticated;

create or replace function public.is_dm_group_admin(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.dm_group_rank(p_group, p_user) >= 1;
$$;
revoke all on function public.is_dm_group_admin(uuid, uuid) from public, anon, authenticated;

-- ٣) القروباتُ القائمة: مؤسسٌ واحدٌ لكلٍّ منها
update public.dm_group_members m set role = 'owner'
  from public.dm_groups g
 where g.id = m.group_id and m.user_id = g.created_by
   and not exists (select 1 from public.dm_group_members o where o.group_id = m.group_id and o.role = 'owner');
update public.dm_group_members m set role = 'owner'
 where not exists (select 1 from public.dm_group_members o where o.group_id = m.group_id and o.role = 'owner')
   and m.user_id = (
     select x.user_id from public.dm_group_members x where x.group_id = m.group_id
      order by case x.role when 'co_owner' then 0 when 'admin' then 1 else 2 end, x.joined_at, x.user_id limit 1);

-- ٤) الإنشاء — المنشئُ مؤسس (بنصّ ٢٠٥ حرفاً والسطرُ الواحدُ تغيّر)
create or replace function public.dm_group_create(p_name text, p_members uuid[], p_photo text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  g uuid;
  ids uuid[];
  x uuid;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = me and coalesce(p.plan, 'free') <> 'free' and (p.plus_until is null or p.plus_until > now())
  ) then
    raise exception 'plus required' using errcode = '42501', hint = 'plus';
  end if;
  select coalesce(array_agg(distinct u), '{}') into ids from unnest(coalesce(p_members, '{}')) u where u is not null and u <> me;
  if cardinality(ids) < 1 or cardinality(ids) > 11 then
    raise exception 'members out of range' using errcode = '22023';
  end if;
  foreach x in array ids loop
    if not public.dm_group_can_add(me, x) then
      raise exception 'cannot add member' using errcode = '42501', hint = 'member';
    end if;
  end loop;
  if p_photo is not null and p_photo !~ ('^' || me::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'bad photo' using errcode = '22023';
  end if;
  insert into public.dm_groups (name, photo_path, created_by) values (btrim(p_name), p_photo, me) returning id into g;
  insert into public.dm_group_members (group_id, user_id, role) values (g, me, 'owner');
  insert into public.dm_group_members (group_id, user_id, role) select g, u, 'member' from unnest(ids) u;
  insert into public.dm_group_messages (group_id, sender_id, kind, sys) values (g, me, 'system', 'created');
  return g;
end;
$$;
revoke all on function public.dm_group_create(text, uuid[], text) from public;
grant execute on function public.dm_group_create(text, uuid[], text) to authenticated;

-- ٥) الطرد — بالرتبة
create or replace function public.dm_group_remove(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  mine integer := public.dm_group_rank(p_group, auth.uid());
  theirs integer := public.dm_group_rank(p_group, p_user);
begin
  if mine < 1 then raise exception 'admin only' using errcode = '42501'; end if;
  if p_user = me then raise exception 'use leave' using errcode = '22023'; end if;
  if theirs < 0 then return; end if;
  -- المؤسسُ لا يُمسّ · الشريكُ للمؤسس وحده · المشرفُ للمؤسس والشريك · العضوُ لأيّ مشرف
  if theirs = 3 or (theirs = 2 and mine < 3) or (theirs = 1 and mine < 2) then
    raise exception 'rank too low' using errcode = '42501', hint = 'rank';
  end if;
  delete from public.dm_group_members where group_id = p_group and user_id = p_user;
  if found then
    insert into public.dm_group_messages (group_id, sender_id, kind, sys, sys_target) values (p_group, me, 'system', 'removed', p_user);
  end if;
end;
$$;
revoke all on function public.dm_group_remove(uuid, uuid) from public;
grant execute on function public.dm_group_remove(uuid, uuid) to authenticated;

-- ٦) تغييرُ الدور — جديد
create or replace function public.dm_group_set_role(p_group uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  mine integer := public.dm_group_rank(p_group, auth.uid());
  theirs integer := public.dm_group_rank(p_group, p_user);
begin
  if p_role not in ('co_owner', 'admin', 'member') then raise exception 'bad role' using errcode = '22023'; end if;
  if p_user = me then raise exception 'not yourself' using errcode = '22023'; end if;
  if theirs < 0 then raise exception 'not a member' using errcode = '22023'; end if;
  if theirs = 3 then raise exception 'rank too low' using errcode = '42501', hint = 'rank'; end if;
  -- الشريكُ تعييناً وإلغاءً للمؤسس وحده؛ والمشرفُ للمؤسس والشريك
  if (p_role = 'co_owner' or theirs = 2) and mine < 3 then raise exception 'rank too low' using errcode = '42501', hint = 'rank'; end if;
  if mine < 2 then raise exception 'rank too low' using errcode = '42501', hint = 'rank'; end if;
  update public.dm_group_members set role = p_role where group_id = p_group and user_id = p_user and role <> p_role;
  if found then
    insert into public.dm_group_messages (group_id, sender_id, kind, sys, sys_target, body) values (p_group, me, 'system', 'role', p_user, p_role);
  end if;
end;
$$;
revoke all on function public.dm_group_set_role(uuid, uuid, text) from public;
grant execute on function public.dm_group_set_role(uuid, uuid, text) to authenticated;

-- ٧) الخروج — خروجُ المؤسس ينقل صفته: أقدمُ شريكٍ ثمّ أقدمُ مشرفٍ ثمّ أقدمُ عضو
create or replace function public.dm_group_leave(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  delete from public.dm_group_members where group_id = p_group and user_id = me;
  if not found then return; end if;
  if not exists (select 1 from public.dm_group_members where group_id = p_group) then
    delete from public.dm_groups where id = p_group;
    return;
  end if;
  insert into public.dm_group_messages (group_id, sender_id, kind, sys) values (p_group, me, 'system', 'left');
  if not exists (select 1 from public.dm_group_members where group_id = p_group and role = 'owner') then
    update public.dm_group_members set role = 'owner'
     where group_id = p_group
       and user_id = (
         select user_id from public.dm_group_members where group_id = p_group
          order by case role when 'co_owner' then 0 when 'admin' then 1 else 2 end, joined_at, user_id limit 1);
  end if;
end;
$$;
revoke all on function public.dm_group_leave(uuid) from public;
grant execute on function public.dm_group_leave(uuid) to authenticated;

-- تحقّق: select role, count(*) from public.dm_group_members group by 1;  — مؤسسٌ واحدٌ لكلّ قروب
