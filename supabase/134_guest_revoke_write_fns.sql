-- 134: تصفّح الضيف (D-627 مرحلة ٣) — سحبُ EXECUTE من anon على دوالّ
-- الكتابة المعرَّفة الخاصّة بأفعال المستخدم. كلُّها محروسةٌ داخليّاً
-- بـauth.uid()، والسحبُ طبقةُ دفاعٍ ثانية بعد فتح التصفّح للزوّار.
--
-- ما لا يُمسّ عمداً:
--   * دوالُّ القراءة كلُّها (الزائر يقرأ بها الآن).
--   * دوالُّ التوليد (set_news_posts، set_imdb_pool، build_imdb_chart…)
--     — تعمل من مسارات الخادم بلا جلسة مستخدم.
--   * log_provider_event — موثَّقٌ في actions.ts: «لا requireUser،
--     الزائرُ يضغط البطاقةَ أيضاً».
--   * دوالُّ الترغرز (handle_new_user، *_reports_hide، *_depth_guard).
do $$
declare
  fn text;
  r record;
begin
  foreach fn in array array[
    'accept_community_invite',
    'accept_follow_request',
    'accept_join_request',
    'admin_set_provider_link',
    'block_user',
    'claim_referral',
    'clear_episode_rating',
    'delete_my_account',
    'join_community',
    'mark_feed_seen',
    'remove_follower',
    'request_or_follow',
    'set_episode_rating',
    'set_featured_list',
    'set_global_room_pin',
    'toggle_favorite',
    'upsert_curated_list',
    'qualify_referral'
  ] loop
    for r in
      select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    loop
      execute format('revoke execute on function %s from anon', r.sig);
    end loop;
  end loop;
end $$;