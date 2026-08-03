-- ============================================================
--  Loopz — تقييد ما يُقرأ من جدول الملفات الشخصية
--  شغّله في Supabase → SQL Editor
-- ============================================================
--
-- المشكلة: سياسة "read all profiles" كانت `for select to authenticated
-- using (true)` — أي مستخدم مسجّل يقدر يقرأ **كل أعمدة كل الصفوف**:
-- الثيم واللغة والأنواع المفضّلة والغلاف لكل حسابات الموقع. لا شيء منها
-- سرّي بذاته، لكن لا سبب يجعلها متاحة، ولا يقف شيء أمام تعداد الحسابات.
--
-- الحل: جدول الملفات يعود مقصوراً على صاحبه، ويُفتح عرضٌ (view) يحمل
-- الأعمدة العامة وحدها. والعرض `security_invoker = false` عمداً: يعمل
-- بصلاحيات مالكه فيتجاوز RLS الجدول — وهذا مقصود لأن ما يعرضه عامّ أصلاً.

-- ---------- العرض العام ----------
create or replace view public.public_profiles
with (security_invoker = false)
as
  select
    p.id,
    p.nickname,
    p.username,
    p.avatar_url,
    p.cover_url,
    p.favorite_genres,
    coalesce(p.hide_name, false) as hide_name
  from public.profiles p;

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

-- ---------- الدوال التي تقرأ ملفات الآخرين ----------
-- كانت `security invoker` وتعتمد على السياسة المفتوحة. بعد إغلاقها تحتاج
-- `security definer` — وهي تُرجع الأعمدة العامة وحدها، فلا تكشف جديداً.

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
  select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false)
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
    r.user_id as id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false),
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
    r.user_id as id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false),
    r.rating, r.review, r.updated_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where r.tmdb_id = t_id and r.media_type = m_type
  order by (r.review is null), r.updated_at desc
  limit 30;
$$;

revoke all on function public.title_reviews(integer, text) from public;
grant execute on function public.title_reviews(integer, text) to authenticated;

-- ---------- إغلاق القراءة المفتوحة ----------
-- يُنفَّذ أخيراً: بعد أن صار لكل قارئٍ طريقه الخاص
drop policy if exists "read all profiles" on public.profiles;
