-- ============================================================
--  ٧٦ — feed_self · كلامُك يظهر لك كما يظهر للناس (D-251)
--
--  **بنصّ أحمد:** «تعليقاتي أحتاج أشوفها في فور يو تظهر لي مثل ما تظهر
--  للناس».
--
--  **والسطرُ الذي كان يمنعه واحد:** `r.user_id <> auth.uid()` في
--  `community_activity` (هجرة ٢٧). **وحجّتُه يومَ كُتب كانت معقولة**:
--  الدالّةُ خدمت تبويباً اسمُه «المجتمع»، **والمجتمعُ هم الآخرون**.
--
--  **وماتت الحجّةُ بموت التبويب.** صار الخطُّ «النشاط» (D-222) وصارت
--  رقاقتُه «لك» تعني **«ما يخصّك»** لا «كلامُ مَن» (D-240) — **وأخصُّ ما
--  يخصّك كلامُك أنت.** ولا خطَّ اجتماعيٌّ في الدنيا يُخفي عن الكاتب ما
--  كتب: **من كتب رأياً ولم يره في مكانه ظنّ أنه لم يُنشر**، فأعاد كتابته
--  أو ظنّ التطبيق معطَّلاً.
--
--  **⚠️ ولا يُفتح شيءٌ جديد بهذا:** الصفُّ صفُّك، وكنتَ تقرؤه في ملفّك
--  وفي غرفة العمل أصلاً — **هذه الهجرة تُزيل استثناءً، لا تمنح قراءة.**
--  ولا سياسةَ RLS تُمسّ، ولا عمودَ يُضاف، ولا صلاحيةَ تُوسَّع:
--  **السياساتُ المفتوحة تبقى أربعاً.**
--
--  **والحارسُ الوحيد الذي يبقى في مكانه:** `hide_name` — من أخفى اسمَه
--  يرى صفَّه مخفيّاً كما يراه غيره (D-241)، **فلا يرى نفسَه بشكلٍ لا
--  يراه به أحد.**
--
--  التحقّق:
--    select count(*) from public.community_activity()
--      where id = auth.uid();          -- > 0 إن كان لك رأيٌ مكتوب
--    select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';   -- أربعٌ لا خامسة
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
    -- **ولا استثناءَ لصاحب الحساب** (D-251): كان هنا
    -- `and r.user_id <> auth.uid()`
    and length(btrim(coalesce(r.review, ''))) > 0
    and coalesce(r.hidden, false) = false
  order by r.updated_at desc
  limit 60;
$$;

revoke all on function public.community_activity() from public;
grant execute on function public.community_activity() to authenticated;
