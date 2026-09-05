-- ============================================================
--  ١٨٧ — الإدارةُ تُمنح وتُسحب، والمحتوى يُرى قبل الحكم (D-928)
-- ============================================================
-- 🔴 **الفجوتان (٢) و(٣) من تقييم ٥ سبتمبر**:
--    - `profiles.is_admin` كان يُبدَّل بـ**SQL خام وحدَه** — **ومالكُ المنتج
--      لا يستطيع أن يعيّن مديراً ولا أن يعزله بنفسه**؛ صار KHLD مديراً بيدِ
--      المساعد لا بيد أحمد.
--    - و`/admin/users` تُوقف الحسابَ ولا تُرِي ما كتبه — **وقرارُ إيقافٍ بلا
--      نظرةٍ إلى الفعل قرارٌ على العمياء.**
--
-- ⚠️ **ولا يغيّر المرءُ صلاحيةَ نفسِه** (`cannot_change_self`): **مديرٌ يسحب
--    صلاحيتَه بضغطةٍ يقفل البابَ على نفسِه ولا أحدَ يفتحه** — ولا زرَّ
--    استرجاعٍ في منتجٍ حارسُه في القاعدة. (ونظيرُها القائمُ في
--    `admin_suspend_user`: `cannot_suspend_self`.)
--
-- 🔑 **والقراءةُ لا تُجلب إلا لمن فُتحت نافذتُه**: الواجهةُ تنادي
--    `admin_user_content` بمعرِّفٍ واحدٍ عند الطلب، **لا لكلِّ نتيجةِ بحث** —
--    ثمنٌ يُدفع في كلِّ فتحةٍ لأجل صفٍّ واحدٍ يُقرأ.
--
-- ⚖️ **ولا فعلَ في نافذة المحتوى**: تُعرض ويُحكم في المخفيِّ من `/admin/reports`
--    — **بابان لفعلٍ واحدٍ يفترقان عند أوّل تعديل.**

create or replace function public.admin_set_admin(p_user uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_was boolean;
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  if p_user is null then raise exception 'bad_user'; end if;
  if p_user = auth.uid() then raise exception 'cannot_change_self'; end if;

  select is_admin into v_was from public.profiles where id = p_user;
  if v_was is null then raise exception 'no_such_user'; end if;
  if v_was = coalesce(p_on, false) then return; end if;

  update public.profiles set is_admin = coalesce(p_on, false) where id = p_user;

  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(),
          case when p_on then 'grant_admin' else 'revoke_admin' end,
          p_user, jsonb_build_object('was', v_was));
end;
$$;
revoke all on function public.admin_set_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;

create or replace function public.admin_user_content(p_user uuid, lim int default 40)
returns table (kind text, at timestamptz, title text, body text, hidden boolean, ref jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select * from (
    select 'review'::text, r.updated_at, coalesce(r.title,'—'),
           left(coalesce(r.review,''), 240), coalesce(r.hidden,false),
           jsonb_build_object('tmdb', r.tmdb_id, 'media', r.media_type)
    from public.ratings r
    where r.user_id = p_user and coalesce(r.review,'') <> ''
    union all
    select 'post', p.created_at, coalesce(p.title,'نقاش'),
           left(coalesce(p.body,''), 240), coalesce(p.hidden,false),
           jsonb_build_object('id', p.id)
    from public.title_posts p where p.user_id = p_user
    union all
    select 'reply', x.created_at, 'ردٌّ على مراجعة',
           left(coalesce(x.body,''), 240), coalesce(x.hidden,false),
           jsonb_build_object('id', x.id)
    from public.review_replies x where x.user_id = p_user
    union all
    select 'list', l.created_at, coalesce(l.name,'قائمة'),
           coalesce(l.subtitle,''), false,
           jsonb_build_object('id', l.id, 'public', l.is_public)
    from public.user_lists l where l.user_id = p_user
  ) q (kind, at, title, body, hidden, ref)
  where public.am_admin()
  order by q.at desc nulls last
  limit least(greatest(coalesce(lim, 40), 1), 200);
$$;
revoke all on function public.admin_user_content(uuid, int) from public, anon;
grant execute on function public.admin_user_content(uuid, int) to authenticated;

-- ============ فحوصٌ بعد التشغيل ============
--   select count(*) from public.admin_user_content('<uuid>', 40);   -- بحساب المدير
--   select public.admin_set_admin(auth.uid(), false);               -- يرفع cannot_change_self
--   select proacl::text from pg_proc
--    where proname in ('admin_set_admin','admin_user_content');     -- بلا anon
