-- ============================================================
--  ٢٥٥ — signal_wording · **الإشعارُ يسمّي ما تفاعل معه الشخص** (T496)
--
--  أحمد ٢١ نوفمبر ٢٠٢٦: «اذا احد اعطاني اعجاب التعليق ما يكون واضح — يور
--  ابانيزر؟ الافضل يكون اعجب بتعليق على ايبانيزر او بتقييمك او بقائمتك».
--  ثم جدولُ مراجعة كلّ تنبيهات التفاعل بين شخصين، واختار «١ أ» (نضيف
--  الإشعارين الناقصين) و«٢ أ» (الردُّ على تعليقك غيرُ الردّ على ردّك)، و«نفذ».
--
--  **لماذا نوعٌ لا عَلَم** (D-218): النوعُ في الجرس وجهةٌ قبل أن يكون جملة،
--  والتطبيقُ يرسم الجملةَ من النوع وحده — فنوعٌ واحدٌ لا يستطيع أن يقول
--  «تعليقك» مرّةً و«تقييمك» مرّة.
--
--  ما تغيّر (إضافيٌّ كلُّه — لا حذفَ ولا إسقاطَ عمودٍ ولا سحبَ صلاحيّة):
--   ١) `like_review` ⇐ يبقى للتقييم الذي فيه **نصّ**، و`like_rating` جديدٌ
--      للتقييم بالنجوم وحدها.
--   ٢) `reply` ⇐ يبقى للردّ على **تعليقك**، و`reply_reply` جديدٌ للردّ على
--      **ردّك** في تعليق غيرك. ومثلُهما `list_reply` / `list_reply_reply`.
--   ٣) `talk_like` جديد: أعجب أحدٌ بمشاركتك في نقاش (`title_post_likes`،
--      لم يكن له إشعارٌ قط).
--   ٤) `request_accepted` جديد: قبل أحدٌ طلبَ متابعتك — من جدولٍ جديد
--      `follow_acceptances` يكتبه `accept_follow_request` وحده. 🔴 لماذا جدولٌ
--      لا عمودٌ في `user_follows`: تلك تُقرأ للجميع (`read all user follows`)
--      ويُكتب فيها بسياسة `follow as self` — فعمودٌ فيها كان سيكشف أنّ
--      الحسابَ خاصٌّ وقبِل فلاناً ومتى، ويقبل أن يُزوَّر. هذا الجدولُ بلا
--      سياسةٍ واحدة: لا يقرؤه ولا يكتبه إلّا دوالُّ definer.
--   ٤ب) `library_grant` جديد: منحك أحدٌ الاطلاعَ على مكتبته (`library_grants`،
--      إعدادات › الخصوصية › «من يرى مكتبتي») — أحمد «نضيف إشعاره». لا
--      إشعارَ للسحب: خبرُ سحب الثقة يُحرج ولا يفيد.
--   ٥) `my_signals_v2()` = الدالّةُ نفسُها **وعمودٌ أخير `owner_id`**: صاحبُ
--      التعليق الذي جرى فيه الردّ. 🔴 لماذا: الردُّ على ردّك يقع في تعليق
--      **غيرك**، والوجهةُ كانت تُبنى بمعرّفك أنت (`/review/…/<أنا>`) فتفتح
--      صفحةً ليس فيها ما رُدَّ عليك. ولا يُغيَّر شكلُ `my_signals` لأن
--      تغييرَ أعمدة دالّةٍ يحتاج `drop` — فصارت `my_signals` تقرأ من
--      `v2` بأعمدتها الثلاثة عشر كما هي، و`unread_signals` تعدّ الجديدَ معها.
--   ٦) 🔴 `accept_follow_request` **لا يُنشئ متابعةً إلّا عن طلبٍ موجود**:
--      كان يحذف الطلبَ ثم يُدرج المتابعةَ في كلّ حال — فأيُّ عضوٍ يستطيع
--      أن يجعل أيَّ شخصٍ «يتابعه» بنداءٍ واحد. ومع إشعار «قبل طلبك» صار
--      ذلك باباً لإشعاراتٍ مزوّرة، فيُغلق هنا.
--
--  الترتيب: الكودُ أوّلاً (يقرأ `my_signals_v2` ويرجع إلى `my_signals` إن
--  غابت)، ثم هذه الهجرة. قبلها يبقى الجرسُ كما هو اليوم.
--
--  تحقُّقها:
--    select relrowsecurity from pg_class where relname = 'follow_acceptances'; -- t
--    select count(*) from pg_policies where tablename = 'follow_acceptances';  -- 0
--    select pg_get_function_result('public.my_signals_v2()'::regprocedure);   -- … list_slug text, owner_id uuid
--    select pg_get_function_result('public.my_signals()'::regprocedure);      -- بلا owner_id، كما كانت
-- ============================================================

begin;

create table if not exists public.follow_acceptances (
  follower_id  uuid not null references auth.users (id) on delete cascade,
  following_id uuid not null references auth.users (id) on delete cascade,
  accepted_at  timestamptz not null default now(),
  primary key (follower_id, following_id)
);
-- بلا سياسات عمداً: دوالُّ definer وحدها تقرأ وتكتب
alter table public.follow_acceptances enable row level security;

-- الجرسُ يقرأ منحَ المكتبة بالممنوح — المفتاحُ الأساسيّ يبدأ بالمالك
create index if not exists library_grants_grantee_idx
  on public.library_grants (grantee_id, created_at desc);

create or replace function public.accept_follow_request(requester uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare me uuid := auth.uid();
begin
  if me is null then return; end if;
  delete from public.follow_requests where requester_id = requester and target_id = me;
  -- 🔴 T496 — لا طلبَ حُذف ⇒ لا متابعةَ ولا إشعار
  if not found then return; end if;
  insert into public.user_follows (follower_id, following_id)
  values (requester, me) on conflict do nothing;
  -- قبولٌ ثانٍ بعد إلغاءٍ وطلبٍ جديد يجدّد الوقت فيعود السطرُ في جرسه
  insert into public.follow_acceptances (follower_id, following_id, accepted_at)
  values (requester, me, now())
  on conflict (follower_id, following_id) do update set accepted_at = excluded.accepted_at;
end;
$function$;
revoke all on function public.accept_follow_request(uuid) from public;
grant execute on function public.accept_follow_request(uuid) to authenticated;

create or replace function public.my_signals_v2()
returns table (kind text, actor_id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, title text, at timestamp with time zone, is_new boolean, list_id uuid, list_slug text, owner_id uuid)
language sql
stable security definer
set search_path to 'public'
as $function$
with me as (
  select auth.uid() as uid,
         (select p.notif_seen_at from public.profiles p where p.id = auth.uid()) as seen
),
sig as (
  select 'follow'::text as kind, f.follower_id as actor_id,
         null::integer as tmdb_id, null::text as media_type, null::text as title,
         f.created_at as at,
         null::uuid as list_id, null::text as list_slug, null::uuid as owner_id
  from public.user_follows f, me
  where f.following_id = me.uid
    and f.created_at >= now() - interval '30 days'
  union all
  select 'request', r.requester_id, null, null, null, r.created_at, null, null, null
  from public.follow_requests r, me
  where r.target_id = me.uid
    and r.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — قبل طلبَ متابعتك: الفاعلُ من قبِل (من أتابعه الآن)
  -- ما دامت المتابعةُ قائمة (من ألغاها لا يُذكَّر بقبولٍ لم يعد له معنى)
  select 'request_accepted', a.following_id, null, null, null, a.accepted_at, null, null, null
  from public.follow_acceptances a
  join public.user_follows f
    on f.follower_id = a.follower_id and f.following_id = a.following_id
  cross join me
  where a.follower_id = me.uid
    and a.accepted_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — منحك الاطلاعَ على مكتبته (الفاعلُ صاحبُ المكتبة)
  select 'library_grant', g.owner_id, null, null, null, g.created_at, null, null, null
  from public.library_grants g, me
  where g.grantee_id = me.uid
    and g.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — تعليقٌ (فيه نصّ) أم تقييمٌ بالنجوم وحدها
  select case when nullif(btrim(coalesce(rt.review, '')), '') is not null
              then 'like_review' else 'like_rating' end,
         l.liker_id, l.tmdb_id, l.media_type, rt.title, l.created_at,
         null, null, l.review_user_id
  from public.review_likes l
  left join public.ratings rt
    on rt.user_id = l.review_user_id
   and rt.tmdb_id = l.tmdb_id
   and rt.media_type = l.media_type
  cross join me
  where l.review_user_id = me.uid
    and l.created_at >= now() - interval '30 days'
  union all
  select 'like_activity', l.liker_id, l.tmdb_id, l.media_type, fo.title, l.created_at,
         null, null, null
  from public.activity_likes l
  left join public.follows fo
    on fo.user_id = l.actor_id
   and fo.tmdb_id = l.tmdb_id
   and fo.media_type = l.media_type
  cross join me
  where l.actor_id = me.uid
    and l.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — ردٌّ على ردّك (أبوه لي) أم ردٌّ على تعليقك؛ وصاحبُ التعليق للوجهة
  select case when exists (
                select 1 from public.review_replies p
                 where p.id = r.parent_id and p.user_id = me.uid)
              then 'reply_reply' else 'reply' end,
         r.user_id, r.tmdb_id, r.media_type, rt.title, r.created_at,
         null, null, r.review_user_id
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
  select 'talk_reply', r.user_id, r.tmdb_id, r.media_type, r.title, r.created_at,
         null, null, null
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
  -- 🆕 T496 — أعجب أحدٌ بمشاركتك في نقاش
  select 'talk_like', k.user_id, p.tmdb_id, p.media_type, p.title, k.created_at,
         null, null, null
  from public.title_post_likes k
  join public.title_posts p on p.id = k.post_id
  cross join me
  where p.user_id = me.uid
    and k.user_id <> me.uid
    and p.hidden = false
    and k.created_at >= now() - interval '30 days'
  union all
  select 'list_review', lr.user_id, null, null, ul.name, lr.updated_at,
         ul.id, ul.source_slug, null
  from public.list_reviews lr
  join public.user_lists ul on ul.id = lr.list_id
  cross join me
  where ul.user_id = me.uid
    and lr.user_id <> me.uid
    and coalesce(lr.hidden, false) = false
    and lr.updated_at >= now() - interval '30 days'
  union all
  select 'like_list_review', k.liker_id, null, null, ul.name, k.created_at,
         ul.id, ul.source_slug, null
  from public.list_review_likes k
  join public.user_lists ul on ul.id = k.list_id
  cross join me
  where k.review_user_id = me.uid
    and k.liker_id <> me.uid
    and ul.is_public
    and k.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — ردٌّ على ردّك في قائمة أم ردٌّ على تقييمك لها
  select case when exists (
                select 1 from public.list_review_replies q
                 where q.id = p.parent_id and q.user_id = me.uid)
              then 'list_reply_reply' else 'list_reply' end,
         p.user_id, null, null, ul.name, p.created_at,
         ul.id, ul.source_slug, p.review_user_id
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
  union all
  select 'list_copy', c.user_id, null, null, ul.name, c.created_at,
         ul.id, ul.source_slug, null
  from public.user_lists c
  join public.user_lists ul on ul.id = c.copied_from
  cross join me
  where ul.user_id = me.uid
    and c.user_id <> me.uid
    and ul.is_public
    and c.created_at >= now() - interval '30 days'
  union all
  select 'list_invite', m.invited_by, null, null, ul.name, m.created_at,
         ul.id, ul.source_slug, null
  from public.list_members m
  join public.user_lists ul on ul.id = m.list_id
  cross join me
  where m.user_id = me.uid
    and m.status = 'pending'
    and m.invited_by is not null
    and m.created_at >= now() - interval '30 days'
  union all
  select 'list_like', k.user_id, null, null, ul.name, k.created_at,
         ul.id, ul.source_slug, null
  from public.list_likes k
  join public.user_lists ul on ul.id = k.list_id
  cross join me
  where ul.user_id = me.uid
    and k.user_id <> me.uid
    and ul.is_public
    and k.created_at >= now() - interval '30 days'
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
  s.list_id, s.list_slug, s.owner_id
from sig s
join public.profiles pr on pr.id = s.actor_id
cross join me
where not public.is_blocked(me.uid, s.actor_id)
order by s.at desc
limit 30;
$function$;
revoke all on function public.my_signals_v2() from public, anon;
grant execute on function public.my_signals_v2() to authenticated, service_role;

-- الأعمدةُ الثلاثة عشر كما كانت — `unread_signals` والنسخُ القديمة تقرأ منها
create or replace function public.my_signals()
returns table (kind text, actor_id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, title text, at timestamp with time zone, is_new boolean, list_id uuid, list_slug text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select s.kind, s.actor_id, s.nickname, s.username, s.avatar_url, s.hide_name,
         s.tmdb_id, s.media_type, s.title, s.at, s.is_new, s.list_id, s.list_slug
  from public.my_signals_v2() s
  order by s.at desc;
$function$;

commit;
