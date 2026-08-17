-- ============================================================
--  Loopz — أرقامُ بطاقة القائمة: كم حفظها وكم تقييمُها (الهجرة ١٠٥ · D-329)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  طلبُ أحمد: «أهم شي من هنا أشوف عدد العاملين لها مفضلة وتقييمها».
--
--  ============ نداءٌ واحدٌ لصفحةٍ فيها ثلاثٌ وستّون بطاقة ============
--
--  **والسؤالُ سؤالان لا واحد** (كم حفظها؟ وما متوسّطُ تقييمها؟)، **لكنّ
--  ندائين لكلِّ بطاقةٍ يعني مئةً وستّةً وعشرين استعلاماً** (D-205/D-164).
--  فالدالّةُ تأخذ **مصفوفةَ معرّفات** وتُعيد صفّاً لكلِّ قائمةٍ لها رقم —
--  **والقائمةُ التي لا رقمَ لها لا صفَّ لها**، فالغيابُ يُقرأ صفراً عند
--  القارئ ولا يُرسم شيءٌ (D-063: الغيابُ أصدق من صفرٍ يُطبع).
--
--  ============ ولماذا `definer` وقد كان يكفي `count` عاديّ ============
--
--  **لأن `list_reviews` بلا سياسةِ قراءةٍ عامّة أصلاً** (D-327): قراءتُها
--  من دوالِّ `definer` وحدَها — **وحاجبُ الإخفاء عند عشرة بلاغات يجب أن
--  يُطبَّق على المتوسّط أيضاً**، وإلّا صار رأيٌ محجوبٌ يرفع النجمة وهو لا
--  يُقرأ. **ورقمٌ يحسب ما لا يُعرض يكذب** (D-219).
--
--  ⚠️ **والعامّةُ وحدَها**: قائمةٌ خاصّةٌ لا تُقرأ، **وعرضُ عددِ من حفظها
--  تسريبٌ بثوب إحصاء** (نصُّ `top_saved_lists` حرفاً).
-- ============================================================

begin;

create or replace function public.list_card_stats(p_ids uuid[])
returns table (
  list_id    uuid,
  saves      integer,
  reviews    integer,
  avg_rating numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    (
      select count(*)::int from public.list_saves s where s.list_id = l.id
    ),
    (
      select count(*)::int from public.list_reviews r
      where r.list_id = l.id and coalesce(r.hidden, false) = false
    ),
    (
      select round(avg(r.rating)::numeric, 1) from public.list_reviews r
      where r.list_id = l.id and coalesce(r.hidden, false) = false
    )
  from public.user_lists l
  where l.id = any(p_ids) and l.is_public;
$$;

revoke all on function public.list_card_stats(uuid[]) from public;
grant execute on function public.list_card_stats(uuid[]) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname = 'list_card_stats') as fn,
--   (select count(*)::int from pg_policies where qual = 'true')           as open_policies;
-- المتوقّع: fn = 1 · open_policies = 4
