-- ============================================================
--  Loopz — 213: تنبيهاتُ Supabase — سرعةُ RLS وتضييقُ ما يُنفّذه الزائر (D-1483)
--  أحمد ١٩ أكتوبر: «اكمل ٣ ٤ ٥» — البنود ٣ و٤ و٥ من تقرير المراقبة الدوري.
--  شُغّل على الإنتاج ١٩ أكتوبر ٢٠٢٦ (`20261019172203 213_advisor_hardening`)؛ الملفُّ هنا سجلٌّ له.
--  آمنٌ لإعادة التشغيل (كلُّ خطوةٍ تفحص قبل أن تغيّر).
--
--  ١) RLS: ١٢٨ سياسة تستدعي `auth.uid()` لكلِّ صفّ (تنبيه `auth_rls_initplan`).
--     `(select auth.uid())` تُحسب مرّةً للاستعلام كلِّه — المعنى نفسُه حرفاً بحرف، والفرقُ في السرعة
--     يكبر مع عدد الصفوف (سجلُّ مشاهدةٍ بـ٦ آلاف حلقة كان يقيّم الشرطَ ٦ آلاف مرّة).
--  ٢) `watch_summary`: ثاني أثقل استعلام (٧٨٫٦ م.ث متوسّطاً × ٤٦ ألف استدعاء). كانت SQL تُدمج وتُخطَّط
--     في كلِّ استدعاء (١٣ م.ث تخطيطاً وحده للعضو الأثقل) — صارت plpgsql فتُحفظ خطّتُها في الاتصال،
--     و`search_path` ثابت (كانت من الخمس في تنبيه `function_search_path_mutable`).
--  ٣) `search_path` ثابت للأربع الباقية — كلُّها تكتب `public.` صراحةً أو لا تلمس جدولاً، فلا يتغيّر شيء.
--  ٤) دوالُّ القوادح بصلاحيات المُنشئ: لا تُستدعى إلّا من قادح، والقادحُ لا يفحص صلاحيةَ التنفيذ عند الإطلاق
--     (تُفحص عند `create trigger` وحده) ⇒ سحبُ التنفيذ من الزائر والعضو لا يغيّر أيَّ كتابة.
--  ٥) دوالُّ العضو والمشرف بصلاحيات المُنشئ تُسحب من الزائر (`anon`) وحده. الدليل:
--     - `pg_stat_statements` منذ ١ أغسطس: صفرُ استدعاءٍ من الزائر لكلٍّ منها.
--     - كلُّ مستدعٍ في الكود يرجع فارغاً عند الخطأ (`if (error || !data) return []`) — فالزائرُ يرى ما كان يرى.
--     - لا واحدةَ منها في سياسة RLS ولا في عرضٍ ولا في دالّةٍ invoker (تلك لو سُحبت لكسرت قراءةَ الزائر).
--     - اثنتان منها كانتا تجيبان الزائرَ عن علاقة أيِّ عضوين.
--
--  ⚠️ يبقى عمداً — مقصودٌ لا ثغرة:
--  - `public_profiles` (تنبيه ERROR `security_definer_view`): العرضُ نفسُه هو حارسُ الخصوصيّة — يُخفي الاسمَ
--    والغلافَ والنبذة حسب `hide_name` و`can_view_profile`. بصلاحيات القارئ لن يرى الزائرُ شيئاً (RLS على profiles).
--  - الدوالُّ المستعملةُ في السياسات وقراءاتُ الضيف العامّة (134–139).
--  - حمايةُ كلمات المرور المسرّبة: الدخولُ بـGoogle وApple وحدهما — لا كلمةَ مرورٍ تُفحص.
-- ============================================================

begin;

-- ١) السياسات: auth.uid() ← (select auth.uid())
do $$
declare
  r record;
  q text;
  c text;
  n int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      -- مكشوفةٌ فقط: ما لُفّ كلُّه لا يُلمس — فإعادةُ التشغيل لا تغيّر شيئاً
      and regexp_replace(coalesce(qual, '') || ' ' || coalesce(with_check, ''),
                         '\(\s*SELECT auth\.uid\(\) AS uid\)', '', 'g') ~ 'auth\.uid\(\)'
  loop
    -- ما لُفّ قبلاً يُحمى أوّلاً (Postgres يعرضه `( SELECT auth.uid() AS uid)`) ثمّ يُلفّ الباقي
    q := case when r.qual is null then null else
           replace(replace(regexp_replace(r.qual, '\(\s*SELECT auth\.uid\(\) AS uid\)', '§UID§', 'g'),
                   'auth.uid()', '(select auth.uid())'), '§UID§', '(select auth.uid())') end;
    c := case when r.with_check is null then null else
           replace(replace(regexp_replace(r.with_check, '\(\s*SELECT auth\.uid\(\) AS uid\)', '§UID§', 'g'),
                   'auth.uid()', '(select auth.uid())'), '§UID§', '(select auth.uid())') end;
    if q is not distinct from r.qual and c is not distinct from r.with_check then
      continue; -- لا شيء مكشوفاً
    end if;
    execute format('alter policy %I on %I.%I%s%s',
      r.policyname, r.schemaname, r.tablename,
      case when q is null then '' else ' using (' || q || ')' end,
      case when c is null then '' else ' with check (' || c || ')' end);
    n := n + 1;
  end loop;
  raise notice '213: % policies wrapped', n;
end $$;

-- ٢) watch_summary — plpgsql بخطّةٍ محفوظة و search_path ثابت؛ المخرجاتُ نفسُها
create or replace function public.watch_summary()
returns table(show_tmdb_id integer, watched integer, last_watched timestamp with time zone, minutes bigint)
language plpgsql
stable
set search_path = public, pg_temp
as $$
#variable_conflict use_column
begin
  return query
  select w.show_tmdb_id, count(*)::integer, max(w.watched_at), coalesce(sum(coalesce(w.runtime, 40)), 0)::bigint
  from public.watched_episodes w
  left join public.follows f
    on f.user_id = w.user_id and f.tmdb_id = w.show_tmdb_id and f.media_type = 'tv'
  where w.user_id = (select auth.uid())
    and (f.rewatch_started_at is null or w.watched_at >= f.rewatch_started_at)
  group by w.show_tmdb_id;
end;
$$;

-- ٣) search_path ثابت للأربع الباقية
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('reorder_list', 'news_host_ok', 'touch_subscription_updated_at', 'my_lists')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) s where s like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- ٤) دوالُّ القوادح بصلاحيات المُنشئ: لا يستدعيها أحدٌ مباشرة
do $$
declare r record; n int := 0;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef and p.prorettype = 'trigger'::regtype
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    n := n + 1;
  end loop;
  raise notice '213: % trigger functions closed', n;
end $$;

-- ٥) دوالُّ العضو والمشرف: تُسحب من الزائر وحدَه — العضوُ وservice_role كما كانا
do $$
declare
  r record;
  had_auth boolean;
  had_service boolean;
  n int := 0;
begin
  for r in
    select p.oid, p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and has_function_privilege('anon', p.oid, 'execute')
      and p.proname in (
        -- المشرف (كلُّها تفحص المشرفَ في داخلها؛ هذا قفلٌ ثانٍ)
        'admin_decide_partner', 'admin_partner_applications', 'admin_provider_links',
        'admin_set_title_genres', 'admin_titles_missing_genres', 'admin_titles_missing_meta', 'set_title_meta',
        -- الشريك
        'apply_partner', 'cancel_partner_application', 'my_partner_state',
        -- القروبات والرسائل
        'dm_group_add', 'dm_group_create', 'dm_group_edit', 'dm_group_leave', 'dm_group_mark_read',
        'dm_group_mute', 'dm_group_remove', 'dm_group_set_role', 'mark_conversation_read',
        'are_mutual', 'have_conversation', 'last_seen_of', 'touch_last_seen',
        -- «لي»
        'my_blocks', 'my_communities', 'my_community_invites', 'my_feed_seen', 'my_invite_list',
        'my_invite_stats', 'my_referral_code', 'my_referral_count', 'my_referral_list', 'my_signals',
        'new_feed_count', 'pending_follow_requests', 'following_activity', 'following_activity_v2',
        'feed_activity_likes'
      )
  loop
    had_auth := has_function_privilege('authenticated', r.oid, 'execute');
    had_service := has_function_privilege('service_role', r.oid, 'execute');
    execute format('revoke execute on function %s from public, anon', r.sig);
    -- سحبُ public قد يسحب ما ورثه العضو منها — يُعاد صراحةً لمن كان يملكه
    if had_auth then execute format('grant execute on function %s to authenticated', r.sig); end if;
    if had_service then execute format('grant execute on function %s to service_role', r.sig); end if;
    n := n + 1;
  end loop;
  raise notice '213: % member/admin functions closed to anon', n;
end $$;

commit;

-- التحقّق بعد التشغيل (قراءةٌ فقط):
-- select count(*) from pg_policies where schemaname = 'public'
--   and replace(coalesce(qual,'') || coalesce(with_check,''), '( SELECT auth.uid() AS uid)', '') ~ 'auth\.uid\(\)';  -- 0
-- select proname, proconfig from pg_proc where proname in ('watch_summary','reorder_list','news_host_ok','touch_subscription_updated_at','my_lists');
-- select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute');  -- كان 133، صار 80
