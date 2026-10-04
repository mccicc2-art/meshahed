-- 193 — profiles.title_mode (D-1269)
--
-- اختيارُ «أسماء العناوين» كان كوكيّاً وحدَه (D-544)، فيخصّ الجهازَ لا صاحبَه:
-- من اختار في جوّاله وجد غيرَه في الويب. هذا العمودُ مرجعُ الحساب، والكوكي
-- يبقى نسخةَ الجهاز السريعة التي يقرؤها الخادم.
--
-- فارغٌ = لم يختر صاحبُه بعد ⇒ يبقى على ما يقوله جهازُه (الافتراض «loopz»).
-- بلا قيمةٍ افتراضيّة ولا تعبئة: لا صفَّ قائماً يُمسّ.
--
-- القيمُ لا تُقيَّد بقائمةٍ هنا — القائمةُ تغيّرت في D-1266 وستتغيّر — والتنقيةُ في
-- `parseTitleMode` عند الكتابة والقراءة. القيدُ هنا على الطول وحدَه.
--
-- ومنحُ `profiles` عموديّ (D-839): العمودُ الجديد لا يُقرأ ولا يُكتب بجلسة
-- المستخدم حتّى يُمنح. والكاتبُ هنا المستخدمُ نفسُه (فعلُ الإعدادات بجلسته،
-- وسياسةُ «صفّي أنا» القائمة تحرسه)، فيُمنح `authenticated` ولا يُمنح `anon`.

alter table public.profiles
  add column if not exists title_mode text;

alter table public.profiles
  drop constraint if exists profiles_title_mode_len;
alter table public.profiles
  add constraint profiles_title_mode_len
  check (title_mode is null or char_length(title_mode) between 1 and 20);

grant select (title_mode), insert (title_mode), update (title_mode)
  on public.profiles to authenticated;
