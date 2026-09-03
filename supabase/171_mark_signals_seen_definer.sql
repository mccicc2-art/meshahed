-- ============================================================
-- 171 — ختمُ «رأيتُ الجرس» يكتب بصلاحيّة المالك (🔴 D-899، إصلاحُ عطلٍ حيّ)
-- ============================================================
-- 🔴 **العطلُ كما بلّغ به عضو** (خالد، ٣ سبتمبر): «التنبيه ما يختفي بعد
-- ما أشوفه» — الشارةُ ٣ تبقى بعد فتح تبويب الإشعارات، **لكلّ الأعضاء
-- ومنذ ٢٩ أغسطس.**
--
-- 📏 **والسببُ مقيس من الشيفرة لا مخمَّن**: الهجرةُ ١٥٦ نزعت UPDATE
-- الجدوليّةَ عن `profiles` وأعادتها على أعمدةٍ مسمّاة، **واستثنت الأختامَ
-- الثلاثة عمداً بحجّة أنّ «دوالَّ definer وحدَها تكتبها»** — **وهذا صحيحٌ
-- لاثنين (`mark_feed_seen`، `touch_last_seen`) وخطأٌ للثالثة**:
-- `mark_signals_seen` في `notifications.sql` **`security invoker`** —
-- فصارت تُرفَض بـ42501 لكلّ مسجَّل، **و`MarkSignalsSeen.tsx` يبتلع
-- الفشلَ بصمت** (بقرارٍ سليم: ختمٌ فاشلٌ لا يمنع القراءة) — **فلا خطأَ
-- يُرى ولا شارةَ تسقط.** الهجرةُ ١٧٠ أصلحت العطلَ نفسَه لعمودٍ آخر.
--
-- 🔑 **العلاجُ `definer` لا منحُ العمود**: منحُ `notif_seen_at` للمستخدم
-- يفتح كتابتَه مباشرةً على PostgREST **بأيّ قيمةٍ** — ماضيةٍ فتعيد
-- «جديداً» ما قُرئ، **والختمُ يُدفع إلى الأمام فقط** (١٥٦ بنصّها).
-- الدالّةُ تكتب `now()` وحدَه لصفِّ `auth.uid()` وحدَه — **لا مُدخَلَ
-- يُزوَّر**، وهي بذلك نسخةُ `mark_feed_seen` حرفاً (`greatest` يحرس
-- الاتّجاه). **والمنحُ كما كان**: `authenticated` وحدَها.
-- ============================================================

create or replace function public.mark_signals_seen()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.profiles
     set notif_seen_at = greatest(coalesce(notif_seen_at, '-infinity'::timestamptz), now())
   where id = auth.uid();
$$;

revoke all on function public.mark_signals_seen() from public, anon;
grant execute on function public.mark_signals_seen() to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل (بحسابك، في SQL Editor):
--    select prosecdef from pg_proc where proname = 'mark_signals_seen';  -- t
--    select public.mark_signals_seen();                                  -- بلا خطأ
--    select public.unread_signals();                                     -- 0
-- ============================================================
