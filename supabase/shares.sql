-- ============================================================
--  Loopz — إرسال عملٍ لصديق، وخيط ردٍّ قصير
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر واجهة الوارد.
--
--  ليس صندوق محادثاتٍ مفتوح. الفرق مقصود: المحادثة المفتوحة تفتح باب
--  الإزعاج والتحرّش، وتحتاج سياسةً وإشرافاً بشرياً — والمشرف الوحيد هنا
--  صاحب التطبيق. هذا خيطٌ **معلَّق بعملٍ بعينه**: تُرسل مسلسلاً مع سطر،
--  ويُردّ عليه بأسطر. لا رسائل بلا موضوع، ولا محادثة تبدأ من فراغ.
-- ============================================================

-- ============================================================
--  ١) المشاركة
-- ============================================================
create table if not exists public.title_shares (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id      integer not null,
  media_type   text not null check (media_type in ('tv', 'movie')),
  title        text,
  poster_path  text,
  note         text check (note is null or length(btrim(note)) <= 280),
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  -- حذفٌ من طرفٍ واحد: من حذف الخيط لا يراه، ويبقى عند الآخر. حذفُ
  -- الصفّ كاملاً كان سيمحو نصف محادثةٍ لا يملكها الحاذف وحده
  sender_hid    boolean not null default false,
  recipient_hid boolean not null default false,
  check (sender_id <> recipient_id)
);

alter table public.title_shares enable row level security;

create index if not exists title_shares_recipient_idx
  on public.title_shares (recipient_id, created_at desc);
create index if not exists title_shares_sender_idx
  on public.title_shares (sender_id, created_at desc);

-- ============================================================
--  ٢) شرط المتابعة المتبادلة
--
--  الإرسال لمن تتابعه **ويتابعك**. هذا الشرط وحده يمنع أغلب الإزعاج قبل
--  أن يقع: من لا تعرفه لا يستطيع أن يبلغك، ومن أزعجك تُلغي متابعته فينقطع
--  الباب من الطرفين. أرخص من نظام حظرٍ كامل، وأقوى منه لأنه افتراضي.
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
  );
$$;

revoke all on function public.are_mutual(uuid, uuid) from public;
grant execute on function public.are_mutual(uuid, uuid) to authenticated;

-- القراءة لطرفَي الخيط وحدهما، وكلٌّ لا يرى ما أخفاه هو
drop policy if exists "read own shares" on public.title_shares;
create policy "read own shares" on public.title_shares
  for select to authenticated
  using (
    (auth.uid() = sender_id and sender_hid = false)
    or (auth.uid() = recipient_id and recipient_hid = false)
  );

-- الإرسال باسمك أنت، ولمن بينك وبينه متابعةٌ متبادلة
drop policy if exists "send share as self" on public.title_shares;
create policy "send share as self" on public.title_shares
  for insert to authenticated
  with check (auth.uid() = sender_id and public.are_mutual(sender_id, recipient_id));

-- التعديل لطرفَي الخيط: علامة القراءة والإخفاء لا أكثر (النصّ لا يُعدَّل
-- بعد الإرسال — رسالةٌ تتغيّر بعد قراءتها تكسر الثقة في السجلّ كلّه)
drop policy if exists "update own share flags" on public.title_shares;
create policy "update own share flags" on public.title_shares
  for update to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id)
  with check (auth.uid() = sender_id or auth.uid() = recipient_id);

-- ============================================================
--  ٣) الردود
-- ============================================================
create table if not exists public.share_replies (
  id         uuid primary key default gen_random_uuid(),
  share_id   uuid not null references public.title_shares (id) on delete cascade,
  author_id  uuid not null references auth.users (id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.share_replies enable row level security;

create index if not exists share_replies_share_idx
  on public.share_replies (share_id, created_at);

drop policy if exists "read replies of own shares" on public.share_replies;
create policy "read replies of own shares" on public.share_replies
  for select to authenticated
  using (
    exists (
      select 1 from public.title_shares s
      where s.id = share_id
        and (auth.uid() = s.sender_id or auth.uid() = s.recipient_id)
    )
  );

-- الردّ من طرفٍ في الخيط، وبشرط بقاء المتابعة المتبادلة: من ألغى متابعتك
-- أغلق الباب — والخيط القديم يبقى مقروءاً ولا يُكتب فيه
drop policy if exists "reply as party" on public.share_replies;
create policy "reply as party" on public.share_replies
  for insert to authenticated
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.title_shares s
      where s.id = share_id
        and (auth.uid() = s.sender_id or auth.uid() = s.recipient_id)
        and public.are_mutual(s.sender_id, s.recipient_id)
    )
  );

drop policy if exists "delete own reply" on public.share_replies;
create policy "delete own reply" on public.share_replies
  for delete to authenticated using (auth.uid() = author_id);

-- ============================================================
--  ٤) عدّاد الوارد غير المقروء — لشارة الأيقونة
-- ============================================================
create or replace function public.unread_shares()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.title_shares
  where recipient_id = auth.uid()
    and recipient_hid = false
    and read_at is null;
$$;

revoke all on function public.unread_shares() from public;
grant execute on function public.unread_shares() to authenticated;

-- التحقّق بعد التشغيل:
--   select tablename, policyname from pg_policies
--   where schemaname='public' and tablename in ('title_shares','share_replies');
--   -- ولا يجوز أن يظهر أيٌّ منها في استعلام qual='true' الصحّي
