-- 246 — حارسُ الداعي في جسم `claim_referral` نفسِه (المهمة ٣٧٠، أحمد ١٠ نوفمبر: «٢ أ … اذن لك بتشغيلها»)
--
-- لماذا: المراجعةُ المستقلّة للمهمة ٣٧٠ وجدت أن الدالّة تقبل داعياً لا يصحّ أن يكون داعياً: الحسابَ الرسميّ (`is_system`)،
-- وشخصيّاتِ Loopz AI (ملفّاتٌ عاديّةٌ مسجَّلةٌ في `personas`، الهجرة ٢٢٥)، والموقوفَ (`suspended_at`، الهجرة ١٧٣). ولو نُسب
-- إليها مدعوٌّ لمنحتها `qualify_referral` أيّاماً ومكافآت. أبوابُ التطبيق الجديدة (`/api/v1/me/referral`) تحرس ذلك قبل النداء،
-- أمّا طريقُ الويب القديم (`/auth/callback` يقرأ كوكي `loopz_ref`) فينادي الدالّةَ مباشرة — **فالحارسُ هنا، حيث الباب (D-011)**.
--
-- ما تغيّر: سطرٌ واحدٌ بعد معرفة صاحب الكود — غيرُ ذلك جسمُ الهجرة ١٥٥ حرفاً (الحرّاسُ: ٤٨ ساعة · بلا متابعة · نسبةٌ واحدة ·
-- لا يدعو نفسَه). التوقيعُ نفسُه، فالصلاحيّاتُ باقية (`authenticated` وحدَه)، وتُعاد هنا صراحةً. لا جدولَ ولا عمودَ جديد.
-- التراجع: إعادةُ تشغيل جسم الدالّة من `155_invite_and_earn.sql`.

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
  -- 🆕 ٢٤٦ — لا يدعو الحسابُ الرسميّ ولا شخصيّةُ AI ولا الموقوف
  if exists (select 1 from public.profiles p
              where p.id = owner
                and (coalesce(p.is_system, false) or p.suspended_at is not null))
     or exists (select 1 from public.personas pe where pe.id = owner) then
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

revoke all on function public.claim_referral(text) from public, anon;
grant execute on function public.claim_referral(text) to authenticated;
