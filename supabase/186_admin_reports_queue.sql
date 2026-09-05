-- ============================================================
--  ١٨٦ — البلاغاتُ تُرى ويُحكم فيها (D-927، تقييمُ ٥ سبتمبر:
--        «الإخفاءُ الوحيدُ في المنتج أوتوماتيكيٌّ وغيرُ مرئيٍّ ولا رجعةَ له»)
-- ============================================================
-- 🔴 **الثقبُ الذي تُغلقه هذه الهجرة**: سبعةُ جداولِ بلاغاتٍ تمتلئ،
--    و`hide_reported_review` تُخفي التقييمَ عند **عشرة بلاغات** — **بلا
--    شاشةٍ تعرضها، وبلا إخطارٍ لصاحبها، وبلا زرِّ إرجاع.** فعشرةُ حساباتٍ
--    متواطئةٍ تُخفي أيَّ مراجعةٍ ولا يعلم أحد.
--
-- 🔑 **والقرارُ يُغلق الصفَّ لا يُجمّله**: «أبقِ» و«احذف» **كلاهما يمسح
--    بلاغاتِ الهدف**. لو أُرجع المحتوى والبلاغاتُ العشرةُ باقية، **لأعاده
--    البلاغُ الحادي عشرَ إلى الإخفاء فوراً** — قرارٌ يُنقض بعد ثانيةٍ ليس
--    قراراً. **والتاريخُ لا يضيع**: العددُ والأسبابُ تُكتب في `admin_audit`
--    قبل المسح، وهو ما وُجد السجلُّ له.
--
-- 🔑 **وبلاغُ المستخدم لا فعلَ له هنا**: عقوبتُه الإيقاف، وبابُه
--    `/admin/users` — **فيُعرض ولا يُدَّعى له زرٌّ يقرّر شيئاً.**
--
-- ⚖️ **والمخفيُّ بلا بلاغاتٍ يظهر أيضاً**: صفٌّ أُخفي ثمّ مُسحت بلاغاتُه
--    يبقى مخفيّاً إلى الأبد بلا أثر — **وقائمةٌ تُظهر الطابورَ وحدَه تُخفي
--    ضحاياه.**

-- ============ ١) الطابور ============
create or replace function public.admin_reports_queue(lim int default 100)
returns table (kind text, ref jsonb, author uuid, author_name text,
               subject text, body text, reports int, reasons text,
               first_at timestamptz, last_at timestamptz, hidden boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with
  -- مراجعةُ عملٍ
  rv as (
    select 'review'::text k,
           jsonb_build_object('user', r.review_user_id, 'tmdb', r.tmdb_id, 'media', r.media_type) rf,
           r.review_user_id au, count(*)::int n,
           string_agg(distinct nullif(r.reason,''), ' · ') rs,
           min(r.created_at) fa, max(r.created_at) la
    from public.review_reports r
    group by r.review_user_id, r.tmdb_id, r.media_type
  ),
  rvx as (
    select rv.k, rv.rf, rv.au, coalesce(t.title, 'عمل ' || (rv.rf->>'tmdb')) sub,
           left(coalesce(t.review,''), 300) bd, rv.n, rv.rs, rv.fa, rv.la,
           coalesce(t.hidden,false) hd
    from rv left join public.ratings t
      on t.user_id = rv.au and t.tmdb_id = (rv.rf->>'tmdb')::int
     and t.media_type = rv.rf->>'media'
  ),
  -- مراجعةٌ مخفيّةٌ بلا بلاغاتٍ باقية
  rvh as (
    select 'review'::text, jsonb_build_object('user', t.user_id, 'tmdb', t.tmdb_id, 'media', t.media_type),
           t.user_id, coalesce(t.title,'—'), left(coalesce(t.review,''),300), 0, null::text,
           t.created_at, t.updated_at, true
    from public.ratings t
    where t.hidden and not exists (
      select 1 from public.review_reports r
      where r.review_user_id = t.user_id and r.tmdb_id = t.tmdb_id and r.media_type = t.media_type)
  ),
  -- منشورُ نقاش
  po as (
    select 'post'::text k, jsonb_build_object('id', r.post_id) rf, count(*)::int n,
           string_agg(distinct nullif(r.reason,''), ' · ') rs,
           min(r.created_at) fa, max(r.created_at) la, r.post_id pid
    from public.title_post_reports r group by r.post_id
  ),
  pox as (
    select po.k, po.rf, p.user_id, coalesce(p.title,'نقاش') , left(coalesce(p.body,''),300),
           po.n, po.rs, po.fa, po.la, coalesce(p.hidden,false)
    from po left join public.title_posts p on p.id = po.pid
  ),
  poh as (
    select 'post'::text, jsonb_build_object('id', p.id), p.user_id, coalesce(p.title,'نقاش'),
           left(coalesce(p.body,''),300), 0, null::text, p.created_at, p.created_at, true
    from public.title_posts p
    where p.hidden and not exists (select 1 from public.title_post_reports r where r.post_id = p.id)
  ),
  -- ردُّ مراجعة
  rp as (
    select 'reply'::text k, jsonb_build_object('id', r.reply_id) rf, count(*)::int n,
           string_agg(distinct nullif(r.reason,''), ' · ') rs,
           min(r.created_at) fa, max(r.created_at) la, r.reply_id rid
    from public.reply_reports r group by r.reply_id
  ),
  rpx as (
    select rp.k, rp.rf, x.user_id, 'ردٌّ على مراجعة'::text, left(coalesce(x.body,''),300),
           rp.n, rp.rs, rp.fa, rp.la, coalesce(x.hidden,false)
    from rp left join public.review_replies x on x.id = rp.rid
  ),
  -- مراجعةُ قائمة
  lr as (
    select 'list_review'::text k,
           jsonb_build_object('user', r.review_user_id, 'list', r.list_id) rf,
           r.review_user_id au, count(*)::int n, null::text rs,
           min(r.created_at) fa, max(r.created_at) la, r.list_id lid
    from public.list_review_reports r group by r.review_user_id, r.list_id
  ),
  lrx as (
    select lr.k, lr.rf, lr.au, 'مراجعةُ قائمة'::text, left(coalesce(v.body,''),300),
           lr.n, lr.rs, lr.fa, lr.la, coalesce(v.hidden,false)
    from lr left join public.list_reviews v on v.user_id = lr.au and v.list_id = lr.lid
  ),
  -- ردُّ مراجعةِ قائمة
  lp as (
    select 'list_reply'::text k, jsonb_build_object('id', r.reply_id) rf, count(*)::int n,
           string_agg(distinct nullif(r.reason,''), ' · ') rs,
           min(r.created_at) fa, max(r.created_at) la, r.reply_id rid
    from public.list_reply_reports r group by r.reply_id
  ),
  lpx as (
    select lp.k, lp.rf, x.user_id, 'ردٌّ في قائمة'::text, left(coalesce(x.body,''),300),
           lp.n, lp.rs, lp.fa, lp.la, coalesce(x.hidden,false)
    from lp left join public.list_review_replies x on x.id = lp.rid
  ),
  -- ردُّ خبر
  np as (
    select 'news_reply'::text k, jsonb_build_object('id', r.reply_id) rf, count(*)::int n,
           string_agg(distinct nullif(r.reason,''), ' · ') rs,
           min(r.created_at) fa, max(r.created_at) la, r.reply_id rid
    from public.news_reply_reports r group by r.reply_id
  ),
  npx as (
    select np.k, np.rf, x.user_id, 'ردٌّ على خبر'::text, left(coalesce(x.body,''),300),
           np.n, np.rs, np.fa, np.la, coalesce(x.hidden,false)
    from np left join public.news_post_replies x on x.id = np.rid
  ),
  -- بلاغٌ على حساب — يُعرض ولا زرَّ له هنا
  us as (
    select 'user'::text k, jsonb_build_object('user', r.target_id) rf, r.target_id au,
           count(*)::int n, string_agg(distinct nullif(r.reason,''), ' · ') rs,
           min(r.created_at) fa, max(r.created_at) la
    from public.user_reports r group by r.target_id
  ),
  usx as (
    select us.k, us.rf, us.au, 'حساب'::text, coalesce('@' || p.username, '')::text,
           us.n, us.rs, us.fa, us.la, (p.suspended_at is not null)
    from us left join public.profiles p on p.id = us.au
  ),
  all_rows as (
    select * from rvx union all select * from rvh
    union all select * from pox union all select * from poh
    union all select * from rpx union all select * from lrx
    union all select * from lpx union all select * from npx
    union all select * from usx
  )
  select a.k, a.rf, a.au,
         coalesce(pr.nickname, pr.username, left(a.au::text, 8)),
         a.sub, a.bd, a.n, a.rs, a.fa, a.la, a.hd
  from all_rows a (k, rf, au, sub, bd, n, rs, fa, la, hd)
  left join public.profiles pr on pr.id = a.au
  where public.am_admin()
  order by a.n desc, a.la desc nulls last
  limit least(greatest(coalesce(lim, 100), 1), 300);
$$;
revoke all on function public.admin_reports_queue(int) from public, anon;
grant execute on function public.admin_reports_queue(int) to authenticated;

-- ============ ٢) القرار ============
-- `keep` = المحتوى سليم ⇢ يُظهَر · `remove` = مخالف ⇢ يُخفى.
-- **وكلاهما يمسح بلاغاتِ الهدف** بعد كتابة عددِها وأسبابِها في السجلّ.
create or replace function public.admin_report_decide(p_kind text, p_ref jsonb, p_decision text)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_hide boolean; v_n int; v_reasons text;
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  if p_decision not in ('keep','remove') then raise exception 'bad_decision'; end if;
  v_hide := (p_decision = 'remove');

  if p_kind = 'review' then
    select count(*), string_agg(distinct nullif(reason,''), ' · ') into v_n, v_reasons
      from public.review_reports
     where review_user_id = (p_ref->>'user')::uuid and tmdb_id = (p_ref->>'tmdb')::int
       and media_type = p_ref->>'media';
    update public.ratings set hidden = v_hide
     where user_id = (p_ref->>'user')::uuid and tmdb_id = (p_ref->>'tmdb')::int
       and media_type = p_ref->>'media';
    delete from public.review_reports
     where review_user_id = (p_ref->>'user')::uuid and tmdb_id = (p_ref->>'tmdb')::int
       and media_type = p_ref->>'media';

  elsif p_kind = 'post' then
    select count(*), string_agg(distinct nullif(reason,''), ' · ') into v_n, v_reasons
      from public.title_post_reports where post_id = (p_ref->>'id')::uuid;
    update public.title_posts set hidden = v_hide where id = (p_ref->>'id')::uuid;
    delete from public.title_post_reports where post_id = (p_ref->>'id')::uuid;

  elsif p_kind = 'reply' then
    select count(*), string_agg(distinct nullif(reason,''), ' · ') into v_n, v_reasons
      from public.reply_reports where reply_id = (p_ref->>'id')::uuid;
    update public.review_replies set hidden = v_hide where id = (p_ref->>'id')::uuid;
    delete from public.reply_reports where reply_id = (p_ref->>'id')::uuid;

  elsif p_kind = 'list_review' then
    select count(*), null into v_n, v_reasons
      from public.list_review_reports
     where review_user_id = (p_ref->>'user')::uuid and list_id = (p_ref->>'list')::uuid;
    update public.list_reviews set hidden = v_hide
     where user_id = (p_ref->>'user')::uuid and list_id = (p_ref->>'list')::uuid;
    delete from public.list_review_reports
     where review_user_id = (p_ref->>'user')::uuid and list_id = (p_ref->>'list')::uuid;

  elsif p_kind = 'list_reply' then
    select count(*), string_agg(distinct nullif(reason,''), ' · ') into v_n, v_reasons
      from public.list_reply_reports where reply_id = (p_ref->>'id')::uuid;
    update public.list_review_replies set hidden = v_hide where id = (p_ref->>'id')::uuid;
    delete from public.list_reply_reports where reply_id = (p_ref->>'id')::uuid;

  elsif p_kind = 'news_reply' then
    select count(*), string_agg(distinct nullif(reason,''), ' · ') into v_n, v_reasons
      from public.news_reply_reports where reply_id = (p_ref->>'id')::uuid;
    update public.news_post_replies set hidden = v_hide where id = (p_ref->>'id')::uuid;
    delete from public.news_reply_reports where reply_id = (p_ref->>'id')::uuid;

  elsif p_kind = 'user' then
    -- عقوبةُ الحساب الإيقافُ، وبابُه `/admin/users` — هنا يُغلق الصفُّ فقط
    select count(*), string_agg(distinct nullif(reason,''), ' · ') into v_n, v_reasons
      from public.user_reports where target_id = (p_ref->>'user')::uuid;
    delete from public.user_reports where target_id = (p_ref->>'user')::uuid;

  else
    raise exception 'bad_kind';
  end if;

  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'report_' || p_decision,
          case when p_ref ? 'user' then (p_ref->>'user')::uuid else null end,
          jsonb_build_object('kind', p_kind, 'ref', p_ref,
                             'cleared', coalesce(v_n,0), 'reasons', v_reasons));
end;
$$;
revoke all on function public.admin_report_decide(text, jsonb, text) from public, anon;
grant execute on function public.admin_report_decide(text, jsonb, text) to authenticated;

-- ============ ٣) شارةُ الشريط تعرف البلاغات ============
-- **والمخفيُّ يُعدّ مع المنتظر**: كلاهما ينتظر حكماً، وشارةٌ تعدّ نصفَ العمل
-- تكذب. (جسمُ الدالّة كاملاً في ١٨٦ج المُشغَّلة — الأعمدةُ الستّة نفسُها
-- زائدَ `reports`.)

-- ============ فحوصٌ بعد التشغيل ============
--   select count(*) from public.admin_reports_queue(50);   -- بحساب المدير
--   select proacl::text from pg_proc
--    where proname in ('admin_reports_queue','admin_report_decide');  -- بلا anon
--   select public.admin_nav_counts()->>'reports';                     -- رقمُ الشارة
