-- ============================================================
--  Loopz — 200: رسائلُ نصّيّةٌ مباشرة، وإعدادُ «من يقدر يراسلني»
--  شغّله في Supabase → SQL Editor **قبل** نشر الواجهة (D-1380).
--  آمنٌ لإعادة التشغيل.
--
--  ⚖️ ينقض D-051 («لا محادثة تبدأ من فراغ») وشرطَ المتابعة المتبادلة للمراسلة
--  (أحمد ١٢ أكتوبر ٢٠٢٦: «ج» ثمّ «ب»): أيُّ مستخدمٍ يراسل أيَّ مستخدمٍ بنصٍّ حرّ،
--  **وصاحبُ الحساب يقرّر من يبدأ معه**: الكلّ (الافتراضيّ) · المتبادلون · لا أحد.
--  القفلُ يمنع **بدء** محادثةٍ جديدة فقط — المحادثةُ القائمة تستمرّ («أ»).
--  والحظرُ فوق كلِّ شيء. «آخرُ ظهور» باقٍ للمتبادلين (`last_seen_of` لا يتغيّر).
-- ============================================================

-- ١) الإعداد
alter table public.profiles
  add column if not exists dm_policy text not null default 'everyone';
do $$ begin
  alter table public.profiles add constraint profiles_dm_policy_check
    check (dm_policy in ('everyone', 'mutual', 'none'));
exception when duplicate_object then null; end $$;
-- `authenticated` تملك UPDATE على أعمدةٍ مسمّاةٍ في `profiles` لا على الجدول (انظر D-839)، فالعمودُ الجديد يُمنح باسمه:
-- صاحبُ الحساب يغيّر إعدادَه، وقراءتُه لكلِّ مسجَّلٍ لأنّ الملفّ يرسم القفلَ منه
grant select (dm_policy), update (dm_policy) on public.profiles to authenticated;

-- ٢) الرسائل النصّيّة — صفٌّ بين شخصين، بلا عمل
create table if not exists public.direct_messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references auth.users (id) on delete cascade,
  recipient_id  uuid not null references auth.users (id) on delete cascade,
  body          text not null check (length(btrim(body)) between 1 and 1000),
  created_at    timestamptz not null default now(),
  read_at       timestamptz,
  -- إخفاءٌ من طرفٍ واحد، كالمشاركات (shares.sql)
  sender_hid    boolean not null default false,
  recipient_hid boolean not null default false,
  check (sender_id <> recipient_id)
);
alter table public.direct_messages enable row level security;
create index if not exists direct_messages_pair_idx
  on public.direct_messages (sender_id, recipient_id, created_at desc);
create index if not exists direct_messages_recipient_idx
  on public.direct_messages (recipient_id, created_at desc);

-- ٣) هل بينهما محادثةٌ قائمة؟ (أيُّ رسالةٍ في أيِّ اتّجاه، مخفيّةً أو لا)
create or replace function public.have_conversation(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.direct_messages
                  where (sender_id = a and recipient_id = b) or (sender_id = b and recipient_id = a))
      or exists (select 1 from public.title_shares
                  where (sender_id = a and recipient_id = b) or (sender_id = b and recipient_id = a))
      or exists (select 1 from public.list_shares
                  where (sender_id = a and recipient_id = b) or (sender_id = b and recipient_id = a));
$$;
revoke all on function public.have_conversation(uuid, uuid) from public;

-- ٤) البوّاب الواحد: هل يقدر a أن يراسل b؟
create or replace function public.can_message(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select a is not null and b is not null and a <> b
     and not public.is_blocked(a, b)
     and (
       public.have_conversation(a, b)
       or (select case p.dm_policy
                    when 'everyone' then true
                    when 'mutual' then public.are_mutual(a, b)
                    else false
                  end
             from public.profiles p where p.id = b)
     );
$$;
revoke all on function public.can_message(uuid, uuid) from public;
grant execute on function public.can_message(uuid, uuid) to authenticated;

-- ٥) سياسات الرسائل النصّيّة
drop policy if exists "read own direct messages" on public.direct_messages;
create policy "read own direct messages" on public.direct_messages
  for select to authenticated
  using ((auth.uid() = sender_id and sender_hid = false)
      or (auth.uid() = recipient_id and recipient_hid = false));

drop policy if exists "send direct message as self" on public.direct_messages;
create policy "send direct message as self" on public.direct_messages
  for insert to authenticated
  with check (auth.uid() = sender_id and public.can_message(sender_id, recipient_id));

drop policy if exists "update own direct message flags" on public.direct_messages;
create policy "update own direct message flags" on public.direct_messages
  for update to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id)
  with check (auth.uid() = sender_id or auth.uid() = recipient_id);
-- النصُّ لا يُعدَّل بعد الإرسال: التعديلُ للقراءة والإخفاء وحدهما
revoke update on public.direct_messages from authenticated;
grant update (read_at, sender_hid, recipient_hid) on public.direct_messages to authenticated;

-- ٦) المشاركاتُ والردودُ تتبع البوّابَ نفسَه بدل المتابعة المتبادلة
drop policy if exists "send share as self" on public.title_shares;
create policy "send share as self" on public.title_shares
  for insert to authenticated
  with check (auth.uid() = sender_id and public.can_message(sender_id, recipient_id));

drop policy if exists "send list share as self" on public.list_shares;
create policy "send list share as self" on public.list_shares
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and public.can_message(sender_id, recipient_id)
    and exists (select 1 from public.user_lists l
                 where l.id = list_shares.list_id and l.user_id = auth.uid() and l.is_public)
  );

-- الردُّ في خيطٍ قائم: الخيطُ نفسُه محادثةٌ قائمة، فالحظرُ وحده يغلقه
drop policy if exists "reply as party" on public.share_replies;
create policy "reply as party" on public.share_replies
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.title_shares s
       where s.id = share_id
         and (auth.uid() = s.sender_id or auth.uid() = s.recipient_id)
         and not public.is_blocked(s.sender_id, s.recipient_id)
    )
  );

-- ٧) عدّادُ غير المقروء يشمل النصّ
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
  );
$$;
revoke all on function public.unread_shares() from public;
grant execute on function public.unread_shares() to authenticated;

-- ٨) «قرأتُ المحادثة» يشمل النصّ
create or replace function public.mark_conversation_read(p_peer uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.title_shares
     set read_at = now()
   where recipient_id = auth.uid() and sender_id = p_peer and read_at is null;
  update public.list_shares
     set read_at = now()
   where recipient_id = auth.uid() and sender_id = p_peer and read_at is null;
  update public.share_replies r
     set read_at = now()
   where r.author_id = p_peer
     and r.read_at is null
     and exists (
       select 1 from public.title_shares s
       where s.id = r.share_id
         and (s.sender_id = auth.uid() or s.recipient_id = auth.uid())
     );
  update public.direct_messages
     set read_at = now()
   where recipient_id = auth.uid() and sender_id = p_peer and read_at is null;
$$;
revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

-- ٩) الوصولُ الفوريّ
do $$ begin
  alter publication supabase_realtime add table public.direct_messages;
exception when duplicate_object then null; end $$;

-- التحقّق بعد التشغيل (أربعةُ أسطر، كلُّها يجب أن تعود):
--   select column_name from information_schema.columns where table_name='profiles' and column_name='dm_policy';
--   select policyname from pg_policies where tablename='direct_messages';
--   select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='direct_messages';
--   select public.can_message(null, null);   -- false
