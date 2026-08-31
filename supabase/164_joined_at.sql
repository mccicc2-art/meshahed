-- ============================================================
-- 164 — تاريخُ الانضمام في صفِّ الملفّ (D-831)
-- ============================================================
-- **حكمُ أحمد**: «مدّة العضويّة من الانضمام» — **بعد أن قِيست القاعدة**:
-- ٣٢ عضواً، أوّلُهم ٢ أغسطس ٢٠٢٦ وآخرُهم ٢٥ أغسطس، **و٢٩ منهم انضمّوا
-- قبل ١٥ أغسطس** — **فتاريخٌ ثابتٌ واحدٌ كان سيقول لتسعةٍ وعشرين مدّةً
-- أقصرَ من الحقيقة** (D-063: **رقمٌ يُعرض خطأً أسوأُ من رقمٍ يغيب**).
--
-- 🔑 **ولماذا عمودٌ لا قراءةٌ من `auth.users`**: **سكيما `auth` ليست
-- مكشوفةً لـPostgREST** — **فالقراءةُ منها تحتاج دالّةَ definer لكلِّ
-- صفٍّ يُرسم**، **وصفحةُ ملفٍّ ترسم شارةً واحدةً لا تستحقّ رحلةً ثانية.**
-- **والصفُّ عندنا أصلاً، فالحقيقةُ تُنسخ إليه مرّةً وتبقى.**
--
-- ⚠️ **والافتراضُ `now()` هو الصوابُ للقادمين**: `handle_new_user` تُدرج
-- الصفَّ **لحظةَ إنشاء الحساب** (تريغر على `auth.users`) — **فالافتراضُ
-- هو تاريخُ الانضمام نفسُه ولا يحتاج تعديلَ الدالّة** (D-028: أقلُّ ما
-- يُمسّ).
--
-- ⚠️ **والتعبئةُ من `auth.users` لا من `updated_at`**: **آخرُ تعديلٍ
-- ليس تاريخَ انضمام** — **وعمودٌ يحمل معنى عمودٍ آخر هو الكذب بعينه**
-- (D-664: كلُّ رقمٍ يقول قاعدتَه في اسمه).
-- ============================================================

-- 🔴 **والعمودُ يقبل الفراغ — وهذا قِيس لا اختير**: **حسابُ Loopz
-- (`is_system`) موجودٌ في `auth.users` بـ`created_at` فارغ** — **فأوّلُ
-- محاولةٍ سقطت على `not null` وارتدّت كلُّها** (ولا صفَّ تغيّر).
-- **والصوابُ أن يبقى فارغاً**: **حسابُ المنصّة ليس عضواً منضمّاً**،
-- **والغيابُ يُكتب غياباً لا يُملأ بتاريخِ اليوم** (D-063) — **والشارةُ
-- تسقط عمّن لا تاريخَ له بدل أن تكذب عليه.**
-- ⚠️ **والافتراضُ `now()` باقٍ للقادمين** (`handle_new_user` تُدرج الصفَّ
-- لحظةَ إنشاء الحساب) — **فالجديدُ يكتب تاريخَه بنفسه.**
alter table public.profiles
  add column if not exists joined_at timestamptz default now();

-- **التعبئةُ مرّةً واحدةً من الحقيقة** — **وما لا حقيقةَ له يصير فارغاً**
update public.profiles p
   set joined_at = u.created_at
  from auth.users u
 where u.id = p.id
   and p.joined_at is distinct from u.created_at;

-- ============================================================
-- العرضُ العامّ — **والعمودُ يُضاف في آخرِ قائمة الاختيار** (درسُ D-824):
-- `create or replace view` تحفظ المنحَ **بشرط ألّا يتغيّر ترتيبُ ما
-- قبله**، **وإعادةُ إنشائها بـ`drop` كانت ستُسقط صلاحيّاتها.**
-- ============================================================
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
    theme_accent,
    -- 🆕 **وتاريخُ الانضمام معلَنٌ لا مخفيّ**: **شارةٌ تُقرأ على صفحةٍ
    -- عامّةٍ تحتاج قيمتَها في العرض العامّ** — **وليس فيه ما يُخفى**
    -- (يومُ انضمامٍ لا مولد).
    joined_at
   FROM profiles p;

-- ============================================================
-- فحصُ صحّةٍ بعد التنفيذ (يُقرأ ولا يُصدَّق بالحدس):
--   select count(*) filter (where joined_at is null) as nulls,
--          min(joined_at)::date as first, max(joined_at)::date as last
--     from public.profiles;                  -- المتوقَّع: 1 (Loopz) · 2026-08-02 · 2026-08-25
--   select count(*) from public.profiles p join auth.users u on u.id = p.id
--    where p.joined_at is distinct from u.created_at;   -- المتوقَّع: 0
--   select count(*) from information_schema.columns
--    where table_schema='public' and table_name='public_profiles';  -- ١٨ (كانت ١٧)
-- ============================================================
