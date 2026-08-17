-- ============================================================
--  Loopz — تقييمُ القوائم ومراجعتُها (الهجرة ١٠٣ · D-327)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  طلبُ أحمد: «نفّذ المراجعات وتقييم الليستات».
--
--  **وقد عُرض عليه ألّا تُبنى اليوم** (٨ قوائم عامّة و٢ حفظ)، **فأمر
--  ببنائها — وطلبُ صاحب المنتج ليس اقتراحاً ينتظر موافقته** (D-285).
--  فالسؤالُ الباقي «كيف تُبنى بلا كسر قاعدة؟» لا «أتُبنى؟».
--
--  ============ سطحٌ عامٌّ ثالث، فحرّاسُه كحرّاس أخويه ============
--
--  **لا وصفةَ جديدة هنا إطلاقاً** — كلُّ سطرٍ منسوخٌ من `ratings` +
--  `review_reports` بحرفه (D-145: وصفةٌ تُنسخ ثم يُصلَح أصلُها وحدَه يعود
--  عطلُها من بابٍ آخر — **فإن تغيّر حارسٌ هناك يتغيّر هنا في الدفعة
--  نفسها**):
--    • **السياساتُ «صفوفي أنا» أربعٌ مقيَّدة** — والقراءةُ العامّة بدالّة
--      `definer` وحدَها، **فالسياساتُ المفتوحة تبقى أربعاً** (D-013).
--    • **`hide_name` والحظرُ في `can_view_profile`** — بوّابةٌ واحدة
--      (D-061).
--    • **بابُ بلاغٍ من اليوم الأول** — **سطحٌ عامٌّ جديدٌ بلا بلاغ هو كيف
--      تُولد المشكلة** (D-193)، وعتبةُ العشرة والمُشغِّلُ والنقضُ اليدويّ
--      كما في `review_reports` حرفاً.
--    • **عَلَمُ الحرق** (D-315): مراجعةُ قائمةٍ تحرق أعمالَها — **وحاجبٌ
--      يستر النصَّ ويترك ما يحرق ليس حاجباً**.
--    • **وحذفُ الحساب يجرّها** بـ`on delete cascade` كأخواتها الأربعة
--      والأربعين.
--
--  ⚠️ **والسلّمُ عشرةٌ لا خمسة** — سلّمُ التقييم في لوبز واحد (D-002):
--  عملٌ يُقيَّم من عشرة وقائمةٌ من خمسة **تُعلّم القارئَ سلّمين**.
--
--  ⚠️ **ولا تُقيَّم قائمتُك ولا قائمةٌ خاصّة**: الأولى تصفيقٌ لنفسك،
--  والثانية لا تُقرأ أصلاً **فمراجعتُها وعدٌ كاذب** (نفسُ شرط `list_saves`).
-- ============================================================

begin;

create table if not exists public.list_reviews (
  user_id     uuid not null references auth.users (id) on delete cascade,
  list_id     uuid not null references public.user_lists (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 10),
  body        text check (body is null or length(btrim(body)) between 1 and 2000),
  has_spoiler boolean not null default false,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (user_id, list_id)
);

alter table public.list_reviews enable row level security;

create index if not exists list_reviews_list_idx
  on public.list_reviews (list_id, updated_at desc);

drop policy if exists "read own list review" on public.list_reviews;
create policy "read own list review" on public.list_reviews
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "write own list review" on public.list_reviews;
create policy "write own list review" on public.list_reviews
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.is_public and l.user_id <> auth.uid()
    )
  );

drop policy if exists "edit own list review" on public.list_reviews;
create policy "edit own list review" on public.list_reviews
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "drop own list review" on public.list_reviews;
create policy "drop own list review" on public.list_reviews
  for delete to authenticated using (auth.uid() = user_id);

create or replace function public.list_reviews_of(p_list uuid, p_limit integer default 50)
returns table (
  id          uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  rating      smallint,
  body        text,
  updated_at  timestamptz,
  has_spoiler boolean
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
    r.rating, r.body, r.updated_at,
    coalesce(r.has_spoiler, false)
  from public.list_reviews r
  join public.profiles p on p.id = r.user_id
  join public.user_lists l on l.id = r.list_id
  where r.list_id = p_list
    and l.is_public
    and (coalesce(r.hidden, false) = false or r.user_id = auth.uid())
    and public.can_view_profile(r.user_id)
  order by r.updated_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create or replace function public.list_review_stats(p_list uuid)
returns table (avg_rating numeric, reviews integer)
language sql
stable
security definer
set search_path = public
as $$
  select round(avg(r.rating)::numeric, 1), count(*)::int
  from public.list_reviews r
  join public.user_lists l on l.id = r.list_id
  where r.list_id = p_list
    and l.is_public
    and coalesce(r.hidden, false) = false
    and public.can_view_profile(r.user_id);
$$;

create table if not exists public.list_review_reports (
  review_user_id uuid not null references auth.users (id) on delete cascade,
  list_id        uuid not null references public.user_lists (id) on delete cascade,
  reporter_id    uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (review_user_id, list_id, reporter_id),
  check (reporter_id <> review_user_id)
);

alter table public.list_review_reports enable row level security;

drop policy if exists "report list review as self" on public.list_review_reports;
create policy "report list review as self" on public.list_review_reports
  for insert to authenticated
  with check (auth.uid() = reporter_id and auth.uid() <> review_user_id);

drop policy if exists "read own list review reports" on public.list_review_reports;
create policy "read own list review reports" on public.list_review_reports
  for select to authenticated using (auth.uid() = reporter_id);

create or replace function public.hide_reported_list_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  select count(*) into n from public.list_review_reports
  where review_user_id = new.review_user_id and list_id = new.list_id;
  if n >= 10 then
    update public.list_reviews set hidden = true
    where user_id = new.review_user_id and list_id = new.list_id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_list_review_reported on public.list_review_reports;
create trigger on_list_review_reported
  after insert on public.list_review_reports
  for each row execute function public.hide_reported_list_review();

revoke all on function public.list_reviews_of(uuid, integer) from public;
grant execute on function public.list_reviews_of(uuid, integer) to authenticated;
revoke all on function public.list_review_stats(uuid) from public;
grant execute on function public.list_review_stats(uuid) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_tables where tablename in ('list_reviews','list_review_reports')) as tbls,
--   (select count(*)::int from pg_policies where tablename = 'list_reviews')                        as pol,
--   (select count(*)::int from pg_proc where proname in ('list_reviews_of','list_review_stats'))    as fns,
--   (select count(*)::int from pg_policies where qual = 'true')                                     as open_policies;
-- المتوقّع: tbls = 2 · pol = 4 · fns = 2 · open_policies = 4
