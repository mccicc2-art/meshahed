-- ============================================================
--  Loopz — الدعوات (بلا اشتراك)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر واجهة الدعوات.
--
--  قرارٌ منتجيّ مسبق: `03_Product_Vision.md` يضع الاشتراكات والإعلانات
--  خارج النطاق، فالمكافأة هنا **رصيدٌ محفوظ** لا اشتراكٌ يُصرف. حين
--  تُقرَّر خطة الاشتراك يُصرف الرصيد بأثرٍ رجعي، ولا نَعِد اليوم بما لا
--  نملك تسليمه.
-- ============================================================

-- ============================================================
--  ١) رمز الدعوة
--
--  رمزٌ مستقلّ لا المعرّف (@username): المعرّف يتغيّر، ورابطُ دعوةٍ
--  انتشر في مجموعةٍ لا يجوز أن يموت بتغيير اسم. ويُولَّد عشوائياً لا
--  تسلسلياً كي لا يُخمَّن رمزُ غيرك فتُنسب إليه دعواتك.
-- ============================================================
create table if not exists public.referral_codes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code       text not null unique
             check (code ~ '^[A-Z0-9]{6,10}$'),
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

-- صاحب الرمز يقرأ رمزه. والبحث برمزٍ عند التسجيل يمرّ بدالة definer أدناه
-- لا بقراءةٍ مفتوحة: القراءة المفتوحة تعني تعداد كل رموز المستخدمين.
drop policy if exists "read own referral code" on public.referral_codes;
create policy "read own referral code" on public.referral_codes
  for select to authenticated using (auth.uid() = user_id);

-- ============================================================
--  ٢) الدعوة المحقَّقة
--
--  صفٌّ واحد لكل مدعوّ مهما تكرّرت المحاولة: `invitee_id` مفتاحٌ أساسي،
--  فلا يُحتسب الشخص الواحد لداعيَين ولا مرّتين لداعٍ واحد.
--
--  و`qualified_at` منفصلٌ عن `created_at` عمداً: الدعوة لا تُحتسب بمجرّد
--  إنشاء الحساب — «ادعُ ٥» بلا شرطٍ تمرينٌ في إنشاء خمسة حسابات وهمية،
--  وثمنُها تخزينٌ ودعمٌ يدفعهما صاحب التطبيق. الشرط: أن يتابع المدعوّ
--  عملاً واحداً على الأقل، وهو أرخص دليلٍ على أنّ خلف الحساب إنساناً.
-- ============================================================
create table if not exists public.referrals (
  invitee_id   uuid primary key references auth.users (id) on delete cascade,
  inviter_id   uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  qualified_at timestamptz,
  check (invitee_id <> inviter_id)
);

alter table public.referrals enable row level security;

create index if not exists referrals_inviter_idx
  on public.referrals (inviter_id, qualified_at);

-- الداعي يرى دعواته، والمدعوّ يرى صفّه. ولا كتابة مباشرة من العميل
-- إطلاقاً: التسجيل والتأهيل يمرّان بدالّتَي definer أدناه.
drop policy if exists "read own referrals" on public.referrals;
create policy "read own referrals" on public.referrals
  for select to authenticated
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

-- ============================================================
--  ٣) الدوال
-- ============================================================

-- رمزي — يُنشأ عند أول طلب فلا حاجة إلى تعبئةٍ رجعية لكل الحسابات
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

  -- ثماني خاناتٍ من أبجديةٍ بلا حروفٍ متشابهة (0/O و1/I): الرمز يُملى
  -- صوتاً ويُكتب باليد، والخلطُ فيه يُنسب الدعوة إلى غير صاحبها
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

-- تسجيل الدعوة: يستدعيها المدعوّ نفسه مرّةً بعد أول دخول
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

  -- لا رمز، أو الرمز رمزُك أنت، أو سُجّلت دعوتك من قبل
  if owner is null or owner = auth.uid() then
    return false;
  end if;
  if exists (select 1 from public.referrals where invitee_id = auth.uid()) then
    return false;
  end if;

  -- الحساب الجديد وحده يُحتسب: من استعمل التطبيق شهراً ثم فتح رابط دعوة
  -- ليس مستخدماً جديداً جلبه أحد. ساعةٌ من إنشاء الحساب مهلةٌ كافية
  if (select created_at from auth.users where id = auth.uid()) < now() - interval '1 hour' then
    return false;
  end if;

  insert into public.referrals (invitee_id, inviter_id)
  values (auth.uid(), owner)
  on conflict (invitee_id) do nothing;

  return true;
end;
$$;

revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;

-- التأهيل: يستدعيها المدعوّ (أو تُستدعى بعد أول متابعة). لا تفعل شيئاً
-- إن لم يتحقّق الشرط، فاستدعاؤها المتكرّر بلا ضرر
create or replace function public.qualify_referral()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  update public.referrals
  set qualified_at = now()
  where invitee_id = auth.uid()
    and qualified_at is null
    and exists (select 1 from public.follows f where f.user_id = auth.uid());

  return found;
end;
$$;

revoke all on function public.qualify_referral() from public;
grant execute on function public.qualify_referral() to authenticated;

-- عدد دعواتي المحقَّقة — للشارة والعدّاد في الملف
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

-- التحقّق بعد التشغيل:
--   select proname from pg_proc where proname in
--     ('my_referral_code','claim_referral','qualify_referral','my_referral_count');
