-- ============================================================
--  ١٨٤ — «الأداء والأمان» تُقاس لا تُوصف (D-924، طلبُ أحمد: «أحتاج أعرف
--        فيها حالة الأداء والسرعة والتأخير، وحالة الأمان وحفظ البيانات
--        وأنواع البيانات التي نجمعها ومستوى الحماية والثغرات والتوصيات»)
-- ============================================================
-- 🔑 **صفحةٌ تعرض رقماً لا تقيسه أسوأُ من صفحةٍ لا تعرضه** (D-063/D-219):
--    فكلُّ رقمٍ هنا من مصدرٍ حيّ — `pg_stat_statements` للزمن،
--    `pg_policies`/`pg_proc` للحماية، `pg_class` للنموّ — **ولا رقمَ
--    مكتوبٌ بيدٍ في الشيفرة إلا التصنيفَ** (أيّ جدولٍ يحمل أيّ نوعِ بيانات)،
--    **وهو حكمٌ لا قياس** فيسكن الشيفرةَ ويُقرأ بجانب الرقم لا بدلاً منه.
--
-- 🔑 **والنصائحُ تُحسب هنا لا تُستورد**: لوحةُ Supabase تعرض `advisors`
--    عبر واجهةٍ لا SQL — **فما يُعتمد عليه يوميّاً يُعاد حسابُه بالسؤال
--    نفسِه** (`auth_rls_initplan` = ١١٩ سياسةً، مطابَقٌ حرفيّاً بالمستشار
--    ٥ سبتمبر). سؤالٌ واحدٌ في القاعدة خيرٌ من تبويبٍ في لوحةٍ أخرى.
--
-- ⚖️ **stable لا volatile، وقراءةٌ محضة**: لا كتابةَ ولا جدولَ ولا عمود.

create or replace function public.admin_health()
returns jsonb
language sql stable security definer
-- ⚠️ **و`auth` ليست في المسار عمداً**: `pg_policies` تُصيّر تعبيرَ السياسة
--    بحسب المسار، **فوجودُ `auth` فيه يطبع `uid()` بلا مؤهِّل** فيسقط
--    الفحصُ عن ١١٩ سياسةً ويقول «صفر». التأهيلُ الصريح (`auth.identities`)
--    يغني عنه — **ورقمٌ صار صفراً بلا سببٍ أخطرُ من رقمٍ كبير.**
set search_path = public, extensions, pg_temp
as $$
  with
  -- ===== الزمن: أثقلُ ما في القاعدة، باسم الدالّة لا بنصِّ الاستعلام =====
  s as (
    select coalesce(substring(query from '"public"\."([a-z0-9_]+)"'), 'sql') as name,
           calls, total_exec_time
    from extensions.pg_stat_statements
  ),
  agg as (select name, sum(calls) as calls, sum(total_exec_time) as tt from s group by name),
  tot as (select nullif(sum(tt),0) as t, sum(calls) as c from agg),
  top as (
    select jsonb_agg(x) as j from (
      select jsonb_build_object(
        'name', agg.name,
        'calls', agg.calls,
        'mean_ms', round((agg.tt/nullif(agg.calls,0))::numeric, 1),
        'pct', round((100*agg.tt/tot.t)::numeric, 1)
      ) as x
      from agg, tot order by agg.tt desc limit 6
    ) q
  ),
  -- ===== الحماية =====
  pol as (
    select count(*) as total,
           count(*) filter (where qual = 'true') as open,
           count(*) filter (
             where (qual ~ 'auth\.uid\(\)' or with_check ~ 'auth\.uid\(\)')
               and coalesce(qual,'')||coalesce(with_check,'') !~ '\(\s*select\s+auth\.uid\(\)')
             as initplan
    from pg_policies where schemaname = 'public'
  ),
  tbl as (
    select count(*) as total, count(*) filter (where not c.relrowsecurity) as rls_off
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  fn as (
    select count(*) filter (where p.prosecdef) as definer,
           count(*) filter (where p.prosecdef and has_function_privilege('anon', p.oid, 'execute')) as definer_anon,
           count(*) filter (where p.proconfig is null and p.prokind = 'f') as mutable_path
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ),
  idx as (
    select (select count(*) from pg_stat_user_indexes where idx_scan = 0) as unused,
           (select round((100.0*sum(blks_hit)/nullif(sum(blks_hit)+sum(blks_read),0))::numeric,2)
              from pg_stat_database where datname = current_database()) as cache_hit
  ),
  -- ===== ما يُجمَع وكم عمرُه — العدُّ والعمرُ فقط؛ التصنيفُ في الشيفرة =====
  grow as (
    select jsonb_object_agg(t, jsonb_build_object('rows', n, 'oldest', o)) as j from (
      select 'runtime_errors' t, (select count(*) from public.runtime_errors) n,
             (select min(at)::date::text from public.runtime_errors) o
      union all select 'profile_views', (select count(*) from public.profile_views), null
      union all select 'user_active_days', (select count(*) from public.user_active_days),
             (select min(day)::text from public.user_active_days)
      union all select 'admin_audit', (select count(*) from public.admin_audit),
             (select min(at)::date::text from public.admin_audit)
      union all select 'user_devices', (select count(*) from public.user_devices), null
      union all select 'partner_details', (select count(*) from public.partner_details), null
      union all select 'payout_requests', (select count(*) from public.payout_requests), null
      union all select 'play_testers', (select count(*) from public.play_testers), null
    ) q
  ),
  prov as (
    select jsonb_agg(jsonb_build_object('provider', provider, 'n', n)) as j
    from (select provider, count(*) as n from auth.identities group by provider order by count(*) desc) p
  ),
  buck as (
    select jsonb_agg(jsonb_build_object(
      'id', b.id, 'public', b.public,
      'objects', (select count(*) from storage.objects o where o.bucket_id = b.id)
    )) as j from storage.buckets b
  )
  select case when not public.am_admin() then null else jsonb_build_object(
    'at', now(),
    'perf', jsonb_build_object(
      'since',    (select stats_reset from extensions.pg_stat_statements_info),
      'calls',    (select c from tot),
      'total_s',  (select round((t/1000)::numeric, 0) from tot),
      'avg_ms',   (select round((t/nullif(c,0))::numeric, 2) from tot),
      'cache_hit',(select cache_hit from idx),
      'db_bytes', pg_database_size(current_database()),
      'unused_indexes', (select unused from idx),
      'top',      (select j from top)
    ),
    'sec', jsonb_build_object(
      'tables',        (select total from tbl),
      'rls_off',       (select rls_off from tbl),
      'policies',      (select total from pol),
      'open_policies', (select open from pol),
      'initplan',      (select initplan from pol),
      'definer',       (select definer from fn),
      'definer_anon',  (select definer_anon from fn),
      'mutable_path',  (select mutable_path from fn),
      'providers',     (select j from prov),
      'buckets',       (select j from buck)
    ),
    'data', (select j from grow)
  ) end;
$$;
revoke all on function public.admin_health() from public, anon;
grant execute on function public.admin_health() to authenticated;

-- ============ فحوصٌ بعد التشغيل ============
--   select public.admin_health();                       -- jsonb لا null (بحساب المدير)
--   select (public.admin_health()->'sec'->>'initplan')::int;  -- = عددُ المستشار نفسِه
--   select proacl::text from pg_proc where proname='admin_health';  -- بلا anon
