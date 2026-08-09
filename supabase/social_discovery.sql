-- ============================================================
--  Loopz — علاج الفراغ ونشاط الدائرة (D-126 · D-127) — رقم ٤٨
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّله **قبل** نشر خطوة «تابع ٣ أشخاص» وسطر «من دائرتك». وإن لم
--  يُشغَّل فلا شيء ينكسر: الواجهتان تسقطان صامتتين (نمط D-113) —
--  خطوةُ التهيئة لا تظهر، وسطرُ صفحة العمل لا يُرسم.
--
--  ملفٌّ واحد لدالّتين لأن السؤال واحد: **ماذا يفعل من حولك؟** الأولى
--  تجيبه قبل أن تكون لك دائرة، والثانية بعد أن تصير لك واحدة.
--
--  لا جدول جديد، ولا سياسة جديدة — دالّتا قراءةٍ definer وفهرسان.
-- ============================================================

-- ============================================================
--  ٠) فهرسان — شرطُ ألّا يمسح الاستعلامان جدولين كاملين
--
--  فهارس اليوم كلّها تبدأ بـ`user_id`: تصلح لسؤال «ماذا في مكتبة فلان»
--  ولا تصلح لعكسه «من في مكتبته هذا العمل» — وهو سؤال الدالّتين معاً.
--  (`ratings` مفهرسٌ على العنوان منذ security2.sql، و`watched_episodes`
--  على (user_id, show_tmdb_id) فيخدم القفزَ من الدائرة إلى العمل.)
-- ============================================================
create index if not exists follows_title_idx
  on public.follows (tmdb_id, media_type);

create index if not exists watched_mv_title_idx
  on public.watched_movies (movie_tmdb_id);

-- ============================================================
--  ١) D-126 — «أشخاص لمتابعتهم»
--
--  الفراغ في هذا التطبيق ليس عطلاً في الفيد، بل حسابٌ دائرته صفر. وأسوأ
--  علاجٍ له فيدٌ عامّ (D-059 قتله): غرباء يملأون الشاشة فيتعلّم المستخدم
--  أن الصفحة ليست له. العلاج من الجذر: **اقترح عليه من يشبه ذوقه**، مرّة
--  في التهيئة قبل أن يدخل، ومرّة داخل الفيد ما دام هزيلاً.
--
--  **البذرة وسيطٌ لا افتراض**: في التهيئة يمرّرها العميل — الأعمال التي
--  ضغطها المستخدم قبل أن تُكتب في مكتبته أصلاً (المتابعات تُحفظ في نهاية
--  الشاشة، فالاقتراح قبلها يقرأ مكتبةً فارغة). وفي الفيد تُترك فارغةً
--  فتُقرأ من مكتبته الفعليّة. سطحان، دالّةٌ واحدة.
--
--  ثلاثة حرّاس، كلّها هنا لا في الصفحة:
--   • `can_view_profile` — لا يُقترح من لا تُرى صفحته. وليست تجميلاً:
--     عدّاد «يشاركك ٣ أعمال» **يصف مكتبة الآخر**، فحسابُه على حسابٍ خاص
--     تسريبٌ بالطرح. من أغلق حسابه لا يُقترح ولا يُعدّ.
--   • الحظر في الاتجاهين (`is_blocked`) — ومن تتابعه أو أرسلتَ له طلباً
--     خارج القائمة: اقتراحُ من تتابعه أصلاً يقول إن التطبيق لا يعرفك.
--   • **من أخفى اسمه لا يُقترح** (D-011). بطاقةُ متابعةٍ بلا اسمٍ ولا
--     صورة تطلب من المستخدم أن يثق بمجهول — والإخفاء اختيارُ صاحبه
--     ليُقرأ رأيه لا ليُتابَع شخصه.
--
--  والذيل احتياطٌ لا حشو: من لا يتقاطع ذوقه مع أحد (قاعدةٌ صغيرة، أو
--  بذرةٌ نادرة) يرى **الأكثر متابَعةً** بدل شاشةٍ فارغة — و`shared = 0`
--  يخبر الواجهة ألّا تكتب سطر السبب. البِركة مقصوصة عند خمسين من كل
--  جهة كي لا تتحوّل الدالّة إلى مسحٍ لجدول المتابعات كلّه.
-- ============================================================
create or replace function public.people_to_follow(
  seed_ids integer[] default null,
  want     integer   default 6
)
returns table (
  id         uuid,
  nickname   text,
  username   text,
  avatar_url text,
  hide_name  boolean,
  shared     integer,
  followers  integer
)
language sql
stable
security definer
set search_path = public
as $$
with me as (
  select auth.uid() as uid
),
seeds as (
  -- بذرةٌ صريحة من شاشة التهيئة، وإلا فمكتبتي (أحدث أربعةٍ وعشرين)
  select distinct s.tmdb_id
  from unnest(
    coalesce(
      seed_ids,
      array(
        select f.tmdb_id
        from public.follows f, me
        where me.uid is not null
          and f.user_id = me.uid
        order by f.added_at desc
        limit 24
      )
    )
  ) as s(tmdb_id)
),
overlap as (
  -- تقاطع الذوق: كم عملاً من البذرة في مكتبته
  select f.user_id as id, count(*)::integer as shared
  from public.follows f
  join seeds s on s.tmdb_id = f.tmdb_id, me
  where me.uid is not null
    and f.user_id <> me.uid
  group by f.user_id
  order by count(*) desc
  limit 50
),
popular as (
  -- الاحتياط: الأكثر متابَعةً في القاعدة
  select uf.following_id as id, count(*)::integer as followers
  from public.user_follows uf
  group by uf.following_id
  order by count(*) desc
  limit 50
),
pool as (
  select id from overlap
  union
  select id from popular
)
select
  p.id,
  p.nickname,
  p.username,
  p.avatar_url,
  false                          as hide_name,
  coalesce(o.shared, 0)          as shared,
  coalesce(pp.followers, 0)      as followers
from pool x
join public.profiles p on p.id = x.id
left join overlap o  on o.id  = x.id
left join popular pp on pp.id = x.id, me
where me.uid is not null
  and p.id <> me.uid
  and coalesce(p.hide_name, false) = false
  and public.can_view_profile(p.id)
  and not public.is_blocked(me.uid, p.id)
  and not exists (
    select 1 from public.user_follows uf
    where uf.follower_id = me.uid and uf.following_id = p.id
  )
  and not exists (
    select 1 from public.follow_requests fr
    where fr.requester_id = me.uid and fr.target_id = p.id
  )
order by coalesce(o.shared, 0) desc, coalesce(pp.followers, 0) desc, p.id
limit least(greatest(coalesce(want, 6), 1), 12);
$$;

revoke all on function public.people_to_follow(integer[], integer) from public;
grant execute on function public.people_to_follow(integer[], integer) to authenticated;

-- ============================================================
--  ٢) D-127 — «من دائرتك» في صفحة العمل
--
--  الفيد يقول «ماذا شاهدت دائرتك» ويُقرأ مرّةً ثم يمضي. صفحةُ العمل
--  تُفتح لحظةَ القرار: أشاهده أم لا؟ ونفس البيانات هناك تجيب سؤالاً
--  آخر — «هل جرّبه أحدٌ أثق به؟». مكانٌ ثانٍ لبياناتٍ موجودة، بلا مصدرٍ
--  جديد ولا جدول.
--
--  **قاعدتان أمنيّتان لا تُخترقان:**
--
--   ١) العدّ **من داخل definer** يعدّ المرئيّ وحده (`can_view_profile`
--      + الحظر). العدّاد الساذج — «كم شخصاً أتابعه شاهد هذا» بلا حارس —
--      يسرّب مكتبةً خاصّة بالطرح: افتح صفحتين، قارن الرقمين، عرفتَ ما
--      شاهده صاحب الحساب المغلق.
--
--   ٢) **يُكتم تحت ثلاثة.** رقمٌ يقول «واحدٌ ممن تتابعهم شاهده» في حسابٍ
--      تتابع فيه ثلاثة أشخاص = تسميةٌ صريحة لشخصٍ بعينه. والمتوسّط
--      كذلك: متوسّطُ مقيّمٍ واحد هو تقييمه. فالعتبة على العدّادين معاً
--      لا على أحدهما — والصفر يعني «لا تُظهر السطر» لا «لا أحد».
--
--  «شاهده» ثلاثة مصادر: فيلمٌ مؤشَّر · حلقةٌ واحدة على الأقل · أو تقييمٌ
--  ظاهر. من قيّم فقد شاهد — والمخفيّ بالبلاغات خارجٌ كما في الفيد.
-- ============================================================
create or replace function public.title_circle(t_id integer, m_type text)
returns table (
  watchers   integer,
  raters     integer,
  avg_rating numeric
)
language sql
stable
security definer
set search_path = public
as $$
with me as (
  select auth.uid() as uid
),
circle as (
  select uf.following_id as uid
  from public.user_follows uf, me
  where me.uid is not null
    and m_type in ('tv', 'movie')
    and uf.follower_id = me.uid
    and public.can_view_profile(uf.following_id)
    and not public.is_blocked(me.uid, uf.following_id)
),
seen as (
  select c.uid
  from circle c
  where (
      m_type = 'movie'
      and exists (
        select 1 from public.watched_movies w
        where w.user_id = c.uid and w.movie_tmdb_id = t_id
      )
    )
    or (
      m_type = 'tv'
      and exists (
        select 1 from public.watched_episodes w
        where w.user_id = c.uid and w.show_tmdb_id = t_id
      )
    )
    or exists (
      select 1 from public.ratings r
      where r.user_id = c.uid
        and r.tmdb_id = t_id
        and r.media_type = m_type
        and coalesce(r.hidden, false) = false
    )
),
rated as (
  select r.rating
  from public.ratings r
  join circle c on c.uid = r.user_id
  where r.tmdb_id = t_id
    and r.media_type = m_type
    and coalesce(r.hidden, false) = false
    and r.rating is not null
),
tally as (
  select
    (select count(*) from seen)::integer  as w,
    (select count(*) from rated)::integer as r,
    (select avg(rating) from rated)       as a
)
select
  case when tally.w >= 3 then tally.w else 0 end,
  case when tally.r >= 3 then tally.r else 0 end,
  case when tally.r >= 3 then round(tally.a::numeric, 1) else null end
from tally;
$$;

revoke all on function public.title_circle(integer, text) from public;
grant execute on function public.title_circle(integer, text) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل — الأربعة معاً، لا الأول وحده
--
--   ١) الدالّتان موجودتان:
--      select proname from pg_proc
--      where proname in ('people_to_follow', 'title_circle');
--
--   ٢) الاقتراح يعمل بحسابك ولا يقترح من تتابعه:
--      select username, shared, followers from public.people_to_follow(null, 6);
--      -- المتوقّع: أشخاصٌ لا تتابعهم؛ و`shared` رقمٌ أو صفرٌ للاحتياط
--
--   ٣) سطر الدائرة يكتم تحت ثلاثة:
--      select * from public.title_circle(1396, 'tv');
--      -- المتوقّع على حسابٍ دائرتُه صغيرة: (0, 0, null) — وهذا صحيح
--
--   ٤) الفهرسان:
--      select indexname from pg_indexes where schemaname='public'
--        and indexname in ('follows_title_idx', 'watched_mv_title_idx');
--
--   ٥) **الاستعلام الصحّي لم يتغيّر** — هذا الملف لا يُنشئ جدولاً ولا
--      سياسة، فقائمة `qual='true'` يجب أن تبقى كما هي حرفياً:
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
--      -- المتوقَّع: user_follows · communities · imdb_ratings
--        (+ سياستا القوائم العامّة)
-- ============================================================
