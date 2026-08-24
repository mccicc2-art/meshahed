-- ============================================================
-- 129 — علَمُ الأنمي لصاحبِ ملفٍّ أزوره · D-561
--
-- **طلبُ أحمد بتصميمٍ للبروفايل**: تبويبُ «المفضّلة» ثلاثةُ صفوفٍ —
-- **Shows · Movies · Anime** — **والأنمي عندنا ليس نوعَ وسيطٍ ثالثاً**
-- بل **علَمٌ على المتابعة** (`follows.is_anime`، الهجرة ٦١ / D-182).
--
-- **والعلَمُ مقصورٌ على صاحبه بالسياسات**: `getMyAnimeFlags` تقرأ
-- `follows` مباشرةً بـ`user_id = auth.uid()` — **فزائرُ ملفِّك يرى
-- خريطةً فارغةً ويغيب صفُّ الأنمي عن صفحتك عنده وحده.**
--
-- **ولماذا دالّةٌ جديدةٌ لا عمودٌ يُضاف إلى `user_public_follows`:**
-- **تغييرُ نوعِ إرجاعِ دالّةٍ قائمةٍ لا يقبله `create or replace`** —
-- يوجب `drop function` أوّلاً، **وإسقاطُ دالّةٍ تقرؤها صفحةٌ حيّةٌ
-- يعني ثوانيَ تكون فيها مكتبةُ كلِّ زائرٍ فارغةً بصمت.** **وهذه إضافةٌ
-- خالصة**: **لا تُسقط شيئاً ولا تُبدّل شيئاً** — **وقبل تشغيلها تعمل
-- الصفحةُ كما تعمل اليوم** (خريطةٌ فارغة، فلا صفَّ أنمي ولا عطل).
-- **وهو نفسُ ما قرّرته D-182**: «عمودٌ جديد لا يُقحم في استعلامٍ قائمٍ
-- يحمل غيره».
--
-- ⚠️ **والبوّابةُ هي `can_view_profile` وحدها** (D-061/D-070، ونمطُ
-- `profile_favorites` في الهجرة ٥٩ حرفاً بحرف): **لا سياسةَ قراءةٍ
-- مفتوحةٍ خامسة، ولا جدولَ جديد.**
--
-- ⚠️ **ولا تخرج إلا صفوفُ الأنمي**: **صفٌّ يقول «ليس أنمي» لا يُقرأ
-- أبداً** — الخريطةُ في الشيفرة تحفظ الصادقَ وحدَه، **فإخراجُ الباقي
-- بايتاتٌ تُدفع ولا تُقرأ.**
--
-- rollback: drop function if exists public.profile_anime_flags(uuid);
-- ============================================================

create or replace function public.profile_anime_flags(p_user uuid)
returns table (tmdb_id integer, media_type text, is_anime boolean)
language sql
stable
security definer
set search_path = public
as $$
  select f.tmdb_id, f.media_type, true
  from public.follows f
  where f.user_id = p_user
    and coalesce(f.is_anime, false)
    and (auth.uid() = p_user or public.can_view_profile(p_user))
  limit 500
$$;
revoke all on function public.profile_anime_flags(uuid) from public;
grant execute on function public.profile_anime_flags(uuid) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select proname from pg_proc where proname = 'profile_anime_flags';  -- صفٌّ واحد
-- select count(*) from public.profile_anime_flags(auth.uid());        -- رقمٌ لا خطأ
--
-- ⚠️ السياسات المفتوحة تبقى **أربعاً**: لا جدولَ ولا سياسة.
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
