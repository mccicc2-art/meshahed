-- ============================================================
--  Loopz — 273: إذنُ ظهور الاسم في بطاقات تطابق الذوق (T596، أحمد ٢٧ نوفمبر ٢٠٢٦: «س٩ أ»)
--  شغّله في Supabase → SQL Editor **قبل** نشر الواجهة. آمنٌ لإعادة التشغيل.
--
--  قرارُ أحمد: بطاقةُ تطابق الذوق تُظهر اسمَ الصديق وصورتَه **بإذنه فقط**، والإذنُ «إعدادٌ واحدٌ في الخصوصيّة، مطفأٌ افتراضيّاً».
--  مطفأٌ ⇒ البطاقةُ تُشارَك وصاحبُها يُسمّى، والصديقُ «صديق» بلا اسمٍ ولا صورة.
--
--  عمودٌ واحد ودالّةٌ واحدة — لا جدولَ ولا تعديلَ لعرض `public_profiles`:
--    profiles.allow_match_card   — يكتبه صاحبُ الحساب وحده (منحةٌ باسم العمود كـ`dm_policy`، D-839).
--    match_card_name_ok(target)  — يسأل بها راسمُ البطاقة (بجلسة من يشارك) دون أن يقرأ صفَّ غيره: نعم فقط إن أذن ولم يُخفِ اسمَه.
--  جُرّبت على `loopz-preview` أوّلاً.
-- ============================================================

alter table public.profiles
  add column if not exists allow_match_card boolean not null default false;

comment on column public.profiles.allow_match_card is
  'T596 (273) — true: the member allows their name and photo on taste-match share cards made by others. Off by default.';

-- صاحبُ الحساب يقرأ إعدادَه ويغيّره؛ والعمودُ يُمنح باسمه لأنّ `authenticated` تملك الكتابةَ على أعمدةٍ مسمّاة
grant select (allow_match_card), insert (allow_match_card), update (allow_match_card) on public.profiles to authenticated;

create or replace function public.match_card_name_ok(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.allow_match_card and not coalesce(p.hide_name, false) from public.profiles p where p.id = target),
    false
  );
$$;

revoke all on function public.match_card_name_ok(uuid) from public, anon;
grant execute on function public.match_card_name_ok(uuid) to authenticated;

-- تحقّقٌ بعد التشغيل:
-- select column_name, column_default from information_schema.columns where table_name = 'profiles' and column_name = 'allow_match_card';
-- select public.match_card_name_ok(auth.uid());  -- false حتّى تفعّله
