-- 231 — D-1505 / A-34: نسخةٌ مرقّمة من watch_source.sql كما شُغّلت على الإنتاج ١ نوفمبر ٢٠٢٦ (بكلمة أحمد «نفذ»).
-- لماذا الآن: الكود يجرّب العمود ثم يتراجع حين يغيب، فكلّ تجربةٍ فاشلة كانت 400 + خطأ Postgres يغطّي الأخطاء الحقيقية.
-- null = علامةٌ يدويّة، فلا تعبئة للصفوف القديمة. صلاحيّات الجدول على مستوى الجدول فتشمل العمود الجديد،
-- وسياسة «own watched …» (FOR ALL) تغطّي التحديث.
alter table public.watched_episodes
  add column if not exists source text
  check (source in ('stremio', 'widget', 'import', 'auto'));

alter table public.watched_movies
  add column if not exists source text
  check (source in ('stremio', 'widget', 'import', 'auto'));
