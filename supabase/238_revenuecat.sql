-- ============================================================================
-- 238_revenuecat.sql — Loopz+ المرحلة ١: خادمُ الاشتراكات (خطّةُ Loopz+ v2 §9 · أحمد ٥–٦ نوفمبر «نفذ معها المرحلة ١»)
-- ============================================================================
--
-- 🔑 **RevenueCat مزوّدٌ، والجدولُ نفسُه** (هجرة ١٥٩ بنته «لمزوّدٍ لم يُختَر بعد»): صفٌّ لكلِّ شراءٍ عند المتجر
-- (`store:original_transaction_id`)، والويبهوك يكتبه بمفتاح الخدمة وحده. يُضاف: المتجرُ والمنتجُ والبيئةُ
-- (`production` · `sandbox`) ونوعُ المدّة وختمُ آخر حدث (لترتيب الأحداث المتأخّرة) ووقتُ أوّل شراء (مرساةُ سنة العمولة).
--
-- 🔑 **المرآةُ تُعيد الحسابَ من صفوف العضو كلِّها** لا من الصفّ الذي قدح (مراجعةُ ٥ نوفمبر المستقلّة): أبعدُ نهايةٍ
-- شغّالةٍ هي نهايةُ اشتراكه، وأعلى طبقةٍ هي طبقتُه. وكانت تتخطّى المؤسِّسَ (`founder = true`) فمن اشترى منهم لم يأخذ
-- بلس أبداً — **المؤسِّسُ اليوم بتاريخٍ ينتهي (٣٠ نوفمبر وما بعده) لا «مدى الحياة»**، فيدخل الحسابَ كغيره: شراؤه يمدّ
-- تاريخَه إن كان أبعد، ولا يقصّه إن كان أقرب.
-- - **ولا تمسّ ما لم يأتِ من المتجر**: `profiles.store_until` يحفظ آخرَ نهايةٍ كتبتها المرآة؛ فلا تُقصّ `plus_until` عند
--   استرجاعٍ أو انتهاء إلّا إن كانت هي هي (لم يُضف إليها يومُ مكافأةٍ ولا منحةٌ يدويّة بعدها).
-- - **الشريكُ يبقى شريكاً** (`plan = 'partner'`) ويمتدّ تاريخُه، و«بلا انتهاء» (`plus_until` فارغة مع خطّةٍ غير المجانيّة)
--   لا يُمسّ.
--
-- 🔑 **الذهبيُّ حقلٌ مستقلّ** (`profiles.gold_until`) لا قيمةٌ جديدةٌ في `plan`: القيدُ يقبل free/plus/partner، و`asPlan()`
-- في كلِّ تطبيقٍ أقدم يقرأ المجهولَ «مجانيّاً» — فذهبيٌّ في `plan` كان سيُسقط مشتركاً إلى المجانيّ على 1.13.x. والذهبيُّ
-- بلسٌ دائماً (نهايتُه داخلةٌ في نهاية بلس)، والشريكُ يقدر أن يكون ذهبيّاً (أحمد «٧ نعم»).
--
-- 🔑 **تجربةُ المتجر (sandbox) تمنح صلاحيّتَها القصيرة وحدها** (أحمد «٦ نعم»): مدّةُ المتجر التجريبيّة دقائق، فتدخل الحسابَ
-- وتنتهي وحدها — **ولا تُحتسب لشريكٍ ولا لمكافأةٍ ولا لإيراد** (العمولةُ والمكافأةُ تشترطان `production`).
--
-- 🔑 **العمولةُ دفترٌ لا يُعدَّل** (`partner_commissions`): ٢٥٪ من **الصافي** (السعرُ بعد الضريبة ورسم المتجر) عن كلِّ دفعةٍ
-- في السنة الأولى من أوّل اشتراك، والاسترجاعُ سطرٌ سالب. والرصيدُ المتاح ما مضت عليه ٣٠ يوماً (نصُّ «شروط العمولة»)
-- ناقصاً ما طُلب صرفُه. `partner_balance` كانت صفراً «بالواقع لا بالتحفّظ» (هجرة ١٧٤) — وهذا يومُ تتبدّل.
--
-- 🔑 **«وتحصل على ١٤ يوماً إضافية حين يشترك»** (صفحةُ الدعوات، هجرة ١٥٥ حجزت `subscribed_at` و`invite_subscribe` «يوم يفتح
-- الدفع»): أوّلُ شراءٍ حقيقيٍّ للمدعوّ يختم الإحالةَ ويمنح الداعي أيّامَه بسقفها السنويّ.
--
-- 🔑 **القروباتُ ١٦** (الخطّة §١٢ «Groups 16 for both tiers»): الجسمان الحيّان قُرئا بـ`pg_get_functiondef` (٦ نوفمبر)
-- ونُسخا حرفاً، وتبدّل الرقمان وحدَهما (١١ ⇢ ١٥ مدعوّاً مع المنشئ، ١٢ ⇢ ١٦ عند الإضافة).
--
-- ⚠️ لا سياساتِ قراءةٍ جديدة: الجداولُ الجديدةُ بلا سياسات (مفتاحُ الخدمة ودوالُّ definer وحدها). `open_policies` يبقى ٥.
-- rollback: أجسامُ ١٥٩ و١٧٤ و٢٠٥/٢١٢ في تاريخ git، و`drop` للجدولين الجديدين والأعمدة الجديدة.
-- ============================================================================

begin;

-- ─── ١) الاشتراكات: مزوّدٌ وطبقةٌ وأعمدةُ المتجر ─────────────────────────────
alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check
  check (provider in ('paddle', 'lemonsqueezy', 'stripe', 'manual', 'revenuecat'));
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('plus', 'gold'));

alter table public.subscriptions add column if not exists store text;
alter table public.subscriptions add column if not exists product_id text;
alter table public.subscriptions add column if not exists environment text not null default 'production';
alter table public.subscriptions drop constraint if exists subscriptions_environment_check;
alter table public.subscriptions add constraint subscriptions_environment_check check (environment in ('production', 'sandbox'));
alter table public.subscriptions add column if not exists period_type text;
/* ختمُ آخر حدثٍ كُتب (`event_timestamp_ms`): حدثٌ أقدمُ يصل متأخّراً لا يُرجع الصفَّ إلى ما قبله */
alter table public.subscriptions add column if not exists last_event_ms bigint;
/* وقتُ أوّل شراءٍ لهذا الصفّ — أقدمُها في صفوف العضو الحقيقيّة مرساةُ «السنة الأولى» للعمولة */
alter table public.subscriptions add column if not exists first_purchase_at timestamptz;
/* 🆕 الشريكُ يُثبَّت على صفّ الشراء يومَ يُكتب أوّلَ مرّة (المراجعةُ المستقلّة ٦ نوفمبر): نقلُ الشراء إلى حسابٍ آخر (TRANSFER)
   لا يعيد نسبتَه إلى داعي الحساب الجديد، واسترجاعُ دفعةٍ قبل النقل يعكس عمولةَ صاحبها (الخطّة: «no re-attribution on TRANSFER») */
alter table public.subscriptions add column if not exists partner_id uuid references auth.users (id) on delete set null;

-- ─── ٢) الملفّ: الذهبيُّ ونهايةُ المتجر ────────────────────────────────────
/* لا منحةَ تعديلٍ للعضو على العمودين (منحُ `profiles` أعمدةٌ مسمّاة — هجراتٌ سابقة): الخادمُ وحده يكتبهما */
alter table public.profiles add column if not exists gold_until timestamptz;
alter table public.profiles add column if not exists store_until timestamptz;
/* ما كان في `plus_until` قبل أن يمدّه المتجر (مؤسِّسٌ حتى ٣٠ نوفمبر، مكافأةٌ، منحة) — يعود إليه إن استُرجع الشراءُ أو نُقل */
alter table public.profiles add column if not exists plus_base_until timestamptz;

-- ─── ٣) المرآة: إعادةُ الحساب من صفوف العضو كلِّها ───────────────────────────
create or replace function public.recompute_plan(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_end     timestamptz;
  v_gold    timestamptz;
  v_forever boolean;
  p         record;
  v_until   timestamptz;
  v_plan    text;
  v_base    timestamptz;
  v_extra   interval;
  v_store   boolean;
begin
  if p_user is null then return; end if;
  /* الشغّالُ: نهايتُه بعدُ لم تأتِ ولم يُختم منتهياً (الاسترجاعُ يُختم منتهياً بوقته) */
  select max(s.current_period_end) filter (where s.current_period_end > now() and s.status <> 'expired'),
         max(s.current_period_end) filter (where s.current_period_end > now() and s.status <> 'expired' and s.plan = 'gold'),
         /* «بلا انتهاء» للمنحة اليدويّة وحدها — صفُّ متجرٍ بلا تاريخ (شراءٌ مدى الحياة أو حدثٌ ناقص) لا يصير بلس دائماً */
         coalesce(bool_or(s.provider = 'manual' and s.status = 'active' and s.current_period_end is null), false)
    into v_end, v_gold, v_forever
    from public.subscriptions s
   where s.user_id = p_user;

  select plan, plus_until, store_until, plus_base_until into p from public.profiles where id = p_user for update;
  if not found then return; end if;

  v_plan := p.plan;
  v_until := p.plus_until;

  /*
   * 🔑 **`plus_until` مقسومٌ ثلاثة**: ما جاء من المتجر (`store_until`)، وما أُضيف فوقه بعده (مكافأةُ دعوةٍ أو منحة — `v_extra`)،
   * وما كان قبل المتجر (`plus_base_until`: مؤسِّسٌ حتى ٣٠ نوفمبر، مكافأةٌ سابقة). فالتجديدُ يمدّ المتجرَ ويُبقي الإضافة،
   * والاسترجاعُ أو النقلُ يرفعان المتجرَ وحده — لا يُبقيان سنةً مسترجَعة، ولا يُسقطان تاريخَ المؤسِّس. `greatest` يتجاهل الفارغ.
   */
  v_store := p.store_until is not null and p.plus_until is not null and p.plus_until >= p.store_until;
  if v_store then
    v_extra := p.plus_until - p.store_until;
    v_base := p.plus_base_until;
  else
    /* 🔑 **يُضاف ولا يُبتلع** (المراجعةُ المستقلّة): ما بقي من منحةٍ سابقةٍ (مؤسِّسٌ · مكافأة) يُضاف فوق المدّة المدفوعة — كما
       تُضاف المكافأةُ التي تأتي أثناء الاشتراك — فالقاعدةُ واحدةٌ في أوّل شراءٍ وفي التجديد، والأصلُ محفوظٌ للاسترجاع */
    v_extra := greatest(interval '0', coalesce(p.plus_until - now(), interval '0'));
    v_base := p.plus_until;
  end if;

  if v_forever then
    /* منحةٌ يدويّةٌ «بلا انتهاء» (الصفُّ القديم في ١٥٩) */
    v_plan := case when p.plan = 'free' then 'plus' else p.plan end;
    v_until := null;
  elsif not v_store and p.plan <> 'free' and p.plus_until is null then
    /* «بلا انتهاء» من قبل (شريكٌ أو منحة): لا يُمسّ — ويبقى الذهبيُّ يُكتب له */
    null;
  elsif v_end is not null then
    v_until := greatest(v_end + v_extra, v_base);
    v_plan := case when p.plan = 'free' then 'plus' else p.plan end;
  elsif v_store then
    /* لم يبق شيءٌ من المتجر: انتهى في موعده (فلا يتبدّل شيء) أو استُرجع/نُقل (يُرفع ما بقي منه) */
    v_until := greatest(least(p.store_until, now()) + v_extra, v_base);
  end if;

  update public.profiles
     set plan = v_plan,
         plus_until = v_until,
         store_until = v_end,
         plus_base_until = v_base,
         gold_until = v_gold
   where id = p_user;
end;
$$;

alter function public.recompute_plan(uuid) owner to postgres;
revoke all on function public.recompute_plan(uuid) from public, anon, authenticated;

create or replace function public.sync_plan_from_subscription()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_plan(old.user_id);
    return old;
  end if;
  perform public.recompute_plan(new.user_id);
  /* نقلُ الشراء إلى حسابٍ آخر (TRANSFER): الحسابُ القديمُ يُعاد حسابُه أيضاً */
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    perform public.recompute_plan(old.user_id);
  end if;
  return new;
end;
$$;

alter function public.sync_plan_from_subscription() owner to postgres;

drop trigger if exists subscriptions_sync_plan on public.subscriptions;
create trigger subscriptions_sync_plan
  after insert or update of status, current_period_end, plan, user_id on public.subscriptions
  for each row execute function public.sync_plan_from_subscription();
drop trigger if exists subscriptions_sync_plan_delete on public.subscriptions;
create trigger subscriptions_sync_plan_delete
  after delete on public.subscriptions
  for each row execute function public.sync_plan_from_subscription();

-- ─── ٤) أحداثُ الويبهوك: مرّةً واحدةً لكلِّ حدث ────────────────────────────────
create table if not exists public.billing_events (
  event_id     text primary key,
  type         text not null,
  user_id      uuid references auth.users (id) on delete set null,
  environment  text,
  event_ms     bigint,
  received_at  timestamptz not null default now(),
  /* اكتمل؟ ختمٌ بلا اكتمالٍ بعد دقيقتين = تشغيلٌ انقطع (مهلةُ الدالّة): إعادةُ RevenueCat تأخذه — لا يُرى «مكرّراً» فيضيع شراء */
  processed_at timestamptz
);
alter table public.billing_events add column if not exists processed_at timestamptz;
alter table public.billing_events enable row level security; -- صفر سياسات
revoke all on public.billing_events from anon, authenticated;

-- ─── ٥) دفترُ العمولات ────────────────────────────────────────────────────
create table if not exists public.partner_commissions (
  id             bigint generated always as identity primary key,
  /* حدثُ RevenueCat الذي أنتجه — حدثٌ يُعاد لا يُضاعف */
  event_id       text not null unique,
  partner_id     uuid not null references auth.users (id) on delete cascade,
  subscriber_id  uuid references auth.users (id) on delete set null,
  kind           text not null check (kind in ('earned', 'reversed')),
  /* بالريال: الصافي والعمولة — سالبان في الاسترجاع */
  net            numeric(12, 2) not null,
  amount         numeric(12, 2) not null,
  currency       text not null default 'SAR',
  product_id     text,
  store          text,
  paid_at        timestamptz not null,
  created_at     timestamptz not null default now()
);
alter table public.partner_commissions enable row level security; -- صفر سياسات
revoke all on public.partner_commissions from anon, authenticated;
create index if not exists partner_commissions_partner_idx on public.partner_commissions (partner_id, created_at desc);

/* الرصيدُ المتاح: ما تجاوز تعليقَ الثلاثين يوماً (والاسترجاعُ يُخصم في حينه) ناقصاً ما طُلب صرفُه أو صُرف */
create or replace function public.partner_balance(p_user uuid)
returns numeric language sql stable security definer
set search_path = public, pg_temp as $$
  select greatest(0,
           coalesce((select sum(c.amount) from public.partner_commissions c
                      where c.partner_id = p_user
                        and (c.kind = 'reversed' or c.created_at < now() - interval '30 days')), 0)
         - coalesce((select sum(r.amount) from public.payout_requests r
                      where r.partner_id = p_user and r.status in ('pending', 'approved', 'paid')), 0))::numeric
  where exists (select 1 from public.partners p where p.user_id = p_user)
    /* حارسُ ٢٢٤ يبقى (المراجعةُ المستقلّة ٦ نوفمبر): رصيدُ الشريك لصاحبه وللمشرف — لا لأيِّ عضوٍ يمرّر معرّفاً */
    and (p_user = auth.uid() or public.am_admin());
$$;

/* لوحةُ الشريك: المتاحُ والمعلَّقُ والإجماليّ، ومن اشترك عبره، وآخرُ الحركات — لصاحبها وحده */
create or replace function public.my_partner_earnings()
returns jsonb language sql stable security definer
set search_path = public, pg_temp as $$
  select case when not exists (select 1 from public.partners p where p.user_id = auth.uid()) then null else jsonb_build_object(
    'available', coalesce(public.partner_balance(auth.uid()), 0),
    'on_hold', coalesce((select sum(c.amount) from public.partner_commissions c
                          where c.partner_id = auth.uid() and c.kind = 'earned' and c.created_at >= now() - interval '30 days'), 0),
    'total', coalesce((select sum(c.amount) from public.partner_commissions c where c.partner_id = auth.uid()), 0),
    'subscribed', (select count(*) from public.referrals r
                    where r.inviter_id = auth.uid() and r.source = 'partner' and r.subscribed_at is not null),
    'recent', coalesce((select jsonb_agg(x order by x.created_at desc) from (
                 select c.kind, c.amount, c.created_at from public.partner_commissions c
                  where c.partner_id = auth.uid() order by c.created_at desc limit 30) x), '[]'::jsonb)
  ) end;
$$;
revoke all on function public.my_partner_earnings() from public, anon;
grant execute on function public.my_partner_earnings() to authenticated;

-- ─── ٦) أوّلُ اشتراكٍ حقيقيّ: ختمُ الإحالة ومكافأةُ الداعي ─────────────────────
/* مرّةً لكلِّ مدعوّ (`subscribed_at` فارغ): الصديقُ يأخذ ١٤ يوماً بسقفه السنويّ (`grant_plus_days`)، والشريكُ يُعدّ في
   «اشتركوا» وعمولتُه من دفترها. لمفتاح الخدمة وحده. */
create or replace function public.billing_first_purchase(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  update public.referrals
     set subscribed_at = now()
   where invitee_id = p_user and subscribed_at is null and rejected_at is null
  returning inviter_id, source into r;
  if not found then return; end if;
  insert into public.referral_events (kind, actor, subject, meta)
  values ('subscription_started', r.inviter_id, p_user, jsonb_build_object('source', r.source));
  if r.source = 'friend' then
    perform public.grant_plus_days(r.inviter_id, 14, 'invite_subscribe', p_user);
  end if;
end;
$$;
alter function public.billing_first_purchase(uuid) owner to postgres;
revoke all on function public.billing_first_purchase(uuid) from public, anon, authenticated;
grant execute on function public.billing_first_purchase(uuid) to service_role;

-- ─── ٧) القروباتُ ١٦ — الجسمان الحيّان حرفاً، والرقمان وحدهما ─────────────────
CREATE OR REPLACE FUNCTION public.dm_group_create(p_name text, p_members uuid[], p_photo text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  g uuid;
  ids uuid[];
  x uuid;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if not exists (
    select 1 from public.profiles p
     where p.id = me and coalesce(p.plan, 'free') <> 'free' and (p.plus_until is null or p.plus_until > now())
  ) then
    raise exception 'plus required' using errcode = '42501', hint = 'plus';
  end if;
  select coalesce(array_agg(distinct u), '{}') into ids from unnest(coalesce(p_members, '{}')) u where u is not null and u <> me;
  if cardinality(ids) < 1 or cardinality(ids) > 15 then
    raise exception 'members out of range' using errcode = '22023';
  end if;
  foreach x in array ids loop
    if not public.dm_group_can_add(me, x) then
      raise exception 'cannot add member' using errcode = '42501', hint = 'member';
    end if;
  end loop;
  if p_photo is not null and p_photo !~ ('^' || me::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'bad photo' using errcode = '22023';
  end if;
  insert into public.dm_groups (name, photo_path, created_by) values (btrim(p_name), p_photo, me) returning id into g;
  insert into public.dm_group_members (group_id, user_id, role) values (g, me, 'owner');
  insert into public.dm_group_members (group_id, user_id, role) select g, u, 'member' from unnest(ids) u;
  insert into public.dm_group_messages (group_id, sender_id, kind, sys) values (g, me, 'system', 'created');
  return g;
end;
$function$;

CREATE OR REPLACE FUNCTION public.dm_group_add(p_group uuid, p_members uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me uuid := auth.uid();
  ids uuid[];
  x uuid;
  n int;
begin
  if not public.is_dm_group_admin(p_group, me) then raise exception 'admin only' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct u), '{}') into ids from unnest(coalesce(p_members, '{}')) u
   where u is not null and not exists (select 1 from public.dm_group_members m where m.group_id = p_group and m.user_id = u);
  if cardinality(ids) = 0 then return 0; end if;
  select count(*) into n from public.dm_group_members where group_id = p_group;
  if n + cardinality(ids) > 16 then raise exception 'group full' using errcode = '22023', hint = 'full'; end if;
  foreach x in array ids loop
    if not public.dm_group_can_add(me, x) then raise exception 'cannot add member' using errcode = '42501', hint = 'member'; end if;
  end loop;
  insert into public.dm_group_members (group_id, user_id, role) select p_group, u, 'member' from unnest(ids) u;
  insert into public.dm_group_messages (group_id, sender_id, kind, sys, sys_target)
    select p_group, me, 'system', 'added', u from unnest(ids) u;
  return cardinality(ids);
end;
$function$;


-- ─── ٧-مكرّر) شارةُ GOLD للآخرين — `public_profiles` بعمودٍ أخيرٍ جديد ────────────
/* الجسمُ الحيُّ قُرئ بـ`pg_get_viewdef` (٦ نوفمبر) ونُسخ حرفاً، ويُضاف في آخره `gold` (نعم/لا لا التاريخ): شارةُ 1.14.0 تُرسم
   لغير صاحبها من هنا، ولا يُكشف متى ينتهي اشتراكُ أحد */
create or replace view public.public_profiles as
 SELECT p.id,
        CASE
            WHEN COALESCE(p.hide_name, false) AND p.id IS DISTINCT FROM auth.uid() THEN NULL::text
            ELSE p.nickname
        END AS nickname,
        CASE
            WHEN COALESCE(p.hide_name, false) AND p.id IS DISTINCT FROM auth.uid() THEN NULL::text
            ELSE p.username
        END AS username,
        CASE
            WHEN COALESCE(p.hide_name, false) AND p.id IS DISTINCT FROM auth.uid() THEN NULL::text
            ELSE p.avatar_url
        END AS avatar_url,
        CASE
            WHEN v.can THEN p.cover_url
            ELSE NULL::text
        END AS cover_url,
        CASE
            WHEN v.can THEN p.favorite_genres
            ELSE NULL::integer[]
        END AS favorite_genres,
    COALESCE(p.hide_name, false) AS hide_name,
        CASE
            WHEN v.can THEN p.cover_pos
            ELSE NULL::smallint
        END AS cover_pos,
    p.avatar_pos,
        CASE
            WHEN COALESCE(p.hide_name, false) AND p.id IS DISTINCT FROM auth.uid() THEN NULL::text
            WHEN NOT v.can THEN NULL::text
            ELSE p.bio
        END AS bio,
    COALESCE(p.is_private, false) AS is_private,
    COALESCE(p.hide_follow_lists, false) AS hide_follow_lists,
    p.profile_prefs,
        CASE
            WHEN p.plus_until IS NOT NULL AND p.plus_until <= now() THEN 'free'::text
            ELSE p.plan
        END AS plan,
    COALESCE(p.founder, false) AS founder,
    p.verified_at,
    p.theme_accent,
        CASE
            WHEN v.can THEN p.joined_at
            ELSE NULL::timestamp with time zone
        END AS joined_at,
        CASE
            WHEN COALESCE(p.hide_name, false) AND p.id IS DISTINCT FROM auth.uid() THEN NULL::jsonb
            WHEN NOT v.can THEN NULL::jsonb
            ELSE p.socials
        END AS socials,
    p.x_verified_at,
    COALESCE(p.gold_until > now(), false) AS gold
   FROM profiles p
     LEFT JOIN LATERAL ( SELECT COALESCE(NOT COALESCE(p.is_private, false) OR p.id = auth.uid() OR (EXISTS ( SELECT 1
                   FROM user_follows f
                  WHERE f.following_id = p.id AND f.follower_id = auth.uid())), false) AS can) v ON true;

-- ─── ٨) تعبئةٌ أولى: `store_until` لمن له صفٌّ اليوم (المنحةُ اليدويّة) ─────────
/* المنحةُ اليدويّةُ المؤرَّخة كتبتها مرآةُ ١٥٩ نفسُها: تُعدّ «من الاشتراكات» قبل الحساب — وإلّا حُسبت منحةً سابقةً فتضاعفت */
update public.profiles p
   set store_until = p.plus_until
 where p.store_until is null
   and exists (select 1 from public.subscriptions s where s.user_id = p.id and s.current_period_end is not distinct from p.plus_until);
do $$
declare u uuid;
begin
  for u in select distinct user_id from public.subscriptions loop perform public.recompute_plan(u); end loop;
end $$;

commit;

-- ============================================================================
-- فحوصُ ما بعد التشغيل — تُشغَّل فعلاً (README)
-- ============================================================================
-- select count(*) as open_policies from pg_policies where schemaname = 'public' and qual = 'true';      -- 5
-- select count(*) from information_schema.columns where table_schema = 'public'
--   and ((table_name = 'subscriptions' and column_name in ('store','product_id','environment','period_type','last_event_ms','first_purchase_at'))
--     or (table_name = 'profiles' and column_name in ('gold_until','store_until','plus_base_until')));   -- 9
-- select count(*) from information_schema.column_privileges where table_name = 'profiles'
--   and column_name in ('gold_until','store_until','plus_base_until') and grantee = 'authenticated' and privilege_type = 'UPDATE';  -- 0
-- select count(*) from public.profiles where plan <> 'free' and (plus_until is null or plus_until > now()); -- كما قبلها
-- select tgname from pg_trigger where tgrelid = 'public.subscriptions'::regclass and not tgisinternal;  -- ثلاثة
