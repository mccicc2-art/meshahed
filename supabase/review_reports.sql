-- ============================================================
--  Loopz — الإبلاغ عن مراجعة
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر زرّ الإبلاغ.
--
--  بديلٌ عن «عدم الإعجاب» لا مكمّلٌ له. الديسلايك يقع على **رأي شخص** لا
--  على العمل — والحكم على العمل موجودٌ أصلاً وأدقّ (تقييمٌ من ١ إلى ١٠).
--  وفي مجتمعٍ صغير لا يُقرأ الديسلايك إحصاءً بل رسالةً شخصية، فيصمت
--  الناس عن الكتابة — وخطّ الآراء هو صفحة المجتمع كلها.
--
--  فما يبقى من حاجةٍ حقيقية هو إخفاء المسيء، وهذا فعلٌ نادر بلا عدّادٍ
--  عامّ: يصل إلى صاحب التطبيق وحده، ولا يظهر للمُبلَّغ عنه ولا لغيره.
-- ============================================================

create table if not exists public.review_reports (
  review_user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id        integer not null,
  media_type     text not null check (media_type in ('tv', 'movie')),
  reporter_id    uuid not null references auth.users (id) on delete cascade,
  reason         text check (reason is null or length(btrim(reason)) <= 300),
  created_at     timestamptz not null default now(),
  -- بلاغٌ واحد لكل شخصٍ على كل مراجعة: التكرار لا يزيد البلاغ صدقاً
  primary key (review_user_id, tmdb_id, media_type, reporter_id),
  check (reporter_id <> review_user_id)
);

alter table public.review_reports enable row level security;

create index if not exists review_reports_target_idx
  on public.review_reports (review_user_id, created_at desc);

-- الكتابة باسمك أنت، ولا تُبلغ عن نفسك
drop policy if exists "report as self" on public.review_reports;
create policy "report as self" on public.review_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id and auth.uid() <> review_user_id);

-- القراءة: بلاغاتك أنت وحدها.
--
-- ولا سياسةَ قراءةٍ لصاحب التطبيق هنا عمداً: صلاحيةُ إشرافٍ داخل RLS
-- تعني قائمة معرّفاتٍ مكتوبةً في SQL تُنسى يوم يتغيّر شيء. المراجعة تتمّ
-- من لوحة Supabase بمفتاح الخدمة — وهو المكان الصحيح لفعلٍ إداريّ.
drop policy if exists "read own reports" on public.review_reports;
create policy "read own reports" on public.review_reports
  for select to authenticated using (auth.uid() = reporter_id);

drop policy if exists "withdraw own report" on public.review_reports;
create policy "withdraw own report" on public.review_reports
  for delete to authenticated using (auth.uid() = reporter_id);

-- استعلام المراجعة (يُشغَّل في اللوحة عند الحاجة):
--   select review_user_id, tmdb_id, media_type, count(*) as reports,
--          max(created_at) as last_report
--   from public.review_reports
--   group by 1, 2, 3
--   order by reports desc, last_report desc;
