-- 247 — رابطُ حملةٍ للحساب الرسميّ: `loopztv.com/invite/LOOPZX` (المهمة ٣٩٣، أحمد ١٧ نوفمبر: «5 عدل وهات الرابط»)
--
-- لماذا: خطّةُ التسويق في X تقيس التسجيلاتِ التي مصدرُها X برابط دعوةٍ خاصٍّ بحساب لوبز (القرار ٥ أ). والحسابُ الرسميُّ ممنوعٌ
-- داعياً منذ ٢٤٦ — والمنعُ كان لسببٍ واحد: لو نُسب إليه مدعوٌّ لمنحته `qualify_referral` أيّاماً ومكافآت. فلا يُرفع المنعُ عن
-- المكافأة، بل يُعطى الحسابُ الرسميُّ مصدراً ثالثاً لا مكافأةَ فيه: **`campaign`**.
--
-- ما تغيّر:
--   ١) `referrals.source` يقبل `campaign` بجانب `friend` و`partner`.
--   ٢) `claim_referral`: صاحبُ الكود حسابٌ رسميٌّ (`is_system`) ⇒ المصدرُ `campaign` بدل الرفض. وشخصيّاتُ AI والموقوفُ مرفوضون
--      كما في ٢٤٦ حرفاً، وبقيّةُ الحرّاس (٤٨ ساعة · بلا متابعة · نسبةٌ واحدة · لا يدعو نفسَه) جسمُ ٢٤٦ نفسُه.
--   ٣) كودُ الحساب الرسميّ `LOOPZX` في `referral_codes`.
--
-- 🔑 لماذا لا مكافأة بلا سطرٍ واحدٍ في `qualify_referral`: الدالّةُ لا تمنح شيئاً إلّا في فرع `src = 'friend'` (١٥٥)، فالحملةُ
-- تُحتسب (`qualified_at`) وتُعَدّ، ولا يُمنح المدعوُّ ولا الحسابُ الرسميُّ يوماً. و`my_invite_list`/`my_invite_stats` تعدّ
-- `friend` وحدَها، فلا تظهر الحملةُ في صفحة دعوات أحد.
--
-- العدّ: `select count(*) from referrals where source = 'campaign'` (المسجّلون) · `… and qualified_at is not null` (المحتسَبون).
--
-- ⚠️ حدٌّ معلَن: `referral_codes.user_id` مفتاحٌ أساسيّ ⇒ للحساب الرسميّ كودٌ واحد، أي حملةٌ واحدةٌ مقيسة (X). حملةٌ ثانيةٌ
-- (سناب مثلاً) تحتاج جدولَ أكوادٍ للحملات — لا يُبنى قبل الحاجة.
--
-- التراجع (يُنفَّذ بالترتيب):
--   delete from public.referral_codes where code = 'LOOPZX';
--   -- ثمّ جسمُ الدالّة من 246_claim_referral_inviter_guard.sql
--   -- ثمّ القيدُ القديم (بعد التأكّد أنّ لا صفَّ campaign):
--   -- alter table public.referrals drop constraint referrals_source_check;
--   -- alter table public.referrals add constraint referrals_source_check check (source in ('friend','partner'));

-- ١) المصدرُ الثالث
alter table public.referrals drop constraint if exists referrals_source_check;
alter table public.referrals add constraint referrals_source_check check (source in ('friend', 'partner', 'campaign'));

-- ٢) الدالّة — جسمُ ٢٤٦ مع فرعٍ واحدٍ للحساب الرسميّ
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
  -- ٢٤٦ — لا يدعو شخصيّةُ AI ولا الموقوف
  if exists (select 1 from public.profiles p where p.id = owner and p.suspended_at is not null)
     or exists (select 1 from public.personas pe where pe.id = owner) then
    return false;
  end if;
  -- 🆕 ٢٤٧ — الحسابُ الرسميُّ يُنسب إليه بمصدر `campaign` وحدَه: يُعَدّ ولا يُكافأ
  if exists (select 1 from public.profiles p where p.id = owner and coalesce(p.is_system, false)) then
    src := 'campaign';
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

revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;

-- ٣) كودُ حملة X — للحساب الرسميّ وحدَه
insert into public.referral_codes (user_id, code)
select p.id, 'LOOPZX'
  from public.profiles p
 where p.id = '100b2000-0000-4000-8000-000000000001' and coalesce(p.is_system, false)
on conflict do nothing;

-- فحصٌ بعد التشغيل (يُتوقَّع: LOOPZX · الشرطُ يحوي campaign):
-- select code from public.referral_codes where user_id = '100b2000-0000-4000-8000-000000000001';
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'referrals_source_check';
