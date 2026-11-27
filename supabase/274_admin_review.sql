-- ============================================================================
-- ٢٧٤ — مراجعةُ صفحات الإدارة (المهمّة ٦٠١ · أحمد ٢٧ نوفمبر «نفذ أ ب»)
-- ============================================================================
-- التقرير: claude/REVIEW-ADMIN-PAGES-2026-11-27.md في مشروع Claude.
-- ستّةُ إصلاحاتٍ في القاعدة، كلُّها دوالُّ قراءةٍ للمدير أو تسجيلٌ في سجلّ الإدارة —
-- لا جدولَ يُنشأ ولا عمودَ يُضاف ولا صفَّ مستخدمٍ يُمَسّ. تُعاد بلا ضرر (create or replace).
--
--  ١) admin_overview — عدُّ الأعطال لا يحسب التشخيص: كان ٣٣ من ٣٧ «خطأً» في ٢٤ ساعة سجلَّ مقاساتِ
--     الويدجت (`AppDiag`)، واثنان إشارتي تريلر — فالتنبيهُ الأحمرُ أعلى الصفحة كان كاذباً. سابقتُه
--     الهجرة ٢١٠ التي استثنت `perf` بالحجّة نفسِها. و`PushSend` يبقى: فشلُ إرسالٍ حقيقيّ.
--     ونشاطُ المستخدمين صار من `user_active_days` (نبضاتُ الاستعمال) لا من `last_sign_in_at`:
--     جلسةُ التطبيق تتجدّد بلا تسجيلِ دخولٍ جديد، فكان «نشط ٣٠ يوماً» يقارب «جديد ٣٠ يوماً» —
--     والمصدرُ نفسُه الذي تُحسب منه عودةُ اليوم الأوّل في صفحة المؤشّرات. المفاتيحُ كما هي.
--  ٢) admin_health — عدُّ السياسات يطابق `SELECT` بحروفٍ كبيرة كما تخزّنها القاعدة (`!~*`):
--     كان ١٤٢ والحقيقيُّ ٢. وجدولُ «ما نجمعه» يقيس الجداولَ الشخصيّةَ والماليّةَ الغائبة.
--  ٣) admin_nav_counts — شارةُ «الملاحظات»: ما لم يُغلق بعد.
--  ٤) admin_billing_summary — جديدة: الاشتراكاتُ الحقيقيّةُ مفصولةً عن المنح اليدويّة والتجريبيّة،
--     وأحداثُ الدفع العالقة، وعمولاتُ الشركاء، وتاريخُ أوّلِ اشتراكٍ حقيقيّ (منه تذكيرُ رخصة TMDB).
--  ٥) سجلُّ الإدارة يشهد أربعةَ أفعالٍ كانت تقع بلا أثر: تعديلُ تقييمِ شخصيّةٍ منشور، وإيقافُ نشرها،
--     وإغلاقُ ملاحظة، وتصنيفُ أنواعِ عمل.
-- ============================================================================

-- ١) ------------------------------------------------------------------------
create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable security definer
set search_path = public, auth, storage, pg_temp
as $function$
declare
  v jsonb;
  today date := public.loopz_today();
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
      /* ٢٧٤ — من استعمل لا من سجّل دخولاً: يومُ الرياض نفسُه الذي يحسب منه المجلسُ عودةَ اليوم الأوّل */
      'active_24h',     (select count(distinct d.user_id) from public.user_active_days d where d.day = today),
      'active_7d',      (select count(distinct d.user_id) from public.user_active_days d where d.day > today - 7),
      'active_30d',     (select count(distinct d.user_id) from public.user_active_days d where d.day > today - 30),
      /* من لم يُرَ إلا في يومٍ واحدٍ أو لم يُرَ أصلاً */
      'never_returned', (select count(*) from auth.users u where u.deleted_at is null
                           and (select count(distinct d.day) from public.user_active_days d where d.user_id = u.id) < 2)
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

    /* ٢٧٤ — الأعطالُ وحدَها: perf (٢١٠) والتشخيصُ والإشاراتُ تسكن الجدولَ نفسَه ولا تعني عطلاً */
    'errors', jsonb_build_object(
      'count_24h', (select count(*) from public.runtime_errors where at > now() - interval '24 hours'
                      and coalesce(kind, '') not in ('perf', 'AppDiag', 'TrailerSignal', 'NativeGate')),
      'count_7d',  (select count(*) from public.runtime_errors where at > now() - interval '7 days'
                      and coalesce(kind, '') not in ('perf', 'AppDiag', 'TrailerSignal', 'NativeGate')),
      'top', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'route', route, 'kind', kind, 'n', n, 'last_at', last_at, 'sample', sample) order by n desc), '[]'::jsonb)
        from (
          select split_part(route, '?', 1) as route, kind, count(*) as n, max(at) as last_at,
                 left(min(message), 120) as sample
          from public.runtime_errors where at > now() - interval '7 days'
            and coalesce(kind, '') not in ('perf', 'AppDiag', 'TrailerSignal', 'NativeGate')
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

-- ٢) ------------------------------------------------------------------------
create or replace function public.admin_health()
returns jsonb
language sql
stable security definer
set search_path = public, extensions, pg_temp
as $function$
  with
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
  pol as (
    select count(*) as total,
           count(*) filter (where qual = 'true') as open,
           /* ٢٧٤ — `~*`: القاعدةُ تخزّن «( SELECT auth.uid() AS uid)» بحروفٍ كبيرة، والمطابقةُ الحسّاسةُ للحالة
              كانت تعدّ كلَّ سياسةٍ مغلَّفةٍ أصلاً (١٤٢ والحقيقيُّ ٢) */
           count(*) filter (
             where (qual ~ 'auth\.uid\(\)' or with_check ~ 'auth\.uid\(\)')
               and coalesce(qual,'')||coalesce(with_check,'') !~* '\(\s*select\s+auth\.uid\(\)')
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
      /* ٢٧٤ — ما كان يُجمع ولا يُعرض: الدفعُ والاعتماداتُ والرسائلُ الخاصّةُ والاستيراد */
      union all select 'subscriptions', (select count(*) from public.subscriptions),
             (select min(created_at)::date::text from public.subscriptions)
      union all select 'billing_events', (select count(*) from public.billing_events),
             (select min(received_at)::date::text from public.billing_events)
      union all select 'partner_commissions', (select count(*) from public.partner_commissions),
             (select min(created_at)::date::text from public.partner_commissions)
      union all select 'apple_tokens', (select count(*) from public.apple_tokens), null
      union all select 'device_tokens', (select count(*) from public.device_tokens),
             (select min(created_at)::date::text from public.device_tokens)
      union all select 'widget_tokens', (select count(*) from public.widget_tokens),
             (select min(created_at)::date::text from public.widget_tokens)
      union all select 'device_links',
             (select count(*) from public.home_server_links) + (select count(*) from public.kodi_links)
           + (select count(*) from public.stremio_links) + (select count(*) from public.nuvio_links), null
      union all select 'platform_links', (select count(*) from public.platform_links),
             (select min(created_at)::date::text from public.platform_links)
      union all select 'import_runs', (select count(*) from public.import_runs),
             (select min(created_at)::date::text from public.import_runs)
      union all select 'direct_messages',
             (select count(*) from public.direct_messages) + (select count(*) from public.dm_group_messages),
             (select min(created_at)::date::text from public.direct_messages)
      union all select 'verification_requests', (select count(*) from public.verification_requests),
             (select min(created_at)::date::text from public.verification_requests)
      union all select 'feedback', (select count(*) from public.feedback),
             (select min(created_at)::date::text from public.feedback)
      union all select 'referral_events', (select count(*) from public.referral_events),
             (select min(at)::date::text from public.referral_events)
      union all select 'session_mints', (select count(*) from public.session_mints),
             (select min(created_at)::date::text from public.session_mints)
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
$function$;

-- ٣) ------------------------------------------------------------------------
create or replace function public.admin_nav_counts()
returns jsonb
language sql
stable security definer
set search_path = public, auth, pg_temp
as $function$
  with tu as (
    select u.id from public.play_testers t
    join auth.users u on lower(u.email) = t.email and u.deleted_at is null
  ),
  rep as (
    select
      (select count(*) from public.review_reports)
    + (select count(*) from public.user_reports)
    + (select count(*) from public.reply_reports)
    + (select count(*) from public.title_post_reports)
    + (select count(*) from public.list_review_reports)
    + (select count(*) from public.list_reply_reports)
    + (select count(*) from public.news_reply_reports)
    + (select count(*) from public.ratings where hidden)
    + (select count(*) from public.title_posts where hidden)
    + (select count(*) from public.review_replies where hidden)
    + (select count(*) from public.list_reviews where hidden)
    + (select count(*) from public.list_review_replies where hidden)
    + (select count(*) from public.news_post_replies where hidden) as n
  )
  select case when not public.am_admin() then null else jsonb_build_object(
    'partners',  (select count(*) from public.partner_applications where status = 'pending'),
    'verify',    (select count(*) from public.verification_requests where status = 'pending'),
    'payouts',   (select count(*) from public.payout_requests where status = 'pending'),
    'suspended', (select count(*) from public.profiles where suspended_at is not null),
    'reports',   (select n from rep),
    'testers_missing', (select count(*) from tu where not exists (
       select 1 from public.user_active_days d
       where d.user_id = tu.id and d.day = public.loopz_today())),
    /* ٢٧٤ — صوتُ المستخدمين الوحيد كان بلا شارة (D-1499) */
    'feedback',  (select count(*) from public.feedback where done_at is null)
  ) end;
$function$;

-- ٤) ------------------------------------------------------------------------
/* 🆕 ملخّصُ الفوترة — صفحةُ «الاشتراكات» (أحمد: «ملخّص الاشتراكات مستقلّ»).
   🔑 ثلاثةُ أصنافٍ لا تُخلط: الحقيقيُّ (RevenueCat · production)، واليدويُّ (منحةُ مديرٍ أو شريك،
   وPlus الممتدُّ حتى ٣٠ نوفمبر)، والتجريبيُّ (sandbox). الخلطُ جعل ٨ صفوفٍ تُقرأ «٨ مشتركين» وليس بينها شراءٌ واحد.
   والنشطُ بقاعدة `recompute_plan` نفسِها (٢٣٨): غيرُ منتهٍ ونهايةُ فترته لم تأتِ. */
create or replace function public.admin_billing_summary()
returns jsonb
language sql
stable security definer
set search_path = public, pg_temp
as $function$
  with real as (
    select * from public.subscriptions where provider = 'revenuecat' and environment = 'production'
  ),
  live as (
    select * from real where status <> 'expired' and current_period_end > now()
  )
  select case when not public.am_admin() then null else jsonb_build_object(
    'at', now(),
    'real', jsonb_build_object(
      'active',         (select count(*) from live),
      'renewing',       (select count(*) from live where not coalesce(cancel_at_period_end, false)),
      'cancel_pending', (select count(*) from live where coalesce(cancel_at_period_end, false)),
      'new_30d',        (select count(*) from real where coalesce(first_purchase_at, created_at) > now() - interval '30 days'),
      'ended_30d',      (select count(*) from real where status = 'expired' and updated_at > now() - interval '30 days'),
      'ever',           (select count(*) from real),
      'first_at',       (select min(coalesce(first_purchase_at, created_at)) from real),
      'by_product', coalesce((select jsonb_agg(jsonb_build_object('store', store, 'plan', plan, 'product', product_id, 'n', n)
                                               order by n desc)
                               from (select store, plan, product_id, count(*) as n from live group by 1, 2, 3) x), '[]'::jsonb)
    ),
    'members', jsonb_build_object(
      'plus',          (select count(*) from public.profiles
                          where coalesce(plan, 'free') <> 'free' and (plus_until is null or plus_until > now())),
      'gold',          (select count(*) from public.profiles
                          where gold_until > now() and coalesce(plan, 'free') <> 'free'
                            and (plus_until is null or plus_until > now())),
      'plus_ending_7d',(select count(*) from public.profiles
                          where coalesce(plan, 'free') <> 'free' and plus_until between now() and now() + interval '7 days'),
      'manual_active', (select count(*) from public.subscriptions
                          where provider = 'manual' and status <> 'expired'
                            and (current_period_end is null or current_period_end > now()))
    ),
    'sandbox', jsonb_build_object(
      'subs',   (select count(*) from public.subscriptions where environment = 'sandbox'),
      'events', (select count(*) from public.billing_events where environment = 'sandbox')
    ),
    'events', jsonb_build_object(
      'received_30d', (select count(*) from public.billing_events
                         where environment = 'production' and received_at > now() - interval '30 days'),
      /* المعالجةُ المقطوعةُ تُعاد بعد دقيقتين (٢٣٨) — ما تجاوز عشرَ دقائق عالقٌ فعلاً */
      'stuck',        (select count(*) from public.billing_events
                         where environment = 'production'
                           and processed_at is null and received_at < now() - interval '10 minutes'),
      'last_at',      (select max(received_at) from public.billing_events where environment = 'production')
    ),
    'commissions', jsonb_build_object(
      'earned',   coalesce((select sum(amount) from public.partner_commissions where kind = 'earned'), 0),
      'reversed', coalesce((select sum(amount) from public.partner_commissions where kind = 'reversed'), 0),
      /* تعليقُ الثلاثين يوماً كما في `partner_balance` */
      'on_hold',  coalesce((select sum(amount) from public.partner_commissions
                              where kind = 'earned' and created_at >= now() - interval '30 days'), 0),
      'partners', (select count(distinct partner_id) from public.partner_commissions)
    ),
    'payouts', jsonb_build_object(
      'pending',        (select count(*) from public.payout_requests where status = 'pending'),
      'pending_amount', coalesce((select sum(amount) from public.payout_requests where status = 'pending'), 0),
      'paid_amount',    coalesce((select sum(amount) from public.payout_requests where status = 'paid'), 0)
    )
  ) end;
$function$;

revoke all on function public.admin_billing_summary() from public, anon;
grant execute on function public.admin_billing_summary() to authenticated;

-- ٥) ------------------------------------------------------------------------
/* أفعالٌ إداريّةٌ كانت تقع بلا أثرٍ في `admin_audit` — والسجلُّ لا يشهد إلا بما يُكتب فيه */
create or replace function public.admin_feedback_done(p_id uuid, p_done boolean default true)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  update public.feedback
     set done_at = case when p_done then now() else null end,
         done_by = case when p_done then auth.uid() else null end
   where id = p_id;
  if found then
    perform public.log_admin('feedback_done', null, jsonb_build_object('feedback', p_id, 'done', p_done));
  end if;
end $function$;

create or replace function public.admin_persona_pause(p_paused boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.am_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.persona_settings set
    paused     = coalesce(p_paused, false),
    paused_at  = case when coalesce(p_paused, false) then now() else null end,
    updated_at = now()
  where id = 1;
  perform public.log_admin('persona_pause', null, jsonb_build_object('paused', coalesce(p_paused, false)));
end;
$function$;

create or replace function public.admin_persona_review_update(
  p_id uuid, p_status text, p_body_ar text, p_body_en text, p_rating smallint default null)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.am_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.persona_reviews set
    status     = coalesce(p_status, status),
    body_ar    = coalesce(nullif(btrim(p_body_ar), ''), body_ar),
    body_en    = coalesce(nullif(btrim(p_body_en), ''), body_en),
    rating     = coalesce(p_rating, rating),
    updated_at = now()
  where id = p_id;
  if found then
    perform public.log_admin('persona_review', null, jsonb_build_object(
      'review', p_id, 'status', p_status, 'rating', p_rating,
      'text', (nullif(btrim(p_body_ar), '') is not null or nullif(btrim(p_body_en), '') is not null)));
  end if;
end;
$function$;

create or replace function public.admin_set_title_genres(p_tmdb_id integer, p_media_type text, p_genres integer[])
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  n integer;
begin
  if not public.am_admin() then
    raise exception 'forbidden';
  end if;
  update public.follows f
     set genres = coalesce(p_genres, '{}'::integer[])
   where f.tmdb_id = p_tmdb_id
     and f.media_type = p_media_type
     and f.genres is null;
  get diagnostics n = row_count;
  perform public.log_admin('title_genres', null, jsonb_build_object(
    'tmdb', p_tmdb_id, 'media', p_media_type, 'genres', p_genres, 'rows', n));
  return n;
end;
$function$;
