-- ============================================================
--  Loopz — الحساب الخاص يخفي محتواه عن غير المتابِعين
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ يعتمد على `profiles.is_private` من follow_requests.sql (٣٢) وعلى
--  `ratings.hidden` من review_reports.sql (٢٤) — شغّلهما قبله.
--
--  **هذا الملف أُعيدت كتابته بالكامل في ٩ أغسطس.** مسودّته الأولى أضافت
--  محوراً ثانياً (`activity_visibility`: عام/المتابعون) قبل أن يوجد
--  الحساب الخاص. ثم شُحن `is_private` (D-058) فصار مفتاحان لسؤالٍ واحد —
--  «من يرى ما أفعل؟» — ومفتاحان لسؤالٍ واحد يوقعان المستخدم في المقارنة
--  بدل الاختيار. القرار: **مفتاحٌ واحد** — «حساب خاص» يحرس المتابعة
--  *ويحجب المحتوى* عن غير المتابِعين معاً، كما يفهمه الناس في كل تطبيق.
--  وسقطت من المسودّة إعادةُ تعريف `community_activity` — خطّ تفاعلات
--  الجميع أُزيل من التطبيق أصلاً (D-059).
--
--  ملاحظة نُسَخ (على نمط review_reports.sql): أحدث نسخ الدوال الخمس
--  المعاد تعريفها هنا تعيش في هذا الملف؛ نسخة عرض `public_profiles`
--  القانونية حُدّثت في security.sql و security2.sql في نفس الدفعة (D-010).
-- ============================================================

-- ============================================================
--  ١) العرض العام يحمل حالة القفل — في الذيل (قاعدة create or replace)
--
--  حالة «خاص» ليست سراً: زرّ المتابعة يكشفها أصلاً («طلبتَ المتابعة»)،
--  وكل منصّةٍ تعرض القفل علناً. الصفحة تحتاجها لترسم غلاف «حساب خاص»
--  بدل صفوفٍ فارغة تبدو عطلاً.
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
    p.cover_pos,
    p.avatar_pos,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.bio end        as bio,
    coalesce(p.is_private, false)        as is_private
  from public.profiles p;

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

-- ============================================================
--  ٢) الحارس الواحد — `can_view_profile(target)`
--
--  صاحبُ الملف، أو ملفٌّ عام، أو متابِعٌ (متابعة قائمة لا طلبٌ معلّق).
--  دالّة definer لأنها تقرأ `profiles.is_private` والجدول مغلق القراءة؛
--  وتُستدعى من دوال definer أخرى فلا تمسّ سياسات RLS — لا خطر تكرار
--  (قاعدة communities2.sql تخصّ السياسات، وهذه ليست سياسة).
-- ============================================================
create or replace function public.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target = auth.uid()
      or not coalesce((select is_private from public.profiles where id = target), false)
      or exists (
        select 1 from public.user_follows uf
        where uf.follower_id = auth.uid() and uf.following_id = target
      )
      -- منحة المكتبة (library_grants, 40): استثناءٌ فرديّ يمنحه المالك —
      -- النسخة المشغَّلة في الإنتاج هي نسخة الهجرة 40 نفسها
      or exists (
        select 1 from public.library_grants g
        where g.owner_id = target and g.grantee_id = auth.uid()
      );
$$;
revoke all on function public.can_view_profile(uuid) from public;
grant execute on function public.can_view_profile(uuid) to authenticated;

-- ============================================================
--  ٣) دوال الملف الشخصي الأربع تحترم الحارس
--
--  الإنفاذ في SQL لا في الصفحة (نهج D-011/D-012): الصفحة تُخفي، والدالة
--  تمنع — فمن نادى الـRPC مباشرةً على حسابٍ خاص لا يتابعه أخذ صفراً.
-- ============================================================

-- تقييماته (نسخة security.sql + الحارس)
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
    and public.can_view_profile(target)
  order by r.rating desc, r.updated_at desc
  limit 200;
$$;
revoke all on function public.user_ratings(uuid) from public;
grant execute on function public.user_ratings(uuid) to authenticated;

-- مكتبته (نسخة security2.sql + الحارس)
create or replace function public.user_public_follows(target uuid)
returns table (
  tmdb_id        integer,
  media_type     text,
  title          text,
  poster_path    text,
  added_at       timestamptz,
  total_episodes integer,
  aired_episodes integer,
  next_air_date  date,
  dropped        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select f.tmdb_id, f.media_type, f.title, f.poster_path, f.added_at,
         f.total_episodes, f.aired_episodes, f.next_air_date,
         coalesce(f.dropped, false)
  from public.follows f
  where f.user_id = target
    and public.can_view_profile(target)
  order by f.added_at desc
  limit 60;
$$;
revoke all on function public.user_public_follows(uuid) from public;
grant execute on function public.user_public_follows(uuid) to authenticated;

-- عدّاد حلقاته لكل مسلسل (نسخة security2.sql + الحارس)
create or replace function public.user_watch_overview(target uuid)
returns table (show_tmdb_id integer, watched integer)
language sql
stable
security definer
set search_path = public
as $$
  select w.show_tmdb_id, count(*)::integer
  from public.watched_episodes w
  where w.user_id = target
    and public.can_view_profile(target)
  group by w.show_tmdb_id;
$$;
revoke all on function public.user_watch_overview(uuid) from public;
grant execute on function public.user_watch_overview(uuid) to authenticated;

-- معرّفات أفلامه المشاهَدة (نسخة security2.sql + الحارس)
create or replace function public.user_watched_movie_ids(target uuid)
returns table (movie_tmdb_id integer)
language sql
stable
security definer
set search_path = public
as $$
  select w.movie_tmdb_id from public.watched_movies w
  where w.user_id = target
    and public.can_view_profile(target)
  limit 1000;
$$;
revoke all on function public.user_watched_movie_ids(uuid) from public;
grant execute on function public.user_watched_movie_ids(uuid) to authenticated;

-- ============================================================
--  ٤) صفحة العمل تحترمه كذلك
--
--  وإلا كان القفل كذبةً: من أغلق ملفه ثم وجد رأيه معروضاً لكل زائرٍ في
--  صفحة العمل لم يُغلق شيئاً. النسخة الحيّة من review_reports.sql
--  (مرشِّح `hidden`) + الحارس لكل كاتب. صاحبُ الرأي مستثنى داخل الحارس.
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
    and public.can_view_profile(r.user_id)
  order by r.updated_at desc
  limit 50;
$$;
revoke all on function public.title_reviews(integer, text) from public;
grant execute on function public.title_reviews(integer, text) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل:
--    select column_name from information_schema.columns
--    where table_schema='public' and table_name='public_profiles'
--      and column_name='is_private';                -- صفٌّ واحد
--    select proname from pg_proc where proname='can_view_profile';
--    -- ثم افتح ملفك بحسابٍ آخر لا يتابعك بعد تفعيل «حساب خاص»:
--    -- غلاف «حساب خاص» بدل الصفوف، ورأيك يغيب عن صفحة العمل.
-- ============================================================
