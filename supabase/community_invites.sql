-- ============================================================
--  Loopz — دعوات المجتمعات (هجرة 42)
--  شغّلها في Supabase → SQL Editor
-- ============================================================

-- المالك يدعو أشخاصاً لمجتمعه؛ المدعوّ يرى الدعوة في دليل المجتمعات
-- ويقبلها فيصير عضواً (أو يرفضها فتُحذف). صفٌّ واحد لكل (مجتمع، مدعوّ).
create table if not exists public.community_invites (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.community_invites enable row level security;

-- الدعوة فعل المالك وحده (القاعدة: السياسة لا تسأل جدولها — تسأل communities)
drop policy if exists "owner invites" on public.community_invites;
create policy "owner invites" on public.community_invites
  for insert to authenticated with check (
    exists (
      select 1 from public.communities c
      where c.id = community_id and c.owner_id = auth.uid()
    )
  );

-- يقرأها المدعوّ (دعواتي) والمالك (من دعوتُ — لحالة «مدعو» في القائمة)
drop policy if exists "invitee or owner reads" on public.community_invites;
create policy "invitee or owner reads" on public.community_invites
  for select to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.communities c
      where c.id = community_id and c.owner_id = auth.uid()
    )
  );

-- يحذفها المدعوّ (رفض) أو المالك (إلغاء)
drop policy if exists "invitee or owner removes" on public.community_invites;
create policy "invitee or owner removes" on public.community_invites
  for delete to authenticated using (
    auth.uid() = user_id
    or exists (
      select 1 from public.communities c
      where c.id = community_id and c.owner_id = auth.uid()
    )
  );

-- القبول: عضويةٌ ثم حذف الدعوة — definer لأن إدراج العضوية للخاصّ محكومٌ
-- بسياساتٍ لا تعرف الدعوات، والدعوة إذنُ دخولٍ من المالك نفسه.
create or replace function public.accept_community_invite(p_community uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  if not exists (
    select 1 from public.community_invites
    where community_id = p_community and user_id = me
  ) then
    return; -- لا دعوة — لا بابَ خلفياً للانضمام
  end if;
  insert into public.community_members (community_id, user_id)
  values (p_community, me) on conflict do nothing;
  delete from public.community_invites
  where community_id = p_community and user_id = me;
end;
$$;
revoke all on function public.accept_community_invite(uuid) from public;
grant execute on function public.accept_community_invite(uuid) to authenticated;

-- دعواتي — صفوف مجتمعاتٍ كاملة لقسم «دعوات» في الدليل (شكل my_communities)
create or replace function public.my_community_invites()
returns table (id uuid, name text, is_private boolean, owner_id uuid, member_count integer, photo_url text)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.is_private, c.owner_id,
    (select count(*)::int from public.community_members m where m.community_id = c.id),
    c.photo_url
  from public.communities c
  join public.community_invites i on i.community_id = c.id and i.user_id = auth.uid()
  order by i.created_at desc;
$$;
revoke all on function public.my_community_invites() from public;
grant execute on function public.my_community_invites() to authenticated;

-- التحقّق بعد التشغيل:
select tablename from pg_tables where schemaname = 'public' and tablename = 'community_invites';
select proname from pg_proc where proname in ('accept_community_invite', 'my_community_invites');
select policyname from pg_policies where tablename = 'community_invites';
