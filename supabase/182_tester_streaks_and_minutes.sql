-- ============================================================
--  ١٨٢ — تتابعُ الدخول ودقائقُ اليوم للمختبِرين (D-917، طلبُ أحمد:
--        «كل يوم أدخل وأتأكد أنهم دخلوا وجلسوا وقتاً كافياً — وعدّاد فوق
--        إذا اكتمل الـ١٢ ودخلوا مع بعض»)
-- ============================================================
-- ١٨١ أجابت «هل دخل؟». هذه تجيب **«هل يدخل كلَّ يوم، وكم يجلس؟»** — وهما
-- سؤالا الأربعةَ عشرَ يوماً لا سؤالُ اليوم الأوّل.
--
-- 🔑 **الدقائقُ تُقدَّر من نبضات الحضور لا تُقاس**: النبضةُ تدقّ كلَّ أربع
--    دقائق في الويب (D-765) وفي التطبيق (D-917)، والصفُّ يُلمس مرّةً كلَّ
--    ثلاث دقائق على الأكثر — **فكلُّ ضربةٍ ≈ أربعُ دقائق**، والواجهةُ تقول
--    «≈» ولا تدّعي ثانية. عدّادُ ضرباتٍ بلا ثانيةٍ إضافيّةٍ في كلِّ نبضة.
--
-- 🔑 **واليومُ يومُ الرياض لا يومُ الخادم**: `current_date` كان UTC، فمن
--    فتح التطبيقَ في الواحدة فجراً كان يُحسب على أمس. `loopz_today()`
--    مصدرٌ واحدٌ للكتابة والقراءة معاً — **يومان مختلفان في جهتين هو
--    عطلُ «لم يدخل اليوم» الذي لا يفسّره أحد.**
--
-- ⚖️ **ولا تُغيَّر `touch_last_seen` إلا بالسطر اللازم**: جسمُها الحيُّ
--    (١٥٣ + ١٥٥) يُعاد حرفاً مع `on conflict do update` بدل `do nothing`.

-- ============ ١) يومُ Loopz ============
create or replace function public.loopz_today()
returns date
language sql stable
set search_path = public
as $$
  select (now() at time zone 'Asia/Riyadh')::date;
$$;
revoke all on function public.loopz_today() from public;
grant execute on function public.loopz_today() to authenticated;

-- ============ ٢) الصفُّ اليوميُّ يعدّ ضرباتِه ============
alter table public.user_active_days
  add column if not exists hits     integer     not null default 1,
  add column if not exists app_hits integer     not null default 0,
  add column if not exists last_at  timestamptz not null default now();

-- ============ ٣) نبضةُ الويب (١٥٣/١٥٥) — تعدّ بدل أن تصمت ============
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_active_days (user_id, day)
  select auth.uid(), public.loopz_today()
  where auth.uid() is not null
  on conflict (user_id, day) do update
     set hits = user_active_days.hits + 1, last_at = now()
   where user_active_days.last_at < now() - interval '3 minutes';
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '60 seconds');
$$;

-- ============ ٤) نبضةُ المنصّة (١٨١) — تعدّ ضرباتِ التطبيق على حدة ============
create or replace function public.touch_presence(p_platform text, p_is_app boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_p text; v_app int;
begin
  if auth.uid() is null then return; end if;
  v_p := case when p_platform in ('android','ios','windows','mac','linux') then p_platform else 'other' end;
  v_app := case when coalesce(p_is_app, false) then 1 else 0 end;
  insert into public.user_active_days (user_id, day, app_hits)
  values (auth.uid(), public.loopz_today(), v_app)
  on conflict (user_id, day) do update
     set hits = user_active_days.hits + 1,
         app_hits = user_active_days.app_hits + excluded.app_hits,
         last_at = now()
   where user_active_days.last_at < now() - interval '3 minutes';
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '60 seconds');
  insert into public.user_devices (user_id, platform, is_app)
  values (auth.uid(), v_p, coalesce(p_is_app, false))
  on conflict (user_id, platform, is_app) do update
     set last_seen_at = now(), hits = user_devices.hits + 1
   where user_devices.last_seen_at < now() - interval '5 minutes';
end;
$$;

-- ============ ٥) التتابع — أيّامٌ متّصلةٌ تنتهي اليومَ أو أمس ============
-- **المرساةُ اليومُ إن دخل اليوم، وإلا أمس**: من دخل أمسَ ولم يدخل بعدُ
-- اليومَ لم ينقطع تتابعُه — ينقطع عند منتصف الليل التالي. والحسابُ صفٌّ
-- برقمه: أوّلُ فجوةٍ تجعل `day < anchor - rn` إلى الأبد، فالعدُّ دقيق.
create or replace function public.active_streak(p_user uuid, p_today date)
returns int
language sql stable
set search_path = public
as $$
  with a as (
    select case when exists (select 1 from public.user_active_days d where d.user_id = p_user and d.day = p_today)
                then p_today else p_today - 1 end as anchor
  ), x as (
    select d.day, (row_number() over (order by d.day desc) - 1)::int as rn
    from public.user_active_days d, a
    where d.user_id = p_user and d.day <= a.anchor
  )
  select count(*)::int from x, a where x.day = a.anchor - x.rn;
$$;
revoke all on function public.active_streak(uuid, date) from public, anon;

-- ============ ٦) المختبِرون — الأعمدةُ اليوميّة ============
-- نوعُ الردّ يتغيّر، فالدالّةُ تُسقط وتُعاد لا تُستبدل.
drop function if exists public.admin_testers();
create function public.admin_testers()
returns table (email text, note text, invited_at timestamptz,
               user_id uuid, username text, nickname text,
               created_at timestamptz, last_sign_in_at timestamptz,
               last_seen_at timestamptz, active_days_30 int,
               platforms text, on_app boolean, suspended_at timestamptz,
               active_today boolean, app_today boolean, streak int,
               days_14 int, app_days_14 int, minutes_today int, minutes_7d int)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  with today as (select public.loopz_today() as d)
  select t.email, t.note, t.invited_at,
         u.id, p.username, p.nickname,
         u.created_at, u.last_sign_in_at, p.last_seen_at,
         (select count(*)::int from public.user_active_days d where d.user_id = u.id and d.day > today.d - 30),
         (select string_agg(distinct d.platform, ' · ') from public.user_devices d where d.user_id = u.id),
         coalesce((select bool_or(d.is_app) from public.user_devices d where d.user_id = u.id), false),
         p.suspended_at,
         exists (select 1 from public.user_active_days d where d.user_id = u.id and d.day = today.d),
         exists (select 1 from public.user_active_days d where d.user_id = u.id and d.day = today.d and d.app_hits > 0),
         case when u.id is null then 0 else public.active_streak(u.id, today.d) end,
         (select count(*)::int from public.user_active_days d where d.user_id = u.id and d.day > today.d - 14),
         (select count(*)::int from public.user_active_days d where d.user_id = u.id and d.day > today.d - 14 and d.app_hits > 0),
         -- ≈ أربعُ دقائق لكلِّ ضربة (إيقاعُ النبضة)
         coalesce((select d.hits * 4 from public.user_active_days d where d.user_id = u.id and d.day = today.d), 0),
         coalesce((select sum(d.hits)::int * 4 from public.user_active_days d where d.user_id = u.id and d.day > today.d - 7), 0)
  from public.play_testers t
  cross join today
  left join auth.users u on lower(u.email) = t.email and u.deleted_at is null
  left join public.profiles p on p.id = u.id
  where public.am_admin()
  order by (u.last_sign_in_at is null), u.last_sign_in_at desc nulls last, t.email;
$$;
revoke all on function public.admin_testers() from public, anon;
grant execute on function public.admin_testers() to authenticated;

-- ============ ٧) العدّادُ الأعلى — أيّامٌ دخل فيها الجميعُ معاً ============
-- «الجميع» = كلُّ من في القائمة وله حساب. **قائمةٌ ناقصةٌ عن ١٢ تُعلَن
-- ناقصةً** (`with_account < needed`) — لا يُدَّعى اكتمالٌ لم يقع.
create or replace function public.admin_testers_daily()
returns jsonb
language sql stable security definer set search_path = public, auth, pg_temp as $$
  with today as (select public.loopz_today() as d),
  tu as (
    select u.id from public.play_testers t
    join auth.users u on lower(u.email) = t.email and u.deleted_at is null
  ),
  n as (select count(*)::int as c from tu),
  per_day as (
    select d.day, count(distinct d.user_id)::int as c
    from public.user_active_days d join tu on tu.id = d.user_id, today
    where d.day > today.d - 60
    group by d.day
  ),
  full_days as (select per_day.day from per_day, n where n.c > 0 and per_day.c = n.c),
  a as (
    select case when exists (select 1 from full_days, today where full_days.day = today.d)
                then today.d else today.d - 1 end as anchor from today
  ),
  x as (
    select f.day, (row_number() over (order by f.day desc) - 1)::int as rn
    from full_days f, a where f.day <= a.anchor
  )
  select case when not public.am_admin() then null else jsonb_build_object(
    'today', (select d from today),
    'with_account', (select c from n),
    'active_today', coalesce((select per_day.c from per_day, today where per_day.day = today.d), 0),
    'all_streak', (select count(*)::int from x, a where x.day = a.anchor - x.rn),
    'all_today', exists (select 1 from full_days, today where full_days.day = today.d)
  ) end;
$$;
revoke all on function public.admin_testers_daily() from public, anon;
grant execute on function public.admin_testers_daily() to authenticated;

-- ============ فحوصٌ بعد التشغيل ============
--   select count(*) from pg_policies where schemaname='public';        -- بلا تغيير (٥ مفتوحة بحسب README)
--   select public.loopz_today(), current_date;                         -- يختلفان بين ٠٠:٠٠ و٠٣:٠٠ بتوقيت الرياض
--   select column_name from information_schema.columns
--    where table_name='user_active_days' and column_name in ('hits','app_hits','last_at');  -- ٣
--   select public.admin_testers_daily();                               -- jsonb لا null (بحساب المدير)
