-- ============================================================
--  ٧٤ — مشاهداتُ المنشور (D-237)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  **الحاجةُ التي أوجدته، بنصّ أحمد:** «هذي أنا أقصد منها كم واحد شاف
--  **المنشور** وليس **الفلم**».
--
--  ================= ما كان خطأً، بالضبط =================
--
--  الخانةُ كانت تقرأ `title_talk_stats.watchers` — **«كم شخصاً في Loopz
--  شاهد هذا العمل»**. فرقمٌ واحد كان يظهر تحت **كلِّ** صفٍّ يتكلّم عن
--  «Se7en»: تعليقُ خالد ونشرتُنا وتعليقُ محمد — **كلُّهم ٢**.
--  **ورقمٌ لا يخصّ الصفَّ الذي تحته أسوأ من لا رقم** (D-134): القارئ
--  يقرؤه «شاهد منشوري اثنان» وهو لا يقول ذلك أبداً.
--
--  ================= أربعةُ قرارات، ولكلٍّ سببُه =================
--
--  ١) **أشخاصٌ لا مرّات.** المفتاحُ الأوّليُّ `(post_key, user_id)`،
--     **فمن فتح الصفحةَ عشراً يُعدّ واحداً**. ولو عددنا المرّات لصار
--     الرقمُ مرآةَ عادةِ التصفّح لا مقياسَ الوصول — **وصاحبُ المنشور
--     نفسُه أكثرُ من يفتحه**، فيصنع رقمَه بيده.
--
--  ٢) **مفتاحٌ نصّيٌّ واحد لنوعَي الصفّ.** `n:<مفتاح النشرة>` لنشرتنا،
--     و`c:<صاحب>:<نوع>:<tmdb>` لتعليق إنسان — **فجدولٌ واحد يعدّ
--     الاثنين**، ولا جدولان يفترقان يوماً. **ولا قيدَ أجنبيّ** لنفس حجّة
--     ٧٣: المقصوصُ من `news_posts` يجب ألّا يمحو عدّاداً.
--
--  ٣) **لا سياسةَ قراءةٍ مفتوحة.** العدُّ عبر `post_view_counts()` وحدها
--     — **فتبقى السياساتُ المفتوحة أربعاً** كما يشترط الفحصُ الصحّي،
--     **ولا يقرأ أحدٌ مَن شاهد ماذا**: الدالّة تُرجع عدداً لا هويّات،
--     والسياسةُ تكشف لكلِّ امرئٍ صفوفَه هو وحدها.
--     ⚠️ **وهذا سجلُّ سلوكٍ لا سجلُّ محتوى** — فالحدُّ عليه أضيق: عددٌ
--     للعامّة، والتفصيلُ لصاحبه.
--
--  ٤) **يُكتب من الواجهة عند الظهور الفعليّ لا عند التحميل.**
--     `IntersectionObserver` في `PostViews.tsx`: الصفُّ الذي لم يبلغ
--     الشاشةَ لا يُعدّ. **ونداءٌ واحد للدفعة كلِّها** (D-164) — لا نداءٌ
--     لكلِّ صفّ.
-- ============================================================

create table if not exists public.post_views (
  -- (القرار ٢) — `n:` أو `c:` ثم بقيّةُ المفتاح
  post_key text not null check (length(btrim(post_key)) between 1 and 200),
  user_id  uuid not null references auth.users (id) on delete cascade,
  seen_at  timestamptz not null default now(),
  -- (القرار ١) — شخصٌ واحد يُعدّ مرّةً واحدة مهما عاد
  primary key (post_key, user_id)
);

alter table public.post_views enable row level security;

-- القراءةُ الشائعة: عدُّ مفاتيح دفعةٍ واحدة — والمفتاحُ الأوّليُّ يخدمها
create index if not exists post_views_key_idx on public.post_views (post_key);

-- ============================================================
--  السياسات — كتابةٌ باسمك، وقراءةُ صفوفِك وحدها (القرار ٣)
-- ============================================================
drop policy if exists "view as self" on public.post_views;
create policy "view as self" on public.post_views
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "read own views" on public.post_views;
create policy "read own views" on public.post_views
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "delete own views" on public.post_views;
create policy "delete own views" on public.post_views
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
--  العدّاد — كم شخصاً رأى كلَّ منشورٍ من قائمةٍ واحدة
--
--  **يعيد ما رآه أحدٌ وحده** — فالخريطةُ تكبر بحجم ما شُوهد لا بحجم ما
--  عُرض، **والصفرُ لا يُرسل أصلاً** (D-222 في الشبكة لا في البكسل).
-- ============================================================
create or replace function public.post_view_counts(keys text[])
returns table (post_key text, views bigint)
language sql
stable
security definer
set search_path = public
as $$
  select v.post_key, count(*)::bigint
  from public.post_views v
  where auth.uid() is not null
    and v.post_key = any (keys)
  group by v.post_key;
$$;

revoke all on function public.post_view_counts(text[]) from public;
grant execute on function public.post_view_counts(text[]) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
--
--   ١) الجدولُ والدالّة:
--      select table_name from information_schema.tables
--      where table_schema='public' and table_name='post_views';
--      select proname from pg_proc where proname='post_view_counts';
--
--   ٢) **السياساتُ المفتوحة أربعٌ ولا خمس** — أهمُّ فحصٍ هنا:
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
--
--   ٣) العدّادُ يعمل ويعيد فارغاً بلا كلام:
--      select * from public.post_view_counts(array['nope']);
-- ============================================================
