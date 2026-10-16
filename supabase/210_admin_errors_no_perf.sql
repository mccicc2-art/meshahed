-- ============================================================
--  Loopz — 210: «ما يهدّد الاستقرار» يعدّ الأخطاءَ وحدها (D-1444)
--  أحمد ١٦ أكتوبر بلقطة لوحة الإدارة: «531 خطأً في الخادم خلال ٢٤ ساعة» — ٥٢٩ منها قياساتُ أداءٍ يرسلها التطبيقُ عمداً
--  (`kind = 'perf'`، مثل «auth.login=106») تسكن جدولَ `runtime_errors` نفسَه، فكان التنبيهُ يكبر مع الاستعمال لا مع الأعطال.
--  شغّله في Supabase → SQL Editor. آمنٌ لإعادة التشغيل.
--
--  - `admin_overview` بنصّها حرفاً، والتغييرُ في قسم `errors` وحده: `kind is distinct from 'perf'` في العدّين و«الأكثر».
--  - القياساتُ باقيةٌ في الجدول كما هي (تقرأها صفحةُ الأداء)؛ لا حذفَ ولا عمودَ جديد.
--  - `create or replace` بالتوقيع نفسِه وما تعيده ⇒ الصلاحياتُ (authenticated · service_role) تبقى كما هي.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_overview()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'storage', 'pg_temp'
AS $function$
declare
  v jsonb;
begin
  if not public.am_admin() then
    return null;
  end if;

  select jsonb_build_object(
    'generated_at', now(),

    'users', (select jsonb_build_object(
      'total',          count(*) filter (where deleted_at is null),
      'new_24h',        count(*) filter (where deleted_at is null and created_at > now() - interval '24 hours'),
      'new_7d',         count(*) filter (where deleted_at is null and created_at > now() - interval '7 days'),
      'new_30d',        count(*) filter (where deleted_at is null and created_at > now() - interval '30 days'),
      'active_24h',     count(*) filter (where deleted_at is null and last_sign_in_at > now() - interval '24 hours'),
      'active_7d',      count(*) filter (where deleted_at is null and last_sign_in_at > now() - interval '7 days'),
      'active_30d',     count(*) filter (where deleted_at is null and last_sign_in_at > now() - interval '30 days'),
      'never_returned', count(*) filter (where deleted_at is null and last_sign_in_at is not null
                                           and created_at > last_sign_in_at - interval '2 minutes')
    ) from auth.users),

    'suspended', (select count(*) from public.profiles where suspended_at is not null),

    'signups_daily', (
      select coalesce(jsonb_agg(jsonb_build_object('d', s.d, 'n', coalesce(u.n, 0)) order by s.d), '[]'::jsonb)
      from generate_series(current_date - 29, current_date, interval '1 day') as s(d)
      left join (
        select (created_at at time zone 'Asia/Riyadh')::date as d, count(*) as n
        from auth.users where deleted_at is null group by 1
      ) u on u.d = s.d::date
    ),

    'logins_hourly', (
      select coalesce(jsonb_agg(jsonb_build_object('h', h.h, 'n', coalesce(a.n, 0)) order by h.h), '[]'::jsonb)
      from generate_series(0, 23) as h(h)
      left join (
        select extract(hour from (last_sign_in_at at time zone 'Asia/Riyadh'))::int as h, count(*) as n
        from auth.users where deleted_at is null and last_sign_in_at is not null group by 1
      ) a on a.h = h.h
    ),

    'visit_langs', (
      select coalesce(jsonb_agg(jsonb_build_object('lang', lang, 'hits', hits) order by hits desc), '[]'::jsonb)
      from (select lang, sum(hits)::int as hits from public.visit_langs
            where day >= current_date - 30 group by lang order by 2 desc limit 6) t
    ),

    'db', jsonb_build_object(
      'db_bytes', pg_database_size(current_database()),
      'storage_bytes', (select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects),
      'storage_objects', (select count(*) from storage.objects),
      'tables', (
        select coalesce(jsonb_agg(jsonb_build_object('name', relname, 'bytes', bytes, 'rows', rows) order by bytes desc), '[]'::jsonb)
        from (
          select c.relname, pg_total_relation_size(c.oid) as bytes, coalesce(s.n_live_tup, 0) as rows
          from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
          left join pg_stat_user_tables s on s.relid = c.oid
          where ns.nspname = 'public' and c.relkind = 'r'
          order by pg_total_relation_size(c.oid) desc limit 8
        ) t
      )
    ),

    -- 🆕 D-1444 — قياساتُ الأداء (`perf`) ليست أخطاءً: تُستثنى من العدّين ومن «الأكثر»
    'errors', jsonb_build_object(
      'count_24h', (select count(*) from public.runtime_errors where at > now() - interval '24 hours' and kind is distinct from 'perf'),
      'count_7d',  (select count(*) from public.runtime_errors where at > now() - interval '7 days' and kind is distinct from 'perf'),
      'top', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'route', route, 'kind', kind, 'n', n, 'last_at', last_at, 'sample', sample) order by n desc), '[]'::jsonb)
        from (
          select split_part(route, '?', 1) as route, kind, count(*) as n, max(at) as last_at,
                 left(min(message), 120) as sample
          from public.runtime_errors where at > now() - interval '7 days' and kind is distinct from 'perf'
          group by 1, 2 order by 3 desc limit 5
        ) e
      )
    ),

    'health', jsonb_build_object(
      'open_policies', (select count(*) from pg_policies where qual = 'true'),
      'open_policy_tables', (select coalesce(jsonb_agg(tablename order by tablename), '[]'::jsonb) from pg_policies where qual = 'true'),
      'cron', (select coalesce(jsonb_agg(jsonb_build_object('job', jobname, 'schedule', schedule, 'active', active)), '[]'::jsonb) from cron.job)
    ),

    'queues', jsonb_build_object(
      'partners_pending', (select count(*) from public.partner_applications where status = 'pending'),
      'verification_pending', (select count(*) from public.verification_requests where status = 'pending'),
      'payouts_pending', (select count(*) from public.payout_requests where status = 'pending'),
      'partners_total', (select count(*) from public.partners)
    ),

    'content', jsonb_build_object(
      'follows',   (select count(*) from public.follows),
      'ratings',   (select count(*) from public.ratings),
      'lists',     (select count(*) from public.user_lists),
      'posts',     (select count(*) from public.title_posts where hidden = false),
      'messages',  (select count(*) from public.community_messages),
      'communities', (select count(*) from public.communities)
    )
  ) into v;

  return v;
end;
$function$;

-- تحقّق (بجلسة أدمن): select (public.admin_overview())->'errors'->>'count_24h';
