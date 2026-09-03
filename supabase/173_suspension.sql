-- ============================================================
--  ١٧٣ — الإيقاف: منعُ دخولٍ وإخفاءُ محتوى (D-901)
--  يعتمد على ١٧٢ (`log_admin`) — شغّلها أوّلاً.
-- ============================================================
-- **طلبُ أحمد**: «أقدر أوقف حساب أي شخص» — وقرارُه: **منعُ دخولٍ
-- وإخفاءُ محتوى** معاً.
--
-- 🔑 **ولماذا هذا الملفُّ قصيرٌ إلى هذا الحدّ:** المسحُ على القاعدة
-- الحيّة أعطى الجواب — **أربعةٌ وعشرون قارئاً يمرّون بـ`can_view_profile`
-- أصلاً** (`title_reviews` · `following_activity_v2` · `profile_activity` ·
-- `user_ratings` · `list_reviews_of` …). **فالبوّابةُ الواحدة تُغلق
-- أربعةً وعشرين باباً بتعديلٍ واحد** — وهذا هو ربحُ «قاعدة البوّابة
-- الواحدة» يُقبض اليوم.
-- **والباقي خمسةٌ لا أكثر**: أربعةُ قوائمَ للأشخاص تُرشِّح `is_system`
-- ولا تمرّ بالبوّابة — **وهي مستخرجةٌ بالاستعلام لا بالتخمين.**

-- ------------------------------------------------------------
-- ١) الأعمدة
-- ------------------------------------------------------------
alter table public.profiles add column if not exists suspended_at     timestamptz;
alter table public.profiles add column if not exists suspended_reason text;
alter table public.profiles add column if not exists suspended_by     uuid references auth.users (id) on delete set null;

create index if not exists profiles_suspended_idx
  on public.profiles (suspended_at) where suspended_at is not null;

-- ⚠️ **ولا تُضَفْ هذه الأعمدةُ إلى منحة ١٥٦ العموديّة أبداً.** تلك
-- المنحةُ تُعدِّد ما يكتبه المستخدمُ بنفسه — **وعمودٌ يوقف الحساب لو
-- دخلها لصار المستخدمُ يفكُّ إيقافَ نفسِه**، وهي ثغرةُ D-773 حرفاً.
-- **والعرضُ `public_profiles` لا يُعاد بناؤه هنا** (لا حاجة)، فلا يقع
-- فخُّ «`drop view` يُعيد المنحة».

-- ------------------------------------------------------------
-- ٢) البوّابةُ الواحدة
-- ------------------------------------------------------------
create or replace function public.can_view_profile(target uuid)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select case
    when exists (select 1 from public.profiles
                  where id = target and suspended_at is not null)
      -- الموقوفُ يراه صاحبُه (لا يدخل أصلاً) والمديرُ ليراجع، ولا أحدَ سواهما.
      then coalesce(target = auth.uid(), false) or public.am_admin()
    else
      target = auth.uid()
      or not coalesce((select is_private from public.profiles where id = target), false)
      or exists (select 1 from public.user_follows uf
                  where uf.follower_id = auth.uid() and uf.following_id = target)
      or exists (select 1 from public.library_grants g
                  where g.owner_id = target and g.grantee_id = auth.uid())
  end;
$function$;

-- ------------------------------------------------------------
-- ٣) قوائمُ الأشخاص الأربع — لا تمرّ بالبوّابة، فتُرشَّح صراحةً
--    (مستخرجةٌ بالاستعلام: هي كلُّ ما يُرشِّح `is_system` ولا يستدعي
--     `can_view_profile`. و`people_to_follow` تستدعيها فسقطت منها.)
--    ⚠️ **مُلتقطةٌ من القاعدة الحيّة عند الكوميت 97d82548** — لو غُيّرت
--    إحداها بين الالتقاط والدمج، **فالسطرُ المضاف وحدَه هو المقصود**:
--    `and p.suspended_at is null`.
-- ------------------------------------------------------------

create or replace function public.search_people(q text)
returns table(id uuid, nickname text, username text, avatar_url text, hide_name boolean)
language sql stable security definer set search_path to 'public' as $function$
  with needle as (
    select btrim(coalesce(q, ''))                                         as raw,
           replace(replace(btrim(coalesce(q, '')), '%', '\%'), '_', '\_') as pat
  )
  select p.id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    p.username,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false)
  from public.profiles p, needle n
  where length(n.raw) >= 2
    and not coalesce(p.is_system, false)
    and p.suspended_at is null
    and (
      p.username ilike '%' || n.pat || '%'
      or (coalesce(p.hide_name, false) = false and p.nickname ilike '%' || n.pat || '%')
    )
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by
    case
      when lower(p.username) = lower(n.raw)                                     then 0
      when coalesce(p.hide_name, false) = false and lower(p.nickname) = lower(n.raw) then 0
      when p.username ilike n.pat || '%'                                        then 1
      when coalesce(p.hide_name, false) = false and p.nickname ilike n.pat || '%'    then 1
      else 2
    end,
    (p.username is null), p.username, p.nickname
  limit 20;
$function$;

create or replace function public.people_featured(p_days integer default 90, p_limit integer default 3)
returns table(user_id uuid, nickname text, username text, avatar_url text, hide_name boolean,
              posts integer, reviews integer, total integer, prev_total integer)
language sql stable security definer set search_path to 'public' as $function$
 with win as ( select now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365)) as t0 ),
 people as (
   select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false) as hide_name
   from public.profiles p
   where coalesce(p.is_system, false) = false
     and p.suspended_at is null
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
          or (b.blocker_id = p.id and b.blocked_id = auth.uid())
     )
 ),
 posts_now as ( select r.user_id, count(*)::int c from public.title_posts r, win where r.kind is null and r.hidden = false and r.created_at >= win.t0 group by r.user_id ),
 reviews_now as ( select g.user_id, count(*)::int c from public.ratings g, win where g.review is not null and length(btrim(g.review)) > 0 and g.updated_at >= win.t0 group by g.user_id )
 select pe.id,
   case when pe.hide_name then null else pe.nickname end,
   case when pe.hide_name then null else pe.username end,
   case when pe.hide_name then null else pe.avatar_url end,
   pe.hide_name,
   coalesce(pn.c, 0), coalesce(rn.c, 0),
   (coalesce(pn.c, 0) + coalesce(rn.c, 0))::int, 0::int
 from people pe
 left join posts_now pn on pn.user_id = pe.id
 left join reviews_now rn on rn.user_id = pe.id
 where (coalesce(pn.c, 0) + coalesce(rn.c, 0)) > 0
 order by (coalesce(pn.c, 0) + coalesce(rn.c, 0)) desc, pe.id
 limit least(greatest(coalesce(p_limit, 3), 1), 20);
$function$;

create or replace function public.people_leaderboard(p_limit integer default 20)
returns table(user_id uuid, nickname text, username text, avatar_url text, hide_name boolean,
              posts integer, reviews integer, total integer, prev_total integer)
language sql stable security definer set search_path to 'public' as $function$
 with anchor as ( select ( date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '2 days') - interval '2 days' ) at time zone 'Asia/Riyadh' as t0 ),
 bounds as ( select t0, t0 - interval '7 days' as t_prev, t0 - interval '7 days' + (now() - t0) as t_prev_end from anchor ),
 people as (
   select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false) as hide_name
   from public.profiles p
   where coalesce(p.is_system, false) = false
     and p.suspended_at is null
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
          or (b.blocker_id = p.id and b.blocked_id = auth.uid())
     )
 ),
 posts_now as ( select r.user_id, count(*)::int c from public.title_posts r, bounds where r.kind is null and r.hidden = false and r.created_at >= bounds.t0 group by r.user_id ),
 posts_prev as ( select r.user_id, count(*)::int c from public.title_posts r, bounds where r.kind is null and r.hidden = false and r.created_at >= bounds.t_prev and r.created_at < bounds.t_prev_end group by r.user_id ),
 reviews_now as ( select g.user_id, count(*)::int c from public.ratings g, bounds where g.review is not null and length(btrim(g.review)) > 0 and g.updated_at >= bounds.t0 group by g.user_id ),
 reviews_prev as ( select g.user_id, count(*)::int c from public.ratings g, bounds where g.review is not null and length(btrim(g.review)) > 0 and g.updated_at >= bounds.t_prev and g.updated_at < bounds.t_prev_end group by g.user_id )
 select pe.id,
   case when pe.hide_name then null else pe.nickname end,
   case when pe.hide_name then null else pe.username end,
   case when pe.hide_name then null else pe.avatar_url end,
   pe.hide_name,
   coalesce(pn.c, 0), coalesce(rn.c, 0),
   (coalesce(pn.c, 0) + coalesce(rn.c, 0))::int,
   (coalesce(pp.c, 0) + coalesce(rp.c, 0))::int
 from people pe
 left join posts_now pn on pn.user_id = pe.id
 left join posts_prev pp on pp.user_id = pe.id
 left join reviews_now rn on rn.user_id = pe.id
 left join reviews_prev rp on rp.user_id = pe.id
 where (coalesce(pn.c, 0) + coalesce(rn.c, 0)) > 0
 order by (coalesce(pn.c, 0) + coalesce(rn.c, 0)) desc, pe.id
 limit least(greatest(coalesce(p_limit, 20), 1), 50);
$function$;

create or replace function public.people_top_review(p_days integer default 30, p_limit integer default 3)
returns table(user_id uuid, nickname text, username text, avatar_url text, hide_name boolean,
              tmdb_id integer, media_type text, title text, poster_path text, backdrop_path text,
              review text, rating smallint, likes integer, created_at timestamptz, has_spoiler boolean)
language sql stable security definer set search_path to 'public' as $function$
 with liked as (
   select g.user_id,
     case when coalesce(p.hide_name,false) then null else p.nickname end as nickname,
     case when coalesce(p.hide_name,false) then null else p.username end as username,
     case when coalesce(p.hide_name,false) then null else p.avatar_url end as avatar_url,
     coalesce(p.hide_name, false) as hide_name,
     g.tmdb_id, g.media_type, g.title, g.poster_path, g.backdrop_path,
     g.review, g.rating, coalesce(g.has_spoiler, false) as has_spoiler,
     count(l.*)::int as likes, g.updated_at
   from public.ratings g
   join public.profiles p on p.id = g.user_id
   join public.review_likes l on l.review_user_id = g.user_id and l.tmdb_id = g.tmdb_id and l.media_type = g.media_type
   where g.review is not null and length(btrim(g.review)) > 0
     and g.updated_at >= now() - make_interval(days => least(greatest(coalesce(p_days,30),1), 365))
     and coalesce(p.is_system, false) = false
     and p.suspended_at is null
     and not exists (
       select 1 from public.blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = g.user_id)
          or (b.blocker_id = g.user_id and b.blocked_id = auth.uid())
     )
   group by g.user_id, p.hide_name, p.nickname, p.username, p.avatar_url, g.tmdb_id, g.media_type, g.title, g.poster_path, g.backdrop_path, g.review, g.rating, g.has_spoiler, g.updated_at
 ),
 best as ( select distinct on (k.user_id) k.* from liked k order by k.user_id, k.likes desc, k.updated_at desc )
 select b.user_id, b.nickname, b.username, b.avatar_url, b.hide_name, b.tmdb_id, b.media_type, b.title, b.poster_path, b.backdrop_path, b.review, b.rating, b.likes, b.updated_at, b.has_spoiler
 from best b order by b.likes desc, b.updated_at desc
 limit least(greatest(coalesce(p_limit, 3), 1), 20);
$function$;

-- ------------------------------------------------------------
-- ٤) الأفعال — الحارسُ في الجسم، والأثرُ مسجَّل، والردُّ بالضبط
-- ------------------------------------------------------------
create or replace function public.admin_suspend_user(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  v_posts bigint[];
  v_lists uuid[];
begin
  if not public.am_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'cannot_suspend_self' using errcode = '22023';
  end if;
  if coalesce((select is_admin from public.profiles where id = p_user), false) then
    raise exception 'cannot_suspend_admin' using errcode = '22023';
  end if;
  -- **السببُ إلزاميّ**: «أوقفتُ حسابك» بلا سببٍ بلاغٌ لا قرار،
  -- وهو ما يُعرض للموقوف ويُحفظ في السجلّ.
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if (select suspended_at from public.profiles where id = p_user) is not null then
    raise exception 'already_suspended' using errcode = '22023';
  end if;

  update public.profiles
     set suspended_at = now(), suspended_reason = btrim(p_reason), suspended_by = auth.uid()
   where id = p_user;

  -- 🔑 **نقلبُ ما كان ظاهراً وحدَه، ونحفظ ما قلبناه.** فكُّ الإيقاف
  -- يردُّ هذه الصفوفَ بعينها — **ولا يُظهر ما كان صاحبُه قد أخفاه
  -- بنفسه، ولا ما أخفاه بلاغُ إساءةٍ سابق.**
  with flipped as (
    update public.title_posts set hidden = true
     where user_id = p_user and hidden = false
     returning id
  ) select coalesce(array_agg(id), '{}'::bigint[]) into v_posts from flipped;

  with flipped as (
    update public.user_lists set is_public = false
     where user_id = p_user and is_public = true
     returning id
  ) select coalesce(array_agg(id), '{}'::uuid[]) into v_lists from flipped;

  -- ⚠️ **`banned_until` تمنع إصدارَ رمزٍ جديد ولا تقتل جلسةً قائمة** —
  -- ورمزُ الوصول يعيش ساعة. **فمسحُ رموز التجديد جزءٌ من الفعل لا زينة**،
  -- وإلّا بقي الموقوفُ داخلاً ساعةً كاملةً و«أوقفته» تكذب.
  update auth.users set banned_until = 'infinity'::timestamptz where id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;

  perform public.log_admin('suspend_user', p_user, jsonb_build_object(
    'reason', btrim(p_reason),
    'posts',  to_jsonb(v_posts),
    'lists',  to_jsonb(v_lists)));
end;
$$;

create or replace function public.admin_unsuspend_user(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_detail jsonb;
begin
  if not public.am_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if (select suspended_at from public.profiles where id = p_user) is null then
    raise exception 'not_suspended' using errcode = '22023';
  end if;

  select a.detail into v_detail
    from public.admin_audit a
   where a.action = 'suspend_user' and a.target = p_user
   order by a.at desc
   limit 1;

  update public.profiles
     set suspended_at = null, suspended_reason = null, suspended_by = null
   where id = p_user;

  if v_detail ? 'posts' then
    update public.title_posts set hidden = false
     where user_id = p_user
       and id in (select (jsonb_array_elements_text(v_detail -> 'posts'))::bigint);
  end if;
  if v_detail ? 'lists' then
    update public.user_lists set is_public = true
     where user_id = p_user
       and id in (select (jsonb_array_elements_text(v_detail -> 'lists'))::uuid);
  end if;

  update auth.users set banned_until = null where id = p_user;

  perform public.log_admin('unsuspend_user', p_user, coalesce(v_detail, '{}'::jsonb));
end;
$$;

create or replace function public.admin_users_search(p_q text, lim int default 25)
returns table (id uuid, username text, nickname text, avatar_url text,
               created_at timestamptz, last_sign_in_at timestamptz,
               plan text, is_admin boolean,
               suspended_at timestamptz, suspended_reason text, email_masked text)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select p.id, p.username, p.nickname, p.avatar_url,
         u.created_at, u.last_sign_in_at,
         p.plan, coalesce(p.is_admin, false),
         p.suspended_at, p.suspended_reason,
         -- ⚠️ **البريدُ مقنَّعٌ في القراءة نفسِها**: التمييزُ بين متشابهَي
         -- الاسم يكفيه حرفان والنطاق. **وما لا يُعرض لا يُسرَّب.**
         case when u.email is null then null
              else left(u.email, 2) || '***@' || split_part(u.email, '@', 2) end
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.am_admin()
    and (
      coalesce(btrim(p_q), '') = ''
      or p.username ilike '%' || replace(replace(btrim(p_q), '%', '\%'), '_', '\_') || '%'
      or p.nickname ilike '%' || replace(replace(btrim(p_q), '%', '\%'), '_', '\_') || '%'
      or p.id::text = btrim(p_q)
    )
  order by (p.suspended_at is null), u.created_at desc
  limit least(greatest(coalesce(lim, 25), 1), 100);
$$;

-- الصلاحيّات: `authenticated` وحدَها، والحارسُ في الجسم. **ولا `anon` أبداً.**
revoke all on function public.admin_suspend_user(uuid, text)   from public, anon;
revoke all on function public.admin_unsuspend_user(uuid)       from public, anon;
revoke all on function public.admin_users_search(text, int)    from public, anon;
grant execute on function public.admin_suspend_user(uuid, text) to authenticated;
grant execute on function public.admin_unsuspend_user(uuid)     to authenticated;
grant execute on function public.admin_users_search(text, int)  to authenticated;
