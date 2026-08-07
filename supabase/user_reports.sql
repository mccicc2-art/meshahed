-- ============================================================
--  Loopz — الإبلاغ عن حساب
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر قائمة الملف الشخصي (بلاغ/حظر).
--
--  شقيق `review_reports` لكن هدفه شخصٌ لا مراجعة: قائمة «المزيد» في
--  الملف الشخصي تعرض «بلاغ» بجانب «حظر»، لأن الفعلين مختلفان — الحظر
--  يحميك أنت (يقطع الارتباط بينكما)، والبلاغ يحمي غيرَك (يصل لصاحب
--  التطبيق ليتصرّف). ولا إخفاء تلقائيّاً هنا عمداً: إخفاء مراجعةٍ فعلٌ
--  صغير قابل للنقض، أمّا إسكات حسابٍ كامل فقرارٌ إداريّ يُتّخذ من لوحة
--  Supabase بعد نظر، لا بعدّاد.
-- ============================================================

create table if not exists public.user_reports (
  target_id   uuid not null references auth.users (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text check (reason is null or length(btrim(reason)) <= 300),
  created_at  timestamptz not null default now(),
  -- بلاغٌ واحد لكل شخصٍ على كل حساب: التكرار لا يزيد البلاغ صدقاً
  primary key (target_id, reporter_id),
  check (reporter_id <> target_id)
);

alter table public.user_reports enable row level security;

-- مراجعة البلاغات تتمّ بالهدف: «من المُبلَغ عنه أكثر؟»
create index if not exists user_reports_target_idx
  on public.user_reports (target_id, created_at desc);

-- الكتابة باسمك أنت، ولا تُبلغ عن نفسك
drop policy if exists "report user as self" on public.user_reports;
create policy "report user as self" on public.user_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id and auth.uid() <> target_id);

-- القراءة: بلاغاتك أنت وحدها — والمراجعة الإدارية من لوحة Supabase
-- بمفتاح الخدمة، كما في review_reports (لا قائمة مشرفين داخل RLS)
drop policy if exists "read own user reports" on public.user_reports;
create policy "read own user reports" on public.user_reports
  for select to authenticated using (auth.uid() = reporter_id);

drop policy if exists "withdraw own user report" on public.user_reports;
create policy "withdraw own user report" on public.user_reports
  for delete to authenticated using (auth.uid() = reporter_id);

-- ============================================================
--  التحقّق بعد التشغيل:
--    select policyname from pg_policies
--    where schemaname='public' and tablename='user_reports';
--    -- ثلاث سياسات: report user as self / read own / withdraw own
-- ============================================================
