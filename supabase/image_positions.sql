-- ============================================================
--  Loopz — تموضع صورتَي الغلاف والملف الشخصي
--  شغّله في Supabase → SQL Editor
--
--  لماذا: المستخدم يرفع صورةً لا تطابق نسبة الإطار، فيقتصّها
--  object-cover حول نقطةٍ ثابتة كانت مكتوبةً في الكود (٣٠٪ للغلاف،
--  المنتصف للصورة الشخصية) — ومن وجهُه أعلى الصورة أو أسفلها لا حيلة
--  له. العمودان يحفظان النسبة الرأسية (٠ = أعلى الصورة، ١٠٠ = أسفلها)
--  التي يختارها بالسحب في الإعدادات.
--
--  smallint لا numeric: قيمة من ٠ إلى ١٠٠ ولا كسور تُذكر بصرياً.
--  والافتراضان يطابقان السلوك القديم حرفياً فلا يتغيّر شيء لمن لم يضبط.
--
--  ملاحظة ترتيب: شغّل هذا الملف قبل نشر الكود الذي يكتب العمودين —
--  upsert على عمودٍ غائب يُسقط الحفظ كله.
--  (نسخة العرض القانونية حُدّثت أيضاً في security.sql و security2.sql
--  حتى لا تُسقط إعادةُ تشغيلهما العمودين من العرض — انظر D-010.)
-- ============================================================

alter table public.profiles
  add column if not exists cover_pos  smallint not null default 30
    check (cover_pos  between 0 and 100),
  add column if not exists avatar_pos smallint not null default 50
    check (avatar_pos between 0 and 100);

-- العرض العام يعيد بناءه ليحمل العمودين: صفحة /u/ ترسم الغلاف والصورة
-- بالتموضع الذي اختاره صاحبهما. التموضع ليس معلومةً حسّاسة فلا يخضع
-- لشرط hide_name — الصورة نفسها هي التي تُخفى، والرقم بلا صورةٍ لا شيء.
create or replace view public.public_profiles
with (security_invoker = false)
as
  select
    p.id,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.nickname end   as nickname,
    p.username,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.avatar_url end as avatar_url,
    p.cover_url,
    p.favorite_genres,
    coalesce(p.hide_name, false) as hide_name,
    -- في الذيل عمداً: create or replace لا يقبل عموداً جديداً في وسط عرضٍ قائم
    p.cover_pos,
    p.avatar_pos
  from public.profiles p;

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;
