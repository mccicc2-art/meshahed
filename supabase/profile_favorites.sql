-- ============================================================
--  Loopz — «مفضّلاتي» قسماً في البروفايل (هجرة 59، D-152)
--  شغّلها في Supabase → SQL Editor بعد feed_new_count.sql (58)
--
--  المفضّلة موجودةٌ منذ D-130 كقائمةٍ مثبّتة في `user_lists`، لكنها
--  تُقرأ اليوم بـ`my_favorites()` وهي **صفوفُك أنت وحدك**
--  (`where l.user_id = auth.uid()`). فقسمٌ في بروفايلك يقرؤه زائرُك
--  يحتاج دالّةً ثانية: نفس الصفوف، بمعيارٍ مختلف.
--
--  **ولا سياسة قراءةٍ مفتوحة خامسة، ولا `is_public` على القائمة:**
--  البوابة هي `can_view_profile` وحدها (D-061/D-070، ونمط
--  `profile_title_art` في هجرة ٥٤ حرفياً). ولماذا لا نشترط أن تكون
--  القائمة معلَنة: **إظهارُ القسم في بروفايلك هو الإعلان نفسه** — من
--  رتّب «مفضّلاتي» في شاشة التخصيص فقد قرّر أن يراها زائره، وطلبُ
--  إعلانٍ ثانٍ من `/lists` مفتاحان لسؤالٍ واحد (D-061).
--
--  ⚠️ والوجه الآخر لنفس القاعدة منفَّذٌ في الشيفرة لا هنا: صفُّ القوائم
--  في البروفايل صار **يستبعد `kind='favorites'`** — وإلا ظهرت المفضّلة
--  مرّتين في صفحةٍ واحدة لمن أعلنها. شيءٌ واحد في مكانٍ واحد.
-- ============================================================

create or replace function public.profile_favorites(p_user uuid)
returns table (tmdb_id integer, media_type text, title text, poster_path text)
language sql
stable
security definer
set search_path = public
as $$
  select i.tmdb_id, i.media_type, i.title, i.poster_path
  from public.user_list_items i
  join public.user_lists l on l.id = i.list_id
  where l.user_id = p_user
    and l.kind = 'favorites'
    and (auth.uid() = p_user or public.can_view_profile(p_user))
  /* ترتيبُ صاحبها اليدويّ أوّلاً (D-043): `sort_order` يبقى `null` حتى
     يسحب، فالنُّقطة تسقط تلقائياً إلى الأحدث — وهو نفس ترتيب الفهرس
     `user_list_items_sorted_idx` فلا فرزَ إضافيّ على القاعدة */
  order by i.sort_order nulls last, i.added_at desc
  limit 24
$$;
revoke all on function public.profile_favorites(uuid) from public;
grant execute on function public.profile_favorites(uuid) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select proname from pg_proc where proname = 'profile_favorites';   -- صفٌّ واحد
-- select count(*) from public.profile_favorites(auth.uid());         -- رقمٌ لا خطأ
--
-- ⚠️ السياسات المفتوحة تبقى **أربعاً**: لا جدولَ ولا سياسة.
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
