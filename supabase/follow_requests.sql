-- ============================================================
--  Loopz — الحساب الخاص: متابعةٌ بطلبٍ يُقبل، وإزالةُ متابِع
--  شغّله في Supabase → SQL Editor (الترتيب في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر واجهة الحساب الخاص.
--
--  النموذج المصغّر: «خاص» يعني أن المتابعة تحتاج موافقةً، وأنك تقدر أن
--  تُزيل متابِعاً يزعجك. إخفاءُ محتوى الحساب الخاص عن غير المتابِعين
--  (التقييمات، القوائم، النشاط) طبقةٌ أوسع في سياسات القراءة — متابَعةٌ
--  لاحقاً؛ هذا الملف يبني البوّابة أولاً.
-- ============================================================

-- علمٌ على الملف: هل المتابعة تحتاج موافقة؟ (الافتراض: عام)
alter table public.profiles
  add column if not exists is_private boolean not null default false;

-- ============================================================
--  ١) طلبات المتابعة المعلّقة
-- ============================================================
create table if not exists public.follow_requests (
  requester_id uuid not null references auth.users (id) on delete cascade,
  target_id    uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (requester_id, target_id),
  check (requester_id <> target_id)
);

alter table public.follow_requests enable row level security;
create index if not exists follow_requests_target_idx
  on public.follow_requests (target_id, created_at desc);

-- الطالبُ يرى طلباتِه الصادرة، والهدفُ طلباتِه الواردة
drop policy if exists "read own follow requests" on public.follow_requests;
create policy "read own follow requests" on public.follow_requests
  for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = target_id);

-- الطلب باسمك أنت (الإنشاء يمرّ عبر الدالّة أدناه، والسياسة تحرسه)
drop policy if exists "request as self" on public.follow_requests;
create policy "request as self" on public.follow_requests
  for insert to authenticated with check (auth.uid() = requester_id);

-- الطالبُ يسحب طلبَه، والهدفُ يرفضه — كلاهما حذفٌ لصفٍّ يخصّه
drop policy if exists "cancel or reject request" on public.follow_requests;
create policy "cancel or reject request" on public.follow_requests
  for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = target_id);

-- ============================================================
--  ٢) المتابعة: طلبٌ للخاصّ، ومتابعةٌ مباشرة للعامّ
--
--  definer كي تقرأ is_private الهدف وتُنشئ الصفّ المناسب. تُرجِع الحالة
--  فتعرف الواجهة أتَعرض «طُلب» أم «متابَع» بلا قراءةٍ ثانية.
-- ============================================================
create or replace function public.request_or_follow(target uuid)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  priv boolean;
  me uuid := auth.uid();
begin
  if me is null or target is null or me = target then
    return 'noop';
  end if;
  select is_private into priv from public.profiles where id = target;
  if coalesce(priv, false) then
    insert into public.follow_requests (requester_id, target_id)
    values (me, target) on conflict do nothing;
    return 'requested';
  else
    insert into public.user_follows (follower_id, following_id)
    values (me, target) on conflict do nothing;
    return 'following';
  end if;
end;
$$;
revoke all on function public.request_or_follow(uuid) from public;
grant execute on function public.request_or_follow(uuid) to authenticated;

-- ============================================================
--  ٣) قبول طلب — الهدف يقبل، فيُنشأ صفُّ متابعة الطالب له
--
--  الطالب لا يملك هذا الصفّ (سياسة user_follows تُدخل صفوفك أنت فقط)،
--  فالقبول يمرّ عبر definer.
-- ============================================================
create or replace function public.accept_follow_request(requester uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  delete from public.follow_requests where requester_id = requester and target_id = me;
  insert into public.user_follows (follower_id, following_id)
  values (requester, me) on conflict do nothing;
end;
$$;
revoke all on function public.accept_follow_request(uuid) from public;
grant execute on function public.accept_follow_request(uuid) to authenticated;

-- ============================================================
--  ٤) إزالة متابِع — أحذف صفَّ متابعته إياي
--
--  لا أملكه (سياسة user_follows تحذف صفوفي)، فيمرّ عبر definer.
-- ============================================================
create or replace function public.remove_follower(follower uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  delete from public.user_follows where follower_id = follower and following_id = me;
end;
$$;
revoke all on function public.remove_follower(uuid) from public;
grant execute on function public.remove_follower(uuid) to authenticated;

-- ============================================================
--  ٥) عدّاد الطلبات الواردة — لشارةٍ في الواجهة
-- ============================================================
create or replace function public.pending_follow_requests()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.follow_requests where target_id = auth.uid();
$$;
revoke all on function public.pending_follow_requests() from public;
grant execute on function public.pending_follow_requests() to authenticated;

-- التحقّق بعد التشغيل:
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name='profiles' and column_name='is_private';
--   select proname from pg_proc where proname in
--     ('request_or_follow','accept_follow_request','remove_follower','pending_follow_requests');
