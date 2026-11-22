-- ============================================================
--  ٢٥٩ — reply_likes_signal_item · **قلبٌ على ردود المراجعات والأخبار، والإشعارُ يعرف الردَّ نفسَه** (T509)
--
--  أحمد ٢٢ نوفمبر ٢٠٢٦ على لقطة مراجعة Clayface: «المفترض اقدر اسوي اعجاب لردود عالرد مثل رد خالد او عمر» (١٥ أ:
--  القلبُ ومعه «أعجب X بردّك»)، وعلى الإشعارات: «اذا عالكلام يودي لمكان الرد او اللايك اللي سواه» (١٤ ب).
--
--  ١) **جدولان لا جدول**: `review_reply_likes` و`news_reply_likes` — كلٌّ بمفتاحٍ أجنبيٍّ على ردّه `on delete cascade`،
--     فالردُّ المحذوفُ يأخذ قلوبَه معه. جدولٌ واحدٌ لنوعين يخسر هذا القيدَ ويحتاج عموداً يقول أيَّ جدولٍ يقصد.
--  ٢) **سياسةُ الإدراج بدالّةٍ definer** (`can_like_review_reply` · `can_like_news_reply`): سياسةُ `review_replies` لا تُريك
--     إلّا ردودَك، فاستعلامٌ فرعيٌّ في السياسة لا يرى ردَّ غيرك ويرفض كلَّ قلب. والشروطُ: ردٌّ قائمٌ غيرُ مخفيّ، ولا حظرَ بينكما في
--     أيِّ اتجاه. وقلبُك على ردِّك مسموحٌ كقلبك على مشاركتك في الغرفة (أحمد «١٧ أ»)، ولا يرنّ: الجرسُ والدفعُ
--     يُسقطان الفاعلَ نفسَه.
--  ٣) **القراءةُ بدالّةٍ واحدة** `reply_likes_of(scope, ids)`: العددُ وقلبي معاً لكلِّ ردٍّ في الصفحة، فلا تُفتح سياسةُ
--     قراءةٍ عامّة على الجدولين (القارئُ يرى صفوفَه وحدها).
--  ٤) **`my_signals_v4` = `v3` + عمودُ `item`**: معرّفُ الردِّ أو المشاركة التي جرى فيها التفاعل — فالضغطُ على الإشعار يفتح
--     الردَّ نفسَه (`?r=`). وثلاثةُ أنواعٍ جديدة: `reply_like` · `news_reply_like` · `mention_news` (الردُّ على ردٍّ في خبرٍ
--     بأسلوب إنستغرام يذكر صاحبَه، ١٦ أ). تغييرُ أعمدة دالّةٍ يحتاج `drop`، فـ`v4` جديدة، و`v3` تقرأ منها بأعمدتها كما هي
--     (الكودُ المنشورُ اليوم يقرأ `v3`، و`v2` تقرأ من `v3`).
--
--  إضافيّةٌ كلُّها. الكودُ قبلها: يقرأ `v4` ويرجع إلى `v3` إن غابت، والقلبُ يُخفى إن غاب قارئُه.
--
--  تحقُّقها:
--    select pg_get_function_result('public.my_signals_v4()'::regprocedure); -- … ref text, item uuid
--    select relname, relrowsecurity from pg_class where relname in ('review_reply_likes','news_reply_likes'); -- t · t
-- ============================================================

begin;

create table if not exists public.review_reply_likes (
  reply_id   uuid not null references public.review_replies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);
create table if not exists public.news_reply_likes (
  reply_id   uuid not null references public.news_post_replies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);
alter table public.review_reply_likes enable row level security;
alter table public.news_reply_likes enable row level security;
-- «أعجبني» لمن يحذف حسابه، ولجرس صاحب الردّ آخرَ ٣٠ يوماً
create index if not exists review_reply_likes_user_idx on public.review_reply_likes (user_id);
create index if not exists news_reply_likes_user_idx on public.news_reply_likes (user_id);

create or replace function public.can_like_review_reply(p_reply uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.review_replies r
     where r.id = p_reply
       and r.hidden = false
       and not public.is_blocked(auth.uid(), r.user_id)
  );
$function$;

create or replace function public.can_like_news_reply(p_reply uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $function$
  select exists (
    select 1 from public.news_post_replies r
     where r.id = p_reply
       and coalesce(r.hidden, false) = false
       and not public.is_blocked(auth.uid(), r.user_id)
  );
$function$;

revoke all on function public.can_like_review_reply(uuid) from public, anon;
revoke all on function public.can_like_news_reply(uuid) from public, anon;
grant execute on function public.can_like_review_reply(uuid) to authenticated;
grant execute on function public.can_like_news_reply(uuid) to authenticated;

drop policy if exists "insert own review reply like" on public.review_reply_likes;
create policy "insert own review reply like" on public.review_reply_likes
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_like_review_reply(reply_id));
drop policy if exists "read own review reply likes" on public.review_reply_likes;
create policy "read own review reply likes" on public.review_reply_likes
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "delete own review reply like" on public.review_reply_likes;
create policy "delete own review reply like" on public.review_reply_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "insert own news reply like" on public.news_reply_likes;
create policy "insert own news reply like" on public.news_reply_likes
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.can_like_news_reply(reply_id));
drop policy if exists "read own news reply likes" on public.news_reply_likes;
create policy "read own news reply likes" on public.news_reply_likes
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "delete own news reply like" on public.news_reply_likes;
create policy "delete own news reply like" on public.news_reply_likes
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, delete on public.review_reply_likes to authenticated;
grant select, insert, delete on public.news_reply_likes to authenticated;

-- العددُ وقلبي لكلِّ ردٍّ في الصفحة — للزائر أيضاً (العددُ وحدَه، وقلبُه `false`)
create or replace function public.reply_likes_of(p_scope text, p_ids uuid[])
returns table (reply_id uuid, likes integer, liked boolean)
language sql
stable security definer
set search_path to 'public'
as $function$
  with k as (
    select l.reply_id, l.user_id from public.review_reply_likes l
     where p_scope = 'review' and l.reply_id = any (p_ids[1:300])
    union all
    select l.reply_id, l.user_id from public.news_reply_likes l
     where p_scope = 'news' and l.reply_id = any (p_ids[1:300])
  )
  select k.reply_id,
         count(*)::integer,
         coalesce(bool_or(k.user_id = auth.uid()), false)
    from k
   group by k.reply_id;
$function$;
revoke all on function public.reply_likes_of(text, uuid[]) from public;
grant execute on function public.reply_likes_of(text, uuid[]) to anon, authenticated, service_role;

create or replace function public.my_signals_v4()
returns table (kind text, actor_id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, title text, at timestamp with time zone, is_new boolean, list_id uuid, list_slug text, owner_id uuid, ref text, item uuid)
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
         null::uuid as list_id, null::text as list_slug, null::uuid as owner_id, null::text as ref, null::uuid as item
  from public.user_follows f, me
  where f.following_id = me.uid
    and f.created_at >= now() - interval '30 days'
  union all
  select 'request', r.requester_id, null, null, null, r.created_at, null, null, null, null, null
  from public.follow_requests r, me
  where r.target_id = me.uid
    and r.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — قبل طلبَ متابعتك: الفاعلُ من قبِل (من أتابعه الآن)
  -- ما دامت المتابعةُ قائمة (من ألغاها لا يُذكَّر بقبولٍ لم يعد له معنى)
  select 'request_accepted', a.following_id, null, null, null, a.accepted_at, null, null, null, null, null
  from public.follow_acceptances a
  join public.user_follows f
    on f.follower_id = a.follower_id and f.following_id = a.following_id
  cross join me
  where a.follower_id = me.uid
    and a.accepted_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — منحك الاطلاعَ على مكتبته (الفاعلُ صاحبُ المكتبة)
  select 'library_grant', g.owner_id, null, null, null, g.created_at, null, null, null, null, null
  from public.library_grants g, me
  where g.grantee_id = me.uid
    and g.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T496 — تعليقٌ (فيه نصّ) أم تقييمٌ بالنجوم وحدها
  select case when nullif(btrim(coalesce(rt.review, '')), '') is not null
              then 'like_review' else 'like_rating' end,
         l.liker_id, l.tmdb_id, l.media_type, rt.title, l.created_at,
         null, null, l.review_user_id, null, null
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
         null, null, null, null, null
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
         null, null, r.review_user_id, null, r.id
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
         null, null, null, null, r.id
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
         null, null, null, null, p.id
  from public.title_post_likes k
  join public.title_posts p on p.id = k.post_id
  cross join me
  where p.user_id = me.uid
    and k.user_id <> me.uid
    and p.hidden = false
    and k.created_at >= now() - interval '30 days'
  union all
  select 'list_review', lr.user_id, null, null, ul.name, lr.updated_at,
         ul.id, ul.source_slug, null, null, null
  from public.list_reviews lr
  join public.user_lists ul on ul.id = lr.list_id
  cross join me
  where ul.user_id = me.uid
    and lr.user_id <> me.uid
    and coalesce(lr.hidden, false) = false
    and lr.updated_at >= now() - interval '30 days'
  union all
  select 'like_list_review', k.liker_id, null, null, ul.name, k.created_at,
         ul.id, ul.source_slug, null, null, null
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
         ul.id, ul.source_slug, p.review_user_id, null, p.id
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
         ul.id, ul.source_slug, null, null, null
  from public.user_lists c
  join public.user_lists ul on ul.id = c.copied_from
  cross join me
  where ul.user_id = me.uid
    and c.user_id <> me.uid
    and ul.is_public
    and c.created_at >= now() - interval '30 days'
  union all
  select 'list_invite', m.invited_by, null, null, ul.name, m.created_at,
         ul.id, ul.source_slug, null, null, null
  from public.list_members m
  join public.user_lists ul on ul.id = m.list_id
  cross join me
  where m.user_id = me.uid
    and m.status = 'pending'
    and m.invited_by is not null
    and m.created_at >= now() - interval '30 days'
  union all
  select 'list_like', k.user_id, null, null, ul.name, k.created_at,
         ul.id, ul.source_slug, null, null, null
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
         ul.id, ul.source_slug, null, null, null
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
         ul.id, ul.source_slug, null, null, null
  from public.list_member_events e
  join public.user_lists ul on ul.id = e.list_id
  cross join me
  where e.target_id = me.uid
    and e.actor_id <> me.uid
    and e.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T498 — حفظ قائمتك
  select 'list_save', s.user_id, null, null, ul.name, s.created_at,
         ul.id, ul.source_slug, null, null, null
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
         null, null, null, r.post_key, r.id
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
         null, null, r.review_user_id, null, r.id
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
         ul.id, ul.source_slug, p.review_user_id, null, p.id
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
         null, null, null, null, r.id
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
  union all
  -- 🆕 T509 — أعجب أحدٌ بردّك على تعليق (`review_reply_likes`). صاحبُ التعليق للوجهة، والردُّ نفسُه `item`
  select 'reply_like', k.user_id, r.tmdb_id, r.media_type, rt.title, k.created_at,
         null, null, r.review_user_id, null, r.id
  from public.review_reply_likes k
  join public.review_replies r on r.id = k.reply_id
  left join public.ratings rt
    on rt.user_id = r.review_user_id
   and rt.tmdb_id = r.tmdb_id
   and rt.media_type = r.media_type
  cross join me
  where r.user_id = me.uid
    and k.user_id <> me.uid
    and r.hidden = false
    and k.created_at >= now() - interval '30 days'
    and public.can_view_profile(r.review_user_id)
  union all
  -- 🆕 T509 — أعجب أحدٌ بردّك تحت خبرٍ من Loopz
  select 'news_reply_like', k.user_id, null, null, np.title, k.created_at,
         null, null, null, r.post_key, r.id
  from public.news_reply_likes k
  join public.news_post_replies r on r.id = k.reply_id
  left join public.news_posts np on np.key = r.post_key
  cross join me
  where r.user_id = me.uid
    and k.user_id <> me.uid
    and coalesce(r.hidden, false) = false
    and k.created_at >= now() - interval '30 days'
  union all
  -- 🆕 T509 — ذكرك في ردٍّ تحت خبر (الردُّ على ردٍّ بأسلوب إنستغرام يذكر صاحبَه) — ومن وصله «ردّ على ردّك» منه لا يُذكَّر ثانية
  select 'mention_news', r.user_id, null, null, np.title, r.created_at,
         null, null, null, r.post_key, r.id
  from public.news_post_replies r
  left join public.news_posts np on np.key = r.post_key
  cross join me
  where me.mention_re is not null
    and coalesce(r.hidden, false) = false
    and r.user_id <> me.uid
    and r.created_at >= now() - interval '30 days'
    and position('@' in r.body) > 0
    and r.body ~* me.mention_re
    and (select count(distinct lower(m[2]))
           from regexp_matches(r.body, '(^|[^A-Za-z0-9_@])@([A-Za-z0-9_]{3,24})(?![A-Za-z0-9_])', 'g') m) <= 12
    and not exists (
      select 1 from public.news_post_replies q
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
  s.list_id, s.list_slug, s.owner_id, s.ref, s.item
from sig s
join public.profiles pr on pr.id = s.actor_id
cross join me
where not public.is_blocked(me.uid, s.actor_id)
order by s.at desc
limit 30;
$function$;
revoke all on function public.my_signals_v4() from public, anon;
grant execute on function public.my_signals_v4() to authenticated, service_role;

-- الأعمدةُ الخمسة عشر كما كانت — الكودُ المنشورُ قبل هذه الهجرة يقرأ `v3`، و`v2` تقرأ منها
create or replace function public.my_signals_v3()
returns table (kind text, actor_id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, title text, at timestamp with time zone, is_new boolean, list_id uuid, list_slug text, owner_id uuid, ref text)
language sql
stable security definer
set search_path to 'public'
as $function$
  select s.kind, s.actor_id, s.nickname, s.username, s.avatar_url, s.hide_name,
         s.tmdb_id, s.media_type, s.title, s.at, s.is_new, s.list_id, s.list_slug, s.owner_id, s.ref
  from public.my_signals_v4() s
  order by s.at desc;
$function$;

commit;
