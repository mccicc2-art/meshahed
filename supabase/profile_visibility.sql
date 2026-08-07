-- ============================================================
--  Loopz — من يرى آرائي؟
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ يعتمد على `ratings.hidden` من review_reports.sql — شغّل ٢٤ قبله.
-- ============================================================

-- ============================================================
--  خيارٌ من اثنين لا ثلاثة
--
--  «عام» أو «المتابِعون». طلبَ المالك أربعة مسمّيات (عام/خاص/نشر للجميع/
--  للأصدقاء) وهي في الحقيقة محوران لشيءٍ واحد: **من يقرأ ما أكتب**.
--  أربعة أزرارٍ لسؤالين متطابقين تُوقِع المستخدم في المقارنة بدل الاختيار.
--
--  ولا حالة «خاصّ تماماً»: من لا يريد أحداً أن يقرأ رأيه لا يكتبه، والتقييم
--  الرقميّ يبقى في مكتبته على كل حال. المخفيّ هنا هو **النشر**، لا التتبّع.
--
--  و«المتابِعون» لا «الأصدقاء»: الصداقة في هذا التطبيق ليست علاقةً
--  متبادلة مسجَّلة — المتابعة اتجاهٌ واحد (D-013). تسمية الشيء بغير اسمه
--  تَعِد بضبطٍ لا وجود له.
-- ============================================================
alter table public.profiles
  add column if not exists activity_visibility text not null default 'public';

alter table public.profiles
  drop constraint if exists profiles_visibility_check;

alter table public.profiles
  add constraint profiles_visibility_check
  check (activity_visibility in ('public', 'followers'));

-- ============================================================
--  خطّ المجتمع الكامل يحترم الخيار
--
--  من اختار «المتابِعون» يغيب عن خطّ الجميع. ولا يغيب عن
--  `following_activity` — من يتابعه يراه، وهذا معنى الخيار لا استثناءٌ منه.
-- ============================================================
create or replace function public.community_activity()
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
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path, r.updated_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and r.user_id <> auth.uid()
    and length(btrim(coalesce(r.review, ''))) > 0
    and coalesce(r.hidden, false) = false
    and coalesce(p.activity_visibility, 'public') = 'public'
  order by r.updated_at desc
  limit 60;
$$;

revoke all on function public.community_activity() from public;
grant execute on function public.community_activity() to authenticated;

-- ============================================================
--  صفحة العمل تحترمه كذلك
--
--  وإلا كان الخيار كذبةً: من أخفى نفسه عن خطّ المجتمع ثم وجد رأيه معروضاً
--  لكل زائرٍ في صفحة العمل لم يُخفِ شيئاً. الاستثناءان الوحيدان: صاحبُ
--  الرأي، ومن يتابعه.
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
    and (
      coalesce(p.activity_visibility, 'public') = 'public'
      or r.user_id = auth.uid()
      or exists (
        select 1 from public.user_follows uf
        where uf.follower_id = auth.uid() and uf.following_id = r.user_id
      )
    )
  order by r.updated_at desc
  limit 50;
$$;

revoke all on function public.title_reviews(integer, text) from public;
grant execute on function public.title_reviews(integer, text) to authenticated;

-- التحقّق بعد التشغيل:
--   select column_name, column_default from information_schema.columns
--   where table_schema='public' and table_name='profiles'
--     and column_name='activity_visibility';
--   select activity_visibility, count(*) from public.profiles group by 1;
