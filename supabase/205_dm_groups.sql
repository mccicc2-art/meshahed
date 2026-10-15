-- ============================================================
--  Loopz — 205: القروبات في الرسائل (أحمد ١٥ أكتوبر: «ابدا القروبات»؛ الصورُ معتمدة نفسَ اليوم)
--  شغّله في Supabase → SQL Editor **قبل** نشر الواجهة. آمنٌ لإعادة التشغيل.
--  بلا `drop` (السياساتُ في كتل `do` والمشغّلان `create or replace`، وسياسةُ المخزن `alter`): موصلُ Supabase يلغي
--  نصّاً فيه حذفٌ (19-append 10 أكتوبر e).
--
--  القرارات:
--  - الأعضاءُ من الناس الذين تتابعهم («١ أ») — وبوّابُ الخاص نفسُه (`can_message`) يحكم كلَّ واحد: من قفل خاصَّه
--    أو بينك وبينه حظرٌ لا يُضاف.
--  - الحدُّ ١٢ شخصاً **وأنت منهم**.
--  - الإنشاءُ لمشتركي لوبز+ («٣ ب») والانضمامُ مجّانيّ — والحكمُ هنا في القاعدة لا في الواجهة وحدها.
--  - المنشئُ مشرف. المشرفُ يضيف ويحذف ويعدّل الاسمَ والصورة؛ والعضوُ يكتم ويخرج.
--  - العضوُ الجديد يرى ما كُتب **بعد** دخوله فقط، ومن خرج أو حُذف لا يرى القروبَ بعدها.
--  - ✓✓ = قرأها الكلّ: كلُّ عضوٍ له «آخرُ قراءة» واحد، والقراءةُ تُحسب منه — لا صفَّ لكلِّ رسالةٍ ولكلِّ قارئ.
--  - الكتابةُ على القروب وأعضائه بالدوالّ وحدها (`security definer`)، وسطورُ النظام (أنشأ · أضاف · خرج …) تكتبها
--    الدوالُّ وحدها — العميلُ لا يكتب إلّا رسالةً عاديّةً باسمه.
-- ============================================================

-- ١) الجداول
create table if not exists public.dm_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 30),
  -- صورةُ القروب في `dm-media` بمجلّد من رفعها — بلا صورة تُرسم صورُ الأعضاء
  photo_path  text check (photo_path is null or photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'),
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  -- آخرُ حركة — ترتيبُ الصندوق
  last_at     timestamptz not null default now()
);
alter table public.dm_groups enable row level security;

create table if not exists public.dm_group_members (
  group_id     uuid not null references public.dm_groups (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  joined_at    timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  muted        boolean not null default false,
  primary key (group_id, user_id)
);
alter table public.dm_group_members enable row level security;
create index if not exists dm_group_members_user_idx on public.dm_group_members (user_id);

create table if not exists public.dm_group_messages (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.dm_groups (id) on delete cascade,
  sender_id   uuid references auth.users (id) on delete set null,
  kind        text not null default 'text' check (kind in ('text', 'system')),
  body        text not null default '',
  gif_id      text,
  image_path  text,
  reply_to    uuid references public.dm_group_messages (id) on delete set null,
  -- سطرُ النظام: ما حدث، وعلى من (الإضافةُ والحذف)، والاسمُ الجديد (إعادةُ التسمية)
  sys         text check (sys in ('created', 'added', 'left', 'removed', 'renamed', 'photo')),
  sys_target  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint dm_group_messages_content_check check (
    length(body) <= 1000
    and (
      (kind = 'system' and sys is not null and gif_id is null and image_path is null and reply_to is null)
      or (
        kind = 'text' and sys is null and sys_target is null
        and (length(btrim(body)) >= 1 or gif_id is not null or image_path is not null)
        and not (gif_id is not null and image_path is not null)
        and (gif_id is null or (gif_id ~ '^[A-Za-z0-9]{1,64}$' and length(btrim(body)) = 0))
        and (image_path is null or image_path ~ ('^' || sender_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
      )
    )
  )
);
alter table public.dm_group_messages enable row level security;
create index if not exists dm_group_messages_group_idx on public.dm_group_messages (group_id, created_at desc);
create index if not exists dm_group_messages_image_idx on public.dm_group_messages (image_path) where image_path is not null;

-- ٢) العضويّة — دوالُّ صغيرةٌ تقرأها السياساتُ بلا دوران
-- متى دخلتُ أنا هذا القروب (`null` = لستُ عضواً) — بلا معاملٍ للشخص، فلا يُسأل بها عن عضويّة غيرك
create or replace function public.dm_group_joined_at(p_group uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select joined_at from public.dm_group_members where group_id = p_group and user_id = auth.uid();
$$;
revoke all on function public.dm_group_joined_at(uuid) from public;
grant execute on function public.dm_group_joined_at(uuid) to authenticated;

create or replace function public.is_dm_group_admin(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.dm_group_members where group_id = p_group and user_id = p_user and role = 'admin');
$$;
revoke all on function public.is_dm_group_admin(uuid, uuid) from public, anon, authenticated;

-- ٣) السياسات — القراءةُ للأعضاء، والكتابةُ رسالةٌ عاديّةٌ باسمك وحدها
do $$ begin
  create policy "members read group" on public.dm_groups
  for select to authenticated
  using (public.dm_group_joined_at(id) is not null);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "members read members" on public.dm_group_members
  for select to authenticated
  using (public.dm_group_joined_at(group_id) is not null);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "members read messages since joining" on public.dm_group_messages
  for select to authenticated
  using (created_at >= public.dm_group_joined_at(group_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "members send as self" on public.dm_group_messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and kind = 'text' and sys is null and sys_target is null
    and public.dm_group_joined_at(group_id) is not null
  );
exception when duplicate_object then null; end $$;

-- لا تعديلَ ولا حذفَ مباشر: الدوالُّ وحدها تكتب القروبَ وأعضاءه، والرسالةُ لا تتغيّر بعد إرسالها
revoke insert, update, delete on public.dm_groups from authenticated, anon;
revoke insert, update, delete on public.dm_group_members from authenticated, anon;
revoke update, delete on public.dm_group_messages from authenticated, anon;
revoke all on public.dm_groups, public.dm_group_members, public.dm_group_messages from anon;
grant select on public.dm_groups, public.dm_group_members, public.dm_group_messages to authenticated;
grant insert on public.dm_group_messages to authenticated;

-- ٤) بعد كلِّ رسالة: الاقتباسُ من القروب نفسِه، والقروبُ يصعد في الصندوق، والمرسِلُ قرأ ما قبلها
create or replace function public.dm_group_message_before()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to is not null and not exists (
    select 1 from public.dm_group_messages m where m.id = new.reply_to and m.group_id = new.group_id and m.kind = 'text'
  ) then
    raise exception 'reply_to must belong to the same group' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.dm_group_message_before() from public, anon, authenticated;
create or replace trigger dm_group_message_before
  before insert on public.dm_group_messages
  for each row execute function public.dm_group_message_before();

create or replace function public.dm_group_message_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_groups set last_at = new.created_at where id = new.group_id and last_at < new.created_at;
  if new.sender_id is not null then
    update public.dm_group_members set last_read_at = new.created_at
     where group_id = new.group_id and user_id = new.sender_id and last_read_at < new.created_at;
  end if;
  return null;
end;
$$;
revoke all on function public.dm_group_message_after() from public, anon, authenticated;
create or replace trigger dm_group_message_after
  after insert on public.dm_group_messages
  for each row execute function public.dm_group_message_after();

-- ٥) من يُضاف: تتابعه، والبوّابُ يقبل (لا حظر، وخاصُّه ليس مقفولاً عنك)
create or replace function public.dm_group_can_add(p_by uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user is not null and p_user <> p_by
     and exists (select 1 from public.user_follows where follower_id = p_by and following_id = p_user)
     and public.can_message(p_by, p_user);
$$;
revoke all on function public.dm_group_can_add(uuid, uuid) from public, anon, authenticated;

-- ٦) الإنشاء — لوبز+ وحدَه، ١ إلى ١١ معك
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
  insert into public.dm_group_members (group_id, user_id, role) values (g, me, 'admin');
  insert into public.dm_group_members (group_id, user_id, role) select g, u, 'member' from unnest(ids) u;
  insert into public.dm_group_messages (group_id, sender_id, kind, sys) values (g, me, 'system', 'created');
  return g;
end;
$$;
revoke all on function public.dm_group_create(text, uuid[], text) from public;
grant execute on function public.dm_group_create(text, uuid[], text) to authenticated;

-- ٧) الإضافة — المشرفُ وحدَه، والمجموعُ لا يتعدّى ١٢
create or replace function public.dm_group_add(p_group uuid, p_members uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  ids uuid[];
  x uuid;
  n int;
begin
  if not public.is_dm_group_admin(p_group, me) then raise exception 'admin only' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct u), '{}') into ids from unnest(coalesce(p_members, '{}')) u
   where u is not null and not exists (select 1 from public.dm_group_members m where m.group_id = p_group and m.user_id = u);
  if cardinality(ids) = 0 then return 0; end if;
  select count(*) into n from public.dm_group_members where group_id = p_group;
  if n + cardinality(ids) > 12 then raise exception 'group full' using errcode = '22023', hint = 'full'; end if;
  foreach x in array ids loop
    if not public.dm_group_can_add(me, x) then raise exception 'cannot add member' using errcode = '42501', hint = 'member'; end if;
  end loop;
  insert into public.dm_group_members (group_id, user_id, role) select p_group, u, 'member' from unnest(ids) u;
  insert into public.dm_group_messages (group_id, sender_id, kind, sys, sys_target)
    select p_group, me, 'system', 'added', u from unnest(ids) u;
  return cardinality(ids);
end;
$$;
revoke all on function public.dm_group_add(uuid, uuid[]) from public;
grant execute on function public.dm_group_add(uuid, uuid[]) to authenticated;

-- ٨) الحذف — المشرفُ يحذف عضواً غيرَه
create or replace function public.dm_group_remove(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if not public.is_dm_group_admin(p_group, me) then raise exception 'admin only' using errcode = '42501'; end if;
  if p_user = me then raise exception 'use leave' using errcode = '22023'; end if;
  delete from public.dm_group_members where group_id = p_group and user_id = p_user;
  if found then
    insert into public.dm_group_messages (group_id, sender_id, kind, sys, sys_target) values (p_group, me, 'system', 'removed', p_user);
  end if;
end;
$$;
revoke all on function public.dm_group_remove(uuid, uuid) from public;
grant execute on function public.dm_group_remove(uuid, uuid) to authenticated;

-- ٩) الخروج — وإن خرج آخرُ مشرفٍ صار أقدمُ الباقين مشرفاً، وإن لم يبقَ أحدٌ زال القروب
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
  if not exists (select 1 from public.dm_group_members where group_id = p_group and role = 'admin') then
    update public.dm_group_members set role = 'admin'
     where group_id = p_group
       and user_id = (select user_id from public.dm_group_members where group_id = p_group order by joined_at, user_id limit 1);
  end if;
end;
$$;
revoke all on function public.dm_group_leave(uuid) from public;
grant execute on function public.dm_group_leave(uuid) to authenticated;

-- ١٠) الاسمُ والصورة — المشرفُ وحدَه؛ `p_clear_photo` يرجع لصور الأعضاء
create or replace function public.dm_group_edit(p_group uuid, p_name text default null, p_photo text default null, p_clear_photo boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  cur record;
begin
  if not public.is_dm_group_admin(p_group, me) then raise exception 'admin only' using errcode = '42501'; end if;
  select name, photo_path into cur from public.dm_groups where id = p_group;
  if p_photo is not null and p_photo !~ ('^' || me::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'bad photo' using errcode = '22023';
  end if;
  if p_name is not null and btrim(p_name) <> cur.name then
    update public.dm_groups set name = btrim(p_name) where id = p_group;
    insert into public.dm_group_messages (group_id, sender_id, kind, sys, body) values (p_group, me, 'system', 'renamed', left(btrim(p_name), 30));
  end if;
  if p_photo is not null or (p_clear_photo and cur.photo_path is not null) then
    update public.dm_groups set photo_path = case when p_clear_photo then null else p_photo end where id = p_group;
    insert into public.dm_group_messages (group_id, sender_id, kind, sys) values (p_group, me, 'system', 'photo');
  end if;
end;
$$;
revoke all on function public.dm_group_edit(uuid, text, text, boolean) from public;
grant execute on function public.dm_group_edit(uuid, text, text, boolean) to authenticated;

-- ١١) الكتمُ والقراءة — لكلِّ عضوٍ صفُّه
create or replace function public.dm_group_mute(p_group uuid, p_muted boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.dm_group_members set muted = coalesce(p_muted, false) where group_id = p_group and user_id = auth.uid();
$$;
revoke all on function public.dm_group_mute(uuid, boolean) from public;
grant execute on function public.dm_group_mute(uuid, boolean) to authenticated;

create or replace function public.dm_group_mark_read(p_group uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.dm_group_members set last_read_at = now() where group_id = p_group and user_id = auth.uid();
$$;
revoke all on function public.dm_group_mark_read(uuid) from public;
grant execute on function public.dm_group_mark_read(uuid) to authenticated;

-- ١٢) عدّادُ غير المقروء يشمل القروبات (رسائلُ غيرك بعد آخر قراءتك — لا سطورُ النظام)
create or replace function public.unread_shares()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select (
    select count(*)::int from public.title_shares
    where recipient_id = auth.uid() and recipient_hid = false and read_at is null
  ) + (
    select count(*)::int from public.list_shares
    where recipient_id = auth.uid() and recipient_hid = false and read_at is null
  ) + (
    select count(*)::int
    from public.share_replies r
    join public.title_shares s on s.id = r.share_id
    where r.author_id <> auth.uid()
      and r.read_at is null
      and ((s.sender_id = auth.uid() and s.sender_hid = false)
        or (s.recipient_id = auth.uid() and s.recipient_hid = false))
  ) + (
    select count(*)::int from public.direct_messages
    where recipient_id = auth.uid() and recipient_hid = false and read_at is null
  ) + (
    select count(*)::int
    from public.dm_group_messages gm
    join public.dm_group_members me on me.group_id = gm.group_id and me.user_id = auth.uid()
    where gm.kind = 'text' and gm.sender_id is distinct from auth.uid() and gm.created_at > me.last_read_at
  );
$$;
revoke all on function public.unread_shares() from public;
grant execute on function public.unread_shares() to authenticated;

-- ١٣) صورُ القروب ورسائله في المخزن الخاصّ: يقرؤها الأعضاء (والقاعدةُ القديمة كما هي: صاحبُ المجلّد ومستلمُ الخاص)
alter policy "dm media read by the two" on storage.objects
  to authenticated
  using (
    bucket_id = 'dm-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.direct_messages m
                  where m.image_path = storage.objects.name and m.recipient_id = auth.uid())
      or exists (select 1 from public.dm_group_messages gm
                  where gm.image_path = storage.objects.name
                    and gm.created_at >= public.dm_group_joined_at(gm.group_id))
      or exists (select 1 from public.dm_groups g
                  where g.photo_path = storage.objects.name
                    and public.dm_group_joined_at(g.id) is not null)
    )
  );
create index if not exists dm_groups_photo_idx on public.dm_groups (photo_path) where photo_path is not null;

-- ١٤) الفوريّة — الرسائلُ والأعضاء (القراءةُ والإضافةُ والخروج)
do $$ begin
  alter publication supabase_realtime add table public.dm_group_messages;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.dm_group_members;
exception when duplicate_object then null; end $$;

-- التحقّق بعد التشغيل:
--   select tablename from pg_tables where tablename like 'dm_group%';                       -- ٣ جداول
--   select proname from pg_proc where proname like 'dm_group_%';                             -- الدوالّ
--   select tablename from pg_publication_tables where pubname = 'supabase_realtime' and tablename like 'dm_group%';
--   select public.unread_shares();                                                           -- رقمٌ لا خطأ
