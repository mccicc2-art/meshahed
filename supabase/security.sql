-- ============================================================
--  Loopz — حزمة تشديد الأمان (مراجعة خبير أمن المعلومات)
--  شغّله في Supabase → SQL Editor مرّةً واحدة
--
--  المبدأ الواحد خلف كل بند هنا: الواجهة تُخفي، وقاعدة البيانات تسمح —
--  وأي عميل يكلّم واجهة Supabase مباشرةً يتجاوز الواجهة. فكل ما يُعرض
--  «مجمّعاً» أو «مخفياً» في التطبيق يجب أن يخرج من قاعدة البيانات
--  مجمّعاً أو مخفياً أصلاً.
--
--  الترتيب مقصود: الدوال البديلة تُنشأ أولاً، وإسقاط سياسات القراءة
--  المفتوحة يأتي آخراً — فلا لحظة يكون فيها القارئ الشرعي بلا طريق.
-- ============================================================

-- ============================================================
--  ١) إخفاء الاسم يُنفَّذ في SQL لا في الواجهة
--     كانت الدوال تُرجع nickname و avatar_url مع علم hide_name وتترك
--     الإخفاء للعميل — أي أن الاسم «المخفي» كان يسافر في الاستجابة.
--     الآن يخرج null من المصدر (وصاحب الحساب يرى اسمه دائماً).
-- ============================================================

create or replace view public.public_profiles
with (security_invoker = false)
as
  select
    p.id,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.nickname end   as nickname,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.username end   as username,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.avatar_url end as avatar_url,
    p.cover_url,
    p.favorite_genres,
    coalesce(p.hide_name, false) as hide_name,
    -- الأعمدة الجديدة في الذيل عمداً: create or replace لا يقبل عموداً
    -- في وسط عرضٍ قائم (image_positions ثم profile_bio ثم profile_visibility)
    p.cover_pos,
    p.avatar_pos,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.bio end        as bio,
    coalesce(p.is_private, false)        as is_private,
    coalesce(p.hide_follow_lists, false) as hide_follow_lists
  from public.profiles p;

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

create or replace function public.search_people(q text)
returns table (
  id uuid,
  nickname text,
  username text,
  avatar_url text,
  hide_name boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    p.username,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false)
  from public.profiles p
  where p.username is not null
    and length(coalesce(q, '')) >= 2
    and (
      p.username ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
      or (coalesce(p.hide_name, false) = false
          and p.nickname ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%')
    )
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by p.username
  limit 20;
$$;

revoke all on function public.search_people(text) from public;
grant execute on function public.search_people(text) to authenticated;

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
  order by r.updated_at desc
  limit 40;
$$;

revoke all on function public.following_activity() from public;
grant execute on function public.following_activity() to authenticated;

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
    case when coalesce(p.hide_name, false) and r.user_id is distinct from auth.uid()
         then null else p.nickname end,
    p.username,
    case when coalesce(p.hide_name, false) and r.user_id is distinct from auth.uid()
         then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.rating, r.review, r.updated_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where r.tmdb_id = t_id and r.media_type = m_type
  order by (r.review is null), r.updated_at desc
  limit 30;
$$;

revoke all on function public.title_reviews(integer, text) from public;
grant execute on function public.title_reviews(integer, text) to authenticated;

-- ============================================================
--  ٢) سجلّ زوّار الملف الشخصي يصبح سرّياً
--     سياسة "read view counts" كانت تكشف الصفوف الخام: من زار من ومتى —
--     والواجهة لا تعرض إلا العدد. الدالة تُرجع العدد وحده بصلاحية
--     definer، والصفوف نفسها لا يقرؤها أحد.
-- ============================================================

drop policy if exists "read view counts" on public.profile_views;

create or replace function public.profile_view_count(target uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct viewer_id)::integer
  from public.profile_views
  where profile_id = target;
$$;

revoke all on function public.profile_view_count(uuid) from public;
grant execute on function public.profile_view_count(uuid) to authenticated;

-- ============================================================
--  ٣) إعجابات المراجعات: الأعداد عامّة، الأسماء لا
--     "read all review likes" كانت تكشف من أعجب بماذا لكل الموقع.
--     الواجهة تعرض عدّاداً و«هل أعجبتُ به أنا» فقط — فهذا ما يخرج.
-- ============================================================

create or replace function public.title_review_likes(t_id integer, m_type text)
returns table (review_user_id uuid, likes integer, liked_by_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.review_user_id,
    count(*)::integer,
    bool_or(l.liker_id = auth.uid())
  from public.review_likes l
  where l.tmdb_id = t_id and l.media_type = m_type
  group by l.review_user_id;
$$;

revoke all on function public.title_review_likes(integer, text) from public;
grant execute on function public.title_review_likes(integer, text) to authenticated;

-- إعجابات مراجعات مجموعة أشخاص (شريط «ممن تتابعهم») في نداء واحد
create or replace function public.feed_review_likes(uids uuid[])
returns table (
  review_user_id uuid,
  tmdb_id        integer,
  media_type     text,
  likes          integer,
  liked_by_me    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.review_user_id,
    l.tmdb_id,
    l.media_type,
    count(*)::integer,
    bool_or(l.liker_id = auth.uid())
  from public.review_likes l
  where l.review_user_id = any(uids)
  group by l.review_user_id, l.tmdb_id, l.media_type;
$$;

revoke all on function public.feed_review_likes(uuid[]) from public;
grant execute on function public.feed_review_likes(uuid[]) to authenticated;

-- عدد الإعجابات التي تلقّاها مستخدم (إحصاءة الملف الشخصي)
create or replace function public.received_likes(target uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.review_likes
  where review_user_id = target;
$$;

revoke all on function public.received_likes(uuid) from public;
grant execute on function public.received_likes(uuid) to authenticated;

drop policy if exists "read all review likes" on public.review_likes;
create policy "read own review likes" on public.review_likes
  for select to authenticated
  using (auth.uid() = liker_id or auth.uid() = review_user_id);

-- ============================================================
--  ٤) تفاعلات الأخبار: نفس المبدأ — العدّاد من دالة، الصفوف لصاحبها
--     وسياسة UPDATE كانت ناقصة: upsert على تفاعل موجود كان يسقط بخطأ
--     RLS صامت.
-- ============================================================

create or replace function public.reaction_counts(ids integer[])
returns table (tmdb_id integer, media_type text, n integer)
language sql
stable
security definer
set search_path = public
as $$
  select r.tmdb_id, r.media_type, count(*)::integer
  from public.post_reactions r
  where r.tmdb_id = any(ids)
  group by r.tmdb_id, r.media_type;
$$;

revoke all on function public.reaction_counts(integer[]) from public;
grant execute on function public.reaction_counts(integer[]) to authenticated;

drop policy if exists "read all reactions" on public.post_reactions;
create policy "read own reactions" on public.post_reactions
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "update own reaction" on public.post_reactions;
create policy "update own reaction" on public.post_reactions
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
--  ٥) جدول التقييمات يُغلق: كل قارئ عبر دالته
--     "read all ratings using(true)" كانت تسمح بتفريغ كل تقييمات
--     ومراجعات الموقع مع معرّفات أصحابها في طلب واحد. القرّاء الشرعيون:
--     متوسط العمل، مراجعات العمل، نشاط المتابَعين، تقييمات صفحة مستخدم،
--     لوحة الصدارة — ولكلٍّ الآن دالة definer تُرجع حاجته وحدها.
-- ============================================================

-- متوسط تقييم المجتمع لعمل — رقمان لا صفوف
create or replace function public.community_rating(t_id integer, m_type text)
returns table (avg_rating numeric, votes integer)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(avg(r.rating), 0)::numeric, count(*)::integer
  from public.ratings r
  where r.tmdb_id = t_id and r.media_type = m_type;
$$;

revoke all on function public.community_rating(integer, text) from public;
grant execute on function public.community_rating(integer, text) to authenticated;

-- تقييمات مستخدم بعينه — صفحة /u/handle تعرضها أصلاً، فهي عامّة بحكم
-- الميزة، لكن عبر دالة محدودة الأعمدة والعدد لا عبر الجدول كله
create or replace function public.user_ratings(target uuid)
returns table (
  user_id     uuid,
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
  select r.user_id, r.tmdb_id, r.media_type, r.rating, r.review,
         r.title, r.poster_path, r.updated_at
  from public.ratings r
  where r.user_id = target
  order by r.rating desc, r.updated_at desc
  limit 200;
$$;

revoke all on function public.user_ratings(uuid) from public;
grant execute on function public.user_ratings(uuid) to authenticated;

-- لوحة «الأعلى تقييماً» كانت security invoker تتّكئ على السياسة المفتوحة —
-- بعد إغلاقها تصبح definer (تُرجع مجاميع لا معرّفات، فلا تكشف شيئاً)
create or replace function public.top_rated_period(days integer default 7)
returns table (
  tmdb_id     integer,
  media_type  text,
  title       text,
  poster_path text,
  avg_rating  numeric,
  votes       integer,
  score       numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with cutoff as (
    select case
             when coalesce(days, 7) <= 0 then '-infinity'::timestamptz
             else now() - make_interval(days => least(days, 3650))
           end as since
  ),
  base as (
    select
      r.tmdb_id,
      r.media_type,
      avg(r.rating)::numeric      as avg_rating,
      count(*)::integer           as votes,
      (array_agg(r.title       order by r.updated_at desc))[1] as title,
      (array_agg(r.poster_path order by r.updated_at desc))[1] as poster_path
    from public.ratings r, cutoff c
    where r.updated_at >= c.since
    group by r.tmdb_id, r.media_type
  ),
  site as (
    select coalesce(avg(rating), 3.5)::numeric as mean from public.ratings
  )
  select
    b.tmdb_id,
    b.media_type,
    b.title,
    b.poster_path,
    round(b.avg_rating, 2),
    b.votes,
    round(
      (b.votes::numeric / (b.votes + 3)) * b.avg_rating
      + (3::numeric / (b.votes + 3)) * s.mean,
      4
    ) as score
  from base b cross join site s
  order by score desc, b.votes desc
  limit 40;
$$;

revoke all on function public.top_rated_period(integer) from public;
grant execute on function public.top_rated_period(integer) to authenticated;

-- صاحب التقييم يقرأ صفوفه مباشرةً (getMyRating / getMyRatings)
drop policy if exists "read own ratings" on public.ratings;
create policy "read own ratings" on public.ratings
  for select to authenticated using (auth.uid() = user_id);

-- الإغلاق — آخر خطوة بعد أن صار لكل قارئ طريقه
drop policy if exists "read all ratings" on public.ratings;

-- ============================================================
--  ٦) حذف الحساب: صفٌّ واحد يجرّ الباقي
--
--  ⚠️ **أُعيدت كتابتها في `account_deletion.sql` (هجرة 56، D-146).**
--  النسخة هنا هي النسخة الحالية حرفاً بحرف — فإعادةُ تشغيل هذا الملف
--  آمنة. النسخة القديمة كانت تعدّد الجداول بأسمائها (أحد عشر)، وصار
--  في `public` أربعةٌ وأربعون مفتاحاً إلى `auth.users`، فكانت تترك
--  الرسائل والمجتمعات والحظر والأغلفة خلفها — **عطلُ خصوصية لا دَين**.
--
--  والقائمة هي المرض لا الحلّ: كل مفاتيح `public` إلى `auth.users`
--  `on delete cascade` بلا استثناء، فحذفُ صفّ المستخدم يمحو الأثر كلَّه
--  اليومَ وبعد عشرين جدولاً. **من يضيف جدولاً لا يلمس هذه الدالّة —
--  يجعل مفتاحه cascade.**
-- ============================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gone integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- الصور أوّلاً: `storage.objects` لا يشير إلى `auth.users` فلا يجرّه
  -- الشلّال؛ وهي أوّلاً كي تسقط داخل نفس المعاملة إن فشل ما بعدها.
  delete from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = uid::text;

  delete from auth.users where id = uid;
  get diagnostics gone = row_count;

  -- صفرُ صفوفٍ يعني أن الحذف لم يحدث — فلا نقول للمستخدم إنه حدث.
  if gone = 0 then
    raise exception 'account deletion did not remove the auth row';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
