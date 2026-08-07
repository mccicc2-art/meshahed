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

-- ============================================================
--  الإخفاء التلقائي عند عشرة بلاغات
--
--  عمودٌ محسوب على صفّ التقييم، لا عدٌّ عند كل قراءة: خطّ المجتمع يقرأ
--  ستّين صفّاً، وعدُّ بلاغات كلٍّ منها في كل فتحةٍ للصفحة استعلامٌ داخل
--  استعلام. المُشغِّل يكتب مرّةً عند البلاغ العاشر ثم لا يعمل شيئاً.
--
--  ⚠️ **حدّ العشرة سيفٌ ذو حدّين، ويجب أن تعرفه:** عشرة حساباتٍ متّفقة
--  تُسكِت أي رأي. اليوم هذا بعيد (المجتمع أصغر من أن تجتمع فيه عشرة على
--  رأي)، ومع النموّ يصير مساراً حقيقياً للتنمّر المنظَّم. ولذلك:
--    • الإخفاء **قابلٌ للنقض بيدك** — `update ratings set hidden = false`
--      يُرجع الرأي فوراً، والبلاغات تبقى للمراجعة.
--    • الإخفاء **لا يحذف شيئاً**: النصّ باقٍ، وصاحبه يراه في `/ratings`
--      لأن قراءته لصفوفه تمرّ بـRLS لا بدوال العرض.
--    • بلاغٌ واحدٌ لكل شخصٍ على كل مراجعة — مضمونٌ بالمفتاح الأساسي.
--  راجِع الاستعلام أسفل الملف كل حين؛ إخفاءٌ صامت بلا مراجعة أسوأ من
--  عدم الإخفاء.
-- ============================================================

alter table public.ratings
  add column if not exists hidden boolean not null default false;

create or replace function public.hide_reported_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  select count(*) into n
  from public.review_reports
  where review_user_id = new.review_user_id
    and tmdb_id = new.tmdb_id
    and media_type = new.media_type;

  if n >= 10 then
    update public.ratings
    set hidden = true
    where user_id = new.review_user_id
      and tmdb_id = new.tmdb_id
      and media_type = new.media_type;
  end if;

  return new;
end;
$$;

drop trigger if exists on_review_reported on public.review_reports;
create trigger on_review_reported
  after insert on public.review_reports
  for each row execute function public.hide_reported_review();

-- ============================================================
--  دوال العرض تستثني المخفيّ
--
--  النسخ القانونية لهذه الثلاث في `security.sql` و`security2.sql`
--  (D-010). تُحدَّث هنا لأن تلك الملفات مُشغَّلة في الإنتاج ولا يُعاد
--  تشغيلها؛ **وواجبٌ نقل هذه النسخ إليها عند أوّل تعديلٍ قادم عليها**
--  حتى لا تتفرّق دوال القراءة على ملفّات.
-- ============================================================
create or replace function public.title_reviews(t_id integer, m_type text)
returns table (
  id          uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  rating      smallint,
  review      text,
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.user_id as id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.rating, r.review, r.updated_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where r.tmdb_id = t_id
    and r.media_type = m_type
    and (coalesce(r.hidden, false) = false or r.user_id = auth.uid())
  order by r.updated_at desc
  limit 50;
$$;

revoke all on function public.title_reviews(integer, text) from public;
grant execute on function public.title_reviews(integer, text) to authenticated;

create or replace function public.following_activity()
returns table (
  id          uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  rating      smallint,
  review      text,
  title       text,
  poster_path text,
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.user_id as id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    p.username,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path, r.updated_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where r.user_id in (
    select following_id from public.user_follows where follower_id = auth.uid()
  )
    and coalesce(r.hidden, false) = false
  order by r.updated_at desc
  limit 40;
$$;

revoke all on function public.following_activity() from public;
grant execute on function public.following_activity() to authenticated;

-- استعلام المراجعة (يُشغَّل في اللوحة عند الحاجة):
--   select review_user_id, tmdb_id, media_type, count(*) as reports,
--          max(created_at) as last_report
--   from public.review_reports
--   group by 1, 2, 3
--   order by reports desc, last_report desc;
--
-- ما أُخفي تلقائياً:
--   select user_id, tmdb_id, media_type, left(review, 80)
--   from public.ratings where hidden;
--
-- نقضُ إخفاءٍ بعد المراجعة:
--   update public.ratings set hidden = false
--   where user_id = '...' and tmdb_id = 000 and media_type = 'tv';
