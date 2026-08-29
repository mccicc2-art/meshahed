-- ============================================================================
-- 159_subscriptions.sql — طبقةُ الاستحقاق (D-795)
-- ============================================================================
--
-- **بوّابةُ الدفع لم تُختَر بعد** (سجلٌّ تجاريٌّ ثمّ بائعٌ مسجَّلٌ متعدّدُ
-- العملات) — **وهذا الجدولُ لا ينتظرها**: هو **مصدرُ الحقيقة للاشتراك**،
-- ومسارُ الويبهوك يُكتب يومَ يُعرف المزوّد **لأنّ شكلَه شكلُه** (Paddle
-- وLemon Squeezy يختلفان في كلّ حقل).
--
-- 🔑 **ولماذا جدولٌ لا عمودان في `profiles`**: `plus_until` تجيب سؤالاً
-- واحداً — **«هل هو مشترِكٌ الآن؟»** — **ولا تجيب: من المزوّد؟ ما رقمُ
-- الاشتراك عنده؟ هل أُلغي وينتهي في نهاية المدّة؟ ومتى تنتهي سنتُه الأولى
-- (وهي مدّةُ عمولة الشريك ومدّةُ السعر المخفَّض)؟** **وعمودٌ يُسأل عمّا
-- لم يُبنَ له يكذب أو يُهجَر.**
--
-- ⚖️ **والمرآةُ تريغر لا وظيفةُ تطبيق**: `profiles.plus_until` تبقى
-- الحقلَ الذي يقرؤه `isPlus` في كلِّ سطح — **وقارئٌ واحدٌ لا يتبدّل**
-- (D-145). **والتريغرُ يكتبها من الاشتراك**، فلا يعرف الرسمُ بمزوّدٍ ولا
-- بحالةِ فوترة.
--
-- 🔴 **والمؤسِّسُ محميٌّ بشرطٍ صريح**: `plus_until = null` عنده تعني «بلا
-- انتهاء» — **وتريغرٌ يكتب تاريخاً فوقها يسلبه ما وُهب مدى الحياة**
-- (هجرة ١٤١). **فلا يُمسّ صفٌّ `founder = true` أبداً.**
--
-- ⚠️ **ولا سياسةَ كتابةٍ للعميل**: الصفوفُ تُكتب من الخادم بمفتاح الخدمة
-- يومَ يصل الويبهوك — **ومن ملك كتابةَ اشتراكه ملك الاشتراكَ نفسَه.**
-- **والسياساتُ المفتوحةُ تبقى أربعاً** (فحصُ ما بعد التشغيل أدناه).
-- ============================================================================

begin;

-- ─── ١) الجدول ─────────────────────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id) on delete cascade,
  /* **المزوّدُ نصٌّ لا `enum`**: `enum` تحتاج هجرةً لكلِّ مزوّدٍ يُضاف،
     **والقيدُ يقبل التوسعةَ بسطر.** و`manual` لمنحةٍ بيد أحمد. */
  provider               text not null
                         check (provider in ('paddle', 'lemonsqueezy', 'stripe', 'manual')),
  /* معرّفُ الاشتراك عند المزوّد — **مفتاحُ عدم التكرار عند إعادة الويبهوك** */
  external_id            text,
  status                 text not null default 'active'
                         check (status in ('active', 'past_due', 'canceled', 'expired')),
  plan                   text not null default 'plus' check (plan in ('plus')),
  /* **نهايةُ المدّة المدفوعة** — وهي ما يُنسخ إلى `profiles.plus_until` */
  current_period_end     timestamptz,
  /* **أُلغي ويكمل مدّتَه**: لا يُنتزع ما دُفع مقابلُه (نصُّ صفحة الشروط) */
  cancel_at_period_end   boolean not null default false,
  /* 🔑 **نهايةُ السنة الأولى** — **حقلٌ لسببين لا واحد**: سعرُ السنة
     الأولى المخفَّض (D-786)، **وعمولةُ الشريك ٢٥٪ «خلال السنة الأولى»**
     (D-782) — **وحسابُها من `created_at` كان سيكذب عند تبديل خطّة أو
     إعادة اشتراك.** */
  first_year_ends_at     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

/* **صفٌّ واحدٌ لكلِّ اشتراكٍ عند المزوّد** — وإعادةُ إرسال الويبهوك
   تُحدِّث ولا تُضاعف (`on conflict`). */
create unique index if not exists subscriptions_provider_external_idx
  on public.subscriptions (provider, external_id)
  where external_id is not null;

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id, status);

-- ─── ٢) الصلاحيّات: قراءةُ صاحبه فقط، ولا كتابةَ من العميل ────────────────
alter table public.subscriptions enable row level security;

drop policy if exists subscriptions_owner_read on public.subscriptions;
create policy subscriptions_owner_read on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid());

/* **ولا `anon`**: اشتراكُ أحدهم ليس شأنَ زائر (D-627 حدُّ القراءة العامّة) */
revoke all on public.subscriptions from anon;
grant select on public.subscriptions to authenticated;

-- ─── ٣) المرآةُ إلى `profiles.plus_until` ─────────────────────────────────
create or replace function public.sync_plan_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* 🔴 **المؤسِّسُ لا يُمسّ**: `plus_until = null` عنده «بلا انتهاء» */
  update public.profiles p
     set plan = case
                  when new.status = 'active' then 'plus'
                  when new.current_period_end is not null
                       and new.current_period_end > now() then 'plus'
                  else p.plan
                end,
         plus_until = new.current_period_end
   where p.id = new.user_id
     and coalesce(p.founder, false) = false
     /* **والشريكُ لا يهبط إلى `plus`**: رتبتُه أعلى ولا تُشترى (D-786) */
     and p.plan <> 'partner';
  return new;
end;
$$;

alter function public.sync_plan_from_subscription() owner to postgres;

drop trigger if exists subscriptions_sync_plan on public.subscriptions;
create trigger subscriptions_sync_plan
  after insert or update of status, current_period_end on public.subscriptions
  for each row execute function public.sync_plan_from_subscription();

-- ─── ٤) ختمُ التعديل ───────────────────────────────────────────────────────
create or replace function public.touch_subscription_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch
  before update on public.subscriptions
  for each row execute function public.touch_subscription_updated_at();

commit;

-- ============================================================================
-- فحوصُ ما بعد التشغيل — **تُشغَّل فعلاً ولا يُكتفى بوجودها** (README)
-- ============================================================================
-- select count(*) as open_policies from pg_policies
--   where schemaname = 'public' and qual = 'true';        -- المتوقَّع: 4
-- select count(*) as anon_can_read from information_schema.role_table_grants
--   where table_name = 'subscriptions' and grantee = 'anon';  -- المتوقَّع: 0
-- select tgname from pg_trigger where tgrelid = 'public.subscriptions'::regclass
--   and not tgisinternal;                                 -- المتوقَّع: صفّان
-- select count(*) as rows from public.subscriptions;      -- المتوقَّع: 0 (جدولٌ نائم)
