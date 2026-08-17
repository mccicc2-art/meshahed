-- ============================================================
--  Loopz — الخيطُ الثالث: كلامُ الناس على القوائم يصل (الهجرة ١٠٦)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️⚠️ **الكودُ يُنشر أوّلاً ثم تُشغَّل هذه الهجرة** — لا العكس.
--  السببُ ملموس: هذه الدوالُّ تبدأ فوراً بإرجاع صفوفٍ **بلا `tmdb_id`**،
--  **وواجهةٌ قديمة سترسم لها رابطاً إلى `/movie/null`** — **ورابطٌ ميّتٌ
--  في خطٍّ اجتماعيّ أسوأُ من صفٍّ غائب** (D-181/D-063).
--
--  ============ ما الذي كان ناقصاً ============
--
--  **تقييمُ القوائم ومراجعتُها بُنيا في D-327** (الهجرة ١٠٣) — **ولا
--  يصلان أحداً**: لا يظهران في خطّ النشاط، **ولا يعلم صاحبُ القائمة أن
--  أحداً قيّمها أصلاً**. **فالحلقةُ مفتوحةٌ عند دورها الأوّل** — وهي
--  بعينها علّةُ D-218 في الردود («من رُدَّ عليه كان لا يعلم أبداً»).
--  **وأرخصُ ميزةٍ هي التي بُنيت ولم تُوصَل** (D-262).
--
--  ============ خيطان قائمان وثالثٌ يُمدُّ إليهما ============
--
--  **ولا سطحَ جديد ولا جدولَ جديد**: الخطُّ موجود (`community_activity`)
--  والجرسُ موجود (`my_signals`) — **فيُوصَّل المصدرُ الثالث إلى البابين
--  القائمين**، تماماً كما وُصِّل `talk_reply` في ٧٩ و`reply` في ٧١.
--  **وبابٌ ثالثٌ لمعنًى له بابان هو ما تمنعه القاعدة ٦.**
--
--  ============ و`drop` هنا لا مفرَّ منها — **وقد أُذن بها** ============
--
--  🔑 **إذنُ أحمد بنصّه: «اكمل»** (على خطّة البند ٨).
--  **`create or replace` لا تغيّر نوعَ ما تُرجعه دالّة** — والعمودان
--  الجديدان في الذيل يعنيان توقيعاً جديداً. **والحذفُ هنا حذفُ تعريفٍ لا
--  حذفُ بيانات**: لا صفَّ يُمسّ، **والدالّةُ تعود في المعاملة نفسِها**
--  (`begin`…`commit`) فلا لحظةَ يكون فيها الخطُّ بلا دالّة.
--
--  ============ الحرّاسُ في الفرع الجديد من يومه الأوّل ============
--
--  • **العامّةُ وحدَها** — مراجعةُ قائمةٍ خاصّةٍ لا تُقرأ أصلاً (نصُّ ١٠٣).
--  • **المكتوبةُ وحدَها في الخطّ** — تقييمٌ بلا نصٍّ رقمٌ لا رأي، **وخطٌّ
--    من أرقامٍ بلا كلام لا يُقرأ** (نصُّ `community_feed` حرفاً).
--    ⚠️ **والجرسُ يأخذ التقييمَ المجرّد أيضاً**: هناك الخبرُ «قيّم أحدٌ
--    قائمتك» وهو خبرٌ تامّ بلا نصّ — **سطحان فحدّان** (D-224).
--  • **المحجوبُ بعشرة بلاغات لا يظهر** (`hidden` — ١٠٣).
--  • **وصاحبُ الحساب مستثنًى**: رأيُك تقرؤه في قائمته، **ووجودُه في
--    خطّك يزاحم غيرَك** (نصُّ `community_feed`).
--  • **والمحظورُ لا يُشعِر ولا يظهر** — `is_blocked` في الفرعين.
--    ⚠️ **وفرعُ التقييمات القديم بلا هذا الحارس** (كما وُلد في ٢٧):
--    **لا يُصلَح صامتاً في هجرةٍ عن شيءٍ آخر** — يُعلَن ديناً ويُصلَح
--    بذاته (D-155: الإعلانُ يُشطب يومَ يكتمل لا يُترك يكذب).
--
--  ============ و`list_slug` عمودٌ ثالث، وهو دَينُ D-328 نفسُه ============
--
--  اسمُ قائمةِ لوبز مخزَّنٌ بالعربية (`upsert_curated_list`) **والهويّةُ
--  في الـslug** — **فيُترجَم عند العرض** (D-147/D-273). **وبلا هذا
--  العمود كان الجرسُ سيقول «قيّم فلانٌ قائمتك أفضل ٢٥٠ فيلماً» لقارئٍ
--  إنجليزيّ.**
-- ============================================================

begin;

-- ============================================================
--  ١) خطُّ المجتمع يحمل صفَّ القائمة
--
--  **الشكلُ شكلُ صفِّ التقييم نفسِه** عمداً (كما وُلد في ٢٧): المستدعي
--  يمرّره إلى نفس المحوّل — **ولو أعدنا شكلاً خاصّاً لاحتاج فرعاً خاصّاً
--  في كلِّ قارئ**، وهو بعينه الانحرافُ الذي يوجد `topChart.ts` لمنعه.
--  **و`tmdb_id = 0` لا `null`**: العمودُ `integer not null` عند القارئ
--  منذ D-123، **و`list_id` هو ما يقول «هذا صفُّ قائمة» لا صفرُ العمل.**
-- ============================================================
drop function if exists public.community_activity();

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
  updated_at  timestamptz,
  list_id     uuid,
  list_name   text,
  list_slug   text
)
language sql
stable
security definer
set search_path = public
as $$
  with rows as (
    -- كلامُ الناس على الأعمال — كما هو منذ الهجرة ٢٧، بذيلٍ فارغ
    select
      r.user_id as id,
      r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path,
      r.updated_at,
      null::uuid as list_id,
      null::text as list_name,
      null::text as list_slug
    from public.ratings r
    where auth.uid() is not null
      and r.user_id <> auth.uid()
      and length(btrim(coalesce(r.review, ''))) > 0
      and coalesce(r.hidden, false) = false

    union all

    -- 🆕 كلامُ الناس على القوائم (الهجرة ١٠٣ → الخيط الثالث)
    select
      lr.user_id,
      0, 'movie', lr.rating, lr.body, ul.name, null::text,
      lr.updated_at,
      ul.id, ul.name, ul.source_slug
    from public.list_reviews lr
    join public.user_lists ul on ul.id = lr.list_id
    where auth.uid() is not null
      and lr.user_id <> auth.uid()
      and length(btrim(coalesce(lr.body, ''))) > 0
      and coalesce(lr.hidden, false) = false
      and ul.is_public
      and not public.is_blocked(auth.uid(), lr.user_id)
  )
  select
    x.id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    x.tmdb_id, x.media_type, x.rating, x.review, x.title, x.poster_path,
    x.updated_at, x.list_id, x.list_name, x.list_slug
  from rows x
  join public.profiles p on p.id = x.id
  order by x.updated_at desc
  limit 60;
$$;

revoke all on function public.community_activity() from public;
grant execute on function public.community_activity() to authenticated;

-- ============================================================
--  ٢) الجرسُ يعرف صاحبَ القائمة
--
--  **مصدرٌ سادسٌ في نفس الدالّة** — ولا دالّةَ ثانية: **الجرسُ نداءٌ
--  واحدٌ عند الفتح** (D-125)، **ونداءان لجرسٍ واحد ضِعفُ الكلفة لنصف
--  الخبر.**
--
--  ⚠️ **والوجهةُ عمودٌ لا اجتهاد**: `list_id` يسافر مع الصفّ **لأن هذا
--  النوعَ وحدَه يفتح `/lists/<id>`** — والنوعُ في هذا الجرس **وجهةٌ قبل
--  أن يكون جملة** (D-218/D-259).
-- ============================================================
drop function if exists public.my_signals();

create or replace function public.my_signals()
returns table (
  kind        text,
  actor_id    uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  title       text,
  at          timestamptz,
  is_new      boolean,
  list_id     uuid,
  list_slug   text
)
language sql
stable
security definer
set search_path = public
as $$
with me as (
  select auth.uid() as uid,
         (select p.notif_seen_at from public.profiles p where p.id = auth.uid()) as seen
),
sig as (
  -- تابعك
  select 'follow'::text as kind, f.follower_id as actor_id,
         null::integer as tmdb_id, null::text as media_type, null::text as title,
         f.created_at as at,
         null::uuid as list_id, null::text as list_slug
  from public.user_follows f, me
  where f.following_id = me.uid
    and f.created_at >= now() - interval '30 days'

  union all

  -- طلب متابعتك (حسابٌ خاص — D-058)
  select 'request', r.requester_id, null, null, null, r.created_at, null, null
  from public.follow_requests r, me
  where r.target_id = me.uid
    and r.created_at >= now() - interval '30 days'

  union all

  -- أعجبه رأيك. العنوان من صفّ تقييمك نفسه (لا يُخزَّن في جدول الإعجاب)
  select 'like_review', l.liker_id, l.tmdb_id, l.media_type, rt.title, l.created_at,
         null, null
  from public.review_likes l
  left join public.ratings rt
    on rt.user_id = l.review_user_id
   and rt.tmdb_id = l.tmdb_id
   and rt.media_type = l.media_type
  cross join me
  where l.review_user_id = me.uid
    and l.created_at >= now() - interval '30 days'

  union all

  -- أعجبه حدثك (الهجرة ٤٦). العنوان من مكتبتك
  select 'like_activity', l.liker_id, l.tmdb_id, l.media_type, fo.title, l.created_at,
         null, null
  from public.activity_likes l
  left join public.follows fo
    on fo.user_id = l.actor_id
   and fo.tmdb_id = l.tmdb_id
   and fo.media_type = l.media_type
  cross join me
  where l.actor_id = me.uid
    and l.created_at >= now() - interval '30 days'

  union all

  -- 🆕 قيّم أحدٌ قائمتك أو كتب عنها (الهجرة ١٠٣ → الخيط الثالث)
  --
  -- **والتقييمُ المجرّد يُشعِر هنا وإن لم يدخل الخطّ**: «قيّم أحدٌ
  -- قائمتك» خبرٌ تامٌّ بلا نصّ، **وخطٌّ من أرقامٍ لا يُقرأ** — سطحان
  -- فحدّان (D-224).
  select 'list_review', lr.user_id, null, null, ul.name, lr.updated_at,
         ul.id, ul.source_slug
  from public.list_reviews lr
  join public.user_lists ul on ul.id = lr.list_id
  cross join me
  where ul.user_id = me.uid
    and lr.user_id <> me.uid
    and coalesce(lr.hidden, false) = false
    and lr.updated_at >= now() - interval '30 days'
)
select
  s.kind,
  s.actor_id,
  case when coalesce(p.hide_name, false) then null else p.nickname end,
  case when coalesce(p.hide_name, false) then null else p.username end,
  case when coalesce(p.hide_name, false) then null else p.avatar_url end,
  coalesce(p.hide_name, false),
  s.tmdb_id, s.media_type, s.title, s.at,
  (me.seen is null or s.at > me.seen) as is_new,
  s.list_id, s.list_slug
from sig s
join public.profiles p on p.id = s.actor_id
cross join me
where not public.is_blocked(me.uid, s.actor_id)
order by s.at desc
limit 30;
$$;

revoke all on function public.my_signals() from public;
grant execute on function public.my_signals() to authenticated;

-- ============================================================
--  ٣) العدّادُ يُعاد بلا تغييرٍ في جسمه
--
--  **لا تعتمد عليه Postgres بتبعيّةٍ مسجَّلة** (جسمُ الدالّة نصٌّ في
--  `$$`) — **فحذفُ `my_signals` لا يسقطه**، وإعادتُه هنا **حزامٌ ثانٍ**
--  كي لا يبقى مخطّطٌ قديمٌ مخبّأً لصفٍّ صار له عمودان.
-- ============================================================
create or replace function public.unread_signals()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.my_signals() s where s.is_new;
$$;

revoke all on function public.unread_signals() from public;
grant execute on function public.unread_signals() to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc
--      where proname in ('community_activity','my_signals','unread_signals')) as fns,
--   (select count(*)::int from pg_proc p, unnest(p.proargnames) n
--      where p.proname = 'community_activity'
--        and n in ('list_id','list_name','list_slug'))                        as feed_cols,
--   (select count(*)::int from pg_policies where qual = 'true')               as open_policies;
-- المتوقّع: fns = 3 · feed_cols = 3 · open_policies = 4
--
-- وتعمل بحسابك:
--   select kind, count(*) from public.my_signals() group by kind;
--   select count(*) from public.community_activity() where list_id is not null;
