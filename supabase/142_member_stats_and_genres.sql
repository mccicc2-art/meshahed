-- ============================================================
--  Loopz — الهجرة ١٤٢ (D-647): إحصائياتُ عضوٍ عامّة + تصنيفُ العمل
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  طلبا أحمد: «كل الحسابات خلي الكارد الأساسي فيها مسلسلات أفلام
--  احصائيات» · «تطلع له الأفلام والمسلسلات مرتّبة حسب التصنيف والأحرف».
--
--  ⚠️ بنيةٌ فقط: لا حذفَ ولا `drop` ولا تعديلَ بياناتٍ قائمة.
--  والسياساتُ المفتوحةُ تبقى أربعاً (لا سياسةَ تُضاف هنا).
-- ============================================================

-- ============ ١) تصنيفُ العمل عموداً على `follows` ============
--
--  🔑 **ولماذا عمودٌ لا جدولٌ ثانٍ** (نمطُ ١٢٦/١٢٧): التصنيفُ صفةٌ
--  للصفِّ نفسِه لا كياناً له عمرٌ مستقلّ — **وجدولٌ لصفةٍ واحدةٍ يضيف
--  وصلةً في كلِّ قراءة.**
--
--  🔑 **ومعرّفاتُ TMDB لا أسماؤها**: الاسمُ يختلف بلغة القارئ،
--  **والمعرّفُ ثابت** — والتحويلُ إلى اسمٍ عربيٍّ أو إنجليزيّ في
--  `BROWSE_GENRES` القائمة (`lib/browse.ts`)، **فلا سجلَّ تصنيفاتٍ
--  ثانٍ يُكتب** (القاعدة ٣).
--
--  ⚠️ **و`null` تعني «لم يُقرأ بعد» لا «بلا تصنيف»** — والقارئُ يفرّق
--  بينهما: ما لم يُقرأ يسقط في «أخرى» ولا يُدّعى أنه بلا نوع.
alter table public.follows
  add column if not exists genres integer[];

comment on column public.follows.genres is
  'معرّفات تصنيف TMDB للعمل (لا أسماء). null = لم تُقرأ بعد. D-647';

-- ============ ٢) ملخّصُ مشاهدةِ عضوٍ بالدقائق ============
--
--  🔴 **ولماذا دالّةٌ جديدة**: `watch_summary()` تقرأ `auth.uid()`
--  وحدَه — **فزائرٌ يضغط «إحصائيات» في ملفِّ غيره كان سيرى أرقامَ
--  نفسِه** (D-217). **وهذه تأخذ الهدفَ صراحةً وتحرسه.**
--
--  ⚠️ **والجسمُ نسخةُ `watch_summary` حرفاً** عدا الهدفَ والحارس —
--  **ومنها شرطُ إعادة المشاهدة** (`rewatch_started_at`): دورةٌ جديدة
--  تبدأ العدَّ من أوّلها، **ولو أُسقط لأعطت الأرقامُ مجموعَ العمر.**
--
--  🔑 **والحارسُ `can_view_profile` وحدَه** — نفسُ حارس كلِّ دالّةِ
--  ملفٍّ عامّ (١٢٩/١٣٠/١٣١)، **ولا سياسةَ قراءةٍ خامسةٌ تُفتح.**
create or replace function public.user_watch_stats(target uuid)
returns table (
  show_tmdb_id integer,
  watched      integer,
  last_watched timestamptz,
  minutes      bigint
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select w.show_tmdb_id,
         count(*)::integer,
         max(w.watched_at),
         coalesce(sum(coalesce(w.runtime, 40)), 0)
  from public.watched_episodes w
  left join public.follows f
    on f.user_id = w.user_id
   and f.tmdb_id = w.show_tmdb_id
   and f.media_type = 'tv'
  where w.user_id = target
    and (f.rewatch_started_at is null or w.watched_at >= f.rewatch_started_at)
    and (auth.uid() = target or public.can_view_profile(target))
  group by w.show_tmdb_id;
$$;

revoke all on function public.user_watch_stats(uuid) from public;
grant execute on function public.user_watch_stats(uuid) to authenticated, anon;
