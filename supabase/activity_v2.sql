-- ============================================================
--  Loopz — خطّ «مجتمعي» يحمل المشاهدة لا المراجعة وحدها (D-123)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md) — رقم ٤٥
--
--  ⚠️ شغّله **قبل** نشر واجهة الفيد الجديدة. الدالّة القديمة
--  `following_activity` تبقى كما هي ولا تُمسّ: هذا الملف يضيف ولا يستبدل،
--  فإن تعطّل شيءٌ في الواجهة عاد الفيد لسابقه بتغيير اسم النداء وحده.
--
--  لماذا؟ الفيد اليوم لا يعرض إلا **مراجعةً مكتوبة** — والصفحة تُسقط في
--  الكود كل تقييمٍ بلا نصّ. أي أن من شاهد موسماً كاملاً ولم يكتب شيئاً لم
--  يحدث في نظر التطبيق. النتيجة خطٌّ صامتٌ يبدو ميتاً وإن كانت الدائرة
--  نشطة. هذه الدالّة تفتح الخطّ لأربعة مصادر.
--
--  والقاعدة التي حكمت التصميم كلّه (قرار أحمد نصّاً: «صف واحد لكل شخص
--  جميله»): **صفٌّ واحد لكل (شخص + عمل + يوم)**. من شاهد اثنتي عشرة
--  حلقةً في ليلة لا يدفن دائرته باثني عشر سطراً — سطرٌ واحد يقول اثنتي
--  عشرة. الفيد الذي لا يُقرأ أسوأ من الفيد الفارغ.
-- ============================================================

-- ============================================================
--  ١) فهارس التاريخ — أربعتها شرطُ ألّا يمسح الاستعلام جداول كاملة
--
--  فهارس اليوم كلّها على (user_id) أو (user_id, show_tmdb_id): تصلح
--  لسؤال «ماذا شاهد فلان» ولا تصلح لسؤال «ماذا شاهد فلان **هذا الشهر**»،
--  وهو سؤال الفيد. أُنشئت قبل الدالّة عمداً كي لا يُقاس أداؤها بلا فهرس.
-- ============================================================
create index if not exists watched_episodes_user_time_idx
  on public.watched_episodes (user_id, watched_at desc);

create index if not exists watched_movies_user_time_idx
  on public.watched_movies (user_id, watched_at desc);

create index if not exists follows_user_added_idx
  on public.follows (user_id, added_at desc);

create index if not exists ratings_user_updated_idx
  on public.ratings (user_id, updated_at desc);

-- ============================================================
--  ٢) الدالّة
--
--  أربعة مصادر، وأولويةٌ واحدة عند التقائها في نفس اليوم لنفس العمل:
--
--    ٤ rate     تقييمٌ أو مراجعة   — رأيٌ يستحق تفاعلاً
--    ٣ movie    فيلمٌ شوهد
--    ٢ episodes حلقاتٌ شوهدت       — العدد وأعلى موسم
--    ١ add      أُضيف للمكتبة
--
--  **التقييم يبتلع المشاهدة ولا يلغيها**: الصفّ الفائز يأخذ نوعه ونصّه،
--  لكن `episode_count` و`top_season` يُلتقطان من كامل مجموعة اليوم بنافذة
--  `max`، فيخرج سطرٌ واحد يقول «أنهى الموسم ٢ · ٦ حلقات · ★٩» بدل سطرين
--  يتنافسان على نفس الخبر.
--
--  ثلاثة حرّاس، كلّها في SQL لا في الصفحة (نهج D-011/D-012):
--   • الدائرة = من أتابعهم وحدهم؛ ومتابعتي إيّاهم تُشبع `can_view_profile`
--     أصلاً — واستدعاؤها هنا **دفاعٌ في العمق** لا زينة: تكلفتها نداءٌ
--     واحد لكل متابَع لا لكل صفّ، والخطأ الذي تحرسه منه (تسريب مكتبةٍ
--     خاصة) لا يُحتمل.
--   • الحظر: `block_user` يفكّ المتابعة في الاتجاهين فيسقط المحظور من
--     الدائرة تلقائياً — و`is_blocked` هنا تسدّ الصفّ اليتيم إن بقي.
--   • إخفاء الاسم (D-011): الاسم والصورة **واسم المستخدم** تُقنَّع.
--     `following_activity` القديمة كانت تسرّب `username` بينما تقنّعه
--     `community_activity` — **تناقضٌ يُصحَّح هنا**: اسم المستخدم عنوانُ
--     الملف، وكشفه يكشف صاحبه.
--
--  ما لا تحمله هذه الدالّة، بصدق:
--   • **«أوقف المتابعة»** — `follows.dropped` علمٌ بلا تاريخ، فلا يمكن
--     تأريخ الحدث. يحتاج عموداً `dropped_at` إن أردناه لاحقاً.
--   • **«أعاد المشاهدة»** — `rewatch_count` عدّادٌ بلا تاريخ كذلك.
--   • **«أنهى المسلسل»** — يحتاج مقارنة المشاهَد بـ`aired_episodes` لكل
--     مسلسل؛ أُجّلت كي لا تدخل ضربةُ تجميعٍ ثانية في مسار الفيد.
--   • **اليوم يُحسب بتوقيت UTC** — فسهرةٌ تمتدّ بعد منتصف الليل بتوقيت
--     المستخدم قد تنقسم صفّين. علاجه عمودُ منطقةٍ زمنية في `profiles`،
--     ولا يستحقّ هجرةً اليوم.
-- ============================================================
create or replace function public.following_activity_v2()
returns table (
  id            uuid,
  nickname      text,
  username      text,
  avatar_url    text,
  hide_name     boolean,
  kind          text,
  tmdb_id       integer,
  media_type    text,
  rating        smallint,
  review        text,
  title         text,
  poster_path   text,
  day           date,
  episode_count integer,
  top_season    integer,
  at            timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
with circle as (
  select uf.following_id as uid
  from public.user_follows uf
  where auth.uid() is not null
    and uf.follower_id = auth.uid()
    and public.can_view_profile(uf.following_id)
    and not public.is_blocked(auth.uid(), uf.following_id)
),
adds as (
  -- إضافات الدائرة في النافذة، ومعها عدد إضافات صاحبها في ذلك اليوم —
  -- العدّ في نافذةٍ لأن `where` لا تقبل دوال النوافذ
  select f.user_id, f.tmdb_id, f.media_type, f.title, f.poster_path, f.added_at,
         count(*) over (partition by f.user_id, (f.added_at)::date) as day_adds
  from public.follows f
  join circle c on c.uid = f.user_id
  where f.added_at >= now() - interval '30 days'
    and coalesce(f.dropped, false) = false
),
ev as (
  -- ٤ · رأيٌ: تقييمٌ برقم، أو مراجعةٌ بنصّ. المخفيّ بالبلاغات يبقى خارجاً
  --     (review_reports.sql) — وهو شرطٌ كان ساقطاً من الدالّة القديمة
  select r.user_id                        as uid,
         4                                as pri,
         'rate'::text                     as kind,
         r.tmdb_id, r.media_type,
         r.rating, r.review, r.title, r.poster_path,
         (r.updated_at)::date             as day,
         0                                as episode_count,
         0                                as top_season,
         r.updated_at                     as at
  from public.ratings r
  join circle c on c.uid = r.user_id
  where r.updated_at >= now() - interval '30 days'
    and coalesce(r.hidden, false) = false

  union all

  -- ٣ · فيلمٌ شوهد. العنوان والملصق من `follows` لأن `watched_movies` لا
  --     تحملهما؛ ومن شاهد فيلماً فهو في مكتبته — والصفّ بلا عنوان لا
  --     يُرسم أصلاً، فالوصل الداخليّ هنا صيانةٌ لا تقييد
  select w.user_id, 3, 'movie',
         w.movie_tmdb_id, 'movie',
         null::smallint, null::text, f.title, f.poster_path,
         (w.watched_at)::date, 0, 0, w.watched_at
  from public.watched_movies w
  join circle c on c.uid = w.user_id
  join public.follows f
    on  f.user_id    = w.user_id
    and f.tmdb_id    = w.movie_tmdb_id
    and f.media_type = 'movie'
  where w.watched_at >= now() - interval '30 days'

  union all

  -- ٢ · حلقاتٌ شوهدت — **هنا يقع التجميع**: عددُ حلقات اليوم وأعلى موسم
  select w.user_id, 2, 'episodes',
         w.show_tmdb_id, 'tv',
         null::smallint, null::text, f.title, f.poster_path,
         (w.watched_at)::date,
         count(*)::integer,
         max(w.season_number)::integer,
         max(w.watched_at)
  from public.watched_episodes w
  join circle c on c.uid = w.user_id
  join public.follows f
    on  f.user_id    = w.user_id
    and f.tmdb_id    = w.show_tmdb_id
    and f.media_type = 'tv'
  where w.watched_at >= now() - interval '30 days'
  group by w.user_id, w.show_tmdb_id, f.title, f.poster_path, (w.watched_at)::date

  union all

  -- ١ · أُضيف للمكتبة. المتروك لا يُعلن — إعلانُ ما تركه المرء ليس خبراً.
  --
  --     **وحدّ العشرين ليس تجميلاً**: `ImportPanel` (D-041) يستورد مكتبة
  --     TV Time أو Trakt كاملةً في دقيقة، فتُكتب مئات الصفوف بتاريخ اليوم.
  --     من استورد لم «يضف» شيئاً في نظر أصدقائه — نقلَ سجلّاً. فمن تجاوز
  --     عشرين إضافةً في يوم لا تُعلن إضافاته أصلاً: الاستيراد ليس خبراً،
  --     ومئة سطرٍ من شخصٍ واحد تدفن الدائرة كلها.
  select a.user_id, 1, 'add',
         a.tmdb_id, a.media_type,
         null::smallint, null::text, a.title, a.poster_path,
         (a.added_at)::date, 0, 0, a.added_at
  from adds a
  where a.day_adds <= 20
)
select r.id, r.nickname, r.username, r.avatar_url, r.hide_name,
       r.kind, r.tmdb_id, r.media_type, r.rating, r.review,
       r.title, r.poster_path, r.day, r.episode_count, r.top_season, r.at
from (
select x.*,
       -- سقفُ خمسة صفوف للشخص الواحد في اليوم الواحد: من شاهد ثمانية
       -- أعمالٍ في عطلته لا يملك الخطّ وحده. الأقوى يبقى (الترتيب بالأولوية)
       row_number() over (partition by x.id, x.day order by x.pri desc, x.raw_at desc) as rn
from (
  select distinct on (e.uid, e.tmdb_id, e.media_type, e.day)
    e.uid                                                   as id,
    case when coalesce(p.hide_name, false) then null else p.nickname end   as nickname,
    case when coalesce(p.hide_name, false) then null else p.username end   as username,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end as avatar_url,
    coalesce(p.hide_name, false)                            as hide_name,
    e.kind, e.tmdb_id, e.media_type, e.rating, e.review,
    e.title, e.poster_path, e.day,
    -- نافذةُ اليوم كلّه: الصفّ الفائز يأخذ رقم من خسر
    max(e.episode_count) over w                             as episode_count,
    max(e.top_season)    over w                             as top_season,
    max(e.at)            over w                             as at,
    e.pri                                                   as pri,
    e.at                                                    as raw_at
  from ev e
  join public.profiles p on p.id = e.uid
  window w as (partition by e.uid, e.tmdb_id, e.media_type, e.day)
  order by e.uid, e.tmdb_id, e.media_type, e.day, e.pri desc, e.at desc
) x
) r
where r.rn <= 5
order by r.at desc
limit 60;
$$;

revoke all on function public.following_activity_v2() from public;
grant execute on function public.following_activity_v2() to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل — الثلاثة معاً، لا الأول وحده
--
--   ١) الدالّة موجودة:
--      select proname from pg_proc where proname = 'following_activity_v2';
--
--   ٢) تعمل بحسابك وتعيد أنواعاً لا نوعاً واحداً:
--      select kind, count(*) from public.following_activity_v2() group by kind;
--      -- المتوقّع: rate / episodes / movie / add بحسب نشاط من تتابعهم
--
--   ٣) الفهارس الأربعة:
--      select indexname from pg_indexes where schemaname='public'
--        and indexname in ('watched_episodes_user_time_idx',
--                          'watched_movies_user_time_idx',
--                          'follows_user_added_idx',
--                          'ratings_user_updated_idx');
--
--   ٤) **الاستعلام الصحّي لم يتغيّر** — هذا الملف لا يُنشئ جدولاً ولا
--      سياسة، فقائمة `qual='true'` يجب أن تبقى كما هي حرفياً:
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
-- ============================================================
