-- ============================================================
--  Loopz — هجرة ١٥٥: «الدعوة والربح» — النموذج النهائي (D-770)
--  شغّلها في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  نموذج أحمد النهائي (٢٩ أغسطس) + حكماه بالسؤالين:
--  «الاثنان معاً» و«بلا قسم الأموال مؤقتاً».
--
--  ١) دعوات الأصدقاء: الدعوة المؤهَّلة = حساب جديد من الرابط + ٥ أعمال
--     + نشاط في ٣ أيام منفصلة خلال أول ١٤ يوماً (البريد موثَّق حكماً —
--     الدخول قوقل وحده). المكافآت: للمدعوّ ١٤ يوم Loopz+ **عند التأهل**
--     (⚖️ نقضُ هدية التسجيل ٣٠ يوماً في ١٥٤ — بحكمه)، وللداعي ٧ أيام
--     لكل تأهيل + شهر عند كل ٥ + ١٤ يوماً إذا اشترك المدعوّ (عمود
--     subscribed_at جاهز؛ إطلاقُه مع فتح الدفع). سقف ٣٦٠ يوماً/سنة.
--  ٢) Loopz Partners: طلب → مراجعة → موافقة بكود /p/ — والنقرات
--     والانضمام يُحصيان من اليوم؛ **العمولات والصرف مؤجَّلة حتى فتح
--     الاشتراكات** (لا اشتراك ولا بوابة دفع بعدُ — D-217: لا وعدَ
--     بما لا يُسلَّم). أنواعُ أحداث الدفع محجوزة في القيد من اليوم.
--  ٣) دفتران لا يُعدَّلان (بند ٦ من نموذجه): plus_rewards
--     وreferral_events — العكسُ حركةٌ مستقلة، لا update ولا delete.
--
--  بنيةٌ فقط: جداول جديدة + أعمدة + استبدال أجسام دوالّ بتواقيعها
--  (لا drop). الجسمان الحيّان لِـ claim/qualify/touch قُرئا بـ
--  pg_get_functiondef قبل البناء (القاعدة ٨). لا سياساتِ qual=true —
--  open_policies يبقى ٥.
--
--  rollback: أجسام 154/153 في تاريخ git + drop للجداول الجديدة
--  (user_active_days · plus_rewards · referral_events · partners ·
--  partner_applications · partner_clicks) ودوالّ D-770 الجديدة.
-- ============================================================

-- ============ ١) أيام النشاط — لقاعدة «٣ أيام منفصلة» ============
create table if not exists public.user_active_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null default current_date,
  primary key (user_id, day)
);
alter table public.user_active_days enable row level security; -- صفر سياسات

-- نبضةُ الحضور (١٥٣) تسجّل يومَ النشاط — سطرٌ فوق الجسم الحيّ حرفاً:
-- صفٌّ واحدٌ لكل يومٍ لكل مستخدم، والتعارضُ صمت
create or replace function public.touch_last_seen()
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.user_active_days (user_id, day)
  select auth.uid(), current_date
  where auth.uid() is not null
  on conflict do nothing;
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid()
     and (last_seen_at is null or last_seen_at < now() - interval '60 seconds');
$$;

revoke all on function public.touch_last_seen() from public;
grant execute on function public.touch_last_seen() to authenticated;

-- ============ ٢) حالة الإحالة ومصدرها ============
alter table public.referrals add column if not exists source text not null default 'friend';
alter table public.referrals drop constraint if exists referrals_source_check;
alter table public.referrals add constraint referrals_source_check check (source in ('friend','partner'));
alter table public.referrals add column if not exists subscribed_at timestamptz;
alter table public.referrals add column if not exists rejected_at timestamptz;
alter table public.referrals add column if not exists invitee_rewarded_at timestamptz;

-- ============ ٣) دفترا المكافآت والأحداث — لا يُعدَّلان ============
create table if not exists public.plus_rewards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  days       integer not null,
  kind       text not null check (kind in
    ('invite_activation','invite_milestone','invite_subscribe','invitee_gift','reversal')),
  ref_user   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.plus_rewards enable row level security; -- صفر سياسات
create index if not exists plus_rewards_user_idx
  on public.plus_rewards (user_id, created_at desc);

-- بند ٧ من نموذجه — الأنواعُ كلُّها محجوزةٌ في القيد من اليوم،
-- والمكتوبُ منها اليومَ: attributed · qualified · reward_issued ·
-- referral_clicked (مجمَّعةً في partner_clicks لا صفّاً لكل نقرة).
-- وأنواعُ الدفع تُكتب يوم يفتح.
create table if not exists public.referral_events (
  id      bigint generated always as identity primary key,
  kind    text not null check (kind in
    ('referral_clicked','referral_attributed','account_verified','referral_qualified',
     'subscription_started','payment_settled','reward_issued',
     'commission_pending','commission_approved','commission_paid','commission_reversed')),
  actor   uuid references auth.users (id) on delete set null,
  subject uuid references auth.users (id) on delete set null,
  meta    jsonb,
  at      timestamptz not null default now()
);
alter table public.referral_events enable row level security; -- صفر سياسات

-- ============ ٤) منحةُ أيام Loopz+ بسقفها — داخليّةٌ بحتة ============
-- لا EXECUTE لأحد: تناديها دوالُّ definer الشقيقة وحدَها (المالكُ يملك).
-- السقف: ٣٦٠ يوماً في السنة المتحرّكة (حكمُه: «١٢ شهراً خلال السنة») —
-- والمنحةُ تُقصّ إلى المتبقّي لا تُرفض كلُّها.
create or replace function public.grant_plus_days(
  p_user uuid, p_days integer, p_kind text, p_ref uuid
)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  used  integer;
  allow integer;
begin
  if p_user is null or p_days is null or p_days <= 0 then return 0; end if;
  select coalesce(sum(days), 0) into used from public.plus_rewards
   where user_id = p_user and days > 0
     and created_at > now() - interval '365 days';
  allow := least(p_days, greatest(0, 360 - used));
  if allow <= 0 then return 0; end if;
  insert into public.plus_rewards (user_id, days, kind, ref_user)
  values (p_user, allow, p_kind, p_ref);
  insert into public.referral_events (kind, actor, subject, meta)
  values ('reward_issued', p_user, p_ref,
          jsonb_build_object('days', allow, 'reward', p_kind));
  update public.profiles
     set plan = case when plan = 'free' then 'plus' else plan end,
         plus_until = case
           when plus_until is null and plan <> 'free' then null
           else greatest(coalesce(plus_until, now()), now())
                + make_interval(days => allow)
         end
   where id = p_user;
  return allow;
end;
$$;

revoke all on function public.grant_plus_days(uuid, integer, text, uuid) from public;

-- ============ ٥) الشركاء — الجداول قبل قارئيها ============
create table if not exists public.partners (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  code        text not null unique check (code ~ '^[A-Z0-9]{6,10}$'),
  approved_at timestamptz not null default now()
);
alter table public.partners enable row level security;
drop policy if exists "read own partner row" on public.partners;
create policy "read own partner row" on public.partners
  for select to authenticated using (auth.uid() = user_id);

create table if not exists public.partner_applications (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  channel_url      text not null check (length(btrim(channel_url)) between 4 and 300),
  content_type     text not null check (length(content_type) <= 120),
  platforms        text not null check (length(platforms) <= 200),
  followers_range  text check (followers_range is null or length(followers_range) <= 40),
  country          text check (country is null or length(country) <= 60),
  content_language text check (content_language is null or length(content_language) <= 60),
  reason           text check (reason is null or length(reason) <= 600),
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at       timestamptz not null default now(),
  decided_at       timestamptz
);
alter table public.partner_applications enable row level security;
drop policy if exists "read own partner application" on public.partner_applications;
create policy "read own partner application" on public.partner_applications
  for select to authenticated using (auth.uid() = user_id);

-- نقراتُ رابط الشريك — مجمَّعةٌ يوماً بيوم (نمط visit_langs: لا IP ولا هوية زائر)
create table if not exists public.partner_clicks (
  partner_id uuid not null references auth.users (id) on delete cascade,
  day        date not null default current_date,
  hits       integer not null default 1,
  primary key (partner_id, day)
);
alter table public.partner_clicks enable row level security; -- صفر سياسات

-- ============ ٦) النسبة — التوقيع الحيّ نفسُه، والبحثُ في البابين ============
-- فوق جسم ١٥٤: الكودُ يُبحث في referral_codes (صديق) ثم partners (شريك)،
-- والمصدرُ يُخزَّن. ⚖️ هديّةُ التسجيل (٣٠ يوماً) سقطت — صارت ١٤ يوماً
-- عند التأهل (نموذجه النهائي). الحرّاسُ كما هم: حسابٌ ≤ ٤٨ ساعة، صفرُ
-- متابعات، نسبةٌ واحدةٌ للعمر، وليس داعيَ نفسِه.
create or replace function public.claim_referral(ref_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
  src   text := 'friend';
  clean text := upper(btrim(coalesce(ref_code, '')));
begin
  if auth.uid() is null or clean = '' then
    return false;
  end if;

  select user_id into owner from public.referral_codes where code = clean;
  if owner is null then
    select user_id into owner from public.partners where code = clean;
    if owner is not null then src := 'partner'; end if;
  end if;

  if owner is null or owner = auth.uid() then
    return false;
  end if;
  if exists (select 1 from public.referrals where invitee_id = auth.uid()) then
    return false;
  end if;
  if (select created_at from auth.users where id = auth.uid()) < now() - interval '48 hours' then
    return false;
  end if;
  if exists (select 1 from public.follows f where f.user_id = auth.uid()) then
    return false;
  end if;

  insert into public.referrals (invitee_id, inviter_id, source)
  values (auth.uid(), owner, src)
  on conflict (invitee_id) do nothing;

  insert into public.referral_events (kind, actor, subject, meta)
  values ('referral_attributed', auth.uid(), owner, jsonb_build_object('source', src));

  return true;
end;
$$;

revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;

-- ============ ٧) التأهيل والمكافآت — التوقيع الحيّ نفسُه ============
-- الشروط: ٥ أعمال (⚖️ كانت ٣) + ٣ أيام نشاطٍ منفصلة خلال أول ١٤ يوماً
-- + لم يُرفض. المكافآت (حكمُه «الاثنان معاً») لدعوات الأصدقاء وحدَها —
-- مؤهَّلُ الشريك يُحصى لعمولةٍ تُفعَّل مع الدفع، لا لمكافآت الأيام
-- («لا يجمع الشريك بين العمولة ومكافآت الدعوات للعملية نفسها»).
create or replace function public.qualify_referral()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me      uuid := auth.uid();
  inviter uuid;
  src     text;
  works   integer;
  days3   integer;
  created timestamptz;
  cnt     integer;
  got     integer;
  due     integer;
begin
  if me is null then return false; end if;

  select inviter_id, source into inviter, src from public.referrals
   where invitee_id = me and qualified_at is null and rejected_at is null;
  if inviter is null then return false; end if;

  select count(*) into works from public.follows f where f.user_id = me;
  if works < 5 then return false; end if;

  select created_at into created from auth.users where id = me;
  select count(*) into days3 from public.user_active_days d
   where d.user_id = me and d.day <= (created + interval '14 days')::date;
  if days3 < 3 then return false; end if;

  update public.referrals set qualified_at = now()
   where invitee_id = me and qualified_at is null;
  if not found then return false; end if;

  insert into public.referral_events (kind, actor, subject, meta)
  values ('referral_qualified', me, inviter, jsonb_build_object('source', src));

  if src = 'friend' then
    -- هديّةُ المدعوّ: ١٤ يوماً عند التأهل — مرّةً واحدة
    update public.referrals set invitee_rewarded_at = now()
     where invitee_id = me and invitee_rewarded_at is null;
    if found then
      perform public.grant_plus_days(me, 14, 'invitee_gift', inviter);
    end if;
    -- الداعي: ٧ أيامٍ لكلِّ تأهيل
    perform public.grant_plus_days(inviter, 7, 'invite_activation', me);
    -- وشهرٌ عند كلِّ خمسة (عدُّ الأصدقاء وحدَه)
    select count(*) into cnt from public.referrals
     where inviter_id = inviter and qualified_at is not null and source = 'friend';
    select ref_months_granted into got from public.profiles where id = inviter;
    due := cnt / 5;
    if due > coalesce(got, 0) then
      update public.profiles set ref_months_granted = due where id = inviter;
      perform public.grant_plus_days(inviter, (due - coalesce(got, 0)) * 30, 'invite_milestone', me);
    end if;
  end if;

  return true;
end;
$$;

revoke all on function public.qualify_referral() from public;
grant execute on function public.qualify_referral() to authenticated;

-- ============ ٨) قوائم العرض وإحصاءاته ============
-- الحالاتُ الخمس (نموذجه بند ٤). my_referral_list (١٥٤) تبقى بجسمها —
-- قارئُها في الواجهة مات، وحذفُ توقيعها يحتاج إذنَ drop فتُترك موثَّقةً.
create or replace function public.my_invite_list()
returns table (person uuid, joined_at timestamptz, status text)
language sql
stable
security definer
set search_path = public
as $$
  select r.invitee_id, r.created_at,
    case
      when r.rejected_at  is not null then 'rejected'
      when r.subscribed_at is not null then 'subscribed'
      when r.qualified_at is not null then 'qualified'
      when exists (select 1 from public.follows f where f.user_id = r.invitee_id)
        or exists (select 1 from public.user_active_days d where d.user_id = r.invitee_id)
        then 'in_progress'
      else 'joined'
    end
  from public.referrals r
  where r.inviter_id = auth.uid() and r.source = 'friend'
  order by r.created_at desc
  limit 500;
$$;

revoke all on function public.my_invite_list() from public;
grant execute on function public.my_invite_list() to authenticated;

create or replace function public.my_invite_stats()
returns table (joined integer, qualified integer, subscribed integer, reward_days integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::int from public.referrals r
      where r.inviter_id = auth.uid() and r.source = 'friend'),
    (select count(*)::int from public.referrals r
      where r.inviter_id = auth.uid() and r.source = 'friend' and r.qualified_at is not null),
    (select count(*)::int from public.referrals r
      where r.inviter_id = auth.uid() and r.source = 'friend' and r.subscribed_at is not null),
    (select coalesce(sum(w.days), 0)::int from public.plus_rewards w
      where w.user_id = auth.uid() and w.days > 0
        and w.kind in ('invite_activation','invite_milestone','invite_subscribe'));
$$;

revoke all on function public.my_invite_stats() from public;
grant execute on function public.my_invite_stats() to authenticated;

-- ============ ٩) أبواب الشريك ============
-- الطلب — upsert لصاحبه: تعديلٌ وهو معلَّق، وإعادةُ تقديمٍ بعد الرفض،
-- **ولا مساسَ بموافَقٍ عليه**
create or replace function public.apply_partner(
  p_channel text, p_content text, p_platforms text,
  p_followers text, p_country text, p_language text, p_reason text
)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  if exists (select 1 from public.partners where user_id = auth.uid()) then return; end if;
  insert into public.partner_applications
    (user_id, channel_url, content_type, platforms, followers_range, country, content_language, reason)
  values (
    auth.uid(),
    btrim(coalesce(p_channel, '')),
    btrim(coalesce(p_content, '')),
    btrim(coalesce(p_platforms, '')),
    nullif(btrim(coalesce(p_followers, '')), ''),
    nullif(btrim(coalesce(p_country, '')), ''),
    nullif(btrim(coalesce(p_language, '')), ''),
    nullif(btrim(coalesce(p_reason, '')), '')
  )
  on conflict (user_id) do update set
    channel_url      = excluded.channel_url,
    content_type     = excluded.content_type,
    platforms        = excluded.platforms,
    followers_range  = excluded.followers_range,
    country          = excluded.country,
    content_language = excluded.content_language,
    reason           = excluded.reason,
    status           = 'pending',
    decided_at       = null,
    created_at       = case when public.partner_applications.status = 'rejected'
                            then now() else public.partner_applications.created_at end
  where public.partner_applications.status <> 'approved';
end;
$$;

revoke all on function public.apply_partner(text, text, text, text, text, text, text) from public;
grant execute on function public.apply_partner(text, text, text, text, text, text, text) to authenticated;

create or replace function public.cancel_partner_application()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  delete from public.partner_applications
   where user_id = auth.uid() and status = 'pending';
$$;

revoke all on function public.cancel_partner_application() from public;
grant execute on function public.cancel_partner_application() to authenticated;

-- نقرةُ رابط /p/ — للزائر أيضاً (anon): تجميعٌ يوميٌّ بلا هويّة زائر،
-- والتنقيةُ في الجسم (D-011): كودٌ غيرُ موجودٍ صمتٌ
create or replace function public.bump_partner_click(p_code text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  p uuid;
begin
  select user_id into p from public.partners
   where code = upper(btrim(coalesce(p_code, '')));
  if p is null then return; end if;
  insert into public.partner_clicks (partner_id, day, hits)
  values (p, current_date, 1)
  on conflict (partner_id, day) do update
    set hits = public.partner_clicks.hits + 1;
end;
$$;

revoke all on function public.bump_partner_click(text) from public;
grant execute on function public.bump_partner_click(text) to anon, authenticated;

-- حالتي كشريك — صفٌّ واحدٌ دائماً (يسارُ الضمّ من ثابت)
create or replace function public.my_partner_state()
returns table (app_status text, applied_at timestamptz, code text, clicks integer, joined integer)
language sql
stable
security definer
set search_path = public
as $$
  select a.status, a.created_at, p.code,
    coalesce((select sum(c.hits)::int from public.partner_clicks c
               where c.partner_id = auth.uid()), 0),
    (select count(*)::int from public.referrals r
      where r.inviter_id = auth.uid() and r.source = 'partner')
  from (select 1) x
  left join public.partner_applications a on a.user_id = auth.uid()
  left join public.partners p on p.user_id = auth.uid();
$$;

revoke all on function public.my_partner_state() from public;
grant execute on function public.my_partner_state() to authenticated;

-- ============ ١٠) بابا الإدارة — الحارسُ في الجسم (D-011) ============
create or replace function public.admin_partner_applications()
returns table (
  user_id uuid, channel_url text, content_type text, platforms text,
  followers_range text, country text, content_language text, reason text,
  status text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, a.channel_url, a.content_type, a.platforms,
         a.followers_range, a.country, a.content_language, a.reason,
         a.status, a.created_at
  from public.partner_applications a
  where public.am_admin()
  order by (a.status = 'pending') desc, a.created_at desc
  limit 200;
$$;

revoke all on function public.admin_partner_applications() from public;
grant execute on function public.admin_partner_applications() to authenticated;

create or replace function public.admin_decide_partner(p_user uuid, p_approve boolean)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  if not public.am_admin() then
    raise exception 'forbidden';
  end if;
  update public.partner_applications
     set status = case when p_approve then 'approved' else 'rejected' end,
         decided_at = now()
   where user_id = p_user and status = 'pending';
  if not found then return; end if;
  if p_approve then
    for i in 1..10 loop
      candidate := (
        select string_agg(
          substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                 (floor(random() * 32) + 1)::int, 1), '')
        from generate_series(1, 8)
      );
      -- لا تصادمَ مع كودَي البابين — رمزٌ واحدٌ لا يفتح بابين
      if not exists (select 1 from public.referral_codes where code = candidate)
         and not exists (select 1 from public.partners where code = candidate) then
        insert into public.partners (user_id, code) values (p_user, candidate)
        on conflict (user_id) do nothing;
        return;
      end if;
    end loop;
    raise exception 'could not allocate a partner code';
  end if;
end;
$$;

revoke all on function public.admin_decide_partner(uuid, boolean) from public;
grant execute on function public.admin_decide_partner(uuid, boolean) to authenticated;

-- التحقّق بعد التشغيل:
--   select count(*) from pg_policies where schemaname='public' and qual='true';  -- = 5 كما هي
--   select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in
--     ('grant_plus_days','my_invite_list','my_invite_stats','apply_partner',
--      'cancel_partner_application','bump_partner_click','my_partner_state',
--      'admin_partner_applications','admin_decide_partner');  -- = 9
--   select count(*) from information_schema.tables where table_schema='public' and table_name in
--     ('user_active_days','plus_rewards','referral_events','partners',
--      'partner_applications','partner_clicks');  -- = 6
--   -- قاعدة ٥ أعمال و٣ أيام و١٤/٧/٣٠ مقروءة من جسم qualify_referral الحي
