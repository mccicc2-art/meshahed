-- ============================================================
--  Loopz — خطّ المجتمع الكامل (لا المتابَعين وحدهم)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر تبويبات صفحة المجتمع.
--
--  صفحة `/people` تصير ثلاثة تبويبات: «مجتمعي» (المتابَعون — وهو
--  `following_activity` القائم)، و«المجتمع» (هذا الملف)، و«الرسائل»
--  (`shares.sql`). هذا الملف يسدّ الثاني وحده.
-- ============================================================

-- ============================================================
--  خطّ الجميع
--
--  نسخةٌ من `following_activity` بشرطٍ واحدٍ مختلف: بلا قيد المتابعة.
--  ولم تُكتب داخل `security.sql` رغم قاعدة D-010 لأن ذلك الملف مُشغَّل في
--  الإنتاج ولا يُعاد تشغيله لإضافة دالّة؛ **والنسخة القانونية يجب أن
--  تُنقل إلى `security.sql` عند أول تعديلٍ قادم عليه** حتى لا تتفرّق دوال
--  القراءة على ملفّين.
--
--  ثلاثة قيود مقصودة:
--
--  1. **المراجعات المكتوبة وحدها.** تقييمٌ بلا نصّ رقمٌ لا رأي، وخطٌّ من
--     أرقامٍ بلا كلام لا يُقرأ. الصفحة تُصفّيها في الكود اليوم، وتصفيتها
--     هنا توفّر نقلها أصلاً.
--  2. **إخفاء الاسم يُنفَّذ في SQL** كما في كل دوال القراءة (D-011):
--     من أخفى اسمه يظهر رأيه بلا اسمه ولا صورته، لا بإخفاءٍ في الواجهة.
--  3. **صاحب الحساب مستثنى.** خطّ المجتمع لتقرأ ما كتبه غيرك؛ رأيك أنت
--     تقرؤه في `/ratings`، ووجوده هنا يزاحم غيرك على مساحةٍ محدودة.
--
--  والسقف ستّون صفّاً: الترتيب بالإعجاب يجري في الكود بعد قراءة الأعداد،
--  فلا ينفع فيه ترقيم الخادم — وستّون أطول مما يُقرأ في جلسة.
-- ============================================================
create or replace function public.community_activity()
returns table (
  id          uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  rating      smallint,
  review      text,
  title       text,
  poster_path text,
  updated_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.user_id as id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path, r.updated_at
  from public.ratings r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and r.user_id <> auth.uid()
    and length(btrim(coalesce(r.review, ''))) > 0
    -- المخفيّ بعشرة بلاغات لا يظهر هنا (review_reports.sql). العمود يُنشأ
    -- هناك، فشغّل ٢٤ قبل ٢٧ — والترتيب في README يضمن ذلك
    and coalesce(r.hidden, false) = false
  order by r.updated_at desc
  limit 60;
$$;

revoke all on function public.community_activity() from public;
grant execute on function public.community_activity() to authenticated;

-- ============================================================
--  إعجابات خطٍّ لا نعرف أصحابه مسبقاً
--
--  `feed_review_likes(uids)` تأخذ قائمة معرّفات المتابَعين لأن الصفحة
--  تعرفهم قبل أن تسأل. خطّ المجتمع لا يعرفهم إلا بعد قراءة الخطّ، فتمريرهم
--  ممكنٌ بنفس الدالّة — **لا حاجة إلى دالّة ثانية**. هذا الملف لا ينشئ
--  شيئاً هنا؛ السطر مكتوبٌ كي لا يبحث أحدٌ عنها.
-- ============================================================

-- فهرسٌ للترتيب الزمني على كامل الجدول — الخطّ الجديد لا يُقيَّد بمستخدم
create index if not exists ratings_updated_idx
  on public.ratings (updated_at desc);

-- التحقّق بعد التشغيل:
--   select proname from pg_proc where proname = 'community_activity';
--   select * from public.community_activity() limit 5;
--   -- ولا يجوز أن تظهر public.ratings في استعلام qual='true' الصحّي
