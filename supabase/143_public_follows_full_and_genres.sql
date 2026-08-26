-- ============================================================
--  Loopz — الهجرة ١٤٣ (D-648): مكتبةُ العضوِ كاملةً + تصنيفاتُها
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ بنيةٌ فقط: لا حذفَ ولا `drop` ولا تعديلَ بياناتٍ قائمة.
--  والسياساتُ المفتوحةُ تبقى أربعاً (لا سياسةَ تُضاف هنا).
-- ============================================================

-- ============ ١) `limit 60` كانت تكذب على أربعةِ أعضاء ============
--
--  🔴 **عطلٌ قائمٌ منذ D-561 ظهر اليوم**: الورقةُ التي شُحنت أمس اسمُها
--  «كلُّ مسلسلاته» **ومصدرُها دالّةٌ تقصّ عند ستّين صفّاً** —
--  **وأربعةُ أعضاءٍ اليوم فوق الستّين** (١٧٣ · ١٢٨ · ١٠٠ · ٧١).
--  **وعدّادا البطاقة نفساهما كانا مقصوصين**: من يتابع ١٧٣ عملاً كانت
--  بطاقتُه تقول ستّين. **ورقمٌ يساوي سقفَه ليس رقماً** (درسُ «١٠٠٠
--  حلقة» في `LibraryAnalysis` بحرفه).
--
--  🔑 **والسقفُ الجديد ألف لا «بلا سقف»**: PostgREST يقصّ عند ألفِ صفٍّ
--  **بصمت** — **فسقفٌ فوقه وهمٌ**، وسقفٌ عنده يقول الحقيقة. **وأكبرُ
--  مكتبةٍ اليوم ١٧٣**، فالهامشُ ستّةُ أضعاف. **ومن يتجاوز الألف يلزمه
--  ترقيمٌ بـ`pageAll` لا رفعُ رقم** — وهو مكتوبٌ هنا ليُقرأ يومَها.
--
--  ⚠️ **ولا تغييرَ في التوقيع** (`create or replace` بلا `drop`):
--  الأعمدةُ التسعةُ نفسُها بترتيبها، **والمتغيّرُ السقفُ وحدَه.**
create or replace function public.user_public_follows(target uuid)
returns table (
  tmdb_id integer,
  media_type text,
  title text,
  poster_path text,
  added_at timestamptz,
  total_episodes integer,
  aired_episodes integer,
  next_air_date date,
  dropped boolean
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select f.tmdb_id, f.media_type, f.title, f.poster_path, f.added_at,
         f.total_episodes, f.aired_episodes, f.next_air_date,
         coalesce(f.dropped, false)
  from public.follows f
  where f.user_id = target
    and public.can_view_profile(target)
  order by f.added_at desc
  limit 1000;
$$;

-- ============ ٢) التصنيفاتُ في دالّةٍ على حدة ============
--
--  🔑 **ولماذا لا تُقحم في `user_public_follows`**: تغييرُ جدولِ العودة
--  يوجب `drop` — **ولا `drop` بالإذن الدائم** (شرطُ أحمد بنصّه).
--  **والسابقةُ في المستودع نفسِه**: `is_anime` خرجت في استعلامٍ ثانٍ لا
--  في اختيارِ `getFollows` (D-182) — **«عمودٌ جديدٌ لا يُقحم في استعلامٍ
--  قائمٍ يحمل غيره»** بحرفها. **وهي ليست سجلّاً ثانياً للمكتبة**: صفوفُها
--  مفتاحٌ وقيمة، **وتُدمج بالمفتاح عند القراءة.**
--
--  ⚠️ **والغيابُ يُقرأ «لم يُقرأ بعد» لا «بلا نوع»** — والقارئُ يفرّق.
create or replace function public.user_follow_genres(target uuid)
returns table (
  tmdb_id integer,
  media_type text,
  genres integer[]
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select f.tmdb_id, f.media_type, f.genres
  from public.follows f
  where f.user_id = target
    and f.genres is not null
    and public.can_view_profile(target)
  limit 1000;
$$;

revoke all on function public.user_follow_genres(uuid) from public;
grant execute on function public.user_follow_genres(uuid) to authenticated, anon;
