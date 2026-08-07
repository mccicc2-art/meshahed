-- ============================================================
--  Loopz — إصلاح سياسات المجتمعات: عضويةٌ عبر دالّة definer
--  شغّله في Supabase → SQL Editor بعد communities.sql
--
--  العلّة: سياسة «members see members» كانت تستعلم `community_members`
--  من داخل سياسة `community_members` نفسها — تكرارٌ لا نهائيّ يرفضه
--  Postgres فتعود القراءة خطأً، فرأى المالكُ غرفتَه «٠ أعضاء» وغلافَ
--  «انضمّ». وسياستا الرسائل تستعلمان الجدول نفسه فتقعان في التكرار عبره.
--  الحلّ المعياريّ: فحص العضوية في دالّة `security definer` تتجاوز RLS،
--  وتستدعيها السياسات الثلاث.
-- ============================================================

create or replace function public.is_community_member(p_community uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = p_community and user_id = p_user
  );
$$;
revoke all on function public.is_community_member(uuid, uuid) from public;
grant execute on function public.is_community_member(uuid, uuid) to authenticated;

drop policy if exists "members see members" on public.community_members;
create policy "members see members" on public.community_members
  for select to authenticated
  using (public.is_community_member(community_id, auth.uid()));

drop policy if exists "members read messages" on public.community_messages;
create policy "members read messages" on public.community_messages
  for select to authenticated
  using (public.is_community_member(community_id, auth.uid()));

drop policy if exists "members post messages" on public.community_messages;
create policy "members post messages" on public.community_messages
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and public.is_community_member(community_id, auth.uid())
  );

-- التحقّق: select proname from pg_proc where proname='is_community_member';
--   ثم افتح غرفتك — يجب أن ترى نفسك عضواً والدردشة مفتوحة.
