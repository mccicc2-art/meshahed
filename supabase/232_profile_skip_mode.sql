-- 232 — profiles.skip_mode (D-1623)
--
-- «إخفاء الفلر» و«المسار الذهبي» كانا على الجهاز وحده (SecureStore · localStorage، D-1619/D-1620)،
-- فصفحةُ العمل تقول ٣٤٦/٣٤٦ والرئيسيّةُ والمكتبةُ والودجت تقول ٣٤٦/١٢١٨ و«الحلقةُ التالية» فيها
-- حلقةٌ مخفيّة. أحمد ٢ نوفمبر ٢٠٢٦ («٤أ»): يُحفظ في الحساب ويُطبَّق في كلِّ مكان.
--
-- فارغٌ = لم يختر صاحبُه بعد ⇒ الكلُّ ظاهر (والجهازُ يبقى على ما اختاره حتى يكتب).
-- بلا قيمةٍ افتراضيّة ولا تعبئة: لا صفَّ قائماً يُمسّ.
--
-- ومنحُ `profiles` عموديّ (D-839): العمودُ لا يُقرأ ولا يُكتب بجلسة المستخدم حتّى يُمنح.
-- الكاتبُ المستخدمُ نفسُه (سياسةُ «صفّي أنا» القائمة تحرسه)، فيُمنح `authenticated` لا `anon`.
-- ومسارُ الودجت يقرأ بمفتاح الخدمة فلا يحتاج منحاً.

alter table public.profiles
  add column if not exists skip_mode text;

alter table public.profiles
  drop constraint if exists profiles_skip_mode_check;
alter table public.profiles
  add constraint profiles_skip_mode_check
  check (skip_mode is null or skip_mode in ('all', 'filler', 'golden'));

grant select (skip_mode), insert (skip_mode), update (skip_mode)
  on public.profiles to authenticated;
