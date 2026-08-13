-- ============================================================
--  Loopz — الردُّ يصل صاحبه (هجرة 71، D-218)
--  شغّلها في Supabase → SQL Editor بعد talk_counters.sql (70)
--
--  **الثغرةُ التي أُغلقت، بحجمها الحقيقيّ:** `SignalKind` كانت
--  `follow · request · like_review · like_activity` — **ولا `reply` فيها**.
--  أي أن **من رُدَّ عليه لا يعلم أبداً**، **فتموت المحادثةُ عند دورها
--  الأول**: يكتب فلانٌ رأياً، ويردّ عليه آخر، ولا يعود صاحبُ الرأي فلا
--  يردّ. **وهذا ليس نقصَ ميزةٍ بل عطلٌ في الحلقة نفسِها** — ردودٌ تعمل منذ
--  D-193 ولا أحد يعلم بها.
--
--  **ولا جدولَ جديداً ولا كتابةً** — نفسُ مبدأ D-125 حرفاً: الإشارةُ
--  موجودةٌ أصلاً في `review_replies`، **والجرسُ يقرؤها عند فتحه** ويقارنها
--  بختم `profiles.notif_seen_at`. **فمصدرٌ خامس في دالّةٍ قائمة، لا بناءٌ
--  ثانٍ.**
--
--  **حالتان تُشعِران، ونوعٌ واحدٌ يجمعهما:**
--    ١) ردٌّ على **رأيك** (`review_user_id = me`).
--    ٢) ردٌّ على **ردّك** (`parent_id` يشير إلى ردٍّ كتبتَه).
--  **ونوعان لجملتين متقاربتين ترفٌ يُدفع ثمنُه في `i18n` وفي الرسم**؛
--  والجملةُ الصادقة «ردّ عليك في {العمل}» تصحّ في الحالتين.
--
--  ⚠️ **وثلاثةُ قيودٍ تُقال بالاسم:**
--    • **لا يُشعِر نفسَه** (`r.user_id <> me.uid`) — الردُّ على ردّك في
--      خيطك أشيعُ من غيره، **وبلا هذا القيد يمتلئ جرسُك بك.**
--    • **المخفيُّ لا يُشعِر** (`hidden = false`) — كما لا يُعرض.
--    • **والمحظورُ لا يُشعِر** — الحارسُ في ذيل الدالّة يشمل المصدرَ
--      الجديد بلا سطرٍ إضافي.
--
--  **والعنوانُ من صفّ التقييم** (`ratings.title`) كما في `like_review` —
--  **لا يُخزَّن في جدول الردود**، و`left join` كي **لا يسقط الإشعار إن
--  حُذف التقييمُ وبقي الخيط**.
--
--  آمنٌ للإعادة.
-- ============================================================

begin;

/* فهرسٌ للقراءة الجديدة: «ردودٌ على رأيي» — العمودان معاً لأن الشرط
   عليهما، والزمنُ لأن النافذةَ ثلاثون يوماً */
create index if not exists review_replies_to_me_idx
  on public.review_replies (review_user_id, created_at);

/* و«ردودٌ على ردّي» تمرّ عبر `parent_id` — وهو بلا فهرسٍ حتى الآن */
create index if not exists review_replies_parent_idx
  on public.review_replies (parent_id);

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
  is_new      boolean
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
         f.created_at as at
  from public.user_follows f, me
  where f.following_id = me.uid
    and f.created_at >= now() - interval '30 days'

  union all

  -- طلب متابعتك (حسابٌ خاص — D-058)
  select 'request', r.requester_id, null, null, null, r.created_at
  from public.follow_requests r, me
  where r.target_id = me.uid
    and r.created_at >= now() - interval '30 days'

  union all

  -- أعجبه رأيك. العنوان من صفّ تقييمك نفسه (لا يُخزَّن في جدول الإعجاب)
  select 'like_review', l.liker_id, l.tmdb_id, l.media_type, rt.title, l.created_at
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
  select 'like_activity', l.liker_id, l.tmdb_id, l.media_type, fo.title, l.created_at
  from public.activity_likes l
  left join public.follows fo
    on fo.user_id = l.actor_id
   and fo.tmdb_id = l.tmdb_id
   and fo.media_type = l.media_type
  cross join me
  where l.actor_id = me.uid
    and l.created_at >= now() - interval '30 days'

  union all

  -- 🆕 ردَّ عليك (D-218): على رأيك **أو** على ردّك — والعنوان من صفّ
  -- التقييم المردود عليه، و`left join` كي لا يسقط الإشعار إن حُذف
  select 'reply', r.user_id, r.tmdb_id, r.media_type, rt.title, r.created_at
  from public.review_replies r
  left join public.ratings rt
    on rt.user_id = r.review_user_id
   and rt.tmdb_id = r.tmdb_id
   and rt.media_type = r.media_type
  cross join me
  where r.hidden = false
    /* **ولا يُشعِر نفسَه**: الردُّ على ردّك في خيطك أشيعُ من غيره */
    and r.user_id <> me.uid
    and (
      /* ردٌّ على رأيك */
      r.review_user_id = me.uid
      /* أو ردٌّ على ردٍّ كتبتَه أنت */
      or exists (
        select 1 from public.review_replies p
         where p.id = r.parent_id and p.user_id = me.uid
      )
    )
    and r.created_at >= now() - interval '30 days'
)
select
  s.kind,
  s.actor_id,
  case when coalesce(p.hide_name, false) then null else p.nickname end,
  case when coalesce(p.hide_name, false) then null else p.username end,
  case when coalesce(p.hide_name, false) then null else p.avatar_url end,
  coalesce(p.hide_name, false),
  s.tmdb_id, s.media_type, s.title, s.at,
  (me.seen is null or s.at > me.seen) as is_new
from sig s
join public.profiles p on p.id = s.actor_id
cross join me
where not public.is_blocked(me.uid, s.actor_id)
order by s.at desc
limit 30;
$$;

revoke all on function public.my_signals() from public;
grant execute on function public.my_signals() to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select kind, count(*)::int from public.my_signals() group by 1 order by 2 desc;
-- select public.unread_signals();
-- -- الفهرسان:
-- select indexname from pg_indexes
--  where tablename = 'review_replies'
--    and indexname in ('review_replies_to_me_idx','review_replies_parent_idx');
--
-- ⚠️ **ولا جدولَ ولا سياسةَ من هذه الهجرة** — والسياساتُ المفتوحة تبقى
--    **أربعاً**:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
