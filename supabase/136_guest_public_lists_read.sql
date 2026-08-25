-- 136: تصفّح الضيف (D-630) — سياسةُ قراءة القوائم المعلنة كانت لدور
-- authenticated وحدَه، فقارئُ user_lists المباشر (أكثر القوائم حفظاً ·
-- تبويب قوائم البروفايل) يعود فارغاً للزائر رغم أن الصفوف معلنة.
-- الشرطُ نفسُه يبقى (is_public / وجودُ قائمةٍ معلنة) — يُضاف anon فقط.
-- لا حذفَ ولا drop ولا تعديلَ بيانات، وopen_policies لا تتغيّر (الشرطان مقيّدان).
alter policy "read public lists" on public.user_lists to authenticated, anon;
alter policy "read public list items" on public.user_list_items to authenticated, anon;
