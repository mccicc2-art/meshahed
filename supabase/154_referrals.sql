-- ============================================================
--  Loopz — هجرة ١٥٤: دعوةُ الأصدقاء — تبنّي البنية الحيّة وإعادةُ
--  تشكيلها على حكم أحمد (D-768)
--  شغّلها في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  🔴 **اكتشافٌ وُثّق قبل البناء**: القاعدةُ الحيّةُ كانت تحمل نظامَ
--  إحالةٍ سابقاً — جدولا `referral_codes` و`referrals` وأربعُ دوالّ —
--  **بلا ملفِّ هجرةٍ في المستودع ولا قيدٍ في schema_migrations ولا
--  مستهلكٍ واحدٍ في الواجهة، والجدولان صفرُ صفوف** (دَينُ ١٣٣–١٣٩ب
--  بعينه). بُني جيّداً (RLS + سياستا قراءةٍ مقيّدتان + قيودٌ سليمة)
--  **فتُبُنّي بدل أن يُهدم** — وهذا الملفُّ سجلُّه الأوّلُ والكامل.
--
--  حكمُ أحمد (٢٨ أغسطس): لكلِّ عضوٍ رابطُ دعوةٍ دائمٌ ويرى كم واحداً
--  دخل عن طريقه ومَن هم · **كلُّ ٥ دعواتٍ محتسبةٍ = شهرُ Loopz+**
--  (٥ ← شهر، ١٠ ← شهران، بلا سقف) · **المدعوُّ يبدأ بشهرِ Loopz+
--  تجربة** · **والاحتسابُ بعد أن يتابع المدعوُّ ٣ أعمال** (كان في
--  النسخة الحيّة عملاً واحداً — ⚖️ نُقض بحكمه؛ ومهلةُ النسبة وُسّعت
--  من ساعةٍ إلى ٤٨ ساعةً: من فتح الرابطَ على جوّاله وسجّل مساءً ليس
--  متلاعباً — وحارسُ «صفر متابعات» يسدّ بابَ القدامى).
--
--  بنيةٌ فقط: عمودُ عدّادٍ على profiles + استبدالُ جسمَي دالّتين
--  (بتوقيعيهما — لا drop) + دالّةُ قائمةٍ جديدة + فهرس. الجدولان
--  الحيّان يُتركان كما هما، ودالّتا `my_referral_code` و
--  `my_referral_count` تبقيان بجسمَيهما الحيَّين حرفاً (مسجَّلتان
--  أدناه للسجلّ). لا سياساتِ جديدة — open_policies يبقى ٥.
--
--  rollback:
--    drop function if exists public.my_referral_list();
--    -- جسما claim_referral/qualify_referral القديمان في تاريخ git لهذا الملف
--    alter table public.profiles drop column if exists ref_months_granted;
--    drop index if exists public.referrals_inviter_idx;
-- ============================================================

-- ٠) السجلُّ الحرفيُّ لِما كان حيّاً بلا ملفّ — `if not exists` يجعله
--    صفراً على البيئة الحيّة وبناءً كاملاً في بيئةٍ جديدة (لا drop):
create table if not exists public.referral_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code       text not null unique check (code ~ '^[A-Z0-9]{6,10}$'),
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
drop policy if exists "read own referral code" on public.referral_codes;
create policy "read own referral code" on public.referral_codes
  for select to authenticated using (auth.uid() = user_id);

create table if not exists public.referrals (
  invitee_id   uuid primary key references auth.users (id) on delete cascade,
  inviter_id   uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  qualified_at timestamptz,
  check (invitee_id <> inviter_id)
);
alter table public.referrals enable row level security;
drop policy if exists "read own referrals" on public.referrals;
create policy "read own referrals" on public.referrals
  for select to authenticated
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

create index if not exists referrals_inviter_idx
  on public.referrals (inviter_id);

-- ١) عدّادُ الأشهر المصروفة للداعي — على profiles لا جدولَ جديد
alter table public.profiles
  add column if not exists ref_months_granted integer not null default 0;

-- ٢) كودي — **الجسمُ الحيُّ حرفاً، بلا تغيير** (أبجديةٌ بلا 0/O و1/I:
--    الرمزُ يُملى صوتاً، والخلطُ يُنسب الدعوةَ لغير صاحبها)
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  existing text;
  candidate text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select code into existing from public.referral_codes where user_id = auth.uid();
  if existing is not null then
    return existing;
  end if;

  for i in 1..10 loop
    candidate := (
      select string_agg(
        substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
               (floor(random() * 32) + 1)::int, 1), '')
      from generate_series(1, 8)
    );
    begin
      insert into public.referral_codes (user_id, code) values (auth.uid(), candidate);
      return candidate;
    exception when unique_violation then
      -- تصادمٌ نادر — نجرّب رمزاً آخر
    end;
  end loop;

  raise exception 'could not allocate a referral code';
end;
$$;

revoke all on function public.my_referral_code() from public;
grant execute on function public.my_referral_code() to authenticated;

-- ٣) نسبةُ الحساب الجديد إلى داعيه — التوقيعُ الحيُّ نفسُه (لا drop)،
--    والجسمُ على حكم أحمد: مهلةُ ٤٨ ساعة + صفرُ متابعات + هديّةُ
--    المدعوّ (شهرُ Loopz+ لمن خطّتُه free وحدَه — لا مساسَ بقائم)
create or replace function public.claim_referral(ref_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  select user_id into owner
  from public.referral_codes
  where code = upper(btrim(coalesce(ref_code, '')));

  if owner is null or owner = auth.uid() then
    return false;
  end if;
  if exists (select 1 from public.referrals where invitee_id = auth.uid()) then
    return false;
  end if;

  -- حسابٌ جديدٌ فعلاً: عمرُه ≤ ٤٨ ساعةً **ولم يتابع شيئاً بعد** —
  -- فمن استعمل التطبيقَ ثم فتح رابطاً ليس مدعوّاً جلبه أحد
  if (select created_at from auth.users where id = auth.uid()) < now() - interval '48 hours' then
    return false;
  end if;
  if exists (select 1 from public.follows f where f.user_id = auth.uid()) then
    return false;
  end if;

  insert into public.referrals (invitee_id, inviter_id)
  values (auth.uid(), owner)
  on conflict (invitee_id) do nothing;

  -- هديّةُ المدعوّ (حكمُه: «شهر بلس تجربة») — free وحدَه
  update public.profiles
     set plan = 'plus', plus_until = now() + interval '30 days'
   where id = auth.uid() and plan = 'free';

  return true;
end;
$$;

revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;

-- ٤) الاحتسابُ والمكافأة — التوقيعُ الحيُّ نفسُه، والجسمُ على حكمه:
--    ⚖️ **ثلاثةُ أعمالٍ لا عملٌ واحد** (نقضُ النسخة الحيّة بأمر صاحبها)،
--    وعند الاحتساب تُصرف للداعي أشهرُه المستحقّة: المحتسَبون ÷ ٥ منقوصاً
--    منه المصروف. داعٍ بلا تاريخِ انتهاءٍ وخطّتُه ليست free (مؤسّسٌ/مدى
--    الحياة): لا تاريخَ يُمسّ — عدّادُه وحدَه يزيد. يناديها فعلُ
--    المتابعة والاستيرادُ بلا انتظارٍ — وتخرج فوراً لغير المدعوّ.
create or replace function public.qualify_referral()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  inviter uuid;
  cnt integer;
  got integer;
  due integer;
begin
  if me is null then
    return false;
  end if;

  select inviter_id into inviter from public.referrals
   where invitee_id = me and qualified_at is null;
  if inviter is null then
    return false;
  end if;

  if (select count(*) from public.follows f where f.user_id = me) < 3 then
    return false;
  end if;

  update public.referrals set qualified_at = now()
   where invitee_id = me and qualified_at is null;
  if not found then
    return false;
  end if;

  select count(*)::int into cnt from public.referrals
   where inviter_id = inviter and qualified_at is not null;
  select ref_months_granted into got from public.profiles where id = inviter;
  due := cnt / 5;
  if due > coalesce(got, 0) then
    update public.profiles
       set ref_months_granted = due,
           plan = case when plan = 'free' then 'plus' else plan end,
           plus_until = case
             when plus_until is null and plan <> 'free' then null
             else greatest(coalesce(plus_until, now()), now())
                  + make_interval(months => (due - coalesce(got, 0)))
           end
     where id = inviter;
  end if;

  return true;
end;
$$;

revoke all on function public.qualify_referral() from public;
grant execute on function public.qualify_referral() to authenticated;

-- ٥) عدّادي — **الجسمُ الحيُّ حرفاً، بلا تغيير** (المحتسَبون وحدَهم)
create or replace function public.my_referral_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.referrals
  where inviter_id = auth.uid() and qualified_at is not null;
$$;

revoke all on function public.my_referral_count() from public;
grant execute on function public.my_referral_count() to authenticated;

-- ٦) 🆕 دعواتي — من دخلوا عن طريقي: الهويّةُ لعرضها من public_profiles،
--    وتاريخُ الانضمام من صفِّ الإحالة نفسِه
create or replace function public.my_referral_list()
returns table (person uuid, joined_at timestamptz, counted boolean)
language sql
stable
security definer
set search_path = public
as $$
  select r.invitee_id, r.created_at, (r.qualified_at is not null)
  from public.referrals r
  where r.inviter_id = auth.uid()
  order by r.created_at desc
  limit 500;
$$;

revoke all on function public.my_referral_list() from public;
grant execute on function public.my_referral_list() to authenticated;

-- التحقّق بعد التشغيل:
--   select count(*) from pg_policies where schemaname='public' and qual='true';  -- = 5 كما هي
--   select proname from pg_proc where proname in ('my_referral_code',
--     'claim_referral','qualify_referral','my_referral_count','my_referral_list');  -- = 5
--   select count(*) from information_schema.columns
--    where table_name='profiles' and column_name='ref_months_granted';  -- = 1
