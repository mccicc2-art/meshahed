-- ============================================================
--  Loopz — الجديد يعلو مرّةً ثم ينزل (هجرة 57، D-149)
--  شغّلها في Supabase → SQL Editor بعد account_deletion.sql (56)
--
--  طلب أحمد نصّاً: «شي فيه شخص قيّم فلم ولا دريت، نزلت تحت مباشرة» ثم
--  «اعمل مثل حقت تويتر، يكفي يشوفها الشخص مرّة وحدة ثم تنزل تحت».
--
--  وهذا **نقضٌ جزئيّ لخوارزمية D-134** — وهي كانت طلبه أيضاً (المراجعة
--  تسبق التقييم يسبق المشاهدة). النقض مقصودٌ ومحدود: الخوارزمية تبقى كما
--  هي **بين الصفوف التي رآها**، ويُضاف فوقها بعدٌ واحد: **ما لم يره بعد
--  يعلو على ما رآه**. فالنوع لم يعد يهزم الجِدّة حين تكون الجِدّة «لم تُرَ».
--
--  **ولماذا عمودٌ واحد لا جدولُ «مقروء» لكل صفّ** (نمط D-125 نفسه): خطُّ
--  النشاط يُقرأ عشرات المرّات في اليوم، وصفٌّ لكل (قارئ × حدث) كتابةٌ على
--  أكثر مسارٍ قراءةً في التطبيق — وثمنُه لا يشتري شيئاً: «رآها مرّة» عند
--  تويتر تعني **زيارة** لا تمرير بكسل. ختمٌ زمنيّ واحد يقولها كلها.
--
--  والدلالة الدقيقة: كلُّ حدثٍ أحدثُ من `feed_seen_at` **لم يُرَ**. وفتحُ
--  التبويب يقدّم الختم — **بعد** أن تُرسم الصفحة، فالزيارة الحالية تراها
--  عاليةً والتالية تراها في مكانها الطبيعي. هذا حرفياً «مرّة وحدة ثم تنزل».
-- ============================================================

alter table public.profiles
  add column if not exists feed_seen_at timestamptz;

-- ============================================================
--  ١) متى رأى خطَّه آخر مرّة
-- ============================================================
-- لا يدخل `public_profiles`: هذا ختمٌ **خاصٌّ بصاحبه** لا يعني زائراً،
-- وإضافةُ عمودٍ إلى العرض تكلّف drop/recreate بلا مقابل (D-037).
create or replace function public.my_feed_seen()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select feed_seen_at from public.profiles where id = auth.uid()
$$;
revoke all on function public.my_feed_seen() from public;
grant execute on function public.my_feed_seen() to authenticated;

-- ============================================================
--  ٢) رأيتُه
-- ============================================================
-- `greatest` لا إسنادٌ مباشر: تبويبان مفتوحان في جهازين قد يكتبان بترتيبٍ
-- مقلوب، فالإسناد المباشر **يُرجِع** الختم إلى الوراء ويُعيد إظهار ما رآه.
create or replace function public.mark_feed_seen()
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.profiles
     set feed_seen_at = greatest(coalesce(feed_seen_at, '-infinity'::timestamptz), now())
   where id = auth.uid()
$$;
revoke all on function public.mark_feed_seen() from public;
grant execute on function public.mark_feed_seen() to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select column_name from information_schema.columns
--   where table_name='profiles' and column_name='feed_seen_at';   -- صفٌّ واحد
-- select proname from pg_proc
--   where proname in ('my_feed_seen','mark_feed_seen');            -- صفّان
--
-- ⚠️ السياسات المفتوحة تبقى **أربعاً**: لا جدولَ جديد ولا سياسة.
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
