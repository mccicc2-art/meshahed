-- ============================================================
--  ٧٧ — loopz_account · Loopz يصير حساباً (D-252)
--
--  **بنصّ أحمد:** «متابعة وبلوك مثله مثل أي حساب، لازم يكون حساب وله
--  مهام ينفذها». **وبإذنٍ صريحٍ منه على هذه الهجرة بعينها** لأنها تكتب
--  في سكيما `auth` — وهو ما لا يشمله الإذن الدائم في `19` §4.
--
--  ================= لماذا صفٌّ في `auth.users` ولا مفرّ =================
--
--  `public.profiles.id` مقيَّدٌ بـ`auth.users(id)`، و`user_follows`
--  و`blocks` تشيران إلى الجدول نفسه. **فالمتابعةُ والحظرُ لا يقعان على
--  كائنٍ خارج هذا الجدول** — وهذا هو الجدار نفسُه الذي أوقفنا في D-236،
--  **والحلُّ هناك كان جدولاً ثالثاً ولا يصلح هنا**: هناك كنّا نحتاج
--  «مؤلِّفَ نشرة» ولا يُتابَع، وهنا نحتاج **صفَّ الهويّة بعينه.**
--
--  ================= وحسابٌ لا يستطيع الدخول أبداً =================
--
--  **لا كلمةَ مرور** (`encrypted_password` فارغ) · **لا بريد** فلا رابطَ
--  سحريّ يُطلب له · **ولا صفَّ في `auth.identities`** فلا حسابَ Google
--  يُطابقه. **وثلاثةُ أبوابٍ مغلقة لا واحد** — والحسابُ الذي لا باب له
--  ليس ثغرةً بل سجلُّ هويّة.
--
--  ================= والمعرّف محجوزٌ ويُقرأ في السجلّ =================
--
--  `100b2000-0000-4000-8000-000000000001` — يُقرأ «loopz» بالنظر.
--  **ولا يبدأ بأصفارٍ عمداً**: `search_people` تستعمل
--  `00000000-0000-0000-0000-000000000000` رايةً لـ«لا هويّة»،
--  **ومعرّفٌ يشبه رايةً يُخلط بها يوماً.**
--
--  ================= والحارسُ عمودٌ لا اسمٌ مكتوبٌ في كل دالّة =================
--
--  `profiles.is_system` — **لأن الاستثناء بالمعرّف الحرفيّ يُنسى في أوّل
--  دالّةٍ تُكتب بعده**، والعمودُ يسأل عنه من يكتبها. ويُطبَّق هنا على
--  البابين اللذين يعرضان الناسَ للناس: `search_people` و`people_to_follow`.
--  **ولا يُطبَّق على الخطّ**: نشرةُ Loopz يجب أن تظهر — هي سببُ الحساب.
--
--  التحقّق:
--    select id, username, nickname, is_system from public.profiles
--      where is_system;                                  -- صفٌّ واحد
--    select count(*) from auth.identities
--      where user_id = '100b2000-0000-4000-8000-000000000001';   -- 0
--    select * from public.search_people('loopz');        -- فارغ
--    select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';        -- أربعٌ لا خامسة
-- ============================================================

alter table public.profiles
  add column if not exists is_system boolean not null default false;

-- الصفُّ في `auth.users`: `id` وحده إلزاميٌّ بلا افتراض، والباقي وصفٌ.
-- و`on_auth_user_created` يقرأ `raw_user_meta_data` فيكتب الملفَّ بنفسه.
insert into auth.users (id, instance_id, aud, role, raw_user_meta_data, raw_app_meta_data)
values (
  '100b2000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '{"full_name":"Loopz","avatar_url":"/icon-192.png"}'::jsonb,
  '{"provider":"system","providers":["system"]}'::jsonb
)
on conflict (id) do nothing;

-- الملفُّ نفسُه: ما كتبه المُشغِّل يُثبَّت هنا صراحةً، ولا يُترك للصدفة.
insert into public.profiles (id, nickname, username, avatar_url, is_system, is_private)
values ('100b2000-0000-4000-8000-000000000001', 'Loopz', 'loopz', '/icon-192.png', true, false)
on conflict (id) do update
  set nickname   = excluded.nickname,
      username   = excluded.username,
      avatar_url = excluded.avatar_url,
      is_system  = true,
      is_private = false;

-- ============================================================
--  البابُ الأوّل — بحثُ الناس: الحسابُ النظاميّ خارجه
-- ============================================================
create or replace function public.search_people(q text)
returns table (
  id uuid,
  nickname text,
  username text,
  avatar_url text,
  hide_name boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with needle as (
    select
      btrim(coalesce(q, ''))                                              as raw,
      replace(replace(btrim(coalesce(q, '')), '%', '\%'), '_', '\_')      as pat
  )
  select
    p.id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    p.username,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false)
  from public.profiles p, needle n
  where length(n.raw) >= 2
    and not coalesce(p.is_system, false)
    and (
      p.username ilike '%' || n.pat || '%'
      or (
        coalesce(p.hide_name, false) = false
        and p.nickname ilike '%' || n.pat || '%'
      )
    )
    and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by
    case
      when lower(p.username) = lower(n.raw)                                   then 0
      when coalesce(p.hide_name, false) = false
           and lower(p.nickname) = lower(n.raw)                               then 0
      when p.username ilike n.pat || '%'                                      then 1
      when coalesce(p.hide_name, false) = false
           and p.nickname ilike n.pat || '%'                                  then 1
      else 2
    end,
    (p.username is null),
    p.username,
    p.nickname
  limit 20;
$$;
revoke all on function public.search_people(text) from public;
grant execute on function public.search_people(text) to authenticated;

-- ============================================================
--  البابُ الثاني — «أشخاصٌ لمتابعتهم»: كذلك خارجه
--  (معطَّلٌ في الواجهة منذ D-187، **ويُحرَس الآن لا يومَ يُفتح** —
--   حارسٌ يُؤجَّل إلى يوم الحاجة يُنسى في ذلك اليوم بعينه.)
-- ============================================================
create or replace function public.people_to_follow(
  seed_ids integer[] default null,
  want     integer   default 6
)
returns table (
  id         uuid,
  nickname   text,
  username   text,
  avatar_url text,
  hide_name  boolean,
  shared     integer,
  followers  integer
)
language sql
stable
security definer
set search_path = public
as $$
with me as (
  select auth.uid() as uid
),
seeds as (
  select distinct s.tmdb_id
  from unnest(
    coalesce(
      seed_ids,
      array(
        select f.tmdb_id
        from public.follows f, me
        where me.uid is not null
          and f.user_id = me.uid
        order by f.added_at desc
        limit 24
      )
    )
  ) as s(tmdb_id)
),
overlap as (
  select f.user_id as id, count(*)::integer as shared
  from public.follows f
  join seeds s on s.tmdb_id = f.tmdb_id, me
  where me.uid is not null
    and f.user_id <> me.uid
  group by f.user_id
  order by count(*) desc
  limit 50
),
popular as (
  select uf.following_id as id, count(*)::integer as followers
  from public.user_follows uf
  group by uf.following_id
  order by count(*) desc
  limit 50
),
pool as (
  select id from overlap
  union
  select id from popular
)
select
  p.id,
  p.nickname,
  p.username,
  p.avatar_url,
  false                          as hide_name,
  coalesce(o.shared, 0)          as shared,
  coalesce(pp.followers, 0)      as followers
from pool x
join public.profiles p on p.id = x.id
left join overlap o  on o.id  = x.id
left join popular pp on pp.id = x.id, me
where me.uid is not null
  and p.id <> me.uid
  and not coalesce(p.is_system, false)
  and coalesce(p.hide_name, false) = false
  and public.can_view_profile(p.id)
  and not public.is_blocked(me.uid, p.id)
  and not exists (
    select 1 from public.user_follows uf
    where uf.follower_id = me.uid and uf.following_id = p.id
  )
  and not exists (
    select 1 from public.follow_requests fr
    where fr.requester_id = me.uid and fr.target_id = p.id
  )
order by coalesce(o.shared, 0) desc, coalesce(pp.followers, 0) desc, p.id
limit least(greatest(coalesce(want, 6), 1), 12);
$$;
revoke all on function public.people_to_follow(integer[], integer) from public;
grant execute on function public.people_to_follow(integer[], integer) to authenticated;
