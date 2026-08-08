-- 43 · خصوصية قوائم المتابعة — دفعة أحمد الثالثة
--
-- الطلب: عدّادا المتابِعين والمتابَعين في الملف العام قابلان للضغط
-- فيعرضان الأسماء، مع مفتاحٍ في الخصوصية يقفل القائمتين.
--
-- عمودٌ واحد لا دوالَ جديدة: الأسماء تُقرأ من public_profiles القائمة
-- (كما تفعل قوائم متابعِي حسابك منذ D-058) وصفوف user_follows عالمية
-- القراءة أصلاً (D-013 — ميزة منتج ومدرجة في فحص السياسات المفتوحة).
-- فالمفتاح يقفل بابَ العرض في التطبيق؛ قفلٌ أصلب يعني نقض D-013
-- وقراره لأحمد وحده — مكتوبٌ هنا كي لا يُظنّ سهواً.
--
-- idempotent: إعادة تشغيله آمنة.

alter table public.profiles
  add column if not exists hide_follow_lists boolean not null default false;

-- ===== العرض القانوني: العمود الجديد في الذيل حصراً (D-037) =====
-- النسخ القانونية في security.sql وsecurity2.sql وprofile_visibility.sql
-- حُدِّثت في نفس الدفعة (D-010).
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
    -- الأعمدة الجديدة في الذيل عمداً: create or replace لا يقبل عموداً
    -- في وسط عرضٍ قائم (image_positions ثم profile_bio ثم profile_visibility)
    p.cover_pos,
    p.avatar_pos,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.bio end        as bio,
    coalesce(p.is_private, false)        as is_private,
    coalesce(p.hide_follow_lists, false) as hide_follow_lists
  from public.profiles p;

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

-- تحقق بعد التشغيل:
-- select column_name from information_schema.columns
--   where table_name = 'public_profiles' and column_name = 'hide_follow_lists';
