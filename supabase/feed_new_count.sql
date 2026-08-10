-- ============================================================
--  Loopz — عدّاد «وصل جديد وأنت جالس» (هجرة 58، D-151)
--  شغّلها في Supabase → SQL Editor بعد feed_seen.sql (57)
--
--  D-149 رتّب ما لم يُرَ **عند فتح الصفحة**. وبقي نصفُ طلب أحمد: الشارة
--  التي تطفو **وأنت جالسٌ في التبويب** («يطلع نفس هذي العلامة واسحب تحت
--  واشوفه»).
--
--  **رقمٌ لا أسطر** — نفس قاعدة جرس D-125: ما يُنادى دورياً يحمل عدداً؛
--  والأسطر تُطلب مرّةً واحدة حين يضغط. ولو أعادت الدالّة الصفوف لصار كل
--  استطلاعٍ نسخةً كاملة من الخطّ في الشبكة بلا أن يقرأها أحد.
--
--  وتبني على `following_activity_v2` نفسها لا على استعلامٍ ثانٍ يوازيها:
--  خطّان يعدّان بطريقتين ينحرفان، فيقول العدّاد «٣» ولا يجد القارئ إلا
--  اثنين. **مصدرٌ واحد للحقيقة، وإن كلّف.**
-- ============================================================

create or replace function public.new_feed_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.following_activity_v2() a
  where a.updated_at > coalesce(
    (select feed_seen_at from public.profiles where id = auth.uid()),
    '-infinity'::timestamptz
  )
$$;
revoke all on function public.new_feed_count() from public;
grant execute on function public.new_feed_count() to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select proname from pg_proc where proname = 'new_feed_count';  -- صفٌّ واحد
-- select public.new_feed_count();                                -- رقمٌ لا خطأ
--
-- ⚠️ السياسات المفتوحة تبقى **أربعاً**: لا جدولَ ولا سياسة.
