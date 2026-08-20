-- ============================================================
-- 124 — تمكينُ الـinlining لدالّتَي القراءة الساخنتين (جولة P1-A · ٢٠ أغسطس ٢٠٢٦)
--
-- المقيسُ قبلها على الإنتاج (pg_stat_statements منذ ١ أغسطس):
--   watch_summary(): ١٢٬٤٨٨ نداءً × ٣١٫١م.ث = ٣٨٨ ثانية — أكبرُ
--   مستهلكِ وقتِ قاعدةٍ في التطبيق. my_lists(): ٦٬٩٢٥ × ٨٫٧م.ث.
--   وEXPLAIN ANALYZE بجلسة authenticated: نداءُ الدالّة ٥٦م.ث بينما
--   جسدُها الحرفيُّ مباشرةً — وبنفس RLS — ٩٫٨م.ث.
--
-- السببُ المثبَت: Postgres لا يُضمِّن (inline) دالّةَ SQL تحمل أيَّ
-- SET، فتبقى صندوقاً أسود يُعاد تنفيذُه بلا initplan لـauth.uid().
-- والعلاجُ الوحيدُ هنا إسقاطُ `SET search_path` — **ولا حرفَ غيرُه**:
--
--   • الجسمان أدناه منسوخان من `pg_get_functiondef` الحيّ حرفاً حرفاً.
--   • كلُّ مرجعٍ مؤهَّلٌ بمخطَّطه أصلاً (public.* و auth.uid())
--     فلا شيءَ يُحلُّ عبر search_path — وهو شرطُ أمان الإسقاط.
--   • SECURITY INVOKER كما كانتا (لا secdef) — RLS يبقى الحارس.
--   • STABLE كما كانتا، والتوقيعُ والعائدُ بلا تغيير، فلا DROP —
--     وCREATE OR REPLACE يُبقي المالكَ والمنح (مُتحقَّقٌ بعد التشغيل).
--   • ⚠️ قاعدةٌ للمستقبل: لا يُعاد `SET search_path` لدالّة قراءةٍ
--     invoker ساخنة — ولدوالّ definer يبقى إجبارياً (لا تمسّها هذه).
--
-- rollback: أعد تشغيل تعريفَي rewatch.sql (watch_summary) و
-- lists4.sql/الحيّ السابق (my_lists) — أي التعريفان نفساهما مع
-- سطر `set search_path = public`.
-- ============================================================

create or replace function public.watch_summary()
returns table (
  show_tmdb_id  integer,
  watched       integer,
  last_watched  timestamptz,
  minutes       bigint
)
language sql
stable
as $$
  select w.show_tmdb_id, count(*)::integer, max(w.watched_at), coalesce(sum(coalesce(w.runtime, 40)), 0) from public.watched_episodes w left join public.follows f on f.user_id = w.user_id and f.tmdb_id = w.show_tmdb_id and f.media_type = 'tv' where w.user_id = auth.uid() and (f.rewatch_started_at is null or w.watched_at >= f.rewatch_started_at) group by w.show_tmdb_id;
$$;

create or replace function public.my_lists()
returns table (
  id uuid, name text, subtitle text, kind text, is_public boolean,
  created_at timestamptz, item_count integer, shows_count integer,
  movies_count integer, posters text[], cover_backdrop text,
  cover_tmdb_id integer, cover_media_type text
)
language sql
stable
as $$
  select
    l.id,
    l.name,
    l.subtitle,
    l.kind,
    l.is_public,
    l.created_at,
    (select count(*)::integer
       from public.user_list_items i
      where i.list_id = l.id),
    (select count(*)::integer
       from public.user_list_items i
      where i.list_id = l.id and i.media_type = 'tv'),
    (select count(*)::integer
       from public.user_list_items i
      where i.list_id = l.id and i.media_type = 'movie'),
    (select array_agg(p order by ord)
       from (select i.poster_path as p,
                    row_number() over (order by i.added_at desc) as ord
               from public.user_list_items i
              where i.list_id = l.id and i.poster_path is not null
              order by i.added_at desc
              limit 12) s),
    l.cover_backdrop,
    l.cover_tmdb_id,
    l.cover_media_type
  from public.user_lists l
  where l.user_id = auth.uid()
  order by l.created_at desc;
$$;

-- تحقُّقها:
--   select proname, coalesce(array_to_string(proconfig,';'),'NONE') as cfg,
--          prosecdef, provolatile
--     from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public' and proname in ('watch_summary','my_lists');
--   -- المتوقَّع: cfg = NONE للاثنتين · prosecdef = f · provolatile = s
--   select tablename, policyname from pg_policies
--    where schemaname='public' and qual='true';
--   -- المتوقَّع: أربعٌ بالضبط
