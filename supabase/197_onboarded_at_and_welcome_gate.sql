-- 197 — ختمُ «أتمّ الترحيب» وبوّابتُه (D-1341، Phase 11-U · U0)
--
-- العطل (تسجيلُ أحمد ١٠ أكتوبر ٢٠٢٦، ١٠:٥٨): حسابٌ جديدٌ تجاوز الترحيبَ من ثلاثة أبواب —
-- الشريطُ الأصليُّ فوق `/welcome`، وإعادةُ فتح التطبيق، وأيُّ مسارٍ في الويب غير `/`.
-- والأصلُ تحتها: «أتمّ الترحيب» لم يكن مخزوناً في أيِّ مكان؛ الشيفرةُ تستنتجه من «المكتبةُ
-- غيرُ فارغة»، فلا شيءَ يُسأل عند الأبواب — ومن ألغى متابعاتِه كلَّها يُرمى في الترحيب ثانيةً.
--
-- العلاج: ختمٌ يُكتب مرّةً ولا يُمحى. ثلاثةُ أشياء:
--   ١) العمود `profiles.onboarded_at` — **خارج منحة الأعمدة** (الهجرة ١٥٦): `authenticated`
--      تملك UPDATE على أعمدةٍ مسمّاة وهذا ليس منها، فلا يكتبه عضوٌ بنداء PostgREST مباشر.
--   ٢) التعبئة (قرارُ أحمد ١٨): من في مكتبته عملٌ واحدٌ على الأقلّ يُعدّ قد أتمّ — لا يرى شيئاً.
--      من مكتبتُه فارغة يمرّ بالترحيب الجديد (وهو يرى القديمَ اليوم على أيِّ حال).
--   ٣) دالّتان definer: `complete_onboarding()` تكتب الختمَ **بعد أن تتحقّق بنفسها** من
--      الخطوتين المقفولتين (اسمُ مستخدمٍ مختار · عملٌ واحدٌ على الأقلّ) — حارسٌ يسكن الشاشةَ
--      وحدَها ليس حارساً (D-821)؛ و`username_available()` لفحص الاسم وهو يُكتب: العرضُ
--      `public_profiles` يُخفي اسمَ من أخفى اسمَه (`hide_name`) فكان سيقول «متاح» لاسمٍ مأخوذ.
--
-- ⚠️ **تُشغَّل قبل نشر الشيفرة**: الحارسُ يقرأ العمود، ومن لم تُصبه التعبئةُ يُقفل خارجاً.
-- (الشيفرةُ تفتح عند الخطأ — عمودٌ غائبٌ لا يقفل أحداً — لكنّ الترتيبَ الصحيحَ هذا.)
-- قابلةٌ لإعادة التشغيل: لا تمسّ ختماً مكتوباً.
--
-- أرقامُ الإنتاج قبل التشغيل (قراءةُ ١٠ أكتوبر): ٤٠ ملفّاً · ٣٧ بمكتبة · ٣ بلا مكتبة ·
-- ٢٣ بلا اسم مستخدم (الحسابُ الجديد يولد بـ`username = null` — `handle_new_user` لا تولّد اسماً).

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'ختمُ إتمام الترحيب — تكتبه complete_onboarding() وحدَها، مرّةً، ولا يُمحى';

-- التعبئة: مكتبةٌ غيرُ فارغة = أتمّ (القرار ١٨)
update public.profiles p
   set onboarded_at = now()
 where p.onboarded_at is null
   and exists (select 1 from public.follows f where f.user_id = p.id);


create or replace function public.complete_onboarding()
returns timestamptz
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uname text;
  stamp timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select username, onboarded_at into uname, stamp
    from public.profiles where id = uid;

  -- مرّةً واحدة: نداءٌ ثانٍ يعيد الختمَ نفسَه ولا يحرّكه
  if stamp is not null then
    return stamp;
  end if;

  -- الخطوةُ المقفولةُ الأولى: اسمُ مستخدمٍ مختار (الفارغُ والمولَّدُ قديماً ليسا اختياراً)
  if uname is null or length(uname) < 3 or uname ~ '^user_[0-9a-f]{8}$' then
    raise exception 'welcome_username_missing';
  end if;

  -- الخطوةُ المقفولةُ الثانية: عملٌ واحدٌ على الأقلّ في المكتبة
  if not exists (select 1 from public.follows f where f.user_id = uid) then
    raise exception 'welcome_titles_missing';
  end if;

  update public.profiles set onboarded_at = now()
   where id = uid
   returning onboarded_at into stamp;

  -- صفرُ صفوفٍ يعني أنّ الختمَ لم يُكتب — فلا نقول إنه كُتب
  if stamp is null then
    raise exception 'welcome_profile_missing';
  end if;
  return stamp;
end;
$$;

revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;


-- هل الاسمُ حرٌّ لي؟ — اسمي أنا «حرّ» (أعيد حفظَه)، واسمُ غيري لا ولو أخفاه.
-- الفهرسُ الفريد `profiles_username_key` على `lower(username)` هو القاضي عند الحفظ؛ هذه مجاملةٌ قبله.
create or replace function public.username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null
     and not exists (
       select 1 from public.profiles
        where lower(username) = lower(btrim(p_username))
          and id <> auth.uid()
     );
$$;

revoke all on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;


-- التحقّق بعد التشغيل — والمتوقَّع: `with_follows = marked` و`unmarked_with_follows = 0`
-- (٣٧ · ٣٧ · ٠ · ٣ بأرقام ١٠ أكتوبر)، ثمّ false · true · true:
-- select
--   (select count(*) from public.profiles p
--     where exists (select 1 from public.follows f where f.user_id = p.id)) as with_follows,
--   (select count(*) from public.profiles where onboarded_at is not null)    as marked,
--   (select count(*) from public.profiles p
--     where p.onboarded_at is null
--       and exists (select 1 from public.follows f where f.user_id = p.id))  as unmarked_with_follows,
--   (select count(*) from public.profiles where onboarded_at is null)        as still_to_welcome;
-- select has_column_privilege('authenticated','public.profiles','onboarded_at','UPDATE') as member_can_write,
--        has_function_privilege('authenticated','public.complete_onboarding()','execute')  as can_complete,
--        has_function_privilege('authenticated','public.username_available(text)','execute') as can_check;
