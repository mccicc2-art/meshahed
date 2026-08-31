-- ============================================================
-- 169 — حسابُ X موثَّقٌ بتسجيل دخولٍ لا بكتابةِ اسم (D-839)
-- ============================================================
-- **حكمُ أحمد**: «هنا مع تويتر والمواقع الثانية أبغاه ربط حقيقي مو بس
-- كتابة اسم، بحيث يعمل تسجيل دخول عن طريقهم عشان يكون أكثر مصداقيّة».
--
-- 🔑 **وعمودٌ واحدٌ يكفي لأنّ المعرّف له بيتٌ أصلاً**: `socials->>'x'`
-- **يخزّن المعرّف منذ D-546**، **وهذا العمودُ يقول متى ثبت**.
-- **وتاريخٌ لا رايةٌ منطقيّة**: **«موثَّقٌ منذ متى» سؤالٌ يُسأل**،
-- **و`true` لا تُجيب عنه** (وهو عرفُ `verified_at` في الجدول نفسِه).
--
-- ⚠️ **والاثنان يُكتبان معاً بيدٍ واحدة** (D-462): **`syncXIdentity`
-- وحدَها تكتبهما من هويّةِ المزوّد** — **ولا يكتب المستخدمُ معرّفَه
-- بيده بعد اليوم**، **وحقلٌ يُوثَّق ويُحرَّر بعده توثيقٌ كاذب.**
--
-- 🔑 **و`socials` تدخل `public_profiles` لأوّل مرّة**: **كانت تُخزَّن
-- منذ D-546 ولا تخرج لأحد** — **فالمعرّفاتُ كانت تُكتب ولا تُرى**
-- (`socialUrl` و`hasAnySocial` بلا قارئٍ واحدٍ في الشجرة كلِّها).
-- ⚠️ **وتتبع حجابَ الاسم**: **من أخفى اسمَه لا يُكشف حسابُه في X**
-- — **وإلّا كان الحجابُ بابَه مفتوحاً من الخلف** (عرفُ `bio` و`username`
-- في هذه الرؤية نفسِها).
--
-- ⚠️ **والعمودان يُلحَقان في آخر قائمة الاختيار** (D-824): **`create or
-- replace view` تحفظ المنحَ بهذا الشرط وحدَه** — ١٩ عموداً → ٢١.
-- ============================================================

alter table public.profiles
  add column if not exists x_verified_at timestamptz;

create or replace view public.public_profiles as
 select id,
        case when coalesce(hide_name, false) and id is distinct from auth.uid()
             then null::text else nickname end as nickname,
        case when coalesce(hide_name, false) and id is distinct from auth.uid()
             then null::text else username end as username,
        case when coalesce(hide_name, false) and id is distinct from auth.uid()
             then null::text else avatar_url end as avatar_url,
    cover_url,
    favorite_genres,
    coalesce(hide_name, false) as hide_name,
    cover_pos,
    avatar_pos,
        case when coalesce(hide_name, false) and id is distinct from auth.uid()
             then null::text else bio end as bio,
    coalesce(is_private, false) as is_private,
    coalesce(hide_follow_lists, false) as hide_follow_lists,
    profile_prefs,
        case when plus_until is not null and plus_until <= now()
             then 'free'::text else plan end as plan,
    coalesce(founder, false) as founder,
    verified_at,
    theme_accent,
    joined_at,
    -- 🆕 العمودان الملحَقان (أعلاه)
        case when coalesce(hide_name, false) and id is distinct from auth.uid()
             then null::jsonb else socials end as socials,
    x_verified_at
   from profiles p;

notify pgrst, 'reload schema';

-- ============================================================
-- فحصُ صحّةٍ بعد التنفيذ:
--   select count(*) from information_schema.columns
--    where table_schema='public' and table_name='public_profiles';   -- ٢١
--   select grantee, privilege_type from information_schema.role_table_grants
--    where table_name='public_profiles';                             -- كما كانت
--   select count(*) from pg_policies where schemaname='public'
--     and (qual='true' or qual is null) and cmd='SELECT';            -- ٥ كما هي
-- ============================================================
