-- هجرة 121 — حجم الخط: تفضيلان مستقلان يتبعان الحساب (١٩ أغسطس ٢٠٢٦)
--
-- «حفظ الاختيار للحساب، أو محلياً للزائر»: الكوكي يخدم الجهاز، وهذان
-- العمودان يجعلان الاختيار يتبع صاحبه بين أجهزته (نمط عمود الثيم في
-- appearance.sql حرفاً). القيم أربع درجات مغلقة — والتحقق في القاعدة
-- أيضاً لا في الشيفرة وحدها، فقيمة حرة هنا تدخل data-* على جذر الصفحة.
--
-- لا سياسة جديدة ولا دالة ولا قراءة عامة: العمودان خاصان بصاحبهما
-- (سياسات profiles القائمة)، ولا يدخلان public_profiles — حجم خطك ليس
-- شأن زوارك.
--
-- الكاتب الوحيد: setFontPrefs في actions.ts (حقل واحد لا يملك كاتبَين).

-- ⚖️ و«ui_state» بطلب أحمد ١٩ أغسطس بنصّه («اعتمد حفظ التلميحات والجولة
-- في حساب المستخدم، مع localStorage للزائر والمزامنة عند تسجيل الدخول»)
-- — ينقض به قرارَ «التلميح شأن جهاز لا حساب» المكتوبَ في OneTimeHint:
--   { "hints": ["home-customize", …], "tour": { "v":1, "i":3, "s":"done" } }
-- الكاتب الوحيد: updateUiState في actions.ts. والتحقق من الشكل في الشيفرة
-- (sanitizeUiState) — jsonb حرّ هنا لأن مفاتيحه ستتغير مع كل تلميح جديد،
-- وقيد check على شكل jsonb يعني هجرةً لكل تلميح.

alter table public.profiles
  add column if not exists font_ui text not null default 'md'
    constraint profiles_font_ui_check check (font_ui in ('sm', 'md', 'lg', 'xl')),
  add column if not exists font_content text not null default 'md'
    constraint profiles_font_content_check check (font_content in ('sm', 'md', 'lg', 'xl')),
  add column if not exists ui_state jsonb not null default '{}'::jsonb;

-- التحقق:
-- select count(*) from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--   and column_name in ('font_ui', 'font_content', 'ui_state');
-- المتوقع: 3
-- ثم فحص الصحة المعتاد:
-- select tablename, policyname from pg_policies
--   where schemaname = 'public' and qual = 'true';
-- المتوقع: أربع سياسات بالضبط.
