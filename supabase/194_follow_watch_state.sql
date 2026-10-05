-- 194 — follows.watch_state (D-1280)
--
-- «ابدأ / أوقف مؤقّتاً / كمّل» في قائمة الضغط المطوّل (أحمد، ٥ أكتوبر ٢٠٢٦). «تابِع المشاهدة»
-- كان يُحسب من الوقائع وحدَها (شوهدت حلقةٌ ولم يكتمل العمل)، فلا مكانَ فيه لقرارٍ بلا حلقة:
--   started — مسلسلٌ لم تُشاهَد منه حلقةٌ وضغط صاحبُه «ابدأ»: يدخل «تابِع المشاهدة» ويخرج من «للمشاهدة».
--   paused  — مسلسلٌ يتابعه وضغط «إيقاف مؤقّت»: يخرج من «تابِع المشاهدة» ويبقى في رفّه بالمكتبة.
--   null    — كما كان: الوقائعُ وحدَها تحكم.
-- للمسلسلات وحدَها (قرارُه: «الأفلام مافيها حلقات»)؛ القيدُ على القيمة هنا، وعلى النوع في الفعل.
--
-- وليس `dropped`: البطاقةُ الحمراء «تركتُه» وتُخرجه من الرئيسيّة كلِّها؛ هذا «مؤجَّل وسأعود».
--
-- بلا قيمةٍ افتراضيّة ولا تعبئة: لا صفَّ قائماً يُمسّ. ومنحُ `follows` على الجدول لا على الأعمدة
-- (سياسةُ «own follows» تحرسه)، فالعمودُ الجديد يُقرأ ويُكتب بجلسة صاحبه بلا منحٍ إضافيّ.

-- شُغّلت على الإنتاج ٥ أكتوبر ٢٠٢٦ بهذا النصّ حرفاً: إضافاتٌ فقط، بلا `drop` ولا `revoke` — فلا تُعاد
-- كما هي على قاعدةٍ فيها القيدُ والقادح (الإضافةُ الثانية تفشل ولا تُفسد شيئاً).

alter table public.follows
  add column if not exists watch_state text;

alter table public.follows
  add constraint follows_watch_state_chk
  check (watch_state is null or watch_state in ('started', 'paused'));

-- تعليمُ حلقةٍ من مسلسلٍ موقوف = «كمّل». في القاعدة لا في الأفعال: كتّابُ `watched_episodes` سبعةٌ
-- (حلقة · موسم · حتّى هنا · التالية · الكلّ · الاستيراد · الطابور دون اتصال)، ومن نُسي منهم يترك
-- مسلسلاً يُشاهَد وهو مخفيٌّ من «تابِع المشاهدة». مستوى العبارة بجدول الانتقال: «شاهدته كلّه» لمئتَي
-- حلقةٍ تحديثٌ واحد لا مئتان. `security invoker`: التحديثُ بجلسة الكاتب نفسِه وتحت سياسته.
create or replace function public.follows_unpause_on_watch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.follows f
     set watch_state = null
   where f.watch_state = 'paused'
     and f.media_type = 'tv'
     and (f.user_id, f.tmdb_id) in (
       select distinct n.user_id, n.show_tmdb_id from new_rows n
     );
  return null;
end;
$$;

create trigger watched_episodes_unpause
  after insert on public.watched_episodes
  referencing new table as new_rows
  for each statement
  execute function public.follows_unpause_on_watch();
