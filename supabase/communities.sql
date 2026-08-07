-- ============================================================
--  Loopz — المجتمعات: غرفٌ يُنشئها الأعضاء ويتحادثون فيها
--  شغّله في Supabase → SQL Editor (الترتيب في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر واجهة المجتمعات.
--
--  النموذج (طلب المالك، والعدد قليلٌ اليوم فبدأنا محافظين):
--   - لكل شخصٍ مجتمعٌ **واحد** يُنشئه ويسمّيه (owner_id فريد).
--   - المجتمع **عامٌّ** (الدخول بلا إذن) أو **خاصّ** (الدخول بطلبٍ يقبله المالك).
--   - الأعضاء يبحثون عن المجتمعات بالاسم ويدخلونها ويتحادثون داخلها.
--   - الدردشة نصٌّ حرٌّ **داخل غرفةٍ انضممتَ إليها** — تختلف عن الرسائل
--     الخاصّة (D-051): تلك بلا موضوعٍ تفتح باب الإزعاج، وهذه غرفةٌ اخترت
--     دخولها. صفحة «المجتمع» في /people تتحوّل من خطّ نشاطٍ للجميع إلى
--     دليل مجتمعاتٍ (أنشئ + ابحث) — خطّ «مجتمعي» يكفي لرؤية تفاعل دائرتك.
-- ============================================================

-- ============================================================
--  ١) المجتمع — صفٌّ واحدٌ لكل مالك
-- ============================================================
create table if not exists public.communities (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null unique references auth.users (id) on delete cascade,
  name       text not null check (length(btrim(name)) between 2 and 50),
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.communities enable row level security;
create index if not exists communities_name_idx on public.communities (name);

-- الدليل عامٌّ للبحث: الاسم والمالك والخصوصية تُقرأ للجميع (كـ user_follows،
-- D-013). الخصوصية تحكم **الدخول** لا الظهور؛ الرسائل والأعضاء محروسون أدناه.
drop policy if exists "communities are discoverable" on public.communities;
create policy "communities are discoverable" on public.communities
  for select to authenticated using (true);

-- الإنشاء باسمك أنت، وواحدٌ فقط (unique owner_id يمنع الثاني)
drop policy if exists "create own community" on public.communities;
create policy "create own community" on public.communities
  for insert to authenticated with check (auth.uid() = owner_id);

drop policy if exists "owner edits community" on public.communities;
create policy "owner edits community" on public.communities
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "owner deletes community" on public.communities;
create policy "owner deletes community" on public.communities
  for delete to authenticated using (auth.uid() = owner_id);

-- ============================================================
--  ٢) العضوية
-- ============================================================
create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.community_members enable row level security;
create index if not exists community_members_user_idx on public.community_members (user_id);

-- يرى قائمةَ الأعضاء من كان عضواً في المجتمع نفسه
drop policy if exists "members see members" on public.community_members;
create policy "members see members" on public.community_members
  for select to authenticated
  using (
    exists (
      select 1 from public.community_members m
      where m.community_id = community_members.community_id and m.user_id = auth.uid()
    )
  );

-- الانضمام المباشر لمجتمعٍ **عامّ** فقط، وباسمك؛ الخاصّ يمرّ بالطلب أدناه
drop policy if exists "join public as self" on public.community_members;
create policy "join public as self" on public.community_members
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.communities c
      where c.id = community_id and c.is_private = false
    )
  );

-- المغادرة — حذفُ عضويتك (المالك لا يغادر؛ يحذف المجتمع بدلاً من ذلك)
drop policy if exists "leave own membership" on public.community_members;
create policy "leave own membership" on public.community_members
  for delete to authenticated
  using (
    auth.uid() = user_id
    and not exists (
      select 1 from public.communities c
      where c.id = community_id and c.owner_id = auth.uid()
    )
  );

-- ============================================================
--  ٣) طلبات الدخول — للمجتمعات الخاصّة
-- ============================================================
create table if not exists public.community_join_requests (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (community_id, user_id)
);

alter table public.community_join_requests enable row level security;
create index if not exists community_join_requests_comm_idx
  on public.community_join_requests (community_id, created_at desc);

-- يراها الطالبُ ومالكُ المجتمع
drop policy if exists "read own or owned requests" on public.community_join_requests;
create policy "read own or owned requests" on public.community_join_requests
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.communities c
      where c.id = community_id and c.owner_id = auth.uid()
    )
  );

-- الطلب باسمك لمجتمعٍ خاصٍّ لست فيه بعد
drop policy if exists "request private as self" on public.community_join_requests;
create policy "request private as self" on public.community_join_requests
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.communities c
      where c.id = community_id and c.is_private = true
    )
  );

-- الطالبُ يسحب طلبَه، والمالكُ يرفضه
drop policy if exists "cancel or reject join" on public.community_join_requests;
create policy "cancel or reject join" on public.community_join_requests
  for delete to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.communities c
      where c.id = community_id and c.owner_id = auth.uid()
    )
  );

-- ============================================================
--  ٤) رسائل المجتمع — نصٌّ حرٌّ داخل الغرفة
-- ============================================================
create table if not exists public.community_messages (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id    uuid not null references auth.users (id) on delete cascade,
  body         text not null check (length(btrim(body)) between 1 and 2000),
  created_at   timestamptz not null default now()
);

alter table public.community_messages enable row level security;
create index if not exists community_messages_comm_idx
  on public.community_messages (community_id, created_at);

-- يقرؤها الأعضاء وحدهم
drop policy if exists "members read messages" on public.community_messages;
create policy "members read messages" on public.community_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.community_members m
      where m.community_id = community_messages.community_id and m.user_id = auth.uid()
    )
  );

-- يكتبها العضو باسمه
drop policy if exists "members post messages" on public.community_messages;
create policy "members post messages" on public.community_messages
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.community_members m
      where m.community_id = community_messages.community_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "author deletes message" on public.community_messages;
create policy "author deletes message" on public.community_messages
  for delete to authenticated using (auth.uid() = author_id);

-- ============================================================
--  ٥) الدوالّ
-- ============================================================

-- إنشاء مجتمع: صفُّ المجتمع + عضويةُ المالك في نقلةٍ واحدة. واحدٌ لكل مالك
-- (unique owner_id يرفع خطأً عند الثاني — تلتقطه الواجهة).
create or replace function public.create_community(p_name text, p_private boolean default false)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then return null; end if;
  insert into public.communities (owner_id, name, is_private)
  values (me, btrim(p_name), coalesce(p_private, false))
  returning id into cid;
  insert into public.community_members (community_id, user_id) values (cid, me)
    on conflict do nothing;
  return cid;
end;
$$;
revoke all on function public.create_community(text, boolean) from public;
grant execute on function public.create_community(text, boolean) to authenticated;

-- الانضمام: عضويةٌ مباشرة للعامّ، وطلبٌ للخاصّ. تُرجِع الحالة للواجهة.
create or replace function public.join_community(p_community uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare me uuid := auth.uid(); priv boolean;
begin
  if me is null then return 'noop'; end if;
  select is_private into priv from public.communities where id = p_community;
  if priv is null then return 'noop'; end if;
  if priv then
    insert into public.community_join_requests (community_id, user_id)
    values (p_community, me) on conflict do nothing;
    return 'requested';
  else
    insert into public.community_members (community_id, user_id)
    values (p_community, me) on conflict do nothing;
    return 'joined';
  end if;
end;
$$;
revoke all on function public.join_community(uuid) from public;
grant execute on function public.join_community(uuid) to authenticated;

-- قبول طلب دخول — المالك وحده، فيُنشأ صفُّ عضويةٍ لا يملكه الطالب.
create or replace function public.accept_join_request(p_community uuid, p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  if not exists (select 1 from public.communities c where c.id = p_community and c.owner_id = me) then
    return; -- لست المالك
  end if;
  delete from public.community_join_requests where community_id = p_community and user_id = p_user;
  insert into public.community_members (community_id, user_id)
  values (p_community, p_user) on conflict do nothing;
end;
$$;
revoke all on function public.accept_join_request(uuid, uuid) from public;
grant execute on function public.accept_join_request(uuid, uuid) to authenticated;

-- البحث عن مجتمعاتٍ بالاسم — مع عدد الأعضاء وحالتي منها (عضو/طالب/لا شيء).
create or replace function public.search_communities(q text)
returns table (
  id           uuid,
  name         text,
  is_private   boolean,
  owner_id     uuid,
  member_count integer,
  my_status    text
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
    end
  from public.communities c
  where btrim(q) = '' or c.name ilike '%' || btrim(q) || '%'
  order by (select count(*) from public.community_members m where m.community_id = c.id) desc
  limit 30;
$$;
revoke all on function public.search_communities(text) from public;
grant execute on function public.search_communities(text) to authenticated;

-- مجتمعاتي — ما أنا عضوٌ فيه، لصفٍّ في أعلى الدليل
create or replace function public.my_communities()
returns table (id uuid, name text, is_private boolean, owner_id uuid, member_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.is_private, c.owner_id,
    (select count(*)::int from public.community_members m2 where m2.community_id = c.id)
  from public.communities c
  join public.community_members m on m.community_id = c.id and m.user_id = auth.uid()
  order by c.created_at desc;
$$;
revoke all on function public.my_communities() from public;
grant execute on function public.my_communities() to authenticated;

-- التحقّق بعد التشغيل:
--   select tablename from pg_tables where schemaname='public'
--     and tablename like 'communit%';
--   select proname from pg_proc where proname in
--     ('create_community','join_community','accept_join_request',
--      'search_communities','my_communities');
--   -- تأكّد أنّ استعلام qual='true' الصحّي يضمّ communities فقط الجديدة
--   -- المقصودة (الدليل عامّ عمداً كـ user_follows).
