-- ============================================================
--  Loopz — جرسُ الإشعارات: عدٌّ عند الفتح، بلا جدولٍ وبلا كتابة (D-125)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md) — رقم ٤٧
--
--  ⚠️ شغّله **قبل** نشر واجهة الجرس.
--  ⚠️ يعتمد على `activity_likes` (الهجرة ٤٦).
--
--  الحلقة الاجتماعية نصفُها كان مفقوداً: من أعجب بتقييمك أو تابعك لا
--  يصلك خبرُه أبداً، فلا سبب يعيدك. وPush خارج نطاق `03` اليوم — فالجرس
--  داخل التطبيق هو نصفُ الحلقة الممكن الآن.
--
--  **ولا جدول إشعارات.** كتابةُ صفٍّ مع كل إعجابٍ ومتابعة تعني كتابةً على
--  أكثر مسارٍ ضغطاً في التطبيق، وتخزينَ ما يُقرأ مرّةً واحدة. الإشارات
--  موجودةٌ أصلاً في جداولها (متابعات، إعجابات، طلبات) — فالجرس **يقرأها
--  عند فتحه** ويقارنها بختمٍ واحد: `profiles.notif_seen_at`.
-- ============================================================

-- ============================================================
--  ١) الختم — عمودٌ واحد على الملف
--
--  «آخر مرّة فتحتُ فيها الجرس». كلُّ ما بعده جديد. NULL = لم يُفتح قطّ،
--  فكلّ ما في النافذة جديد — وهو السلوك الصحيح لحسابٍ لم يرَ الجرس بعد.
-- ============================================================
alter table public.profiles
  add column if not exists notif_seen_at timestamptz;

-- ============================================================
--  ٢) الإشارات — أربعة مصادر في نداءٍ واحد
--
--  متابِعٌ جديد · طلبُ متابعة · إعجابٌ برأيك · إعجابٌ بحدثك.
--
--  ثلاثة قيود مقصودة:
--   • **بلا معرّف مُعجِبٍ مكشوف؟ لا** — هنا العكس: الإشعار بلا فاعلٍ لا
--     معنى له («أعجب أحدهم» ليست خبراً). الفاعل يظهر باسمه، **وإخفاء
--     الاسم يُنفَّذ هنا كما في كل دوال القراءة (D-011)**.
--   • **المحظور لا يُشعِر** — `is_blocked` في كل مصدر.
--   • **النافذة ثلاثون يوماً وسقفها ثلاثون سطراً**: الجرس ذاكرةٌ قصيرة
--     لا أرشيف؛ الأرشيف هو الصفحات نفسها.
-- ============================================================
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

-- ============================================================
--  ٣) العدّاد وحده — للشارة، بلا حمل الأسطر
--
--  الشارة تُرسم في كل صفحة؛ حملُ ثلاثين سطراً بأسمائها وعناوينها لرسم
--  رقمٍ واحد هدرٌ. هذه تعدّ فقط، والأسطر تُطلب عند فتح الورقة وحدها.
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

-- ============================================================
--  ٤) ختمُ القراءة — فعلٌ واحد يملكه صاحبه
--
--  سياسة `profiles` تسمح لصاحب الصفّ بالتحديث، فلا حاجة إلى definer:
--  الدالّة موجودة كي يكون للفعل اسمٌ واحد لا تحديثَ عمودٍ مبعثراً.
-- ============================================================
create or replace function public.mark_signals_seen()
returns void
language sql
volatile
security invoker
set search_path = public
as $$
  update public.profiles set notif_seen_at = now() where id = auth.uid();
$$;

revoke all on function public.mark_signals_seen() from public;
grant execute on function public.mark_signals_seen() to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل:
--
--   ١) العمود:
--      select column_name from information_schema.columns
--      where table_schema='public' and table_name='profiles'
--        and column_name='notif_seen_at';                 -- صفٌّ واحد
--
--   ٢) الدوال الثلاث:
--      select proname from pg_proc
--      where proname in ('my_signals','unread_signals','mark_signals_seen');
--
--   ٣) تعمل بحسابك:
--      select kind, count(*) from public.my_signals() group by kind;
--      select public.unread_signals();
--
--   ٤) **الاستعلام الصحّي لم يتغيّر** — لا جدول ولا سياسة من هذه الهجرة:
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
-- ============================================================
