-- ============================================================
--  ٢٥٦ — signal_more · **الإشعاراتُ الناقصة بين شخصين** (T498)
--
--  أحمد ٢١ نوفمبر ٢٠٢٦ على جدول «ما لا يُشعَر به اليوم»: البند ٣ (التصويت)
--  «ب» — لا إشعار ويكفي القلب؛ و«نفذ البقيه وارفعها» للبنود ٤–١٠ و١٢:
--   ٤) `news_reply`: ردّ على ردّك تحت خبرٍ من Loopz.
--   ٥) `mention_reply` · `mention_list`: ذكرك في ردٍّ على تعليق، أو في ردٍّ في قائمة.
--   ٦–٧) `mention_talk`: ذكرك في نقاش — والنقاشُ العامّ، ولو لم تكتب فيه قبل.
--   ٨) `list_invite_accepted` · `list_invite_declined`: قبل دعوتك أو اعتذر عنها.
--   ٩) `list_removed`: أخرجك صاحبُ القائمة منها (عضوٌ فعّال، لا إلغاءُ دعوة).
--   ١٠) `list_save`: حفظ قائمتك.
--   ١٢) أضافك إلى مجموعة رسائل — **دفعٌ وحدَه** من الخادم، فلا شيءَ هنا.
--
--  **لماذا `my_signals_v3`**: سطرُ الخبر يحتاج مفتاحَه (`ref`) ليفتح `/post/<key>`،
--  وتغييرُ أعمدة دالّةٍ يحتاج `drop`. فـ`v3` جديدة، و`v2` و`my_signals` تقرآن منها
--  بأعمدتهما كما هي (الكودُ المنشور اليوم يقرأ `v2`).
--  **ولماذا `list_member_events`**: الاعتذارُ والإخراجُ يحذفان صفَّ العضويّة، فلا
--  يبقى ما يقرؤه الجرس. جدولٌ بلا سياسةٍ واحدة كـ`follow_acceptances` (٢٥٥):
--  تكتبه دالّتا `respond_list_invite` و`remove_list_member` وحدهما.
--  **والمنشنُ بنمطٍ على النصّ** (`~*`) بعد `position('@')`: لا جدولَ للمنشن، والنصوصُ
--  آخرَ ٣٠ يوماً قليلة؛ ومن وصله «ردّ عليك» من الردّ نفسِه لا يُذكَّر ثانية.
--  ومراجعةٌ مستقلّة (٢١ نوفمبر): مشاركةٌ فيها أكثرُ من ١٢ اسماً لا تُبلِّغ أحداً (الدفعُ مثلُها)،
--  والمنشنُ تحت تعليقِ حسابٍ خاصّ لا يصل من لا يرى صاحبَه (`can_view_profile`).
--
--  إضافيّةٌ كلُّها. الكودُ قبلها: يقرأ `v3` ويرجع إلى `v2` ثم `my_signals` إن غابت.
--
--  تحقُّقها:
--    select pg_get_function_result('public.my_signals_v3()'::regprocedure); -- … owner_id uuid, ref text
--    select relrowsecurity from pg_class where relname = 'list_member_events'; -- t
-- ============================================================

begin;

create table if not exists public.list_member_events (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('declined', 'removed')),
  list_id    uuid not null references public.user_lists (id) on delete cascade,
  actor_id   uuid not null references auth.users (id) on delete cascade,
  target_id  uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
-- بلا سياسات عمداً: دوالُّ definer وحدها تقرأ وتكتب
alter table public.list_member_events enable row level security;
create index if not exists list_member_events_target_idx
  on public.list_member_events (target_id, created_at desc);

create or replace function public.respond_list_invite(p_list uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_inv uuid;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_accept then
    update public.list_members set status = 'active', accepted_at = now()
     where list_id = p_list and user_id = v_uid and status = 'pending';
    if not found then raise exception 'list_invite_missing' using errcode = 'P0002'; end if;
    return 'active';
  end if;
  delete from public.list_members where list_id = p_list and user_id = v_uid and status = 'pending'
  returning invited_by into v_inv;
  -- 🆕 T498 — الاعتذارُ يُخبر من دعاك (البند ٨)
  if v_inv is not null and v_inv <> v_uid then
    insert into public.list_member_events (kind, list_id, actor_id, target_id) values ('declined', p_list, v_uid, v_inv);
  end if;
  return 'declined';
end;
$function$;

create or replace function public.remove_list_member(p_list uuid, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_user <> v_uid and not exists (select 1 from public.user_lists l where l.id = p_list and l.user_id = v_uid) then
    raise exception 'list_not_owner' using errcode = '42501';
  end if;
  delete from public.list_members where list_id = p_list and user_id = p_user
  returning status into v_status;
  if not found then return false; end if;
  -- 🆕 T498 — صاحبُها أخرج عضواً فعّالاً (لا مغادرةٌ ولا إلغاءُ دعوة) ⇒ يُخبَر (البند ٩)
  if p_user <> v_uid and v_status = 'active' then
    insert into public.list_member_events (kind, list_id, actor_id, target_id) values ('removed', p_list, v_uid, p_user);
  end if;
  return true;
end;
$function$;

create or replace function public.my_signals_v3()
returns table (kind text, actor_id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, title text, at timestamp with time zone, is_new boolean, list_id uuid, list_slug text, owner_id uuid, ref text)
language sql
stable security definer
set search_path to 'public'
as $function$
with me as (
  select auth.uid() as uid,
         (select p.notif_seen_at from public.profiles p where p.id = auth.uid()) as seen,
         -- 🆕 T498 — نمطُ المنشن: `@اسمي` بحدود `mentionsIn` نفسِها (الحرفُ قبله ليس حرفاً ولا @، وبعده ليس حرفاً)
         (select '(^|[^A-Za-z0-9_@])@' || lower(p.username) || '([^A-Za-z0-9_]|$)'
            from public.profiles p where p.id = auth.uid() and p.username ~ '^[A-Za-z0-9_]{3,24}$') as mention_re
),
sig as (
  select 'follow'::text as kind, f.follower_id as actor_id,
         null::integer as tmdb_id, null::text as media_type, null::text as title,
         f.created_at as at,
         null::uuid as list_id, null::text as list_slug, null::uuid as owner_id, null::text as ref
  from public.user_follows f, me
  where f.following_id = me.uid
    and f.created_at >= now() - interval '30 days'
  union all
  select 'request', r.requester_id, null, null, null, r.created_at, null, null, null, null
  from public.follow_requests r, me
  where r.target_id = me.uid
    and r.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — قبل طلبَ متابعتك: الفاعلُ من قبِل (من أتابعه الآن)
  -- ما دامت المتابعةُ قائمة (من ألغاها لا يُذكَّر بقبولٍ لم يعد له معنى)
  select 'request_accepted', a.following_id, null, null, null, a.accepted_at, null, null, null, null
  from public.follow_acceptances a
  join public.user_follows f
    on f.follower_id = a.follower_id and f.following_id = a.following_id
  cross join me
  where a.follower_id = me.uid
    and a.accepted_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — منحك الاطلاعَ على مكتبته (الفاعلُ صاحبُ المكتبة)
  select 'library_grant', g.owner_id, null, null, null, g.created_at, null, null, null, null
  from public.library_grants g, me
  where g.grantee_id = me.uid
    and g.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — تعليقٌ (فيه نصّ) أم تقييمٌ بالنجوم وحدها
  select case when nullif(btrim(coalesce(rt.review, '')), '') is not null
              then 'like_review' else 'like_rating' end,
         l.liker_id, l.tmdb_id, l.media_type, rt.title, l.created_at,
         null, null, l.review_user_id, null
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
         null, null, null, null
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
         null, null, r.review_user_id, null
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
         null, null, null, null
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
         null, null, null, null
  from public.title_post_likes k
  join public.title_posts p on p.id = k.post_id
  cross join me
  where p.user_id = me.uid
    and k.user_id <> me.uid
    and p.hidden = false
    and k.created_at >= now() - interval '30 days'
  union all
  select 'list_review', lr.user_id, null, null, ul.name, lr.updated_at,
         ul.id, ul.source_slug, null, null
  from public.list_reviews lr
  join public.user_lists ul on ul.id = lr.list_id
  cross join me
  where ul.user_id = me.uid
    and lr.user_id <> me.uid
    and coalesce(lr.hidden, false) = false
    and lr.updated_at >= now() - interval '30 days'
  union all
  select 'like_list_review', k.liker_id, null, null, ul.name, k.created_at,
         ul.id, ul.source_slug, null, null
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
         ul.id, ul.source_slug, p.review_user_id, null
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
         ul.id, ul.source_slug, null, null
  from public.user_lists c
  join public.user_lists ul on ul.id = c.copied_from
  cross join me
  where ul.user_id = me.uid
    and c.user_id <> me.uid
    and ul.is_public
    and c.created_at >= now() - interval '30 days'
  union all
  select 'list_invite', m.invited_by, null, null, ul.name, m.created_at,
         ul.id, ul.source_slug, null, null
  from public.list_members m
  join public.user_lists ul on ul.id = m.list_id
  cross join me
  where m.user_id = me.uid
    and m.status = 'pending'
    and m.invited_by is not null
    and m.created_at >= now() - interval '30 days'
  union all
  select 'list_like', k.user_id, null, null, ul.name, k.created_at,
         ul.id, ul.source_slug, null, null
  from public.list_likes k
  join public.user_lists ul on ul.id = k.list_id
  cross join me
  where ul.user_id = me.uid
    and k.user_id <> me.uid
    and ul.is_public
    and k.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T498 — قبل دعوتك إلى قائمتك المشتركة (الفاعلُ المدعوّ، وأنا من دعاه)
  select 'list_invite_accepted', m.user_id, null, null, ul.name, m.accepted_at,
         ul.id, ul.source_slug, null, null
  from public.list_members m
  join public.user_lists ul on ul.id = m.list_id
  cross join me
  where m.invited_by = me.uid
    and m.user_id <> me.uid
    and m.status = 'active'
    and m.accepted_at >= now() - interval '30 days'
  union all
  -- 🆕 T498 — اعتذر عن دعوتك · أخرجك من قائمة (صفُّ العضويّة يُحذف، فالأثرُ في `list_member_events`)
  select case e.kind when 'declined' then 'list_invite_declined' else 'list_removed' end,
         e.actor_id, null, null, ul.name, e.created_at,
         ul.id, ul.source_slug, null, null
  from public.list_member_events e
  join public.user_lists ul on ul.id = e.list_id
  cross join me
  where e.target_id = me.uid
    and e.actor_id <> me.uid
    and e.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T498 — حفظ قائمتك
  select 'list_save', s.user_id, null, null, ul.name, s.created_at,
         ul.id, ul.source_slug, null, null
  from public.list_saves s
  join public.user_lists ul on ul.id = s.list_id
  cross join me
  where ul.user_id = me.uid
    and s.user_id <> me.uid
    and ul.is_public
    and s.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T498 — ردٌّ على ردّك تحت خبرٍ من Loopz (الخبرُ بلا صاحب، فالردُّ على الردّ وحدَه)
  select 'news_reply', r.user_id, null, null, np.title, r.created_at,
         null, null, null, r.post_key
  from public.news_post_replies r
  join public.news_post_replies p on p.id = r.parent_id
  left join public.news_posts np on np.key = r.post_key
  cross join me
  where p.user_id = me.uid
    and r.user_id <> me.uid
    and coalesce(r.hidden, false) = false
    and r.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T498 — ذكرك في ردٍّ على تعليق (ومن وصله «ردّ عليك» من الردِّ نفسِه لا يُذكَّر ثانية)
  select 'mention_reply', r.user_id, r.tmdb_id, r.media_type, rt.title, r.created_at,
         null, null, r.review_user_id, null
  from public.review_replies r
  left join public.ratings rt
    on rt.user_id = r.review_user_id
   and rt.tmdb_id = r.tmdb_id
   and rt.media_type = r.media_type
  cross join me
  where me.mention_re is not null
    and r.hidden = false
    and r.user_id <> me.uid
    and r.review_user_id <> me.uid
    and r.created_at >= now() - interval '30 days'
    and position('@' in r.body) > 0
    and r.body ~* me.mention_re
    -- مشاركةٌ تذكر أكثرَ من ١٢ اسماً لا تُبلِّغ أحداً (حدُّ `mentionsIn`، والدفعُ يطبّقه نفسَه) — بابُ إزعاجٍ جماعيّ يُغلق
    and (select count(distinct lower(m[2]))
           from regexp_matches(r.body, '(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])', 'g') m) <= 12
    -- تعليقُ حسابٍ خاصّ لا يُكشف لمن لا يرى صاحبَه (العنوانُ ووجهةُ صفحته)
    and public.can_view_profile(r.review_user_id)
    and not exists (
      select 1 from public.review_replies q
       where q.id = r.parent_id and q.user_id = me.uid
    )
  union all
  -- 🆕 T498 — ذكرك في ردٍّ في قائمة
  select 'mention_list', p.user_id, null, null, ul.name, p.created_at,
         ul.id, ul.source_slug, p.review_user_id, null
  from public.list_review_replies p
  join public.user_lists ul on ul.id = p.list_id
  cross join me
  where me.mention_re is not null
    and coalesce(p.hidden, false) = false
    and ul.is_public
    and p.user_id <> me.uid
    and p.review_user_id <> me.uid
    and p.created_at >= now() - interval '30 days'
    and position('@' in p.body) > 0
    and p.body ~* me.mention_re
    -- مشاركةٌ تذكر أكثرَ من ١٢ اسماً لا تُبلِّغ أحداً (حدُّ `mentionsIn`، والدفعُ يطبّقه نفسَه) — بابُ إزعاجٍ جماعيّ يُغلق
    and (select count(distinct lower(m[2]))
           from regexp_matches(p.body, '(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])', 'g') m) <= 12
    and not exists (
      select 1 from public.list_review_replies q
       where q.id = p.parent_id and q.user_id = me.uid
    )
  union all
  -- 🆕 T498 — ذكرك في نقاش (والنقاشُ العامّ `tmdb_id = 0`) — لكلِّ مذكور، لا لمن كتب في الغرفة وحده
  select 'mention_talk', r.user_id, r.tmdb_id, r.media_type, r.title, r.created_at,
         null, null, null, null
  from public.title_posts r
  cross join me
  where me.mention_re is not null
    and r.hidden = false
    and r.user_id <> me.uid
    and r.created_at >= now() - interval '30 days'
    and position('@' in r.body) > 0
    and r.body ~* me.mention_re
    -- مشاركةٌ تذكر أكثرَ من ١٢ اسماً لا تُبلِّغ أحداً (حدُّ `mentionsIn`، والدفعُ يطبّقه نفسَه) — بابُ إزعاجٍ جماعيّ يُغلق
    and (select count(distinct lower(m[2]))
           from regexp_matches(r.body, '(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])', 'g') m) <= 12
    and not exists (
      select 1 from public.title_posts q
       where q.id = r.parent_id and q.user_id = me.uid
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
  s.list_id, s.list_slug, s.owner_id, s.ref
from sig s
join public.profiles pr on pr.id = s.actor_id
cross join me
where not public.is_blocked(me.uid, s.actor_id)
order by s.at desc
limit 30;
$function$;
revoke all on function public.my_signals_v3() from public, anon;
grant execute on function public.my_signals_v3() to authenticated, service_role;

-- الأعمدةُ الأربعة عشر كما كانت — الكودُ المنشور قبل هذه الهجرة يقرأ `v2`
create or replace function public.my_signals_v2()
returns table (kind text, actor_id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, title text, at timestamp with time zone, is_new boolean, list_id uuid, list_slug text, owner_id uuid)
language sql
stable security definer
set search_path to 'public'
as $function$
  select s.kind, s.actor_id, s.nickname, s.username, s.avatar_url, s.hide_name,
         s.tmdb_id, s.media_type, s.title, s.at, s.is_new, s.list_id, s.list_slug, s.owner_id
  from public.my_signals_v3() s
  order by s.at desc;
$function$;

commit;
