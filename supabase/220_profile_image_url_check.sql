-- =====================================================================
-- 220 — صورتا الملفّ الشخصيّ من مضيفينا وحدهما (A-13)
-- =====================================================================
-- المدقّق ٢٢ أكتوبر ٢٠٢٦ (A-13)، وأحمد في اليوم نفسه: «والـSQL شغّله أنت» — **شُغِّلت على الإنتاج يدويّاً ٢٢ أكتوبر**
-- (`execute_sql`، فلا سطرَ لها في سجلّ الهجرات — انظر A-08). هذا الملفُّ سجلُّها في المستودع.
--
-- 🔴 العلّة: `profiles.avatar_url` و`cover_url` ممنوحان عموداً لـ`authenticated` (الهجرة ١٥٦)، فكتابةٌ مباشرةٌ عبر REST
--    تتخطّى `safeImageUrl` في `src/lib/actions.ts` — وبطاقةُ المشاركة (`src/app/api/share/route.tsx` · `dataUrl`) تجلب
--    الرابطَ من الخادم ⇒ جلبٌ لعنوانٍ يختاره المستخدم (SSRF). الكودُ يحرس الجلبَ الآن (`fetchableImage`)، وهذا يحرس القيمة.
-- ⚖️ القائمةُ قائمةُ `safeImageUrl` نفسُها + **ملفٌّ من الموقع بمقطعٍ واحد** (`/loopz-mark.png`): حسابُ Loopz الرسميّ يحمل
--    صورتين نسبيّتين منذ ١٤ أغسطس، ومقياسُ المدقّق لم يره — ورابطٌ نسبيٌّ لا يُجلب من الخادم ولا يقفز إلى مضيفٍ آخر.
--    ⚠️ غيّرها مع أختيها (`safeImageUrl` و`fetchableImage`): مضيفٌ يُقبل في واحدٍ ويُرفض في آخر صورةٌ تختفي أو كتابةٌ تفشل.
-- NOT VALID ثمّ VALIDATE: لا قفلَ طويلٌ على الجدول، وصفٌّ مخالفٌ يوقف التحقّق ولا يُحذف شيء.
--
-- ↩️ التراجع:
--   alter table public.profiles drop constraint if exists profiles_avatar_url_safe, drop constraint if exists profiles_cover_url_safe;

begin;
alter table public.profiles
  add constraint profiles_avatar_url_safe check (
    avatar_url is null
    or avatar_url ~ '^https://uvgmvrdrxzpudoldjxaa\.supabase\.co/storage/v1/object/public/'
    or avatar_url ~ '^https://lh3\.googleusercontent\.com/'
    or avatar_url ~ '^/[A-Za-z0-9._-]+$'
  ) not valid,
  add constraint profiles_cover_url_safe check (
    cover_url is null
    or cover_url ~ '^https://uvgmvrdrxzpudoldjxaa\.supabase\.co/storage/v1/object/public/'
    or cover_url ~ '^https://lh3\.googleusercontent\.com/'
    or cover_url ~ '^/[A-Za-z0-9._-]+$'
  ) not valid;
comment on constraint profiles_avatar_url_safe on public.profiles is 'A-13 (22 Oct 2026): mirrors safeImageUrl in src/lib/actions.ts + single-segment site assets (/loopz-mark.png). The share card fetches this URL server-side.';
comment on constraint profiles_cover_url_safe on public.profiles is 'A-13 (22 Oct 2026): mirrors safeImageUrl in src/lib/actions.ts + single-segment site assets (/loopz-cover.jpg).';
commit;

alter table public.profiles validate constraint profiles_avatar_url_safe;
alter table public.profiles validate constraint profiles_cover_url_safe;
