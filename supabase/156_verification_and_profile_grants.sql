-- ============================================================================
-- 156_verification_and_profile_grants.sql
--   التوثيق — وسدُّ ثغرتَي امتيازٍ سبقتاه
-- ============================================================================
--
-- 🔴 **الثغرتان أوّلاً، والشارةُ بعدهما** — ولا تُقلب النوبة.
-- حكمُ أحمد (D-773): «التوثيقُ لا يُباع ولا يأتي تلقائيّاً مع Plus…
-- بهذا تبقى العلامةُ نادرةً وموثوقة». **وعمودٌ يستطيع صاحبُه أن يختمَ
-- به نفسَه ليس توثيقاً، هو زينةٌ مجّانيّة.** فلو أُضيف `verified_at`
-- قبل السدّ لوُلد مثقوباً.
--
-- ─────────────────────────── الأصلُ الواحد ────────────────────────────
-- Supabase تفتح المشروعَ بـ
--   `alter default privileges in schema public grant all on tables
--    to anon, authenticated, service_role;`
-- **فكلُّ جدولٍ أو عرضٍ يُولد في `public` يولد ومعه `all` للزائر
-- وللمسجَّل.** وهذا مقبولٌ للجداول لأنّ RLS هو البابُ هناك، **ومهلكٌ
-- في موضعين**: جدولٌ سياستُه `all` على صفٍّ يملكه المستخدم، **وعرضٌ**
-- — لأنّ العرضَ لا RLS له أصلاً.
--
-- ⚠️ **والدرسُ الذي كلّف جولةً**: `drop view` ثمّ `create view` **تُعيد
-- المنحةَ الافتراضيّةَ من جديد** — فالنزعُ يأتي بعد الإنشاء دائماً،
-- لا قبله.
--
-- ══════════════════ الثغرةُ الأولى: أعمدةُ `profiles` ══════════════════
-- سياسةٌ واحدةٌ `all` شرطُها `auth.uid() = id`. **والسياسةُ تحرس الصفَّ
-- ولا تحرس العمود**: فكلُّ داخلٍ إلى حسابه كان يستطيع
-- `PATCH /profiles?id=eq.<معرّفه هو>` بجسمٍ فيه `{"is_admin": true}`
-- **فيصير مديراً بطلبٍ واحدٍ من متصفّحه** — و`am_admin()` لا تقرأ إلّا
-- هذا العمود، وعليها تقوم `/admin/*` و`admin_decide_partner` وإدارةُ
-- الروابط. **وكذلك `plan` و`plus_until` و`founder` و
-- `ref_months_granted`**: اشتراكٌ بلا دفع، ومكافآتُ الدعوة تُصفَّر ثمّ
-- تُحصَّل من جديد.
--
-- ═══════════ الثغرةُ الثانية (وهي الأسوأ): العرضُ العامّ ═══════════
-- `public_profiles` عرضٌ **مالكُه `postgres`** بلا `security_invoker` —
-- وهذا مقصودٌ ولا يتغيّر (D-017: العرضُ هو ما يفتح ملفَّ غيرِك للقراءة
-- بينما RLS يقفل الجدول على صاحبه). **لكنّ العرضَ البسيطَ قابلٌ
-- للتحديث تلقائيّاً**، **والكتابةُ عبره تجري بصلاحيّة مالكِه** — أيْ
-- `postgres`، **الذي يتجاوز RLS**. و`authenticated` كان يملك عليه
-- `insert, update, delete`.
-- **فأيُّ مسجَّلٍ كان يستطيع `PATCH /public_profiles?id=eq.<أيِّ أحد>`
-- ويضع `founder = true`، أو يبدّل غلافَ غيرِه، أو `DELETE` صفَّ أيِّ
-- مستخدمٍ في التطبيق.** لا صفَّه هو — **صفَّ أيِّ أحد.**
-- ⚠️ **و`verified_at` كانت ستولد داخلَ هذا الباب**: عمودٌ بسيطٌ في
-- العرض = عمودٌ قابلٌ للتحديث = **توثيقٌ يمنحه المستخدمُ لنفسه.**
--
-- 🔑 **والعلاجُ في الحالتين منحةٌ لا سياسة**: السياساتُ سليمةٌ كما هي،
-- **والخللُ في جدول الامتيازات.** فتُنزع المنحةُ الجدوليّةُ وتُعاد
-- عموديّةً على ما يكتبه التطبيقُ فعلاً، **ويُترك للعرضِ `SELECT` وحدَه.**
--
-- ⚠️ **ولمَ `profiles` وحدَها من بين ستّين جدولاً تحمل المنحةَ نفسَها؟**
-- لأنّ سياساتِ البقيّةِ إمّا `select` فقط (`partners`، `referrals`،
-- `referral_codes`، `partner_applications`) وإمّا معدومةٌ تماماً
-- (`plus_rewards`، `referral_events`، `user_active_days`،
-- `partner_clicks`) — **وRLS مفعَّلٌ بلا سياسةٍ بابٌ مغلَق.**
-- **و`public_profiles` هو العرضُ الوحيدُ القابلُ للتحديث في المخطَّط**
-- (مُتحقَّقٌ منه حيّاً) — فلا أخٌ له يحتاج المعالجةَ نفسَها.
-- ============================================================================


-- ─── ١) عمودا التوثيق ──────────────────────────────────────────────────────
-- **ختمٌ لا رايةٌ ثنائيّة**: `timestamptz` يقول «متى» فيصلح لإعادة الفحص
-- عند تغيير الاسم جذريّاً أو انتقال ملكيّة الحساب (شرطُ أحمد)، والرايةُ
-- لا تقول شيئاً. **والنزعُ بـ`null`** — والتاريخُ يبقى في جدول الطلبات.
alter table public.profiles
  add column if not exists verified_at timestamptz,
  -- نوعُ الحساب كما اختاره: شخصيّة/صانع · جهة/علامة · منصّة إعلاميّة.
  -- **والشارةُ واحدةٌ لثلاثتها** (نصُّ أحمد: «الشخص أو الجهة المذكورة»)،
  -- والنوعُ لسياسةِ المراجعة لا لرسمٍ ثانٍ — **شارةٌ ثانيةٌ عطلٌ لا تنويع.**
  add column if not exists verified_kind text
    check (verified_kind is null or verified_kind in ('person', 'org', 'media'));

comment on column public.profiles.verified_at is
  'ختمُ التوثيق اليدويّ — يُكتب من دالّة المراجعة وحدَها، لا من العميل';


-- ─── ٢) نزعُ المنحةِ الجدوليّة عن `profiles` ───────────────────────────────
-- **والقراءةُ تبقى**: RLS يحصرها في صفِّك، ونزعُها كان سيحوّل قراءةَ
-- الزائرِ من «صفرُ صفوف» إلى خطأِ صلاحيّةٍ ٤٢٥٠١ — **وخطأٌ حيث كان صمتٌ
-- انكسارٌ في مسارٍ لم يتغيّر منطقُه.**
revoke insert, update, delete on public.profiles from anon, authenticated;
-- **والحذفُ لا يُعاد لأحد**: حذفُ الحساب يمرّ بـ`delete_my_account()`
-- (حزمةُ `security.sql`) — وهي وحدَها تعرف ما يُحذف معه.


-- ─── ٣) إعادةُ المنحةِ على الأعمدةِ التي يكتبها التطبيقُ فعلاً ────────────
-- **القائمةُ مستخرَجةٌ من الشيفرة لا مقدَّرة**: `updateProfile` و
-- `setHomeView`/`setToWatchQueue`/`saveHomeSectionOrder`/`saveRowOrder`
-- (`home_prefs`) و`setFontPrefs` و`patchUiState` و`setContentPrefs`/
-- `mergeGuestPrefs` و`setLocale` و`saveProfileSectionOrder`/
-- `setProfileSavedLists` (`profile_prefs`).
--
-- ⚠️ **و`id` تُمنح للاثنين**: `upsert` من PostgREST يولّد
-- `insert … on conflict (id) do update set …` **فتدخل `id` في الجانبين**،
-- **وشرطُ السياسة `with check (auth.uid() = id)` يمنع تحويلَها لغيرك.**
-- **والأختامُ الثلاثةُ خارجَ القائمة** (`notif_seen_at`، `feed_seen_at`،
-- `last_seen_at`): تكتبها دوالُّ definer وحدَها (`notifications.sql`،
-- `feed_seen.sql`، `153`) — **وختمُ «رأيتُ» يُدفع إلى الأمام فقط.**
grant insert (
  id, nickname, avatar_url, favorite_genres, updated_at, username,
  cover_url, theme, locale, hide_name, home_prefs, cover_pos, avatar_pos,
  bio, is_private, hide_follow_lists, profile_prefs, font_ui, font_content,
  ui_state, unwanted_genres, preferred_languages, excluded_languages, socials
) on public.profiles to authenticated;

grant update (
  id, nickname, avatar_url, favorite_genres, updated_at, username,
  cover_url, theme, locale, hide_name, home_prefs, cover_pos, avatar_pos,
  bio, is_private, hide_follow_lists, profile_prefs, font_ui, font_content,
  ui_state, unwanted_genres, preferred_languages, excluded_languages, socials
) on public.profiles to authenticated;

-- **ولا شيءَ لـ`anon`**: كلُّ كاتبٍ في الشيفرة يمرّ بـ`requireUser` أو
-- بفحصِ `auth.getUser()` قبله — **والزائرُ يكتب في كوكي جهازه.**


-- ─── ٤) العرضُ العامّ: يُبنى من جديدٍ ثمّ يُقفل ────────────────────────────
-- **يُبنى من جديدٍ لا يُستبدل**: `create or replace` لا تحذف عموداً ولا
-- تعيد ترتيباً، **والبناءُ آمنٌ هنا** لأنّه لا عرضَ ولا دالّةَ تعتمد عليه
-- (مُتحقَّقٌ من `pg_depend` ومن نصوص كلِّ الدوالّ) — قارئُه التطبيقُ وحدَه.
--
-- 🔴 **و`plan` تُخفَّض عند المصدر**: `isPlus()` تقرأ `plus_until`،
-- **والعرضُ لا يمرّرها بقرارِ أحمد في D-633** («الشارةُ تُرى والتاريخُ لا
-- يُرى، فلا يعرف الناسُ متى ينتهي اشتراكُ غيرهم») — **فكان الغيابُ يُقرأ
-- «بلا انتهاء» فيرى الناسُ شارةَ بلس على مشتركٍ انتهى اشتراكُه أمس**،
-- بينما يراها صاحبُها مطفأةً في صفحته (هناك يُقرأ الجدولُ كاملاً).
-- **وحكمٌ واحدٌ يعطي جوابين بحسب من ينظر عطلٌ لا اختلافُ سياق.**
-- 🔑 **والعلاجُ لا ينقض القرار ولا يزرع حكماً ثانياً في SQL**: العرضُ
-- لا يضيف عموداً ولا بوليانَ صلاحيّة، **بل يقول الحقيقةَ في `plan` نفسِها**
-- — منتهي الاشتراكِ **هو `free` علناً**. فتبقى `plan.ts` القاعدةَ
-- الواحدة (D-145) بلا سطرٍ يتغيّر فيها.
drop view if exists public.public_profiles;

create view public.public_profiles as
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
         -- **والختمُ يخرج للعامّة**: الشارةُ تُرى على ملفِّ صاحبها،
         -- **ولا يُخرج نوعُ التوثيق** — النوعُ لسياسة المراجعة لا للعرض.
         verified_at
    from public.profiles p;

grant select on public.public_profiles to anon, authenticated, service_role, postgres;

-- 🔴 **والنزعُ بعد الإنشاء لا قبله**: `create view` تلتقط المنحةَ
-- الافتراضيّةَ (`all`) من جديد — **وهذا بالضبط ما أعاد الثغرةَ في
-- التطبيق الأوّل.**
revoke insert, update, delete, truncate, references, trigger
  on public.public_profiles from anon, authenticated;

comment on view public.public_profiles is
  'الأعمدة العامة من profiles. عرضٌ مالكُه postgres فيتجاوز RLS عمداً — ولهذا لا يُمنح عليه إلا SELECT.';


-- ============================================================================
-- التحقّق — شُغِّل بعده، والمتوقَّع بين القوسين
-- ============================================================================
-- ١) لا منحةَ كتابةٍ جدوليّةً على الجدول:                      (صفر صفوف)
--    select grantee, privilege_type from information_schema.table_privileges
--     where table_schema='public' and table_name='profiles'
--       and grantee in ('anon','authenticated')
--       and privilege_type in ('INSERT','UPDATE','DELETE');
--
-- ٢) الأعمدةُ المحروسةُ لا تُكتب:                              (صفر صفوف)
--    select column_name from information_schema.column_privileges
--     where table_schema='public' and table_name='profiles'
--       and grantee in ('anon','authenticated')
--       and privilege_type in ('INSERT','UPDATE')
--       and column_name in ('is_admin','plan','plus_until','founder',
--            'ref_months_granted','is_system','verified_at','verified_kind',
--            'last_seen_at','notif_seen_at','feed_seen_at');
--
-- ٣) المسموحةُ تُكتب:                                    (٢٤ عموداً UPDATE)
--    select count(*) from information_schema.column_privileges
--     where table_schema='public' and table_name='profiles'
--       and grantee='authenticated' and privilege_type='UPDATE';
--
-- ٤) العرضُ للقراءة وحدَها:                     (anon:SELECT authenticated:SELECT)
--    select grantee, string_agg(privilege_type,',' order by privilege_type)
--      from information_schema.table_privileges
--     where table_schema='public' and table_name='public_profiles'
--       and grantee in ('anon','authenticated') group by 1;
--
-- ٥) لا عرضَ آخرَ قابلٌ للتحديثِ يحمل منحةَ كتابة:            (صفر صفوف)
--    select v.table_name from information_schema.views v
--     where v.table_schema='public' and v.is_updatable='YES'
--       and exists (select 1 from information_schema.table_privileges tp
--                    where tp.table_schema='public' and tp.table_name=v.table_name
--                      and tp.grantee in ('anon','authenticated')
--                      and tp.privilege_type in ('INSERT','UPDATE','DELETE'));
--
-- ٦) والحيُّ جُرِّب لا قُرِئ فقط (داخل معاملةٍ تُلغى):
--    مسجَّلٌ يعدّل `bio` في صفِّه            → ينجح
--    مسجَّلٌ يضع `is_admin = true` في صفِّه  → 42501
--    مسجَّلٌ يكتب عبر `public_profiles`      → 42501
--    و`upsert` بشكلِ PostgREST كاملاً        → ينجح
-- ============================================================================
