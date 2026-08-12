-- ============================================================
--  Loopz — أخبارٌ أثقل (هجرة 66، D-212)
--  شغّلها في Supabase → SQL Editor بعد news_posts.sql (65)
--
--  **بلاغُ أحمد بنصّه:** «الأخبار الموجودة كلها موعد نزول الحلقة القادمة
--  الذي هو أصلاً موجود في Upcoming!! أنا أبغى أخبار أثقل: سيتوقف مسلسل،
--  أو الإعلان عن الموسم الثاني، أو رسمياً موعد فِلم كذا في السينما…
--  المهم ما يذكر موعد نزول حلقة قادمة لأنها في Upcoming».
--
--  **وهو محقّ، والعيبُ عيبُ تصميمٍ لا تنفيذ:** `episode` كان **أسهلَ**
--  إشارةٍ تُرصد (حقلٌ جاهز في تفاصيل TMDB)، **فامتلأت الصفحة بأرخصها**.
--  والقاعدةُ التي تُستخلص وتُكتب في `04`: **السهولةُ ليست معياراً — الخبرُ
--  ما لا يعرفه المستخدم من مكانٍ آخر في التطبيق.** وشريطُ «Upcoming»
--  يعرض مواعيدَ الحلقات أصلاً، **فتكرارُها في الأخبار ضجيجٌ بلفظٍ آخر.**
--
--  **فهذه الهجرة تفعل ثلاثة:**
--   ١) **تحذف نوع `episode` من الوجود** — صفوفَه وقيدَه معاً.
--   ٢) تضيف إلى اللقطة ما يُرصد به الثقيل: **آخرُ عرضٍ للمسلسل**،
--      **وموعدُ انطلاق الموسم القادم**، **والتاريخُ الرسميّ في الصالات**.
--   ٣) توسّع أنواعَ الخبر إلى: `season_date` (انطلاقُ موسم) ·
--      `theatrical` (رسمياً في السينما) · `released` (صدر فعلاً).
--
--  ⚠️ **وحذفُ الصفوف مذكورٌ صراحةً لا مدسوس:** الصفوفُ المحذوفة **من
--  توليد هذه الميزة نفسها قبل ساعة**، لا بياناتِ مستخدمين — ولا يُحذف
--  بهذه الهجرة شيءٌ كتبه إنسان.
--
--  آمنٌ للإعادة.
-- ============================================================

begin;

-- ============================================================
--  ١) اللقطة تكبر بأربعة حقول — وكلُّها تصنع خبراً ثقيلاً وحدها
-- ============================================================
alter table public.title_snapshots
  add column if not exists last_air_date    text,
  /* موعدُ **انطلاق موسمٍ** لا موعدُ حلقة: الفرقُ بينهما هو الفرقُ بين
     خبرٍ وجدولِ عرض */
  add column if not exists next_season_date text,
  add column if not exists next_season_num  integer,
  /* التاريخُ الرسميّ في الصالات (نوع ٢/٣ في TMDB) — **وهو ما طلبه أحمد
     بالاسم**، ويختلف عن `release_date` العامّ الذي قد يكون رقميّاً */
  add column if not exists theatrical_date  text;

-- ============================================================
--  ٢) `episode` يخرج: صفوفاً وقيداً
-- ============================================================
delete from public.news_posts where kind = 'episode';

alter table public.news_posts drop constraint if exists news_posts_kind_check;
alter table public.news_posts
  add constraint news_posts_kind_check
  check (kind in ('trailer', 'date', 'season', 'status', 'season_date', 'theatrical', 'released'));

-- ============================================================
--  ٣) الكتابةُ تحمل الحقول الجديدة
-- ============================================================
create or replace function public.set_title_snapshots(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  with incoming as (
    select *
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      tmdb_id integer, media_type text, status text, release_date text,
      next_air_date text, seasons integer, trailer_key text,
      last_air_date text, next_season_date text, next_season_num integer,
      theatrical_date text
    )
    limit 60
  )
  insert into public.title_snapshots
    (tmdb_id, media_type, status, release_date, next_air_date, seasons, trailer_key,
     last_air_date, next_season_date, next_season_num, theatrical_date, updated_at)
  select
    i.tmdb_id, i.media_type,
    left(i.status, 40), left(i.release_date, 10), left(i.next_air_date, 10),
    i.seasons, left(i.trailer_key, 40),
    left(i.last_air_date, 10), left(i.next_season_date, 10), i.next_season_num,
    left(i.theatrical_date, 10), now()
  from incoming i
  where i.tmdb_id is not null
    and i.media_type in ('tv', 'movie')
  on conflict (tmdb_id, media_type) do update
     set status           = excluded.status,
         release_date     = excluded.release_date,
         next_air_date    = excluded.next_air_date,
         seasons          = excluded.seasons,
         trailer_key      = excluded.trailer_key,
         last_air_date    = excluded.last_air_date,
         next_season_date = excluded.next_season_date,
         next_season_num  = excluded.next_season_num,
         theatrical_date  = excluded.theatrical_date,
         updated_at       = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.set_title_snapshots(jsonb) from public;
grant execute on function public.set_title_snapshots(jsonb) to authenticated;

create or replace function public.set_news_posts(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  with incoming as (
    select *
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      key text, kind text, tmdb_id integer, media_type text,
      title text, poster_path text, data jsonb
    )
    limit 60
  )
  insert into public.news_posts (key, kind, tmdb_id, media_type, title, poster_path, data)
  select
    left(x.key, 120), x.kind, x.tmdb_id, x.media_type,
    left(btrim(x.title), 300), left(x.poster_path, 120),
    coalesce(x.data, '{}'::jsonb)
  from incoming x
  where x.key is not null
    /* **`episode` غير مقبولٍ هنا أيضاً** — الحارسُ في القاعدة لا في
       الشيفرة وحدها، فنسخةٌ قديمة من التطبيق لا تعيده */
    and x.kind in ('trailer', 'date', 'season', 'status', 'season_date', 'theatrical', 'released')
    and x.tmdb_id is not null
    and x.media_type in ('tv', 'movie')
    and length(btrim(coalesce(x.title, ''))) between 1 and 300
    and length(coalesce(x.data, '{}'::jsonb)::text) <= 400
  on conflict (key) do nothing;

  get diagnostics v_count = row_count;

  delete from public.news_posts p
  where p.key in (
    select key from public.news_posts order by published_at desc offset 300
  );

  return v_count;
end;
$$;

revoke all on function public.set_news_posts(jsonb) from public;
grant execute on function public.set_news_posts(jsonb) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select count(*)::int as episodes_left from public.news_posts where kind='episode'; -- 0
-- select count(*)::int as cols from information_schema.columns
--  where table_name='title_snapshots'
--    and column_name in ('last_air_date','next_season_date','next_season_num','theatrical_date'); -- 4
-- select kind, count(*)::int from public.news_posts group by kind order by 2 desc;
--
-- ⚠️ والسياساتُ المفتوحة تبقى **أربعاً**:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
