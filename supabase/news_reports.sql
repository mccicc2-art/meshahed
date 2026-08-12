-- ============================================================
--  Loopz — أخبارٌ أوسع، وخبرٌ من كتابتنا بنسبةٍ لمصدره (هجرة 67، D-213)
--  شغّلها في Supabase → SQL Editor بعد news_heavier.sql (66)
--
--  **طلبُ أحمد:** «عادي نحطّ المصدر كرابط تحت بالخطّ الصغير، لكن المحتوى
--  ننقله عندنا» — **ورُدَّ على النقل:** الإسنادُ ليس رخصة، والنصُّ ملكُ
--  ناشره. **والمقبولُ الذي بُني بدلاً منه: الحقيقةُ لا يملكها أحد.**
--  نستخرج **الحدث** (تجديد · إلغاء · تأجيل) بأنماطٍ صريحة، **ونكتب
--  جملتنا** بالعربية والإنجليزية، **وتحتها اسمُ المصدر ورابطُه بالخطّ
--  الصغير** — وهو ما تفعله الصحفُ ببعضها كلَّ يوم.
--
--  **وثلاثةُ أنواعٍ تُضاف، اثنان منها من بياناتنا وحدها:**
--    `chart`    — «دخل X قائمة أفضل ٥٠ عندنا» (**بلا نداءٍ واحد**)
--    `provider` — «صار X متاحاً على نتفليكس» (نداءُ مزوّدين لكل عمل)
--    `report`   — الحدثُ المستخرَج من الفيد، **بجملتنا وبنسبةٍ لمصدره**
--
--  ⚠️ **و`report` أضيقُ ما دخل هذا الجدول:** `event` من قائمةٍ مغلقة،
--  و`source` من سجلّ المصادر، **والرابطُ يمرّ على `news_host_ok` نفسِها**
--  التي تحرس الهجرة ٦٤ — فلا يدخل رابطٌ إلى نطاقٍ لا نعرفه.
--
--  آمنٌ للإعادة.
-- ============================================================

begin;

-- ============================================================
--  ١) اللقطة تعرف موضعَ العمل في قائمتنا ومنصّاتِه
-- ============================================================
alter table public.title_snapshots
  /* رتبةُ العمل في `imdb_chart` — **تُقرأ من عندنا لا من TMDB**، فخبرُ
     «دخل أفضل ٥٠» أرخصُ خبرٍ نملكه: صفرُ نداءات */
  add column if not exists chart_rank integer,
  /* معرّفاتُ منصّات الاشتراك في منطقتنا، مرتّبةً ومفصولةً بفاصلة —
     **نصٌّ لا مصفوفة**: المقارنةُ هنا «هل تغيّرت؟» لا «أيُّها أوّل» */
  add column if not exists providers text;

-- ============================================================
--  ٢) ثلاثةُ أنواعٍ تُضاف إلى القيد
-- ============================================================
alter table public.news_posts drop constraint if exists news_posts_kind_check;
alter table public.news_posts
  add constraint news_posts_kind_check
  check (kind in (
    'trailer', 'date', 'season', 'status', 'season_date', 'theatrical',
    'released', 'chart', 'provider', 'report'
  ));

-- ============================================================
--  ٣) الكتابةُ تتحقّق من الخبر المنقول عن مصدر
-- ============================================================
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
    and x.kind in (
      'trailer', 'date', 'season', 'status', 'season_date', 'theatrical',
      'released', 'chart', 'provider', 'report'
    )
    and x.tmdb_id is not null
    and x.media_type in ('tv', 'movie')
    and length(btrim(coalesce(x.title, ''))) between 1 and 300
    and length(coalesce(x.data, '{}'::jsonb)::text) <= 400
    /* **حارسا `report`، وهما سببُ وجود هذه الهجرة:**
       (١) الحدثُ من قائمةٍ مغلقة — لا نصَّ حرّ.
       (٢) والرابطُ — إن وُجد — إلى نطاقٍ في القائمة البيضاء نفسِها
           (`news_host_ok`، هجرة ٦٤). **فلا يُهرَّب رابطٌ في خبر.** */
    and (
      x.kind <> 'report'
      or (
        (x.data ->> 'event') in ('renewed', 'canceled', 'delayed')
        and coalesce(length(x.data ->> 'source'), 0) between 1 and 40
        and (
          (x.data ->> 'url') is null
          or public.news_host_ok(x.data ->> 'url')
        )
      )
    )
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

-- ============================================================
--  ٤) شريحةُ المراقبة تحمل الرتبة معها
-- ============================================================
-- **ولماذا تُحمل من هنا:** الرتبةُ في جدولنا، **فقراءتُها مع الشريحة
-- تلغي استعلاماً ثانياً لكل دورة** — والخبرُ الناتج بلا نداءِ TMDB أصلاً.
drop function if exists public.news_watch_slice(integer);

create function public.news_watch_slice(p_limit integer default 25)
returns table (tmdb_id integer, media_type text, checked_at timestamptz, chart_rank integer)
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
  ),
  ranked as (
    select c.tmdb_id::integer as tmdb_id, c.media_type, min(c.rank)::integer as rank
      from public.imdb_chart c
     group by 1, 2
  )
  select w.tmdb_id, w.media_type, s.updated_at, r.rank
  from watch w
  left join public.title_snapshots s
    on s.tmdb_id = w.tmdb_id and s.media_type = w.media_type
  left join ranked r
    on r.tmdb_id = w.tmdb_id and r.media_type = w.media_type
  order by s.updated_at asc nulls first
  limit least(greatest(coalesce(p_limit, 25), 1), 60);
$$;

revoke all on function public.news_watch_slice(integer) from public;
grant execute on function public.news_watch_slice(integer) to authenticated;

-- ============================================================
--  ٥) اللقطةُ تحفظ الحقلين الجديدين
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
      theatrical_date text, chart_rank integer, providers text
    )
    limit 60
  )
  insert into public.title_snapshots
    (tmdb_id, media_type, status, release_date, next_air_date, seasons, trailer_key,
     last_air_date, next_season_date, next_season_num, theatrical_date,
     chart_rank, providers, updated_at)
  select
    i.tmdb_id, i.media_type,
    left(i.status, 40), left(i.release_date, 10), left(i.next_air_date, 10),
    i.seasons, left(i.trailer_key, 40),
    left(i.last_air_date, 10), left(i.next_season_date, 10), i.next_season_num,
    left(i.theatrical_date, 10), i.chart_rank, left(i.providers, 200), now()
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
         chart_rank       = excluded.chart_rank,
         providers        = excluded.providers,
         updated_at       = now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.set_title_snapshots(jsonb) from public;
grant execute on function public.set_title_snapshots(jsonb) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select count(*)::int as newcols from information_schema.columns
--  where table_name='title_snapshots' and column_name in ('chart_rank','providers'); -- 2
-- select count(*)::int as slice_cols from information_schema.columns
--  where table_name='news_watch_slice';   -- (دالّة، تُفحص بالتشغيل)
-- select * from public.news_watch_slice(3);
-- select public.news_host_ok('https://deadline.com/x') as ok;  -- true
--
-- ⚠️ والسياساتُ المفتوحة تبقى **أربعاً**:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
