-- ============================================================
--  Loopz — أخبارُنا نحن (هجرة 65، D-211)
--  شغّلها في Supabase → SQL Editor بعد news_items.sql (64)
--
--  **طلبُ أحمد بنصّه:** «هل بالإمكان بناء أخبارنا الخاصة؟ بحيث الشخص
--  يقرأها وهي مكتوبةٌ بموقعنا ويعلّق عليها داخل موقعنا؟»
--
--  **والجوابُ الهندسيّ: الخبرُ ليس مقالاً نأخذه، بل تغيّرٌ نرصده.**
--  نحن نملك لقطةَ كل عملٍ نراقبه؛ فحين يتبدّل حقلٌ فيها — نزل مقطعٌ
--  دعائيّ، تحدّد موعدُ صدور، تأكّد موسمٌ جديد، انتهى مسلسل — **يولد
--  خبرٌ لم يكتبه أحدٌ قبلنا**. لا رابطَ خارجيّ، ولا مصدرَ يُخفى، ولا
--  حقوقَ أحد: البياناتُ من TMDB بترخيصنا، والجملةُ من قوالبنا.
--
--  ⚠️ **ولا نصَّ حرّاً في هذا الجدول إلا اسمَ العمل.** الخبرُ يُخزَّن
--  **حقائقَ مرقّمة** (`kind` + `data`)، **وتُركَّب الجملةُ عند العرض من
--  قوالب `i18n`** — وثلاثةُ مكاسب في قرارٍ واحد:
--    (١) **الخبرُ بلغتين معاً بلا ترجمةٍ ولا عمودٍ ثانٍ** — من بدّل لغته
--        قرأ الخبرَ نفسَه بلغته الجديدة.
--    (٢) **ولا يستطيع كاتبٌ خبيثٌ حقنَ نصٍّ** — أقصى ما يملكه رقمٌ في
--        حقلٍ نعرفه (الكتابةُ بجلسة المستخدم ما دام لا مفتاحَ خدمة —
--        نفسُ حدِّ الهجرة ٦٤، **وهنا أضيق**).
--    (٣) **وتصحيحُ صياغةٍ يقع في ملفٍّ واحد** لا في ألف صفّ.
--
--  **ولا سياسةَ واحدة على الجدولين:** RLS مُفعَّلة والأبوابُ دوالُّ
--  `definer` — **فالسياساتُ المفتوحة تبقى أربعاً.**
--
--  آمنٌ للإعادة.
-- ============================================================

begin;

-- ============================================================
--  ١) اللقطة — ذاكرتُنا عن كل عملٍ نراقبه
-- ============================================================
create table if not exists public.title_snapshots (
  tmdb_id       integer not null,
  media_type    text not null check (media_type in ('tv', 'movie')),
  /* حقولٌ قليلة مقصودة: **ما يصنع خبراً وحده**. كلُّ حقلٍ إضافيّ يعني
     نداءَ TMDB أثقل ودفعةَ ضجيجٍ أكبر (تغيّرُ صورةٍ ليس خبراً). */
  status        text,
  release_date  text,
  next_air_date text,
  seasons       integer,
  trailer_key   text,
  updated_at    timestamptz not null default now(),
  primary key (tmdb_id, media_type)
);

alter table public.title_snapshots enable row level security;

-- ============================================================
--  ٢) الخبر — مفتاحُه هو معناه
-- ============================================================
-- `key` نصٌّ مركَّب (`kind:media:id:dedupe`)، **فالتكرارُ مستحيلٌ بالبناء
-- لا بالفحص**: «نزل مقطعٌ دعائيّ مفتاحُه X» خبرٌ واحد مهما تكرّر الرصد.
create table if not exists public.news_posts (
  key          text primary key,
  kind         text not null check (kind in ('trailer', 'date', 'season', 'status', 'episode')),
  tmdb_id      integer not null,
  media_type   text not null check (media_type in ('tv', 'movie')),
  /* اسمُ العمل وقتَ التوليد — يُعرض داخل الجملة. وهو **النصُّ الحرّ
     الوحيد**، ومحدودٌ بثلاثمئة محرف */
  title        text not null check (length(btrim(title)) between 1 and 300),
  poster_path  text,
  /* حقائقُ الخبر: تاريخٌ أو رقمُ موسمٍ أو مفتاحُ مقطع — تُقرأ بالاسم
     في القالب، وما لا يعرفه القالبُ يُهمَل */
  data         jsonb not null default '{}'::jsonb,
  published_at timestamptz not null default now()
);

create index if not exists news_posts_time_idx
  on public.news_posts (published_at desc);

alter table public.news_posts enable row level security;

-- ============================================================
--  ٣) شريحةُ المراقبة — القاعدةُ تقرّر من يُفحص التالي
-- ============================================================
-- **ولماذا في SQL لا في الشيفرة:** «أيُّ الأعمال أقدمُ لقطةً؟» سؤالُ
-- ترتيبٍ على جدولين، وجوابُه في الواجهة يعني جلبَ آلاف الصفوف لفرزها.
-- **وما نراقبه**: قائمةُ أفضل ٥٠ عندنا **وكلُّ ما في مكتبات المستخدمين**
-- — ولا يخرج من هذه الدالّة إلا **معرّفاتُ أعمال**: لا `user_id` ولا من
-- يتابع ماذا (ق٨ لا تُمسّ).
create or replace function public.news_watch_slice(p_limit integer default 25)
returns table (tmdb_id integer, media_type text, checked_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with watch as (
    select c.tmdb_id::integer as tmdb_id, c.media_type
      from public.imdb_chart c
    union
    select f.tmdb_id::integer, f.media_type
      from public.follows f
  )
  select w.tmdb_id, w.media_type, s.updated_at
  from watch w
  left join public.title_snapshots s
    on s.tmdb_id = w.tmdb_id and s.media_type = w.media_type
  /* الجديدُ أوّلاً (لقطةٌ غائبة)، ثم الأقدمُ فحصاً — فالدورةُ تمرّ على
     الجميع بلا سجلِّ مواضع */
  order by s.updated_at asc nulls first
  limit least(greatest(coalesce(p_limit, 25), 1), 60);
$$;

revoke all on function public.news_watch_slice(integer) from public;
grant execute on function public.news_watch_slice(integer) to authenticated;

-- ============================================================
--  ٤) الكتابة — لقطاتٌ وأخبار
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
      next_air_date text, seasons integer, trailer_key text
    )
    limit 60
  )
  insert into public.title_snapshots
    (tmdb_id, media_type, status, release_date, next_air_date, seasons, trailer_key, updated_at)
  select
    i.tmdb_id, i.media_type,
    left(i.status, 40), left(i.release_date, 10), left(i.next_air_date, 10),
    i.seasons, left(i.trailer_key, 40), now()
  from incoming i
  where i.tmdb_id is not null
    and i.media_type in ('tv', 'movie')
  on conflict (tmdb_id, media_type) do update
     set status        = excluded.status,
         release_date  = excluded.release_date,
         next_air_date = excluded.next_air_date,
         seasons       = excluded.seasons,
         trailer_key   = excluded.trailer_key,
         updated_at    = now();

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
    and x.kind in ('trailer', 'date', 'season', 'status', 'episode')
    and x.tmdb_id is not null
    and x.media_type in ('tv', 'movie')
    and length(btrim(coalesce(x.title, ''))) between 1 and 300
    /* حجمُ الحقائق محدود: كائنٌ صغيرٌ لا مستندٌ مهرَّب */
    and length(coalesce(x.data, '{}'::jsonb)::text) <= 400
  /* **خبرٌ وُلد لا يُعاد كتابتُه**: مفتاحُه معناه، فتكرارُ الرصد صامت */
  on conflict (key) do nothing;

  get diagnostics v_count = row_count;

  /* سقفٌ معلَن: ثلاثمئة خبرٍ حيّ، والأقدمُ يخرج — **ولا أحدَ يقرأ خبرَ
     الشهر الماضي**، وجدولٌ ينمو بلا حدٍّ كلفةٌ بلا قارئ */
  delete from public.news_posts p
  where p.key in (
    select key from public.news_posts order by published_at desc offset 300
  );

  return v_count;
end;
$$;

revoke all on function public.set_news_posts(jsonb) from public;
grant execute on function public.set_news_posts(jsonb) to authenticated;

-- ============================================================
--  ٥) القراءة
-- ============================================================
create or replace function public.loopz_news(p_limit integer default 30)
returns table (
  key          text,
  kind         text,
  tmdb_id      integer,
  media_type   text,
  title        text,
  poster_path  text,
  data         jsonb,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.key, p.kind, p.tmdb_id, p.media_type, p.title, p.poster_path, p.data, p.published_at
  from public.news_posts p
  order by p.published_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;

revoke all on function public.loopz_news(integer) from public;
grant execute on function public.loopz_news(integer) to authenticated;

/* «هل حان الرصدُ التالي؟» — يُسأل في القاعدة لا على ساعة المتصفّح
   (قاعدةُ نقاء الرسم عندنا). والقياسُ **بأقدم لقطة** لا بآخر خبر:
   دورةٌ لا تنتج خبراً هي دورةٌ ناجحة — لا شيءَ تغيّر. */
create or replace function public.news_gen_stale(p_minutes integer default 30)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select min(updated_at) from public.title_snapshots)
      < now() - make_interval(mins => least(greatest(coalesce(p_minutes, 30), 5), 1440)),
    true);
$$;

revoke all on function public.news_gen_stale(integer) from public;
grant execute on function public.news_gen_stale(integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select count(*)::int as tbls from pg_tables
--  where schemaname='public' and tablename in ('title_snapshots','news_posts');   -- 2
-- select count(*)::int as pol from pg_policies
--  where tablename in ('title_snapshots','news_posts');                            -- 0
-- select count(*)::int as fns from pg_proc where proname in
--  ('news_watch_slice','set_title_snapshots','set_news_posts','loopz_news','news_gen_stale'); -- 5
-- select count(*)::int as slice from public.news_watch_slice(25);                  -- 25
--
-- ⚠️ والسياساتُ المفتوحة تبقى **أربعاً**:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
