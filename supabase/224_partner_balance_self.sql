-- =====================================================================
-- 224 — رصيدُ الشريك لصاحبه أو للإدارة وحدَهما (A-23 · المدقّق ٢٥ أكتوبر)
-- =====================================================================
-- أحمد ٢٥ أكتوبر ٢٠٢٦: «نفذ أ للكل .. وشغله».
--
-- `partner_balance` (174) دالّةُ definer تقبل أيَّ معرّف، فكان الحكمُ «لصاحبها وحدَه» افتراضاً في تعليقات الكود لا حارساً في
-- الجسم. اليومَ تعيد صفراً فلا يضيع شيء، لكنّها الموضعُ الوحيد الذي يتغيّر يومَ يُفتح الدفع — فيُوضع الحارسُ قبل ذلك اليوم.
-- كلُّ النداءات تمرّر صاحبَ الجلسة (`getMyPartnerBalance` · `request_payout`)، فلا سلوكَ يتغيّر لأحد.
-- غيرُ المالك يأخذ `null` (كغير الشريك) لا خطأً — فالقارئُ يعامله صفراً كما يفعل اليوم.
--
-- ↩️ التراجع: جسمُ الدالّة في 174 بلا السطر الأخير من شرط `where`.

create or replace function public.partner_balance(p_user uuid)
returns numeric language sql stable security definer
set search_path = public, pg_temp as $$
  select 0::numeric
  where exists (select 1 from public.partners p where p.user_id = p_user)
    and (p_user = auth.uid() or public.am_admin());
$$;

revoke all on function public.partner_balance(uuid) from public, anon;
grant execute on function public.partner_balance(uuid) to authenticated;
