-- ============================================================
--  Loopz — إعجابُ القوائم منفصلاً عن حفظها، وإزالةُ النسخ (249)
--
--  أحمد، ١٩ نوفمبر ٢٠٢٦: «مافي اعجاب حاليا للقوائم — الاعجاب الحالي يضيفها ل قوائمك — لازم يكون فيه اعجاب
--  و الاضافة للقوائم منفصله عنها»، ثمّ «قراري ازالة النسخ — تقدر تحفظ اللستة».
--  قراراتُه: ٢ب الحفظاتُ القائمةُ تُحسب إعجاباً أيضاً · ٣ «الرائجة» تُحسب بين الإعجاب والردود والحفظ ·
--  ٤أ صاحبُ القائمة يُبلَّغ بالإعجاب · ونسخةُ العضو الوحيدة المنشورة «تتحول عنده انه حفظها».
--  أذن بتشغيلها على الإنتاج: «نفذ وااذن لك بالهجرة».
-- ============================================================

-- ---------- ١) الجدول — أخو `list_saves` حرفاً في شكله وحارسه ----------
create table if not exists public.list_likes (
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- حذفُ القائمة يُسقط إعجاباتها: إعجابٌ بلا قائمة ليس شيئاً
  list_id    uuid not null references public.user_lists (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);

alter table public.list_likes enable row level security;

-- عدُّ البطاقة والرائجةُ والجرسُ كلُّها تقرأ بالقائمة لا بالمستخدم
create index if not exists list_likes_list_idx
  on public.list_likes (list_id, created_at desc);

-- صفوفي أنا وحدها، والإعجابُ لقائمةٍ معلنةٍ ليست لي — شرطُ الحفظ نفسُه (`list_saves.sql`)
drop policy if exists "own list likes" on public.list_likes;
create policy "own list likes" on public.list_likes
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.is_public and l.user_id <> (select auth.uid())
    )
  );

-- ---------- ٢) ٢ب: القلبُ القديمُ كان الحفظ — فكلُّ حفظةٍ قائمةٍ إعجابٌ أيضاً، بتاريخها ----------
insert into public.list_likes (user_id, list_id, created_at)
select s.user_id, s.list_id, s.created_at
  from public.list_saves s
  join public.user_lists l on l.id = s.list_id
 where l.is_public and l.user_id <> s.user_id
on conflict do nothing;

-- ---------- ٣) أرقامُ البطاقة: `likes` عمودٌ أخير — القرّاءُ القدامى يقرؤون أعمدتهم بأسمائها فلا ينكسر أحد ----------
-- تغييرُ أعمدة الناتج لا يمرّ بـ`create or replace` — فحذفٌ وإنشاءٌ في المعاملة نفسِها، والمنحُ كما كان حرفاً.
drop function if exists public.list_card_stats(uuid[]);
create function public.list_card_stats(p_ids uuid[])
returns table (list_id uuid, saves integer, reviews integer, avg_rating numeric, likes integer)
language sql
stable security definer
set search_path to 'public'
as $$
  select l.id,
         ( select count(*)::int from public.list_saves s where s.list_id = l.id ),
         ( select count(*)::int from public.list_reviews r where r.list_id = l.id and coalesce(r.hidden, false) = false ),
         ( select round(avg(r.rating)::numeric, 1) from public.list_reviews r where r.list_id = l.id and coalesce(r.hidden, false) = false ),
         ( select count(*)::int from public.list_likes k where k.list_id = l.id )
    from public.user_lists l
   where l.id = any(p_ids) and l.is_public;
$$;
revoke all on function public.list_card_stats(uuid[]) from public;
grant execute on function public.list_card_stats(uuid[]) to anon, authenticated, service_role;

-- ---------- ٤) «القوائم الرائجة» (٣): إعجابٌ + رأيٌ + ردٌّ + حفظٌ في النافذة ----------
-- التوقيعُ كما هو فلا يتغيّر قارئُه؛ وعمودُ `saves` صار **النتيجةَ** — القارئُ يرتّب به وحدَه ولا يعرضه.
create or replace function public.top_saved_lists(p_days integer default 7, p_limit integer default 3)
returns table (list_id uuid, name text, owner_id uuid, nickname text, username text, avatar_url text, hide_name boolean, saves integer, posters text[])
language sql
stable security definer
set search_path to 'public'
as $$
  with win as ( select now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90)) as t0 ),
  ev as (
    select s.list_id from public.list_saves s, win where s.created_at >= win.t0
    union all
    select k.list_id from public.list_likes k, win where k.created_at >= win.t0
    union all
    select r.list_id from public.list_reviews r, win where r.created_at >= win.t0 and coalesce(r.hidden, false) = false
    union all
    select p.list_id from public.list_review_replies p, win where p.created_at >= win.t0 and coalesce(p.hidden, false) = false
  ),
  counted as ( select ev.list_id, count(*)::int as score from ev group by ev.list_id )
  select l.id, l.name, l.user_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    c.score,
    coalesce( ( select array_agg(i.poster_path order by i.rowid) from ( select i2.poster_path, row_number() over () as rowid from public.user_list_items i2 where i2.list_id = l.id and i2.poster_path is not null limit 3 ) i ), '{}'::text[] )
  from counted c
  join public.user_lists l on l.id = c.list_id
  join public.profiles p on p.id = l.user_id
  where l.is_public
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = l.user_id)
         or (b.blocker_id = l.user_id and b.blocked_id = auth.uid())
    )
  order by c.score desc, l.updated_at desc
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

-- ---------- ٥) الجرس (٤أ): «أعجبته قائمتك» — الدالّةُ كما هي على الإنتاج حرفاً (قُرئت ١٩ نوفمبر) + فرعُ `list_like` ----------
-- الإعجاباتُ المنقولةُ من الحفظ في (٢) أقدمُ من يومها — وما كان منها داخل الثلاثين يوماً يظهر في الجرس كما كان
-- سيظهر لو كُتب يومَها؛ وهي حفظاتٌ كانت تُرى «♥» أصلاً.
create or replace function public.my_signals()
returns table (kind text, actor_id uuid, nickname text, username text, avatar_url text, hide_name boolean, tmdb_id integer, media_type text, title text, at timestamp with time zone, is_new boolean, list_id uuid, list_slug text)
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
         null::uuid as list_id, null::text as list_slug
  from public.user_follows f, me
  where f.following_id = me.uid
    and f.created_at >= now() - interval '30 days'
  union all
  select 'request', r.requester_id, null, null, null, r.created_at, null, null
  from public.follow_requests r, me
  where r.target_id = me.uid
    and r.created_at >= now() - interval '30 days'
  union all
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
  union all
  select 'list_copy', c.user_id, null, null, ul.name, c.created_at,
         ul.id, ul.source_slug
  from public.user_lists c
  join public.user_lists ul on ul.id = c.copied_from
  cross join me
  where ul.user_id = me.uid
    and c.user_id <> me.uid
    and ul.is_public
    and c.created_at >= now() - interval '30 days'
  union all
  select 'list_invite', m.invited_by, null, null, ul.name, m.created_at,
         ul.id, ul.source_slug
  from public.list_members m
  join public.user_lists ul on ul.id = m.list_id
  cross join me
  where m.user_id = me.uid
    and m.status = 'pending'
    and m.invited_by is not null
    and m.created_at >= now() - interval '30 days'
  union all
  -- 🆕 249 (٤أ) — أعجب أحدٌ بقائمتي: يفتح القائمة
  select 'list_like', k.user_id, null, null, ul.name, k.created_at,
         ul.id, ul.source_slug
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
  s.list_id, s.list_slug
from sig s
join public.profiles pr on pr.id = s.actor_id
cross join me
where not public.is_blocked(me.uid, s.actor_id)
order by s.at desc
limit 30;
$function$;

-- ---------- ٦) إزالةُ النسخ: البابُ يُغلق في القاعدة لا في الواجهة وحدها ----------
-- النسخُ القديمةُ من التطبيق (قبل وصول التحديث) تنادي `copy_list` — فيُسحب حقُّ تنفيذها، والدالّةُ تبقى
-- بلا منفِّذ (لا حذفَ لما قد يُحتاج للرجوع). عمودُ `copied_from` وحارسُه باقيان: لا يكتب فيهما أحدٌ بعد اليوم.
revoke execute on function public.copy_list(uuid) from public, anon, authenticated;

-- ---------- ٧) النسخةُ المنشورةُ الوحيدة «تتحول عنده انه حفظها» ----------
-- يُحفظ الأصلُ لصاحب النسخة (ورايةُ التشغيل تنتقل معه إن كان شغّلها)، ثمّ تُحذف النسخة.
insert into public.list_saves (user_id, list_id, is_playlist)
select c.user_id, c.copied_from, coalesce(c.is_playlist, false)
  from public.user_lists c
  join public.user_lists o on o.id = c.copied_from
 where c.copied_from is not null
   and o.is_public
   and o.user_id <> c.user_id
on conflict (user_id, list_id) do nothing;

delete from public.user_lists where copied_from is not null;

-- التحقّق بعد التشغيل:
--   select count(*) from public.list_likes;                                   -- = حفظاتُ القوائم المعلنة قبل الخطوة ٧ (١٥ يومَ التشغيل؛ تحويلُ النسخة إلى حفظٍ يأتي بعد التعبئة فالحفظاتُ ١٦)
--   select * from public.list_card_stats(array(select id from public.user_lists where is_public limit 5));
--   select count(*) from public.user_lists where copied_from is not null;      -- ٠
--   select has_function_privilege('authenticated', 'public.copy_list(uuid)', 'execute');  -- false
