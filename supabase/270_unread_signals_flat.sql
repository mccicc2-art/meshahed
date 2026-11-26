-- ====== 270 — عدُّ الجرس من القارئ الأحدث مباشرةً (M-06، المراقب ٢٢–٢٦ نوفمبر؛ أحمد ٢٢ نوفمبر «٢أ» و٢٦ نوفمبر «نفذ») ======
--
-- `unread_signals` كانت تعدّ من `my_signals()` التي تقرأ `my_signals_v2()` ثمّ `v3()` ثمّ `v4()` — ثلاثةُ أغلفةٍ كلٌّ منها يرتّب
-- من جديد ما رتّبه الذي تحته، والعدُّ لا يحتاج ترتيباً. وسيطُ زمنها على الحافّة تجاوز ١٥٠ ms في ثلاثة تقاريرَ متتالية (١٦٤ · ١٥١ · ١٧٥)
-- فتحقّق شرطُ القرار. الدالّةُ نفسُها سريعة (٩–٢٤ ms دافئةً، قياسُ ٢٢ نوفمبر) — الكلفةُ في الأغلفة والترتيب.
--
-- النتيجةُ لا تتغيّر: `v4` يحمل `is_new` وحدَّ الثلاثين، والأغلفةُ تمرّره كما هو. الأغلفةُ تبقى لمن يقرؤها (حزمٌ قديمة).
-- عدُّ تنبيهات الربط (هجرة ٢٦٩) يُجمع في الخادم (`getUnreadSignals`) لا هنا — لا يُمسّ.
-- الصلاحياتُ لا تتغيّر (`create or replace` يُبقيها)، و`search_path` مثبَّت كما كان.
--
-- قاعدةُ DDL (أحمد ٢٢ نوفمبر «١أ»): مهلةُ قفلٍ ٣ ث، خارج ١٣–٢٠ UTC؛ فشلُ القفل ⇐ يُعاد التشغيل.
--
-- ↩️ التراجع:
--   create or replace function public.unread_signals() returns integer language sql stable security definer
--     set search_path to 'public' as $$ select count(*)::integer from public.my_signals() s where s.is_new; $$;

set lock_timeout = '3s';
set statement_timeout = '60s';

create or replace function public.unread_signals()
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::integer from public.my_signals_v4() s where s.is_new;
$function$;
