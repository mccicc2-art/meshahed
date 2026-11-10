-- 244 — لوحةُ داعمي لوبز، والانضمامُ المباشرُ لبرنامج الشركاء لعضو Gold (أحمد ١٠ نوفمبر: «١ أ · ٣ ب · ٢ أ»)
--
-- لماذا:
-- ١) **لوحةُ الداعمين** ميزةٌ من مزايا Gold («تدعم لوبز»): كلُّ عضو Gold يظهر فيها تلقائياً (١ أ) ويخفي اسمه بزرّ،
--    وتحت اسمه في ملفّه سطرُ «داعم لوبز منذ …» يفتحها (٣ ب). الإخفاءُ قرارٌ واحد: يُخفي الاسمَ من اللوحة ومن الملفّ معاً.
--    «منذ» = أوّلُ اشتراك Gold له في الإنتاج (شراءٌ أو منحة)؛ صفوفُ `sandbox` لا تُحسب.
-- ٢) **الشركاء**: عضو Gold ينضمّ بضغطةٍ بعد الموافقة على الشروط، بلا مراجعة (٢ أ). بلس يرفع طلباً كما هو اليوم
--    (`apply_partner`: حسابُ X موثّق + بلس + مراجعة — لا يُمسّ)، وغيرُ المشترك لا يقدّم. الشريكُ الذي ينتهي ذهبيُّه يبقى شريكاً.
--
-- 🔴 «Gold» هنا **اشتراكٌ حقيقيّ** لا `gold_until` وحدَه (مراجعةٌ مستقلّة ١٠ نوفمبر): `recompute_plan` (٢٣٨) يمدّ `gold_until`
--    من صفوف `sandbox` أيضاً عن قصد (المختبِرُ يرى ما اشترى)، فلو كان الحارسُ `gold_until` لصار مختبِرٌ بشراءٍ تجريبيٍّ مجّانيّ
--    شريكاً دائماً بعمولةٍ حقيقيّة. `gold_real` = صفُّ Gold في الإنتاج ساري المدّة، أو منحةٌ يدويّةٌ مفتوحة. والموقوفُ لا يظهر ولا ينضمّ.
--
-- كلُّ الدوالّ `security definer` بحارسٍ في جسمها، وعمودُ الإخفاء لا يُكتب إلا عبرها. آمنٌ للتكرار، والكودُ يعمل قبلها:
-- إن غابت الدوالّ فاللوحةُ فارغةٌ والانضمامُ يردّ خطأً معروفاً.

alter table public.profiles add column if not exists supporter_hidden boolean not null default false;

-- «داعمٌ منذ»: أوّلُ اشتراك Gold في الإنتاج
create or replace function public.gold_since(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select min(coalesce(s.first_purchase_at, s.created_at))
    from public.subscriptions s
   where s.user_id = p_user
     and s.plan = 'gold'
     and coalesce(s.environment, 'production') <> 'sandbox';
$$;

revoke all on function public.gold_since(uuid) from public, anon, authenticated;

-- Gold حقيقيّ: اشتراكُ إنتاجٍ ساري، أو منحةٌ يدويّةٌ مفتوحةٌ (كما يحسبها `recompute_plan` لـ`plan_perpetual`) — لا تجربةَ متجر
create or replace function public.gold_real(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.subscriptions s
     where s.user_id = p_user
       and s.plan = 'gold'
       and coalesce(s.environment, 'production') <> 'sandbox'
       and s.status <> 'expired'
       and (s.current_period_end > now()
            or (s.provider = 'manual' and s.status = 'active' and s.current_period_end is null))
  );
$$;

revoke all on function public.gold_real(uuid) from public, anon, authenticated;

-- اللوحة: كلُّ Gold فعّالٍ لم يُخفِ نفسه ولم يُخفِ اسمه من الملفّ (`hide_name`) — الأقدمُ أوّلاً، والترتيبُ الآخرُ في العميل
-- شكلُ الصفّ تغيّر أثناء البناء (أُسقط المعرّف) — `create or replace` لا يغيّر نوعَ الإرجاع، فالإسقاطُ أوّلاً يجعل التكرارَ آمناً
drop function if exists public.gold_supporters();
create or replace function public.gold_supporters()
returns table (username text, nickname text, avatar_url text, avatar_pos smallint, since timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- المعرّفُ لا يخرج، و«منذ» بالشهر — اللوحةُ عامّةٌ (anon) ولا تعرض أكثرَ من ذلك
  select p.username, p.nickname, p.avatar_url, p.avatar_pos, date_trunc('month', public.gold_since(p.id)) as since
    from public.profiles p
   where p.gold_until > now()
     and public.gold_real(p.id)
     and p.suspended_at is null
     and not p.supporter_hidden
     and not coalesce(p.hide_name, false)
     and p.username is not null
   order by public.gold_since(p.id) asc nulls last, p.username asc
   limit 2000;
$$;

revoke all on function public.gold_supporters() from public;
grant execute on function public.gold_supporters() to anon, authenticated;

-- سطرُ الملفّ: «داعمٌ منذ» لعضو Gold ظاهرٍ في اللوحة، وإلا `null`
create or replace function public.supporter_since(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when p.gold_until > now() and public.gold_real(p.id) and p.suspended_at is null
                   and not p.supporter_hidden and not coalesce(p.hide_name, false)
              then date_trunc('month', public.gold_since(p.id)) end
    from public.profiles p
   where p.id = p_user;
$$;

revoke all on function public.supporter_since(uuid) from public;
grant execute on function public.supporter_since(uuid) to anon, authenticated;

-- حالي في اللوحة (بطاقتي وزرُّ الإخفاء)
create or replace function public.my_supporter_state()
returns table (gold boolean, hidden boolean, since timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(p.gold_until > now(), false) and public.gold_real(p.id), p.supporter_hidden, public.gold_since(p.id)
    from public.profiles p
   where p.id = auth.uid();
$$;

revoke all on function public.my_supporter_state() from public, anon;
grant execute on function public.my_supporter_state() to authenticated;

create or replace function public.set_supporter_hidden(p_hidden boolean)
returns void
language sql
volatile
security definer
set search_path = public, pg_temp
as $$
  update public.profiles set supporter_hidden = coalesce(p_hidden, false) where id = auth.uid();
$$;

revoke all on function public.set_supporter_hidden(boolean) from public, anon;
grant execute on function public.set_supporter_hidden(boolean) to authenticated;

-- الانضمامُ المباشر لعضو Gold: كودٌ كما يولّده `admin_decide_partner`، وشارةُ الشريك في الخطّة (الملفُّ يُظهر GOLD فوقها).
-- شريكٌ قائمٌ يُعاد كودُه كما هو (ضغطتان لا تصنعان كودين).
create or replace function public.join_partner_gold()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text;
  candidate text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  select code into v_code from public.partners where user_id = auth.uid();
  if v_code is not null then
    return v_code;
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and gold_until > now() and suspended_at is null)
     or not public.gold_real(auth.uid()) then
    raise exception 'partner_gold_required';
  end if;
  for i in 1..10 loop
    candidate := (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
        from generate_series(1, 8)
    );
    if not exists (select 1 from public.referral_codes where code = candidate)
       and not exists (select 1 from public.partners where code = candidate) then
      insert into public.partners (user_id, code) values (auth.uid(), candidate)
      on conflict (user_id) do nothing;
      select code into v_code from public.partners where user_id = auth.uid();
      update public.profiles set plan = 'partner' where id = auth.uid() and plan <> 'partner';
      -- طلبٌ معلَّقٌ سابقٌ (قدّمه وهو بلس) يُغلق بالموافقة فلا يبقى في طابور الإدارة
      update public.partner_applications set status = 'approved', decided_at = now()
       where user_id = auth.uid() and status = 'pending';
      return v_code;
    end if;
  end loop;
  raise exception 'could not allocate a partner code';
end;
$$;

revoke all on function public.join_partner_gold() from public, anon;
grant execute on function public.join_partner_gold() to authenticated;
