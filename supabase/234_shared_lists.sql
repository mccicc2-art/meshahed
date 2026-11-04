-- ============================================================
--  Loopz — القوائمُ المشتركة (234)
--  شغّله في Supabase → SQL Editor — **قبل** نشر «ادعُ» في صفحة القائمة. يحتاج ٢٣٣ قبله (`my_signals` منها).
--
--  ⚖️ **صاحبُ القائمة يدعو، والمدعوُّ يقبل** (أحمد ٤ نوفمبر ٢٠٢٦، البند ٢ من ستّة):
--  ١أ الدعوةُ لمن يتابعهم صاحبُها وحدَهم (كالقروبات) · ٢أ دعوةٌ تُقبل أو تُرفض لا إضافةٌ مباشرة ·
--  ٣أ الأعضاءُ يضيفون أعمالاً ويحذفونها فقط — الاسمُ والترتيبُ والإعلانُ والحذفُ لصاحبها ·
--  ٤ب عشرةٌ مع صاحبها · ٥أ صورةُ من أضاف العملَ على زاويته · ٦ب لا تنبيهَ للإضافة، الدعوةُ وحدَها ·
--  ٧أ مجانيّةٌ للجميع. والقائمةُ الذكيّةُ وقوائمُ لوبز لا تُشارَك: الأولى تملأ نفسَها، والثانيةُ ليست لأحد.
-- ============================================================

-- ---------- ١) الأعضاء ----------
-- صفٌّ لكلِّ (قائمة، عضو) — صاحبُ القائمة ليس صفّاً هنا: ملكيّتُه في `user_lists.user_id` وحدَها، فلا مصدران للحقيقة.
create table if not exists public.list_members (
  list_id     uuid not null references public.user_lists (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  invited_by  uuid references auth.users (id) on delete set null,
  status      text not null default 'pending' check (status in ('pending', 'active')),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (list_id, user_id)
);
create index if not exists list_members_user_idx on public.list_members (user_id, status, created_at desc);

alter table public.list_members enable row level security;

-- ---------- ٢) من أضاف العمل (٥أ) ----------
-- `on delete set null`: حسابٌ يُحذف لا يُسقط أعمالاً أضافها — تبقى في القائمة بلا صورة.
alter table public.user_list_items
  add column if not exists added_by uuid references auth.users (id) on delete set null;

-- الكاتبُ هو الجلسةُ دائماً لا ما يرسله العميل: صورةٌ على بوسترٍ تنسب إضافةً لغير صاحبها كذبةٌ ظاهرة
create or replace function public.user_list_items_added_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.added_by := auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists user_list_items_added_by on public.user_list_items;
create trigger user_list_items_added_by
  before insert on public.user_list_items
  for each row execute function public.user_list_items_added_by();

-- ---------- ٣) أسئلةُ العضويّة — `definer` لتُقرأ من داخل السياسات بلا دوران ----------
-- سياسةٌ على `user_lists` تسأل `list_members`، وسياسةُ `list_members` تسأل `user_lists`: بلا دالّةٍ تتجاوز RLS
-- يدور Postgres بينهما إلى «infinite recursion». الدالّتان تجيبان عن سؤالٍ واحدٍ عن الجلسة نفسِها، لا أكثر.
create or replace function public.list_member_status(p_list uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select m.status from public.list_members m
   where m.list_id = p_list and m.user_id = auth.uid();
$$;

create or replace function public.list_owned(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_lists l where l.id = p_list and l.user_id = auth.uid());
$$;

revoke all on function public.list_member_status(uuid) from public, anon;
revoke all on function public.list_owned(uuid) from public, anon;
grant execute on function public.list_member_status(uuid) to authenticated;
grant execute on function public.list_owned(uuid) to authenticated;

-- ---------- ٤) السياسات ----------
-- المدعوُّ (معلّقاً) يرى القائمةَ وأعمالَها ليقرّر — الدعوةُ هي الإذن، وإلّا دُعي إلى صفحةٍ لا يراها.
drop policy if exists "member reads list" on public.user_lists;
create policy "member reads list" on public.user_lists
  for select to authenticated
  using (public.list_member_status(id) is not null);

drop policy if exists "member reads list items" on public.user_list_items;
create policy "member reads list items" on public.user_list_items
  for select to authenticated
  using (public.list_member_status(list_id) is not null);

-- ٣أ: العضوُ الفعّالُ يضيف ويحذف — ولا تعديل (الترتيبُ `sort_order` لصاحبها). والذكيّةُ لا تُشارَك أصلاً،
-- والحارسُ هنا أيضاً لأن قائمةً قد تصير ذكيّةً بعد المشاركة.
drop policy if exists "member adds list items" on public.user_list_items;
create policy "member adds list items" on public.user_list_items
  for insert to authenticated
  with check (
    public.list_member_status(list_id) = 'active'
    and exists (select 1 from public.user_lists l where l.id = list_id and l.kind <> 'smart')
  );

drop policy if exists "member removes list items" on public.user_list_items;
create policy "member removes list items" on public.user_list_items
  for delete to authenticated
  using (public.list_member_status(list_id) = 'active');

-- من يرى الأعضاء: صاحبُها (والمعلّقون معهم)، والعضوُ نفسُه، والفعّالون لكلِّ من يرى القائمة.
-- الكتابةُ كلُّها في الدوالّ أدناه — لا سياسةَ إدراجٍ ولا تعديلٍ ولا حذفٍ مباشر.
drop policy if exists "read list members" on public.list_members;
create policy "read list members" on public.list_members
  for select to authenticated, anon
  using (
    user_id = auth.uid()
    or public.list_owned(list_id)
    or (
      status = 'active'
      and exists (select 1 from public.user_lists l where l.id = list_id)
    )
  );
grant select on public.list_members to authenticated, anon;
revoke insert, update, delete on public.list_members from authenticated, anon;

-- ---------- ٥) الأفعال ----------
-- ١أ + ٤ب: الدعوةُ لمن أتابعه، وعشرةٌ مع صاحبها (المعلّقون يُحسبون: مقعدٌ محجوزٌ مقعد).
create or replace function public.invite_list_members(p_list uuid, p_users uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  l public.user_lists;
  v_taken integer;
  v_new uuid[];
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  select * into l from public.user_lists where id = p_list;
  if not found or l.user_id <> v_uid then raise exception 'list_not_owner' using errcode = '42501'; end if;
  if l.kind = 'smart' or l.source_slug is not null then raise exception 'list_not_shareable' using errcode = '22023'; end if;

  select coalesce(array_agg(distinct u), '{}') into v_new
    from unnest(coalesce(p_users, '{}')) u
   where u <> v_uid
     and exists (select 1 from public.user_follows f where f.follower_id = v_uid and f.following_id = u)
     and not public.is_blocked(v_uid, u)
     and not exists (select 1 from public.list_members m where m.list_id = p_list and m.user_id = u);
  if cardinality(v_new) = 0 then return 0; end if;

  select count(*) into v_taken from public.list_members where list_id = p_list;
  if 1 + v_taken + cardinality(v_new) > 10 then
    raise exception 'list_members_full' using errcode = '22023';
  end if;

  insert into public.list_members (list_id, user_id, invited_by, status)
  select p_list, u, v_uid, 'pending' from unnest(v_new) u
  on conflict do nothing;
  return cardinality(v_new);
end;
$$;

-- ٢أ: المدعوُّ وحدَه يقبل أو يرفض دعوتَه — الرفضُ يحذف الصفّ فتُعاد دعوتُه لاحقاً إن شاء صاحبُها
create or replace function public.respond_list_invite(p_list uuid, p_accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_accept then
    update public.list_members set status = 'active', accepted_at = now()
     where list_id = p_list and user_id = v_uid and status = 'pending';
    if not found then raise exception 'list_invite_missing' using errcode = 'P0002'; end if;
    return 'active';
  end if;
  delete from public.list_members where list_id = p_list and user_id = v_uid and status = 'pending';
  return 'declined';
end;
$$;

-- صاحبُها يزيل أيَّ عضوٍ أو يلغي دعوتَه، والعضوُ يغادر بنفسه — والأعمالُ التي أضافها تبقى في القائمة
create or replace function public.remove_list_member(p_list uuid, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if p_user <> v_uid and not exists (select 1 from public.user_lists l where l.id = p_list and l.user_id = v_uid) then
    raise exception 'list_not_owner' using errcode = '42501';
  end if;
  delete from public.list_members where list_id = p_list and user_id = p_user;
  return found;
end;
$$;

revoke all on function public.invite_list_members(uuid, uuid[]) from public, anon;
revoke all on function public.respond_list_invite(uuid, boolean) from public, anon;
revoke all on function public.remove_list_member(uuid, uuid) from public, anon;
grant execute on function public.invite_list_members(uuid, uuid[]) to authenticated;
grant execute on function public.respond_list_invite(uuid, boolean) to authenticated;
grant execute on function public.remove_list_member(uuid, uuid) to authenticated;

-- ---------- ٦) الجرس: «دعاك فلانٌ إلى قائمة» ----------
-- نصُّ ٢٣٣ حرفاً + فرعُ `list_invite`.
create or replace function public.my_signals()
returns table(kind text, actor_id uuid, nickname text, username text, avatar_url text, hide_name boolean,
              tmdb_id integer, media_type text, title text, at timestamp with time zone, is_new boolean,
              list_id uuid, list_slug text)
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
  -- 🆕 233 — نسخ أحدٌ قائمتي: الجرسُ يفتح قائمتي (الأصل) لا نسختَه الخاصّة
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
  -- 🆕 234 — دُعيتُ إلى قائمةٍ مشتركة: الدعوةُ المعلّقةُ وحدَها، والقائمةُ تُرى وإن كانت خاصّة (الدعوةُ هي الإذن)
  select 'list_invite', m.invited_by, null, null, ul.name, m.created_at,
         ul.id, ul.source_slug
  from public.list_members m
  join public.user_lists ul on ul.id = m.list_id
  cross join me
  where m.user_id = me.uid
    and m.status = 'pending'
    and m.invited_by is not null
    and m.created_at >= now() - interval '30 days'
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
-- التحقّق بعد التشغيل:
select p.oid::regprocedure as fn, p.prosecdef as definer,
       (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'user_list_items' and column_name = 'added_by') as added_by_col,
       to_regclass('public.list_members') is not null as members_table
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname in ('invite_list_members', 'respond_list_invite', 'remove_list_member', 'list_member_status', 'list_owned', 'my_signals');
