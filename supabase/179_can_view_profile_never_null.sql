-- ======================================================================
-- 179 — can_view_profile لا تعود NULL أبداً  (D-904 · LOOPZ-AUD)
-- ======================================================================
-- **الجذر:** الفرعُ الأوّل (الموقوف) صُلِّب في الهجرة ١٧٣ بـ`coalesce`،
-- **والفرعُ الثاني تُرك على حاله** — وفيه `target = auth.uid()` وحدَه.
-- **وللزائر `auth.uid()` فارغة**، فالمقارنةُ تعطي NULL لا false،
-- ثمّ `NULL or false or false` = **NULL** أمام حسابٍ خاصّ.
--
-- **ولمَ يُصلَح ما لم يتسرّب منه شيءٌ بعد؟** لأنّ السلامةَ اليومَ عَرَضيّة
-- لا مقصودة: سياساتُ RLS تقرأ NULL «منعاً»، وجافاسكربت تقرأ null «كذباً» —
-- **فالبابُ مغلقٌ بحظِّ لغتَين**. يكفي قارئٌ واحدٌ يكتب `not can_view_profile(x)`
-- (فتصير NULL لا true ولا false، ويسقط الشرطُ كلُّه) **أو `coalesce(...,true)`
-- في سطرِ راحةٍ** ليصير الخاصُّ مقروءاً. **الجوابُ المنطقيُّ يُقال صراحةً،
-- لا يُترك ليُقرأ صحيحاً بالصدفة.**
--
-- ✅ **مُجرَّبةٌ على `loopz-preview`** (٤ سبتمبر ٢٠٢٦) بثلاث حالات:
--    زائر ← حسابٌ خاصّ: NULL ثمّ **false** · زائر ← حسابٌ عامّ: **true** كما كان
--    · زائر ← معرّفٌ مجهول: `true` (سلوكٌ سابقٌ ثابتٌ لكلِّ مجهول، فلا يكشف وجوداً).
-- ✅ **وشُغّلت على الإنتاج وتحقّقت ٤ سبتمبر ٢٠٢٦**: `coalesce` في الفرعين (٢/٢)
--    · `prosecdef=t` · `stable` · **٣٢ ملفّاً كلُّها تعيد جواباً غيرَ NULL**
--    · `open_policies=5` · صفر خطأِ تشغيلٍ بعدها.
-- ======================================================================

create or replace function public.can_view_profile(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (select 1 from public.profiles
                  where id = target and suspended_at is not null)
      then coalesce(target = auth.uid(), false) or public.am_admin()
    else
      coalesce(target = auth.uid(), false)   -- D-904: كان `target = auth.uid()`
      or not coalesce((select is_private from public.profiles where id = target), false)
      or exists (select 1 from public.user_follows uf
                  where uf.follower_id = auth.uid() and uf.following_id = target)
      or exists (select 1 from public.library_grants g
                  where g.owner_id = target and g.grantee_id = auth.uid())
  end;
$$;

-- التحقُّق (يُشغَّل بعدها بجلسةِ زائر):
--   select public.can_view_profile('<uuid حسابٍ خاصّ>');  -- يجب false لا NULL
--   select public.can_view_profile('<uuid حسابٍ عامّ>');   -- يجب true
