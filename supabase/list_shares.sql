-- ============================================================
--  Loopz — مشاركة قائمةٍ لصديق داخل الرسائل (37)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر واجهة مشاركة القوائم.
--
--  لماذا جدولٌ لا رسالةٌ برابط: D-051 يقول الرسالة مرفقٌ منظَّم لا نصٌّ
--  حرّ — والرابط داخل نصٍّ حرّ يفتح الباب الذي أُغلق عمداً. فالقائمة
--  المُشارَكة صفٌّ منظَّم كمشاركة العمل تماماً: بطاقةٌ في المحادثة، لا
--  سطرُ نصٍّ فيه URL. (شقيق title_shares في shares.sql — نفس البوّابة
--  ونفس الأعلام، والردود تبقى معلَّقةً بالأعمال وحدها.)
-- ============================================================

create table if not exists public.list_shares (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  -- حذفُ القائمة يُسقط بطاقتها من المحادثات: بطاقةٌ إلى لا شيء أسوأ من غيابها
  list_id      uuid not null references public.user_lists (id) on delete cascade,
  -- الاسم والعدّة لحظة الإرسال (روح D-048): البطاقة تُرسم بلا join،
  -- والضغط عليها يفتح الحقيقة الحيّة من صفحة القائمة نفسها
  list_name    text,
  item_count   integer,
  note         text check (note is null or length(btrim(note)) <= 280),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  -- حذفٌ من طرفٍ واحد — كما في title_shares وللسبب نفسه
  sender_hid    boolean not null default false,
  recipient_hid boolean not null default false,
  check (sender_id <> recipient_id)
);

alter table public.list_shares enable row level security;

create index if not exists list_shares_recipient_idx
  on public.list_shares (recipient_id, created_at desc);
create index if not exists list_shares_sender_idx
  on public.list_shares (sender_id, created_at desc);

-- القراءة لطرفَي المشاركة وحدهما، وكلٌّ لا يرى ما أخفاه هو
drop policy if exists "read own list shares" on public.list_shares;
create policy "read own list shares" on public.list_shares
  for select to authenticated
  using (
    (auth.uid() = sender_id and sender_hid = false)
    or (auth.uid() = recipient_id and recipient_hid = false)
  );

-- الإرسال باسمك، لمتابعٍ متبادل، **ولقائمتك المعلنة وحدها**: الخاصّة
-- لا يفتحها المستلم أصلاً (سياسة القراءة في lists.sql) — ومشاركةُ ما لا
-- يُفتح وعدٌ كاذب يُقطع هنا لا في الواجهة
drop policy if exists "send list share as self" on public.list_shares;
create policy "send list share as self" on public.list_shares
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and public.are_mutual(sender_id, recipient_id)
    and exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.user_id = auth.uid() and l.is_public
    )
  );

-- التعديل لطرفَي المشاركة: علامة القراءة والإخفاء لا أكثر
drop policy if exists "update own list share flags" on public.list_shares;
create policy "update own list share flags" on public.list_shares
  for update to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id)
  with check (auth.uid() = sender_id or auth.uid() = recipient_id);

-- ============================================================
--  عدّاد الوارد غير المقروء — يشمل القوائم الآن (يستبدل نسخة shares.sql)
-- ============================================================
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
  );
$$;

revoke all on function public.unread_shares() from public;
grant execute on function public.unread_shares() to authenticated;

-- التحقّق بعد التشغيل:
--   select tablename, policyname from pg_policies
--   where schemaname='public' and tablename = 'list_shares';
--   select proname from pg_proc where proname = 'unread_shares';
--   -- ولا يجوز أن يظهر list_shares في استعلام qual='true' الصحّي
