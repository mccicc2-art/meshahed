-- ============================================================
--  ١٨١ — متابعةُ المختبِرين ومنصّاتُ المستخدمين (D-909، طلبُ أحمد:
--        «أتابع لوبز ١٠٠٪ — الـ١٢ حساباً هل دخلوا، ومن يستخدم أندرويد»)
-- ============================================================
-- المتابعةُ تسكن `/admin` وحدَها (D-901). وهذه الهجرةُ تضيف السؤالين
-- اللذين لم تكن القاعدةُ تملك جوابَهما:
--
-- ١) **«هل دخل المختبِرُ الذي دعوتُه؟»** — Play Console يعرف من دُعي،
--    ولا يعرف من فتح التطبيق. **والوصلُ بينهما البريدُ**: قائمةُ الدعوة
--    تسكن `play_testers` (يكتبها أحمد)، والجوابُ ضمٌّ على `auth.users`.
--    🔑 **ولا بريدَ يُعرض إلا بريدٌ كتبه أحمد بنفسه** — القائمةُ مُدخَلُه
--    لا تسريبُ القاعدة.
--
-- ٢) **«من يستخدم أندرويد الآن؟»** — مرشّحو الاختبار. ⚠️ **و`auth.sessions`
--    لا تصلح مصدراً**: قِيست في الإنتاج ٥ سبتمبر فكانت **٤٥ جلسةً من ٥٥
--    وسمُها `node`** — لأنّ خادمَنا هو من يجدّد الرمز فيدهس وسمَ المتصفّح.
--    **فالمصدرُ نبضةُ الحضور** (١٥٣/١٥٥): تمرّ على خادمنا في كلِّ حال،
--    **والوسمُ يُقرأ من ترويسة الطلب لا من نصٍّ يرسله العميل** (وصفةُ
--    `lang-ping`/D-666: **لا يُصدّق ما يقوله متصفّح عن نفسه**).
--    والقديمُ يُستردّ مرّةً من الجلسات التي نجا وسمُها — **ماضٍ ناقصٌ خيرٌ
--    من صفرٍ يكذب** (D-063).
--
-- **ولا صفَّ يحمل أكثر ممّا يحتاجه السؤال**: صنفُ المنصّة لا وسمُ الجهاز
-- كاملاً — **الوسمُ الكاملُ بصمةٌ تعرّف صاحبَها، والصنفُ لا** (D-666).

-- ============ ١) منصّاتُ المستخدم — صفٌّ لكلِّ (مستخدم، منصّة) ============
create table if not exists public.user_devices (
  user_id       uuid    not null references auth.users (id) on delete cascade,
  platform      text    not null check (platform in ('android','ios','windows','mac','linux','other')),
  is_app        boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  hits          integer not null default 1,
  primary key (user_id, platform, is_app)
);
alter table public.user_devices enable row level security; -- صفر سياسات: definer وحدَها تكتب وتقرأ
create index if not exists user_devices_platform_idx
  on public.user_devices (platform, last_seen_at desc);

-- ============ ٢) نبضةُ الحضور وقد صارت تعرف المنصّة ============
-- **دالّةٌ باسمٍ جديدٍ لا حِملٌ ثانٍ على `touch_last_seen`**: حِملان بالاسم
-- نفسِه أحدُهما بمعاملاتٍ افتراضيّة يجعلان النداءَ الفارغَ ملتبساً في
-- Postgres — **والالتباسُ عطلٌ يظهر بعد الشحن.** والقديمةُ تبقى كما هي.
create or replace function public.touch_presence(p_platform text, p_is_app boolean default false)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_p text;
begin
  if auth.uid() is null then return; end if;
  -- **القيمةُ تُحبس في قائمةٍ مغلقة**: ما لا نعرفه «أخرى» — لا نصٌّ حرٌّ يدخل عموداً
  v_p := case when p_platform in ('android','ios','windows','mac','linux') then p_platform else 'other' end;

  insert into public.user_active_days (user_id, day)
  values (auth.uid(), current_date)
  on conflict do nothing;

  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '60 seconds');

  -- خنقٌ ثالث: صفُّ الجهاز يُلمس كلَّ خمس دقائق لا كلَّ نبضة
  insert into public.user_devices (user_id, platform, is_app)
  values (auth.uid(), v_p, coalesce(p_is_app, false))
  on conflict (user_id, platform, is_app) do update
     set last_seen_at = now(), hits = user_devices.hits + 1
   where user_devices.last_seen_at < now() - interval '5 minutes';
end;
$$;

revoke all on function public.touch_presence(text, boolean) from public, anon;
grant execute on function public.touch_presence(text, boolean) to authenticated;

-- ============ ٣) استردادُ الماضي مرّةً واحدة ============
-- الجلساتُ التي نجا وسمُها من التجديد الخادميّ — والباقي لا يُخمّن.
insert into public.user_devices (user_id, platform, is_app, first_seen_at, last_seen_at, hits)
select s.user_id,
       case when s.user_agent ilike '%android%'          then 'android'
            when s.user_agent ~* 'iphone|ipad|ipod'      then 'ios'
            when s.user_agent ilike '%windows%'          then 'windows'
            when s.user_agent ~* 'macintosh|mac os'      then 'mac'
            when s.user_agent ilike '%linux%'            then 'linux'
            else 'other' end,
       false, min(s.created_at), max(s.updated_at), count(*)::int
from auth.sessions s
where s.user_agent ilike 'Mozilla/%'
group by 1, 2
on conflict do nothing;

-- ============ ٤) قائمةُ الدعوة — مُدخَلُ أحمد لا قراءةُ القاعدة ============
create table if not exists public.play_testers (
  email      text primary key,
  note       text,
  added_at   timestamptz not null default now(),
  added_by   uuid references auth.users (id) on delete set null,
  invited_at timestamptz
);
alter table public.play_testers enable row level security; -- صفر سياسات

-- ============ ٥) القراءاتُ والكتاباتُ الإداريّة — الحارسُ في الجسم (D-011) ============
create or replace function public.admin_testers()
returns table (email text, note text, invited_at timestamptz,
               user_id uuid, username text, nickname text,
               created_at timestamptz, last_sign_in_at timestamptz,
               last_seen_at timestamptz, active_days_30 int,
               platforms text, on_app boolean, suspended_at timestamptz)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select t.email, t.note, t.invited_at,
         u.id, p.username, p.nickname,
         u.created_at, u.last_sign_in_at, p.last_seen_at,
         (select count(*)::int from public.user_active_days d
           where d.user_id = u.id and d.day > current_date - 30),
         (select string_agg(distinct d.platform, ' · ') from public.user_devices d where d.user_id = u.id),
         coalesce((select bool_or(d.is_app) from public.user_devices d where d.user_id = u.id), false),
         p.suspended_at
  from public.play_testers t
  left join auth.users u on lower(u.email) = t.email and u.deleted_at is null
  left join public.profiles p on p.id = u.id
  where public.am_admin()
  order by (u.last_sign_in_at is null), u.last_sign_in_at desc nulls last, t.email;
$$;

-- **مرشّحو الاختبار**: من فُتح له التطبيقُ على أندرويد **من المتصفّح**
-- (لا من التطبيق: هذا مختبِرٌ أصلاً)، وليس بريدُه في قائمة الدعوة.
create or replace function public.admin_android_candidates(p_days int default 30)
returns table (user_id uuid, username text, nickname text, avatar_url text,
               email_masked text, created_at timestamptz, seen_at timestamptz,
               active_days_30 int, watched int)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select p.id, p.username, p.nickname, p.avatar_url,
         -- القناعُ نفسُه الذي في `admin_users_search` (١٧٣) — **صيغةٌ واحدة لا اثنتان**
         case when u.email is null then null
              else left(u.email, 2) || '***@' || split_part(u.email, '@', 2) end,
         u.created_at,
         max(d.last_seen_at),
         (select count(*)::int from public.user_active_days a
           where a.user_id = p.id and a.day > current_date - 30),
         (select count(*)::int from public.watched_episodes w where w.user_id = p.id)
  from public.user_devices d
  join public.profiles p on p.id = d.user_id
  join auth.users u on u.id = p.id and u.deleted_at is null
  where public.am_admin()
    and d.platform = 'android'
    and d.is_app = false
    and d.last_seen_at > now() - make_interval(days => greatest(coalesce(p_days, 30), 1))
    and coalesce(p.is_admin, false) = false
    and lower(u.email) not in (select t.email from public.play_testers t)
  group by p.id, p.username, p.nickname, p.avatar_url, u.email, u.created_at
  order by max(d.last_seen_at) desc;
$$;

create or replace function public.admin_tester_add(p_email text, p_note text default null)
returns void language plpgsql volatile security definer
set search_path = public, auth, pg_temp as $$
declare v text;
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  v := lower(btrim(coalesce(p_email, '')));
  -- الشكلُ يُحكَم هنا لا في الواجهة (D-011): بريدٌ بلا `@` سطرٌ ميّتٌ في القائمة
  if v !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' or length(v) > 254 then
    raise exception 'bad_email';
  end if;
  insert into public.play_testers (email, note, added_by)
  values (v, nullif(btrim(coalesce(p_note, '')), ''), auth.uid())
  on conflict (email) do update set note = coalesce(excluded.note, play_testers.note);
  perform public.log_admin('tester_add', null, jsonb_build_object('email', v));
end;
$$;

create or replace function public.admin_tester_remove(p_email text)
returns void language plpgsql volatile security definer
set search_path = public, auth, pg_temp as $$
declare v text;
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  v := lower(btrim(coalesce(p_email, '')));
  delete from public.play_testers where email = v;
  perform public.log_admin('tester_remove', null, jsonb_build_object('email', v));
end;
$$;

create or replace function public.admin_tester_invited(p_email text, p_on boolean)
returns void language plpgsql volatile security definer
set search_path = public, auth, pg_temp as $$
declare v text;
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  v := lower(btrim(coalesce(p_email, '')));
  update public.play_testers
     set invited_at = case when coalesce(p_on, false) then now() else null end
   where email = v;
end;
$$;

-- **كشفُ البريد فعلٌ لا عرض**: القوائمُ مقنّعةٌ دائماً، **والكشفُ نداءٌ
-- واحدٌ يُكتب في `admin_audit`** — دعوةُ مرشّحٍ إلى Play تحتاج بريدَه
-- كاملاً، **وما لا يُسجَّل يصير عادةً لا استثناء** (روحُ ١٧٢).
create or replace function public.admin_reveal_email(p_user uuid)
returns text language plpgsql volatile security definer
set search_path = public, auth, pg_temp as $$
declare v text;
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  select u.email into v from auth.users u where u.id = p_user and u.deleted_at is null;
  if v is null then raise exception 'not_found'; end if;
  perform public.log_admin('reveal_email', p_user, '{}'::jsonb);
  return v;
end;
$$;

revoke all on function public.admin_testers()                     from public, anon;
revoke all on function public.admin_android_candidates(int)       from public, anon;
revoke all on function public.admin_tester_add(text, text)        from public, anon;
revoke all on function public.admin_tester_remove(text)           from public, anon;
revoke all on function public.admin_tester_invited(text, boolean) from public, anon;
revoke all on function public.admin_reveal_email(uuid)            from public, anon;
grant execute on function public.admin_testers()                     to authenticated;
grant execute on function public.admin_android_candidates(int)       to authenticated;
grant execute on function public.admin_tester_add(text, text)        to authenticated;
grant execute on function public.admin_tester_remove(text)           to authenticated;
grant execute on function public.admin_tester_invited(text, boolean) to authenticated;
grant execute on function public.admin_reveal_email(uuid)            to authenticated;

-- ============ ٦) ملخّصُ الفهرس — دالّةٌ صغيرةٌ لا نسخةٌ من ١٧٧ ============
-- ⚖️ **ولمَ لا يُوسَّع `admin_overview` كما يقتضي «نداءٌ واحد» (١٧٧)؟**
-- لأنّ توسيعَها يعني **إعادةَ كتابة مئةٍ وثلاثين سطراً حيّةً حرفاً بحرف**
-- لتُضاف إليها ستّةَ عشرَ — **وخطأُ نسخٍ واحدٌ في نداءٍ يقرؤه الفهرسُ كلَّ
-- فتحة أغلى من رحلةٍ ثانيةٍ إلى القاعدة**؛ **وملفُّ الهجرة سجلٌّ لا يُعاد
-- صوغُه** (درسُ ١٧٥). فالجديدُ يسكن دالّتَه، والقديمةُ لا تُمَسّ.
create or replace function public.admin_testers_summary()
returns jsonb
language sql stable security definer
set search_path = public, auth, pg_temp as $$
  select case when not public.am_admin() then null else jsonb_build_object(
    'testers', (select jsonb_build_object(
      'total',        count(*),
      'with_account', count(*) filter (where u.id is not null),
      'signed_in',    count(*) filter (where u.last_sign_in_at is not null),
      'active_7d',    count(*) filter (where u.last_sign_in_at > now() - interval '7 days')
    ) from public.play_testers t
      left join auth.users u on lower(u.email) = t.email and u.deleted_at is null),
    'platforms', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'platform', platform, 'users', users, 'app_users', app_users) order by users desc), '[]'::jsonb)
      from (
        select platform,
               count(distinct user_id)::int as users,
               count(distinct user_id) filter (where is_app)::int as app_users
        from public.user_devices
        where last_seen_at > now() - interval '30 days'
        group by platform
      ) pl
    )
  ) end;
$$;

revoke all on function public.admin_testers_summary() from public, anon;
grant execute on function public.admin_testers_summary() to authenticated;
