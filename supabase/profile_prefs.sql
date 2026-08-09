-- ============================================================
--  Loopz — تخصيص البروفايل (D-129) — رقم ٥١
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  **ما يضيفه:** عمود `profiles.profile_prefs` (توأم `home_prefs`)،
--  وإظهاره في `public_profiles`، ودالّة `profile_artists` لقسم «فنّانوك».
--
--  **لماذا التفضيلات في العرض العام وليست خاصّة:** هي **إخراجُ صفحته
--  للزائر** لا سرٌّ عنه — لو بقيت خاصّةً لرأى كلُّ زائرٍ ترتيباً
--  افتراضياً وضاع التخصيص كلّه. ولا شيء فيها يكشف محتوى: أسماءُ أقسامٍ
--  وترتيبُها لا غير.
--
--  **القيد الذي لا يُخترق (ق٦ من بريف الهوية):** ترتيبُ المالك ليس
--  إذناً. كل قسمٍ يُصفّى ثانيةً في SQL عبر `can_view_profile` — وإخفاءُ
--  قسمٍ من الترتيب إخراجٌ لا خصوصية. لذلك `profile_artists` تسأل
--  البوّابة أوّلَ سطرٍ فيها، ولا تعتمد على أن الصفحة لن ترسمها.
-- ============================================================

alter table public.profiles
  add column if not exists profile_prefs jsonb;

-- ============================================================
--  العرض العام + ذيلٌ جديد
--  الأعمدة الجديدة في الذيل عمداً: `create or replace` لا يقبل عموداً
--  في وسط عرضٍ قائم (image_positions ← profile_bio ← profile_visibility
--  ← follow_privacy ← هذا الملف).
-- ============================================================
create or replace view public.public_profiles
with (security_invoker = false)
as
  select
    p.id,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.nickname end   as nickname,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.username end   as username,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.avatar_url end as avatar_url,
    p.cover_url,
    p.favorite_genres,
    coalesce(p.hide_name, false) as hide_name,
    p.cover_pos,
    p.avatar_pos,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.bio end        as bio,
    coalesce(p.is_private, false)        as is_private,
    coalesce(p.hide_follow_lists, false) as hide_follow_lists,
    p.profile_prefs
  from public.profiles p;

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

-- ============================================================
--  قسم «فنّانوك» في بروفايل أيّ شخص
--
--  `person_follows` صفوفُك أنت وحدها (D-062)، وقد قال ملفُّها صراحةً إن
--  عرضَها يوماً يكون **بدالّةٍ محدودة الأعمدة لا بفتح الجدول** — هذا هو
--  ذلك اليوم. ثلاثة أعمدة تخرج: المعرّف والاسم والصورة. لا تاريخ
--  متابعةٍ ولا عدد: العدُّ من TMDB في طبقة العرض، والتاريخ لا شأن لأحد به.
--
--  والبوّابة أوّل سطر: حسابٌ خاصّ لا تتابعه يرجع صفراً من الصفوف — لا
--  خطأً ولا قائمةً فارغةً كاذبة، بل «لا شيء» كما تفعل بقية دوال الملف.
-- ============================================================
create or replace function public.profile_artists(p_user uuid, p_limit integer default 60)
returns table (
  person_id    integer,
  name         text,
  profile_path text
)
language sql
stable
security definer
set search_path = public
as $$
  select pf.person_id, pf.name, pf.profile_path
  from public.person_follows pf
  where pf.user_id = p_user
    and public.can_view_profile(p_user)
  order by pf.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;

revoke all on function public.profile_artists(uuid, integer) from public;
grant execute on function public.profile_artists(uuid, integer) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- ١) العمود والعرض:
--    select column_name from information_schema.columns
--    where table_schema='public' and table_name='public_profiles'
--      and column_name='profile_prefs';   -- صفٌّ واحد
--
-- ٢) الدالّة موجودة ومحكومة:
--    select proname, prosecdef from pg_proc where proname='profile_artists';
--    -- prosecdef = true
--
-- ٣) ولا سياسة مفتوحة جديدة — هذا الملف لا يضيف أيّ سياسة:
--    select tablename, policyname from pg_policies
--    where schemaname='public' and qual='true';
--    -- المتوقَّع أربعة: user_follows · communities · imdb_ratings · imdb_chart
