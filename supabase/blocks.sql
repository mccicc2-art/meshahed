-- ============================================================
--  Loopz — حظر شخصٍ مزعج
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر واجهة الحظر.
--
--  لماذا حظرٌ وعندنا شرط المتابعة المتبادلة؟ الشرط يمنع الغريب، لكنّه
--  لا يمنع من كان صديقاً ثمّ أزعج: إلغاء المتابعة يقطع الرسائل لكنّه
--  ناعم — يعيد الطرف متابعتك فيفتح الباب ثانيةً. الحظر قطعٌ نهائيّ:
--  يُغلق الرسائل من الطرفين، ويفكّ المتابعة في الاتجاهين، فلا يعود
--  المحظور يراك في تدفّق من تتابعهم ولا تراه أنت.
-- ============================================================

-- ============================================================
--  ١) جدول الحظر — صفٌّ لكلّ (حاظر، محظور)
-- ============================================================
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;

-- فهرسٌ على المحظور: «هل حظرني أحد؟» سؤالٌ ساخن في are_mutual
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- تراقب قائمتك أنت وحدك؛ لا أحد يعرف من حظره غيرُه
drop policy if exists "read own blocks" on public.blocks;
create policy "read own blocks" on public.blocks
  for select to authenticated using (auth.uid() = blocker_id);

drop policy if exists "block as self" on public.blocks;
create policy "block as self" on public.blocks
  for insert to authenticated with check (auth.uid() = blocker_id);

drop policy if exists "unblock own" on public.blocks;
create policy "unblock own" on public.blocks
  for delete to authenticated using (auth.uid() = blocker_id);

-- ============================================================
--  ٢) حظرٌ في أيّ اتجاه يُغلق الباب
--
--  من حظرتَه ومن حظرك سواء: كلاهما يمنع الرسالة. definer كي يقرأ
--  الصفَّ الذي لا يملكه السائل (حظرُ الطرف الآخر لك).
-- ============================================================
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

revoke all on function public.is_blocked(uuid, uuid) from public;
grant execute on function public.is_blocked(uuid, uuid) to authenticated;

-- ============================================================
--  ٣) شرط المتابعة المتبادلة يشترط الآن ألّا حظرَ بينكما
--
--  تعديلُ are_mutual وحده يقفل **الإرسالَ والردَّ معاً** — كلتا
--  سياستيهما في shares.sql تستدعيانه — بلا لمسِ سياسةٍ أو صفٍّ آخر.
--  إعادةُ إعلانٍ للدالّة نفسها؛ توقيعها ثابت، فالسياسات القائمة تلتقطه.
-- ============================================================
create or replace function public.are_mutual(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.user_follows where follower_id = a and following_id = b
    ) and exists (
      select 1 from public.user_follows where follower_id = b and following_id = a
    ) and not public.is_blocked(a, b);
$$;

revoke all on function public.are_mutual(uuid, uuid) from public;
grant execute on function public.are_mutual(uuid, uuid) to authenticated;

-- ============================================================
--  ٤) فعلُ الحظر — يحظر ويفكّ المتابعة من الطرفين في نقلةٍ واحدة
--
--  فكُّ متابعة الطرف الآخر لك يحتاج definer: سياسة user_follows تسمح
--  بحذف صفوفك أنت فقط. هنا نحذف الاتجاهين فيختفي المحظور من تدفّق
--  «من تتابعهم» عند كليكما فوراً — لا مجرّد إسكاتٍ للرسائل.
-- ============================================================
create or replace function public.block_user(target uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
begin
  if me is null or target is null or me = target then
    return;
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (me, target)
  on conflict do nothing;

  -- يفكّ المتابعة في الاتجاهين
  delete from public.user_follows
  where (follower_id = me and following_id = target)
     or (follower_id = target and following_id = me);
end;
$$;

revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

-- رفعُ الحظر فعلٌ بسيطٌ (حذفُ صفّك)، تكفيه سياسة "unblock own" أعلاه؛
-- لا تُعاد المتابعة تلقائياً — من رفع الحظر يتابع من جديدٍ إن شاء.

-- ============================================================
--  ٥) قائمة من حظرتَهم — لشاشة الإعدادات
-- ============================================================
create or replace function public.my_blocks()
returns table (
  user_id    uuid,
  username   text,
  nickname   text,
  avatar_url text,
  hide_name  boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.blocked_id, p.username, p.nickname, p.avatar_url, p.hide_name, b.created_at
  from public.blocks b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

revoke all on function public.my_blocks() from public;
grant execute on function public.my_blocks() to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل:
--    select tablename, policyname from pg_policies
--    where schemaname='public' and tablename='blocks';
--    -- ثلاث سياسات: read own / block as self / unblock own
--    select proname from pg_proc
--    where proname in ('is_blocked','block_user','my_blocks','are_mutual');
--  وتأكّد أنّ استعلام qual='true' الصحّي لم يتغيّر (blocks ليست فيه).
-- ============================================================
