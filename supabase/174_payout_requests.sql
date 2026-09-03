-- ============================================================
--  ١٧٤ — طلباتُ التحويل للشركاء (D-901)
--  يعتمد على ١٧٢ (`log_admin`) — شغّلها أوّلاً.
-- ============================================================
-- **قرارُ أحمد: تُبنى الآن.** وتُقال الحقيقةُ معها: **المدفوعاتُ لم
-- تُفتح، فلا عمولةَ تُستحقّ** (D-770c/D-217/D-858) — **فالطابورُ يبقى
-- صفراً حتى تُفتح القناة، وهذا صحيحٌ لا عطل.**
--
-- **وما يُبنى اليوم يجعل يومَ الفتح خطوةً واحدة**: الجدولُ والبوّاباتُ
-- وطابورُ الإدارة جاهزةٌ، ويبقى مصدرُ الرصيد وحدَه.

create table if not exists public.payout_requests (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references auth.users (id) on delete cascade,
  amount        numeric(10,2) not null check (amount >= 100),
  currency      text not null default 'SAR' check (currency = 'SAR'),
  status        text not null default 'pending'
                check (status in ('pending', 'approved', 'paid', 'rejected')),
  requested_at  timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references auth.users (id) on delete set null,
  note          text,
  -- 🔑 **لقطةٌ لا مرجع.** `partner_details` تتغيّر: لو قُرئ الآيبانُ
  -- **وقتَ الصرف** بدل **وقتِ الطلب**، فشريكٌ بدّل آيبانه بين الطلب
  -- والتحويل يُصرف له إلى حسابٍ لم يُراجَع. **الطلبُ يحمل ما وُوفق عليه.**
  iban_snapshot   text not null,
  bank_snapshot   text,
  holder_snapshot text
);

create index if not exists payout_requests_partner_idx on public.payout_requests (partner_id, requested_at desc);
create index if not exists payout_requests_status_idx  on public.payout_requests (status, requested_at);

-- **طلبٌ معلَّقٌ واحدٌ لكلِّ شريك** — قيدٌ في القاعدة لا شرطٌ في الشيفرة:
-- **البابُ حيث الحارس** (D-011).
create unique index if not exists payout_requests_one_pending
  on public.payout_requests (partner_id) where status = 'pending';

-- ⚠️ **بصفرِ سياسات** (نمطُ `runtime_errors` و`visit_langs` و`admin_audit`):
-- القراءةُ بدوالِّ definer وحدَها. **و`open_policies` يبقى خمساً.**
alter table public.payout_requests enable row level security;

-- ------------------------------------------------------------
-- الرصيدُ المستحقّ — **الموضعُ الوحيد الذي يتغيّر يومَ تُفتح المدفوعات**
-- ------------------------------------------------------------
-- اليوم صفرٌ **بالواقع لا بالتحفّظ**: لا اشتراكاتٍ مدفوعة ولا عمولةَ
-- محسوبة. **ولهذا `request_payout` مغلقةٌ فعليّاً** — وهذا هو الصدق:
-- زرٌّ يقبل طلباً لا رصيدَ خلفه وعدٌ يُخلَف.
create or replace function public.partner_balance(p_user uuid)
returns numeric language sql stable security definer
set search_path = public, pg_temp as $$
  select 0::numeric
  where exists (select 1 from public.partners p where p.user_id = p_user);
$$;

-- ------------------------------------------------------------
-- الطلبُ — كلُّ بوّابةٍ في الجسم
-- ------------------------------------------------------------
create or replace function public.request_payout(p_amount numeric)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  v_me      uuid := auth.uid();
  v_d       public.partner_details%rowtype;
  v_balance numeric;
  v_id      uuid;
begin
  if v_me is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not exists (select 1 from public.partners p where p.user_id = v_me) then
    raise exception 'not_a_partner' using errcode = '42501';
  end if;

  select * into v_d from public.partner_details d where d.user_id = v_me;
  -- **بياناتٌ ناقصةٌ = لا طلب.** (واحدٌ من شريكَينا اليوم لم يكملها.)
  if v_d.user_id is null or coalesce(btrim(v_d.iban), '') = ''
     or coalesce(btrim(v_d.account_name), '') = '' then
    raise exception 'details_incomplete' using errcode = '22023';
  end if;

  if p_amount is null or p_amount < 100 then
    raise exception 'below_minimum' using errcode = '22023';
  end if;

  v_balance := public.partner_balance(v_me);
  if p_amount > coalesce(v_balance, 0) then
    raise exception 'insufficient_balance' using errcode = '22023';
  end if;

  -- الطلبُ المعلَّقُ الثاني يرفضه الفهرسُ الفريد، والرسالةُ تُقال هنا.
  if exists (select 1 from public.payout_requests r
              where r.partner_id = v_me and r.status = 'pending') then
    raise exception 'pending_request_exists' using errcode = '22023';
  end if;

  insert into public.payout_requests
    (partner_id, amount, iban_snapshot, bank_snapshot, holder_snapshot)
  values (v_me, p_amount, v_d.iban, v_d.bank_name, v_d.account_name)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.my_payout_requests()
returns table (id uuid, amount numeric, currency text, status text,
               requested_at timestamptz, decided_at timestamptz, note text)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, r.amount, r.currency, r.status, r.requested_at, r.decided_at, r.note
  from public.payout_requests r
  where r.partner_id = auth.uid()
  order by r.requested_at desc
  limit 50;
$$;

-- ------------------------------------------------------------
-- الإدارة — الحارسُ في الجسم، وكلُّ قرارٍ يُسجَّل
-- ------------------------------------------------------------
create or replace function public.admin_payout_queue(lim int default 100)
returns table (id uuid, partner_id uuid, username text, nickname text,
               amount numeric, currency text, status text,
               requested_at timestamptz, decided_at timestamptz, note text,
               iban_snapshot text, bank_snapshot text, holder_snapshot text,
               details_changed boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, r.partner_id, p.username, p.nickname,
         r.amount, r.currency, r.status, r.requested_at, r.decided_at, r.note,
         r.iban_snapshot, r.bank_snapshot, r.holder_snapshot,
         -- ⚠️ **رايةٌ تُقال للمراجِع**: هل بدّل الشريكُ آيبانه بعد الطلب؟
         -- **الصرفُ يمضي على اللقطة**، لكنّ التغيّرَ نفسَه يستحقّ نظرة.
         (d.iban is distinct from r.iban_snapshot) as details_changed
  from public.payout_requests r
  left join public.profiles p        on p.id = r.partner_id
  left join public.partner_details d on d.user_id = r.partner_id
  where public.am_admin()
  order by (r.status <> 'pending'), r.requested_at
  limit least(greatest(coalesce(lim, 100), 1), 200);
$$;

create or replace function public.admin_decide_payout(
  p_id uuid, p_decision text, p_note text default null)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_row public.payout_requests%rowtype;
begin
  if not public.am_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'paid', 'rejected') then
    raise exception 'bad_decision' using errcode = '22023';
  end if;

  select * into v_row from public.payout_requests r where r.id = p_id;
  if v_row.id is null then
    raise exception 'not_found' using errcode = '22023';
  end if;
  -- **الحالاتُ تمشي في اتّجاهٍ واحد**: معلَّق → موافَق → مصروف، والرفضُ
  -- من المعلَّق وحدَه. **ولا يُنقَض قرارٌ صُرف.**
  if v_row.status = 'paid' then
    raise exception 'already_paid' using errcode = '22023';
  end if;
  if p_decision = 'paid' and v_row.status <> 'approved' then
    raise exception 'approve_first' using errcode = '22023';
  end if;
  if p_decision in ('approved', 'rejected') and v_row.status <> 'pending' then
    raise exception 'not_pending' using errcode = '22023';
  end if;

  update public.payout_requests
     set status = p_decision,
         decided_at = now(),
         decided_by = auth.uid(),
         note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), note)
   where id = p_id;

  perform public.log_admin('decide_payout', v_row.partner_id, jsonb_build_object(
    'request', p_id, 'decision', p_decision,
    'amount', v_row.amount, 'from', v_row.status));
end;
$$;

-- الصلاحيّات — **ولا `anon` في شيءٍ من هذا.**
revoke all on function public.partner_balance(uuid)              from public, anon;
revoke all on function public.request_payout(numeric)            from public, anon;
revoke all on function public.my_payout_requests()               from public, anon;
revoke all on function public.admin_payout_queue(int)            from public, anon;
revoke all on function public.admin_decide_payout(uuid, text, text) from public, anon;

grant execute on function public.partner_balance(uuid)              to authenticated;
grant execute on function public.request_payout(numeric)            to authenticated;
grant execute on function public.my_payout_requests()               to authenticated;
grant execute on function public.admin_payout_queue(int)            to authenticated;
grant execute on function public.admin_decide_payout(uuid, text, text) to authenticated;
