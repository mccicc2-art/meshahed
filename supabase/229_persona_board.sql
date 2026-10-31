-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 229 · قسمُ «شخصيات لوبز AI» في لوحة «الأعضاء» (D-1608) — عددُ المراجعات الظاهرة لكلِّ شخصيّة
--
-- أحمد ٣١ أكتوبر: صمّم مكاناً يُرى فيه الشخصيّات غيرَ المراجعات ← «الأعضاء فقط · ٣ أ» (العددُ والأنواعُ تحت الاسم) ←
-- «يكون في آخر قسم في الأعضاء — نفذ و ارفع» ← «أ) نعم، شغّلها» لهذه الدالّة.
--
-- لماذا دالّةٌ جديدة: `persona_reviews_of` تعيد النصوصَ كاملةً وسقفُها ٢٠٠ — فالعدُّ بها يسحب ألفَ نصٍّ ليحسب رقماً،
-- ويقف عند «٢٠٠» بعد أسبوعٍ من الكتابة (٣–٥ في الساعة). وهذه تعدّ في القاعدة بالحدّ نفسِه (`persona_review_visible`)
-- فما يُعدّ هو ما يراه القارئ في الملفّ لا أكثر.
-- 🔑 **قراءةٌ فقط**: لا جدولَ ولا عمودَ ولا كتابة. والمنحُ لكلِّ قارئ (الزائرُ يرى اللوحة) كأختها `persona_reviews_of`.
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

create or replace function public.persona_board()
returns table (persona_id uuid, reviews integer)
language sql stable security definer
set search_path = public, pg_temp as $$
  select p.id,
         (select count(*)::integer from public.persona_reviews r
           where r.persona_id = p.id and public.persona_review_visible(r.status, r.publish_at))
    from public.personas p;
$$;
revoke all on function public.persona_board() from public;
grant execute on function public.persona_board() to anon, authenticated, service_role;
