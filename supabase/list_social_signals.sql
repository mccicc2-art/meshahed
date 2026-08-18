-- ============================================================
--  Loopz — الجرسُ يعرف الإعجابَ والردَّ على رأي القائمة (الهجرة ١١٤)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️⚠️ **الكودُ يُنشر أوّلاً ثم تُشغَّل هذه الهجرة** — لا العكس، للسبب
--  نفسِه الذي كُتب في ١٠٦ حرفاً: **الواجهةُ القديمة لا تعرف النوعين**،
--  **وسلسلةُ الوجهة عندها تنتهي إلى `/u/<username>`** — **فيُرسَل من
--  ضغط «أعجب برأيك في قائمة» إلى صفحةِ الشخص لا إلى القائمة**، ووجهةٌ
--  خاطئةٌ أسوأُ من إشعارٍ متأخّر (D-218/D-181).
--
--  ============ ما الذي كان ناقصاً ============
--
--  **بُني الإعجابُ والردُّ في D-370** (الهجرة ١١٣) **ولا يصلان أحداً**:
--  `my_signals` تحمل سبعةَ أنواعٍ وليس فيها هذان — **فمن رُدَّ عليه في
--  قائمةٍ لا يعلم أبداً**، وهي علّةُ D-218 نفسُها للمرّة الثالثة (ردودُ
--  الأعمال في ٧١، وردودُ الغرف في ٧٩). **وأرخصُ ميزةٍ هي التي بُنيت ولم
--  تُوصَل** (D-262) — **وقد أُعلن هذا ديناً يومَ وُلد** في `05_Todo`،
--  **والدَّينُ المعلَنُ يُشطب يومَ يكتمل لا يُترك يكذب** (D-155).
--
--  ============ 🔴 وما قِيس قبل أن يُكتب سطرٌ واحد ============
--
--  **الدالّةُ الحيّةُ اليومَ تحمل خمسةَ أنواعٍ لا سبعة**:
--    `follow | request | like_review | like_activity | list_review`
--  **و`reply` و`talk_reply` غائبان** — قِيسا في القاعدة نفسِها:
--    select string_agg(m[1],' | ') from pg_proc p,
--      lateral regexp_matches(pg_get_functiondef(p.oid),'select ''([a-z_]+)''','g') m
--    where p.proname='my_signals';
--
--  **والسببُ الهجرةُ ١٠٦ نفسُها**: كُتب جسمُها من نسخةٍ أقدم من ٧١/٧٩،
--  **فأسقطت الفرعين وهي تضيف الثالث** — **ومنذ ذلك اليوم لا يعلم من
--  رُدَّ عليه في عملٍ ولا في غرفةِ نقاشٍ أنه رُدَّ عليه**، وهي علّةُ
--  D-218 بعينها بُعثت من حيث دُفنت.
--
--  ⚠️ **فالفرعان هنا مُعادان لا مُضافان، ويُقالان بصوتٍ عالٍ ولا
--  يُصلَحان صامتين** (D-155): **جسمُ الدالّة يُستبدل كاملاً، فتركُهما
--  خارجَه اختيارٌ لا سهو** — **ولا إصلاحَ صامتٍ ولا إبقاءٌ صامت.**
--  🔑 **والدرسُ**: **الأصلُ في `create or replace` أن يُقرأ الحيُّ أوّلاً
--  لا أن يُنسخ آخرُ ملفٍّ في المستودع** — **والمستودعُ يقول كيف تعمل،
--  والقاعدةُ تقول ما الذي يعمل الآن** (القاعدة ٤ بروحها).
--
--  ============ ولا `drop function` هذه المرّة ============
--
--  🔑 **الأعمدةُ الثلاثةَ عشرةَ نفسُها** — `kind` نصٌّ لا نوعٌ مُعدَّد،
--  **فنوعان جديدان قيمتان في عمودٍ قائم لا توقيعٌ جديد**: `create or
--  replace` وحدَها تكفي، **ولا حذفَ تعريفٍ ولا لحظةَ يكون فيها الجرسُ بلا
--  دالّة** (خلافاً لـ١٠٦ و١١١، وهو فرقٌ يُقال لا يُسكت عنه — D-037).
--
--  ============ الحرّاسُ في الفرعين من يومهما الأوّل ============
--
--  • **العامّةُ وحدَها** (`ul.is_public`) — **وهذا حارسٌ لم يحتجه فرعُ
--    ١٠٦**: هناك المُشعَرُ صاحبُ القائمة ويقرأ قائمتَه خاصّةً كانت أو
--    عامّة، **وهنا المُشعَرُ صاحبُ الرأي** — **وقائمةٌ صارت خاصّةً تفتح
--    له صفحةً لا يرى فيها ما أُشعِر به** (D-063).
--  • **المحجوبُ بعشرة بلاغات لا يُشعِر** (`hidden` — ١١٣).
--  • **ونفسُك لا تُشعِرك**: `<> me.uid` في الفرعين — **وقاعدةُ الإدخال
--    تمنع إعجابَك برأيك أصلاً، والحارسُ هنا لأن القراءةَ لا تتّكل على
--    الكتابة** (D-011).
--  • **والمحظورُ يسقط في المصفاة الأخيرة** — `is_blocked` مرّةً واحدةً
--    لكلِّ الأنواع، حيث هي منذ ٧١.
--
--  ============ و«ردَّ على ردّك» ليس نوعاً ثالثاً ============
--
--  **الحالتان جملةٌ واحدةٌ ووجهةٌ واحدة** — ردٌّ على رأيك، وردٌّ على
--  ردّك تحت رأي غيرك — **فنوعٌ واحد** (نصُّ `reply` في ٧١ حرفاً).
--  **والثانيةُ تُقرأ من `parent_id`** بلا عمودٍ جديدٍ ولا جدول.
-- ============================================================

begin;

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

  -- 🔴 ردَّ عليك في عملٍ (الهجرة ٧١ — D-218) — **مُعادٌ لا مُضاف**
  select 'reply', r.user_id, r.tmdb_id, r.media_type, rt.title, r.created_at,
         null, null
  from public.review_replies r
  left join public.ratings rt
    on rt.user_id = r.review_user_id
   and rt.tmdb_id = r.tmdb_id
   and rt.media_type = r.media_type
  cross join me
  where r.hidden = false
    and r.user_id <> me.uid
    and (
      r.review_user_id = me.uid
      or exists (
        select 1 from public.review_replies p
         where p.id = r.parent_id and p.user_id = me.uid
      )
    )
    and r.created_at >= now() - interval '30 days'

  union all

  -- 🔴 ردَّ عليك في غرفة نقاش (الهجرة ٧٩ — D-259) — **مُعادٌ لا مُضاف**
  select 'talk_reply', r.user_id, r.tmdb_id, r.media_type, r.title, r.created_at,
         null, null
  from public.title_posts r
  cross join me
  where r.hidden = false
    and r.user_id <> me.uid
    and exists (
      select 1 from public.title_posts p
       where p.id = r.parent_id and p.user_id = me.uid
    )
    and r.created_at >= now() - interval '30 days'

  union all

  -- قيّم أحدٌ قائمتك أو كتب عنها (الهجرة ١٠٦)
  select 'list_review', lr.user_id, null, null, ul.name, lr.updated_at,
         ul.id, ul.source_slug
  from public.list_reviews lr
  join public.user_lists ul on ul.id = lr.list_id
  cross join me
  where ul.user_id = me.uid
    and lr.user_id <> me.uid
    and coalesce(lr.hidden, false) = false
    and lr.updated_at >= now() - interval '30 days'

  union all

  -- 🆕 أعجبه رأيُك في قائمة (الهجرة ١١٤ — دَينُ D-370)
  select 'like_list_review', k.liker_id, null, null, ul.name, k.created_at,
         ul.id, ul.source_slug
  from public.list_review_likes k
  join public.user_lists ul on ul.id = k.list_id
  cross join me
  where k.review_user_id = me.uid
    and k.liker_id <> me.uid
    and ul.is_public
    and k.created_at >= now() - interval '30 days'

  union all

  -- 🆕 ردَّ أحدٌ على رأيك في قائمة، أو على ردّك تحت رأيِ غيرك (١١٤)
  select 'list_reply', p.user_id, null, null, ul.name, p.created_at,
         ul.id, ul.source_slug
  from public.list_review_replies p
  join public.user_lists ul on ul.id = p.list_id
  cross join me
  where p.user_id <> me.uid
    and coalesce(p.hidden, false) = false
    and ul.is_public
    and p.created_at >= now() - interval '30 days'
    and (
      p.review_user_id = me.uid
      or exists (
        select 1 from public.list_review_replies q
        where q.id = p.parent_id and q.user_id = me.uid
      )
    )
)
select
  s.kind,
  s.actor_id,
  case when coalesce(pr.hide_name, false) then null else pr.nickname end,
  case when coalesce(pr.hide_name, false) then null else pr.username end,
  case when coalesce(pr.hide_name, false) then null else pr.avatar_url end,
  coalesce(pr.hide_name, false),
  s.tmdb_id, s.media_type, s.title, s.at,
  (me.seen is null or s.at > me.seen) as is_new,
  s.list_id, s.list_slug
from sig s
join public.profiles pr on pr.id = s.actor_id
cross join me
where not public.is_blocked(me.uid, s.actor_id)
order by s.at desc
limit 30;
$$;

revoke all on function public.my_signals() from public;
grant execute on function public.my_signals() to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname='public' and p.proname='my_signals')                    as fn,
--   (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.proname='my_signals'
--        and pg_get_functiondef(p.oid) like '%like_list_review%')              as has_like,
--   (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.proname='my_signals'
--        and pg_get_functiondef(p.oid) like '%list_reply%')                    as has_reply,
--   (select count(*)::int from pg_policies where qual = 'true')                as open_policies;
--   (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
--      lateral regexp_matches(pg_get_functiondef(p.oid),'select ''([a-z_]+)''','g') m
--      where n.nspname='public' and p.proname='my_signals')                    as kinds;
-- المتوقّع: fn = 1 · has_like = 1 · has_reply = 1 · open_policies = 4 · kinds = 9
