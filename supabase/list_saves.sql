-- ============================================================
--  Loopz — حفظ قائمة غيرك (38)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر زرّ «أضِفها إلى قوائمي».
--
--  مرجعٌ حيّ لا نسخة: الصفّ يربط حسابك بقائمة صاحبها، وصفحة قوائمك
--  تعرضها من مصدرها — فأي تعديلٍ أو إضافةٍ من صاحبها تنعكس عندك فوراً
--  بلا مزامنة أصلاً (طلب أحمد بنصّه). النسخُ كان سيجمّدها يوم حفظها.
-- ============================================================

create table if not exists public.list_saves (
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- حذفُ القائمة يُسقط حفظها عند الجميع: مرجعٌ إلى لا شيء ليس مرجعاً
  list_id    uuid not null references public.user_lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

alter table public.list_saves enable row level security;

create index if not exists list_saves_user_idx
  on public.list_saves (user_id, created_at desc);

-- سياسةٌ واحدة كنمط dismissed_titles: صفوفي وحدها قراءةً وكتابةً وحذفاً.
-- وشرطُ الإدراج: القائمة معلنةٌ وليست لي — الخاصّة لا تُقرأ أصلاً فحفظُها
-- وعدٌ كاذب، وقائمتي لا معنى لحفظها (هي في قوائمي أصلاً).
drop policy if exists "own list saves" on public.list_saves;
create policy "own list saves" on public.list_saves
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.is_public and l.user_id <> auth.uid()
    )
  );

-- التحقّق بعد التشغيل:
select tablename, policyname from pg_policies
where schemaname='public' and tablename = 'list_saves';
-- ولا يجوز أن يظهر list_saves في استعلام qual='true' الصحّي
