-- ============================================================
--  ١٧٦ — رسائلُ الموقوف تختفي من مجتمعاته (D-901، إغلاقُ الثغرة المُعلَنة)
-- ============================================================
-- ١٧٣ أخفت البروفايلَ والمراجعاتِ والمنشوراتِ والقوائم، **وقالت صراحةً إنّ
-- رسائلَ المجتمعات تبقى ظاهرةً** لأنّ `community_messages` بلا عمود `hidden`.
--
-- 🔑 **والحلُّ أخفُّ ممّا بدا**: الرسائلُ لا تُقرأ بدوالَّ، بل **بسياسةِ
-- قراءةٍ واحدة** (`members read messages`) عبر عميل المستخدم — فُحص القرّاءُ
-- في القاعدة (`title_rooms` و`maintain_title_communities` لا يقرآن رسائل)
-- وفي الشيفرة (`data.ts` وحده، بعميل الجلسة). **فتعديلُ السياسة يغلق
-- البابَ الوحيد.** ولا عمودَ جديد ولا قلبَ رايات: **الشرطُ يُقرأ حيّاً من
-- `suspended_at`، فيَرجع كلُّ شيءٍ عند فكِّ الإيقاف بلا حفظٍ ولا ردّ.**
--
-- ⚠️ **ولماذا دالّةُ definer لا استعلامٌ مباشر داخل السياسة**: `profiles`
-- مقفلةٌ بـRLS على صاحبها، **فاستعلامٌ في السياسة يجري بصلاحيّة القارئ
-- ويرى لغيره صفرَ صفوف** — أي «غيرُ موقوف» دائماً. وهذه قاعدةُ المشروع:
-- «سياسةٌ لا تستعلم إلّا عبر مساعدِ definer» (نمطُ `is_community_member`).
-- **و`alter policy` لا `drop`+`create`**: لا لحظةَ بلا سياسةٍ بين الاثنين.
--
-- ✅ **مُثبَتٌ داخل ترانزاكشن رُوجع قبل التطبيق**: عضوٌ عاديٌّ يرى ٧ رسائل
-- منها ٤ للمستهدَف ← بعد إيقافه يرى ٣ و**صفراً** له · `open_policies` = ٥.

create or replace function public.is_suspended(p_user uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select suspended_at is not null from public.profiles where id = p_user), false);
$$;

revoke all on function public.is_suspended(uuid) from public, anon;
grant execute on function public.is_suspended(uuid) to authenticated;

alter policy "members read messages" on public.community_messages
  using (
    (is_community_member(community_id, auth.uid()) or is_open_title_room(community_id))
    and not public.is_suspended(author_id)
  );
