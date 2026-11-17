-- 248 — «امنح Loopz+» من لوحة الإدارة (المهمة ٤٠١، أحمد ١٨ نوفمبر: «١أ نفذ شكل الاشعار المقترح»)
--
-- لماذا: المنحةُ اليدويّة كانت سطرَ SQL خاماً (صفٌّ `manual` في `subscriptions`)، فلا يعرف الممنوحُ بها: لا إشعارَ ولا سطر.
-- منح عضوين ١٧ نوفمبر فلم يبلغهما شيء. الآن تُمنح من `/admin/users` بزرّ، والخادمُ يرسل بعدها إشعارَ «هدية من Loopz».
--
-- ما تغيّر:
--   `admin_grant_plus(p_user, p_until, p_reason)` — صفُّ `manual` بخطّة `plus` حتى `p_until`، و`recompute_plan` (مشغّلُ
--   `subscriptions_sync_plan`، ٢٣٨) يحسب `plus_until` من كلِّ الصفوف كما يحسب أيَّ منحة. يعيد `plus_until` بعدها.
--
-- 🔑 الحارسُ في جسم الدالّة لا في الواجهة (D-011)، نمطُ `admin_set_admin` (١٨٩) حرفاً:
--   - `am_admin()` وحدَه يمنح · السببُ إلزاميّ (٣ أحرفٍ فأكثر) · سطرٌ في `admin_audit` (`grant_plus`).
--   - النهايةُ في المستقبل وخلال سنتين: منحةٌ أطولُ قرارٌ لا يُتّخذ بخانة تاريخ (Gold الدائمةُ تبقى SQL خاماً بقصد).
--   - لا منحةَ لحساب نظام ولا لموقوف.
--   - صفٌّ يدويٌّ لا يحمل `partner_id` ولا `subscribed_at`: لا عمولةَ ولا مكافأةَ دعوة (D-1657: المكافأةُ تحتاج دفعاً حقيقيّاً).
--
-- التراجع:
--   drop function if exists public.admin_grant_plus(uuid, timestamptz, text);
--   (الصفوفُ التي منحتها تبقى منحاً صحيحة؛ تُسحب بحذف صفِّها `provider = 'manual'` فيعيد المشغّلُ الحساب.)

create or replace function public.admin_grant_plus(p_user uuid, p_until timestamptz, p_reason text)
returns timestamptz
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_sys    boolean;
  v_susp   timestamptz;
  v_until  timestamptz;
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  if p_user is null then raise exception 'bad_user'; end if;
  if char_length(v_reason) < 3 then raise exception 'reason_required'; end if;
  if p_until is null or p_until <= now() then raise exception 'until_in_past'; end if;
  if p_until > now() + interval '2 years' then raise exception 'until_too_far'; end if;

  select is_system, suspended_at into v_sys, v_susp from public.profiles where id = p_user;
  if not found then raise exception 'no_such_user'; end if;
  if v_sys then raise exception 'system_account'; end if;
  if v_susp is not null then raise exception 'user_suspended'; end if;

  insert into public.subscriptions (user_id, provider, plan, status, current_period_end)
  values (p_user, 'manual', 'plus', 'active', p_until);

  select plus_until into v_until from public.profiles where id = p_user;

  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), 'grant_plus', p_user,
          jsonb_build_object('until', p_until, 'plus_until', v_until, 'reason', v_reason));
  return v_until;
end;
$$;

revoke all on function public.admin_grant_plus(uuid, timestamptz, text) from public, anon;
grant execute on function public.admin_grant_plus(uuid, timestamptz, text) to authenticated;

-- ═══ التحقُّق (يُشغَّل بعدها، ويُقرأ بالعين) ═════════════════
-- select pg_get_function_identity_arguments(p.oid) args, p.prosecdef definer,
--        (select string_agg(distinct r.rolname, ',') from aclexplode(p.proacl) x
--           join pg_roles r on r.oid = x.grantee where x.privilege_type = 'EXECUTE') grantees
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'public' and p.proname = 'admin_grant_plus';
-- المتوقَّع: صفٌّ واحد · definer = true · لا `anon` في المنح.
-- وبعد أوّل منحة: select action, detail from public.admin_audit where action = 'grant_plus' order by at desc limit 5;
