-- ============================================================
--  ٨١ — people_page · أقسامُ تبويب «الناس» (D-263)
--  تُشغَّل بعد talk_bulletins.sql (80)
--
--  **طلبُ أحمد بلوحتين:** «تبويب الناس ابغاه مثل كذا» — الأكثرُ مشاركةً
--  هذا الأسبوع · نجومٌ صاعدون · أعلى تعليقٍ حصل على إعجابات · ماذا يشاهد
--  الأعضاء الآن · أشخاصٌ يشبهون ذوقك (قائمةٌ منذ D-126).
--
--  ================= ⚠️ عددٌ صريح لا نقاطٌ موزونة =================
--
--  **قرارُ أحمد بسؤالٍ صريح.** اللوحةُ تعرض «٢٤٥ نقطة» و«★٢٤٥٠» —
--  **ولا نقاطَ في Loopz ولا عمودَ لها.** والبديلان كانا: معادلةً
--  (مشاركة=٥ · ردّ=٢ · إعجاب=١) تُنتج رقماً كبيراً يشبه اللوحة،
--  **أو العددَ الحقيقيَّ كما هو.**
--  **واختار العدد**، والحجّةُ مكتوبةٌ في `07`: **رقمٌ لا يستطيع أحدٌ
--  مراجعته يُفقِد الثقةَ ببقيّة الصفحة** (D-219)، **ومعادلةٌ تُعاير كلَّما
--  تغيّر المحتوى**. **والوزنُ يُضاف يومَ يكبر الموقع بلا هجرة** — الدالّةُ
--  تُرجع الأعمدةَ الثلاثة منفصلةً، فمن أراد وزناً وزَنها عند العرض.
--
--  ================= ولا جدولَ حالةٍ ولا عمودَ عدّاد =================
--
--  **كلُّ رقمٍ هنا يُحسب من صفوفٍ قائمة** (`title_posts` · `ratings` ·
--  `review_likes` · `follows`) — **لا عمودَ `points` يُحدَّث مع كل فعل**،
--  فعمودٌ كهذا يفسد صمتاً ولا يُكتشف (نمطُ D-125: ختمٌ ودالّةٌ بدل جدول).
--  **والسقفُ ٧ أيامٍ يجعل المسحَ صغيراً** مهما كبر الأرشيف.
--
--  **ولا سياسةَ قراءةٍ مفتوحة** — ثلاثُ دوالِّ `security definer` تقرأ
--  باحترام `hide_name` والحظر، **كما تفعل `my_signals` و`title_thread`.**
--  **والسياساتُ المفتوحة تبقى أربعاً.**
--
--  آمنةٌ للإعادة، ولا تُنشئ جدولاً ولا عموداً.
-- ============================================================

begin;

-- ============================================================
--  ١) لوحةُ النشاط — تخدم قسمين لا قسماً (D-198)
-- ============================================================
--  **«الأكثر مشاركة» و«الصاعدون» سؤالان عن رقمٍ واحد**: الأوّل يسأل عن
--  حجمِ النافذة الحالية، والثاني عن **الفرق** بينها وبين التي قبلها.
--  **فدالّةٌ واحدة تُرجع النافذتين، والواجهةُ تطرح** — ونداءان لرقمٍ
--  واحد هو ما تمنعه D-198.
--
--  ⚠️ **والمقاييسُ الثلاثة منفصلةٌ عمداً** (`posts` · `reviews` ·
--  `likes_in`): **مجموعُها هو «العدد الصريح»**، وبقاؤها منفصلةً هو ما
--  يجعل الرقمَ قابلاً للمراجعة — **ومن أراد وزناً فالمكوّناتُ عنده.**
create or replace function public.people_leaderboard(
  p_days  integer default 7,
  p_limit integer default 5
)
returns table (
  user_id     uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  posts       integer,
  reviews     integer,
  likes_in    integer,
  total       integer,
  prev_total  integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90)) as t0,
      now() - make_interval(days => 2 * least(greatest(coalesce(p_days, 7), 1), 90)) as t_prev
  ),
  /* **من يُعَدّ أصلاً**: كلُّ من له ملفٌّ غيرُ نظاميّ ولا حظرَ بينه وبين
     القارئ. **وحسابُ Loopz خارج القائمة** — لوحةُ الناس للناس (D-252). */
  people as (
    select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false) as hide_name
    from public.profiles p
    where auth.uid() is not null
      and coalesce(p.is_system, false) = false
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
  ),
  /* مشاركاتُ النقاش — **كلامُ البشر وحده**: `kind is null` (D-261) */
  posts_now as (
    select r.user_id, count(*)::int c
    from public.title_posts r, bounds
    where r.kind is null and r.hidden = false and r.created_at >= bounds.t0
    group by r.user_id
  ),
  posts_prev as (
    select r.user_id, count(*)::int c
    from public.title_posts r, bounds
    where r.kind is null and r.hidden = false
      and r.created_at >= bounds.t_prev and r.created_at < bounds.t0
    group by r.user_id
  ),
  /* الآراءُ المكتوبة — **لا التقييمُ الصامت**: نجمةٌ بلا نصٍّ ليست مشاركة */
  reviews_now as (
    select g.user_id, count(*)::int c
    from public.ratings g, bounds
    where g.review is not null and length(btrim(g.review)) > 0
      and g.updated_at >= bounds.t0
    group by g.user_id
  ),
  reviews_prev as (
    select g.user_id, count(*)::int c
    from public.ratings g, bounds
    where g.review is not null and length(btrim(g.review)) > 0
      and g.updated_at >= bounds.t_prev and g.updated_at < bounds.t0
    group by g.user_id
  ),
  /* الإعجاباتُ **الواردة** لا الصادرة — «كم أعجب الناسَ كلامُه» */
  likes_now as (
    select l.review_user_id as user_id, count(*)::int c
    from public.review_likes l, bounds
    where l.created_at >= bounds.t0
    group by l.review_user_id
  ),
  likes_prev as (
    select l.review_user_id as user_id, count(*)::int c
    from public.review_likes l, bounds
    where l.created_at >= bounds.t_prev and l.created_at < bounds.t0
    group by l.review_user_id
  )
  select
    pe.id,
    case when pe.hide_name then null else pe.nickname end,
    case when pe.hide_name then null else pe.username end,
    case when pe.hide_name then null else pe.avatar_url end,
    pe.hide_name,
    coalesce(pn.c, 0),
    coalesce(rn.c, 0),
    coalesce(ln.c, 0),
    coalesce(pn.c, 0) + coalesce(rn.c, 0) + coalesce(ln.c, 0),
    coalesce(pp.c, 0) + coalesce(rp.c, 0) + coalesce(lp.c, 0)
  from people pe
  left join posts_now    pn on pn.user_id = pe.id
  left join posts_prev   pp on pp.user_id = pe.id
  left join reviews_now  rn on rn.user_id = pe.id
  left join reviews_prev rp on rp.user_id = pe.id
  left join likes_now    ln on ln.user_id = pe.id
  left join likes_prev   lp on lp.user_id = pe.id
  /* **ومن لا شيءَ له لا يُعرض**: صفرٌ في لوحةٍ ليس ترتيباً، هو حشو */
  where coalesce(pn.c,0) + coalesce(rn.c,0) + coalesce(ln.c,0)
      + coalesce(pp.c,0) + coalesce(rp.c,0) + coalesce(lp.c,0) > 0
  order by (coalesce(pn.c,0) + coalesce(rn.c,0) + coalesce(ln.c,0)) desc,
           (coalesce(pn.c,0) + coalesce(rn.c,0) + coalesce(ln.c,0))
         - (coalesce(pp.c,0) + coalesce(rp.c,0) + coalesce(lp.c,0)) desc
  limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.people_leaderboard(integer, integer) from public;
grant execute on function public.people_leaderboard(integer, integer) to authenticated;

-- ============================================================
--  ٢) أعلى تعليقٍ حصل على إعجابات
-- ============================================================
--  **والنافذةُ ٣٠ يوماً لا الأبد**: «أعلى تعليق» بلا نافذةٍ يتجمّد على
--  صفٍّ واحدٍ إلى الأبد **فيصير زينةً لا خبراً** — والقسمُ يقول «هذا
--  الأسبوع/الشهر» ضمناً بموضعه في صفحةٍ عن الحاضر.
create or replace function public.people_top_review(p_days integer default 30)
returns table (
  user_id     uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  title       text,
  poster_path text,
  review      text,
  rating      smallint,
  likes       integer,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    g.user_id,
    case when coalesce(p.hide_name,false) then null else p.nickname end,
    case when coalesce(p.hide_name,false) then null else p.username end,
    case when coalesce(p.hide_name,false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    g.tmdb_id, g.media_type, g.title, g.poster_path,
    g.review, g.rating,
    count(l.*)::int as likes,
    g.updated_at
  from public.ratings g
  join public.profiles p on p.id = g.user_id
  join public.review_likes l
    on l.review_user_id = g.user_id and l.tmdb_id = g.tmdb_id and l.media_type = g.media_type
  where auth.uid() is not null
    and g.review is not null and length(btrim(g.review)) > 0
    and g.updated_at >= now() - make_interval(days => least(greatest(coalesce(p_days,30),1), 365))
    and coalesce(p.is_system, false) = false
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = g.user_id)
         or (b.blocker_id = g.user_id and b.blocked_id = auth.uid())
    )
  group by g.user_id, p.hide_name, p.nickname, p.username, p.avatar_url,
           g.tmdb_id, g.media_type, g.title, g.poster_path, g.review, g.rating, g.updated_at
  order by count(l.*) desc, g.updated_at desc
  limit 1;
$$;

revoke all on function public.people_top_review(integer) from public;
grant execute on function public.people_top_review(integer) to authenticated;

-- ============================================================
--  ٣) ماذا يضيف الأعضاء إلى مكتباتهم
-- ============================================================
--  ⚠️ **واسمُه يُقال بدقّة**: اللوحةُ تكتب «ماذا يشاهد الأعضاء الآن»،
--  **ولا نعلم ما يُشاهَد الآن** — لا حضورَ لحظيّاً عندنا. **والذي نعلمه
--  ما أُضيف إلى المكتبة للتوّ** (`follows.added_at`). **فالجملةُ تتبع
--  البيانات لا العكس** (D-216): «أضافوا إلى مكتباتهم».
--  **والعنوانُ والملصقُ على الصفّ نفسِه** (D-048) فلا نداءَ TMDB.
--
--  **وشخصٌ واحدٌ لكلِّ عمل**: من أضاف عشرةً لا يملأ القسمَ وحده.
create or replace function public.people_watching(p_limit integer default 8)
returns table (
  user_id     uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  title       text,
  poster_path text,
  added_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (f.user_id)
    f.user_id,
    case when coalesce(p.hide_name,false) then null else p.nickname end,
    case when coalesce(p.hide_name,false) then null else p.username end,
    case when coalesce(p.hide_name,false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    f.tmdb_id, f.media_type, f.title, f.poster_path, f.added_at
  from public.follows f
  join public.profiles p on p.id = f.user_id
  where auth.uid() is not null
    and f.user_id <> auth.uid()
    and coalesce(p.is_system, false) = false
    and f.added_at >= now() - interval '30 days'
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = f.user_id)
         or (b.blocker_id = f.user_id and b.blocked_id = auth.uid())
    )
  order by f.user_id, f.added_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 24);
$$;

revoke all on function public.people_watching(integer) from public;
grant execute on function public.people_watching(integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname in
--      ('people_leaderboard','people_top_review','people_watching'))        as fns,
--   (select count(*)::int from public.people_leaderboard(7, 5))             as board,
--   (select count(*)::int from public.people_top_review(30))                as top_review,
--   (select count(*)::int from public.people_watching(8))                   as watching,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                           as open_policies;
--
--  **المتوقَّع:** `fns=3 | open_policies=4` — **والثلاثةُ الباقية أرقامُ
--  اليوم لا أرقامٌ مطلوبة**: تُقرأ كما تعود، **وصفرٌ فيها حقيقةٌ عن
--  الموقع لا عطلٌ في الهجرة.**
--
--  ⚠️ **وتُشغَّل بدور `postgres` فتعود فارغةً كلُّها** (`auth.uid()` فارغ)
--  — **وهذا صحيحٌ لا خطأ**: الحارسُ يعمل. الأرقامُ الحقيقية تُرى من
--  التطبيق بحسابٍ مسجَّل.
