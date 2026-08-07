-- ============================================================
--  Loopz — حزمة الأمن الثانية (توصيات التقييم الثاني)
--  شغّله في Supabase → SQL Editor بعد security.sql
--
--  ثلاثة أهداف: فهارس لأسخن مسار قراءة (صفحة العمل)، وإخفاء الاسم
--  يشمل المعرّف @username أيضاً (كان يخرج من الدوال والواجهة وحدها
--  تخفيه)، وإحصاءات الملف الشخصي العام عبر دوال definer بدل قراءةٍ
--  مباشرة كانت ممنوعة بالسياسات فتعرض أصفاراً.
-- ============================================================

-- ============================================================
--  ١) فهرسان لصفحة العمل
--     community_rating و title_reviews و title_review_likes كلها ترشّح
--     على (tmdb_id, media_type) وتعمل على كل فتح لصفحة مسلسل/فيلم —
--     وكانت الوحيدة بلا فهرس يخدمها.
-- ============================================================

create index if not exists ratings_title_idx
  on public.ratings (tmdb_id, media_type);

create index if not exists review_likes_title_idx
  on public.review_likes (tmdb_id, media_type);

-- ============================================================
--  ٢) إخفاء الاسم يشمل المعرّف
--     من فعّل «إخفاء الاسم» كان اسمه وصورته يخرجان null لكن معرّفه
--     @handle يخرج كاملاً — يُستعلم به ويُفتح ملفه. الآن: المعرّف null
--     لغير صاحبه، والمخفي لا يظهر في بحث الأشخاص إطلاقاً.
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
    -- تموضع الصورتين (٠–١٠٠ رأسياً) في الذيل عمداً: create or replace
    -- لا يقبل عموداً جديداً في وسط عرضٍ قائم — أُضيفا في image_positions.sql
    p.cover_pos,
    p.avatar_pos
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
  select p.id, p.nickname, p.username, p.avatar_url, false
  from public.profiles p
  where p.username is not null
    and coalesce(p.hide_name, false) = false
    and length(coalesce(q, '')) >= 2
    and (
      p.username ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
      or p.nickname ilike '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
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
    case when coalesce(p.hide_name, false) then null else p.username end,
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
    case when coalesce(p.hide_name, false) and r.user_id is distinct from auth.uid()
         then null else p.username end,
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
--  ٣) الملف الشخصي العام: مكتبة المستخدم وإحصاءاته عبر دوال definer
--     جداول follows و watched_* مقصورة على صاحبها بالسياسات، وصفحة
--     /u/handle كانت تقرأها مباشرةً فتعرض أصفاراً للجميع بصمت.
--     المكتبة ملفٌّ عام بحكم المنتج — فتخرج من دوال محدودة الأعمدة
--     والعدد، لا بإعادة فتح الجداول.
-- ============================================================

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
  order by f.added_at desc
  limit 60;
$$;

revoke all on function public.user_public_follows(uuid) from public;
grant execute on function public.user_public_follows(uuid) to authenticated;

-- عددُ ما شاهد لكل مسلسل — أعداد مجمّعة، لا صفوف حلقات ولا أوقات
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
  group by w.show_tmdb_id;
$$;

revoke all on function public.user_watch_overview(uuid) from public;
grant execute on function public.user_watch_overview(uuid) to authenticated;

-- معرّفات أفلامه المشاهَدة (تظهر شارات «تمّت مشاهدته» على ملفه) —
-- المعرّفات فقط، بلا أوقات مشاهدة
create or replace function public.user_watched_movie_ids(target uuid)
returns table (movie_tmdb_id integer)
language sql
stable
security definer
set search_path = public
as $$
  select w.movie_tmdb_id from public.watched_movies w
  where w.user_id = target
  limit 1000;
$$;

revoke all on function public.user_watched_movie_ids(uuid) from public;
grant execute on function public.user_watched_movie_ids(uuid) to authenticated;

-- ============================================================
-- القائمة المعلنة لزائرٍ بلا حساب
--
-- سياسات القراءة العامّة على `user_lists` و`user_list_items` مقصورة على
-- `authenticated`، و`public_profiles` كذلك. فرابط قائمةٍ «معلنة» كان لا
-- يُفتح إلا بتسجيل دخول — أي أنّه لم يكن معلناً أصلاً، وهذا ما يجعل
-- المشاركة بلا معنى.
--
-- والعلاج بابٌ واحدٌ ضيّق لا توسيعُ ثلاثة أبواب: منح `anon` قراءةَ
-- `public_profiles` كان سيفتح تعداد كل الملفات لأي روبوت، ومنحه قراءة
-- الجدولين كان سيكشف أعمدةً لا تلزم الصفحة. هذه الدالّة تُرجع ما تحتاجه
-- صفحة القائمة المعلنة ولا حرفاً زيادة، وتفشل صامتةً على القائمة الخاصة.
--
-- `hide_name` محفوظٌ هنا كما هو محفوظٌ في `public_profiles`: من أخفى اسمه
-- تظهر قائمته بلا صاحب، لا باسمه.
-- ============================================================

create or replace function public.public_list(p_id uuid)
returns table (
  id             uuid,
  name           text,
  subtitle       text,
  kind           text,
  created_at     timestamptz,
  owner_id       uuid,
  owner_nickname text,
  owner_username text,
  owner_avatar   text,
  items          jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.subtitle,
    l.kind,
    l.created_at,
    l.user_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(
      (select jsonb_agg(x order by x.sort_order nulls last, x.added_at desc)
         from (select i.tmdb_id, i.media_type, i.title, i.poster_path,
                      i.added_at, i.sort_order
                 from public.user_list_items i
                where i.list_id = l.id
                order by i.sort_order nulls last, i.added_at desc
                limit 500) x),
      '[]'::jsonb)
  from public.user_lists l
  join public.profiles p on p.id = l.user_id
  where l.id = p_id and l.is_public;
$$;

revoke all on function public.public_list(uuid) from public;
grant execute on function public.public_list(uuid) to anon, authenticated;
