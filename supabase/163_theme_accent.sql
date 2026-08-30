-- ============================================================================
-- 163_theme_accent.sql — لونُ التمييز الشخصيّ (D-825)
-- ============================================================================
--
-- **حكمُ أحمد** (٣٠ أغسطس): «احتاج إمكانية اختيار ألوان الثيم حسب مزاجه،
-- **والي يدخل حسابه يشوف الألوان المختارة**».
--
-- 🔑 **والمختارُ لونُ التمييز لا الثيمُ كلُّه** — **والحجّةُ تُقال لا
-- تُخبَّأ**: الثيمُ ثمانيةَ عشرَ متغيّراً فيها الخلفيّةُ والنصّ،
-- **ومن ملك الخلفيّةَ والنصَّ ملك أن يصنع تطبيقاً لا يُقرأ**
-- (D-636: امنعِ الحالةَ المستحيلة في مصدرها). **ولونُ التمييز هو
-- الذي يُقرأ «لوني»** — **وكلُّ لونٍ في السجلّ يحمل لونَ نصِّه معه**
-- فلا تركيبةَ واحدةٌ تسقط قراءةً.
--
-- 🔑 **وبيتُه عمودٌ لا `ui_state`** (خلافاً لـD-822): **`ui_state` حالةُ
-- صاحبِها ولا يقرؤها زائر** — **وهذا نصفُ الطلب: أن يراه الزائر.**
--
-- ⚠️ **ورمزٌ لا لون** — نفسُ حكم D-824: **القيمُ في `lib/themes.ts`**،
-- **والقيدُ شكلٌ لا تعداد** فتُوسَّع القائمةُ بلا هجرةٍ ثانية.
--
-- 🔴 **ودرسُ الهجرة ١٦٠ بحرفه**: **`profiles` تُمنح `update` بالعمود**
--    (٢٥ عموداً من ٣٦) **و`select` على الجدول** — **فُحص قبل كتابة هذين
--    السطرين ولم يُفترض**: **`grant update (theme_accent)` واجبٌ**،
--    **و`select` يرثه العمودُ من منحة الجدول** لـ`anon` و`authenticated`
--    معاً — **وهو المطلوب: الزائرُ يراه.**
--
-- ⚠️ **ولا صفَّ قائمٌ يُمسّ**: `add column` بلا قيمةٍ افتراضيّة —
--    **والغائبُ يعني «لونُ الثيم كما هو»** تماماً كما اليوم.

alter table public.profiles add column if not exists theme_accent text;

alter table public.profiles drop constraint if exists profiles_theme_accent_check;
alter table public.profiles
  add constraint profiles_theme_accent_check
  check (theme_accent is null or theme_accent ~ '^[a-z]{3,12}$');

grant update (theme_accent) on public.profiles to authenticated;

comment on column public.profiles.theme_accent is
  'رمزُ لونِ التمييز الشخصيّ — القيمُ في lib/themes.ts (ACCENTS). null = لونُ الثيم.';

-- ============================================================
--  ٢) والعرضُ العامُّ يحمله — **وهو نصفُ الطلب**
-- ============================================================
-- 🔑 «**والي يدخل حسابه يشوف الألوان المختارة**» — **والصفحةُ تقرأ
--    `public_profiles` لا `profiles`** (الجدولُ مقصورٌ على صاحبه)،
--    **فعمودٌ لا يعبر العرضَ لا يراه زائر.**
-- ⚠️ **ولا يُخفى مع `hide_name`**: **إخفاءُ الاسم إخفاءُ هويّةٍ لا
--    إخفاءُ زينة** — **ولونٌ يختفي لأنّ صاحبَه أخفى اسمَه يترك صفحةً
--    نصفَ ملوّنةٍ بلا سبب.**
-- ✅ **و`create or replace view` تُبقي الأذونَ ولا تُسقطها** — **بخلاف
--    `drop function`** (درسُ ١٦٢) — **والعمودُ يُضاف في آخر القائمة**
--    لأنّ Postgres لا تقبل إدراجَه في وسطها. **وقِيس `relacl` بعدها.**

create or replace view public.public_profiles as
 SELECT id,
        CASE
            WHEN COALESCE(hide_name, false) AND id IS DISTINCT FROM auth.uid() THEN NULL::text
            ELSE nickname
        END AS nickname,
        CASE
            WHEN COALESCE(hide_name, false) AND id IS DISTINCT FROM auth.uid() THEN NULL::text
            ELSE username
        END AS username,
        CASE
            WHEN COALESCE(hide_name, false) AND id IS DISTINCT FROM auth.uid() THEN NULL::text
            ELSE avatar_url
        END AS avatar_url,
    cover_url,
    favorite_genres,
    COALESCE(hide_name, false) AS hide_name,
    cover_pos,
    avatar_pos,
        CASE
            WHEN COALESCE(hide_name, false) AND id IS DISTINCT FROM auth.uid() THEN NULL::text
            ELSE bio
        END AS bio,
    COALESCE(is_private, false) AS is_private,
    COALESCE(hide_follow_lists, false) AS hide_follow_lists,
    profile_prefs,
        CASE
            WHEN plus_until IS NOT NULL AND plus_until <= now() THEN 'free'::text
            ELSE plan
        END AS plan,
    COALESCE(founder, false) AS founder,
    verified_at,
    theme_accent
   FROM profiles p;

notify pgrst, 'reload schema';

-- ═══ فحصٌ صحّيّ ═══
-- select count(*) from information_schema.columns
--   where table_schema='public' and table_name='public_profiles';   -- ١٧
-- select relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='public' and c.relname='public_profiles';       -- كما كان
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='profiles' and column_name='theme_accent';
-- select has_column_privilege('authenticated','public.profiles','theme_accent','UPDATE');  -- t
-- select has_column_privilege('anon','public.profiles','theme_accent','SELECT');            -- t
-- select count(*) from public.profiles;                    -- بلا تغيّر
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';             -- خمسٌ بلا زيادة
