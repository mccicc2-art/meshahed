-- ============================================================
-- 126 — تفضيلاتُ المحتوى: أنواعٌ غيرُ مرغوبة ولغاتٌ مفضّلةٌ ومستبعدة · D-545
--
-- **ولماذا أعمدةٌ على `profiles` لا جدولٌ جديد** (مواصفةُ أحمد: «راجع
-- بنية التفضيلات الحالية وأعد استخدامها»، وحكمُه بعد المراجعة):
--   ١) **`favorite_genres` موجودٌ هناك منذ اليوم الأوّل** وهو «المحتوى
--      المفضَّل» بعينه، **ويُحرَّر في هذه الصفحة نفسِها**. **وجدولٌ ثانٍ
--      يعني الأنواعَ المفضّلةَ في مكانين** — وهو ما تمنعه القاعدة ٣.
--   ٢) **`profiles` تُقرأ مرّةً مخبَّأةً لكلِّ صفحة** (`getProfile`)
--      **فلا استعلامَ ثانٍ** — وهو شرطُ المواصفة نصّاً.
--   ٣) **وRLS المطلوب قائمٌ فعلاً ومقيس**: سياسةٌ واحدةٌ `ALL` بـ
--      `using (auth.uid() = id)` **و`with check (auth.uid() = id)`** —
--      **الشرطان اللذان طلبتَهما على التحديث موجودان.**
--
-- **إضافةٌ محضة**: ثلاثةُ أعمدةٍ بقيمةٍ افتراضيّةٍ فارغة **ولا شيءَ
-- يتغيّر لمن لم يفتح الإعدادات** — وهو شرطُ «السلوكُ الحالي مطابقٌ تماماً».
--
-- ⚠️ **واللغاتُ رموزُ ISO 639-1 وترتيبُ المصفوفة معنًى**: الأولى أعلى
-- أولويّة. **`text[]` تحفظ الترتيب، و`jsonb` كانت ستحفظه أيضاً**
-- لكنّ المصفوفةَ تُفهرَس وتُقارن بـ`&&` بلا تحويل.
--
-- rollback:
--   alter table public.profiles
--     drop column if exists unwanted_genres,
--     drop column if exists preferred_languages,
--     drop column if exists excluded_languages;
-- ============================================================

alter table public.profiles
  add column if not exists unwanted_genres     integer[] not null default '{}',
  add column if not exists preferred_languages text[]    not null default '{}',
  add column if not exists excluded_languages  text[]    not null default '{}';

-- **حارسٌ في القاعدة لا في الواجهة وحدَها** (D-177: حارسٌ على طرفٍ واحد
-- ليس حارساً): **نوعٌ لا يكون مفضّلاً وغيرَ مرغوبٍ معاً، ولغةٌ لا تكون
-- مفضّلةً ومستبعدةً معاً** — **ولو أرسل العميلُ ذلك يُرفض الصفُّ كلُّه.**
alter table public.profiles
  drop constraint if exists profiles_prefs_no_conflict;
alter table public.profiles
  add constraint profiles_prefs_no_conflict check (
    not (coalesce(favorite_genres, '{}') && coalesce(unwanted_genres, '{}'))
    and
    not (coalesce(preferred_languages, '{}') && coalesce(excluded_languages, '{}'))
  );
