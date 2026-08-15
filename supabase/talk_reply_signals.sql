-- ============================================================
--  ٧٩ — talk_reply_signals · الردُّ في الغرفة يصل صاحبه (D-259)
--  تُشغَّل بعد title_talk.sql (78)
--
--  **طلبُ أحمد بنصّه:** «نعم، إشعار لمن يردّ على تعليقي داخل الغرفة».
--  **وهو دَينٌ أعلنتُه في `05` يوم شُحنت الغرفة**: الشجرةُ تعمل، **ومن
--  رُدَّ عليه لا يعلم** — وهو حرفاً عطلُ D-218 نفسُه في سطحٍ جديد:
--  **حلقةٌ تموت عند دورها الأوّل.**
--
--  ================= ولا جدولَ ولا كتابة =================
--
--  **نفسُ مبدأ D-125/D-218:** الإشارةُ موجودةٌ أصلاً في `title_posts`،
--  **والجرسُ يقرؤها عند فتحه** ويقارنها بختم `profiles.notif_seen_at`.
--  **فمصدرٌ سادسٌ في دالّةٍ قائمة، لا بناءٌ ثانٍ.** و`unread_signals()`
--  تعدّ من `my_signals()` نفسِها **فتلتقط المصدرَ الجديد بلا سطر**.
--
--  ================= ولماذا نوعٌ جديد لا `reply` =================
--
--  ⚠️ **لأن الوجهةَ تختلف، والنوعُ في هذا الجرس وجهةٌ قبل أن يكون جملة**
--  (D-218): `reply` تفتح **صفحةَ تعليقك** (`/review/…` — D-257)،
--  **وردُّ الغرفة لا تعليقَ له يُفتح** — بيتُه `‎/talk/<type>/<id>`.
--  **ونوعٌ واحدٌ بوجهتين كان سيرسل نصفَ الإشعارات إلى صفحةٍ لا يوجد فيها
--  ما رُدَّ عليه** — وهو بعينه العيبُ الذي صحّحته D-257 حين كانت `reply`
--  تفتح `‎/talk`. **فالدرسُ يُطبَّق يومَ يتكرّر، لا يُقرأ ويُنسى.**
--
--  ================= والمِرساةُ `parent_id` وحدَه =================
--
--  في `review_replies` مرساتان: «ردٌّ على رأيك» و«ردٌّ على ردّك».
--  **وفي الغرفة واحدةٌ فقط**: الغرفةُ **لا صاحبَ لها** (D-254)، فلا معنى
--  لـ«ردَّ على غرفتك». **ومن كتب جذراً فردَّ عليه أحدٌ فـ`parent_id` هو
--  الرابط** — لا فرقَ بين جذرٍ وردٍّ هنا، وكلاهما صفٌّ في `title_posts`.
--
--  **وثلاثةُ القيود كما هي حرفاً:** لا يُشعِر نفسَه · والمخفيُّ لا
--  يُشعِر · والمحظورُ لا يُشعِر (حارسُ ذيل الدالّة يشمله بلا سطر).
--
--  **والعنوانُ من الصفّ نفسِه** (`title_posts.title`) لا بـ`join`:
--  الجدولُ يحمل العنوانَ مع كل مشاركة منذ الهجرة ٧٨ (نمطُ `ratings`،
--  D-048) — **فمصدرٌ سادسٌ بلا انضمامٍ سادس.**
--
--  آمنةٌ للإعادة، ولا جدولَ ولا سياسةَ منها: **السياساتُ المفتوحة تبقى
--  أربعاً.**
-- ============================================================

begin;

/* فهرسُ القراءة الجديدة: «مَن ردَّ على مشاركتي» يمرّ عبر `parent_id`.
   **وهو موجودٌ منذ ٧٨** (`title_posts_parent_idx`) — يُعاد التأكيد
   لأن الهجرة تُقرأ وحدها يوماً، **و`if not exists` تجعله بلا ثمن.** */
create index if not exists title_posts_parent_idx
  on public.title_posts (parent_id);

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

  -- ردَّ عليك (D-218): على رأيك **أو** على ردّك
  select 'reply', r.user_id, r.tmdb_id, r.media_type, rt.title, r.created_at
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

  -- 🆕 ردَّ عليك في غرفة نقاش (D-259، الهجرة ٧٩)
  select 'talk_reply', r.user_id, r.tmdb_id, r.media_type, r.title, r.created_at
  from public.title_posts r
  cross join me
  where r.hidden = false
    /* **ولا يُشعِر نفسَه** — والشجرةُ تجعل الردَّ على نفسك أشيعَ ممّا
       كان في الخيط المسطّح: من فتح فرعاً وأكمله يردّ على نفسه مراراً */
    and r.user_id <> me.uid
    /* **والمرساةُ واحدة**: مشاركةٌ كتبتُها ورُدَّ عليها */
    and exists (
      select 1 from public.title_posts p
       where p.id = r.parent_id and p.user_id = me.uid
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
--  التحقّق بعد التشغيل — صفٌّ واحدٌ مجمَّع (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_indexes
--     where tablename='title_posts' and indexname='title_posts_parent_idx') as idx,
--   (select count(*)::int from public.my_signals())                          as signals,
--   (select public.unread_signals())                                         as unread,
--   (select count(*)::int from pg_policies
--     where schemaname='public' and qual='true')                             as open_policies;
-- -- المتوقَّع: idx=1 | open_policies=4
