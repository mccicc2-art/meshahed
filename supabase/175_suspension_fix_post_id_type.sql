-- ============================================================
--  ١٧٥ — إصلاحُ نوعِ معرّف المنشور في دالّتَي الإيقاف (D-901)
-- ============================================================
-- 🔴 **عطلٌ كان سيسقط أوّلَ ضغطةِ «إيقاف» في الإنتاج، ولم يكن ليظهر قبلها.**
-- كُتب في ١٧٣ `v_posts bigint[]` **على افتراضٍ لم يُقَس**، و`title_posts.id`
-- نوعُه **`uuid`** — فترمي الدالّةُ
-- `42846: COALESCE could not convert type bigint[] to uuid[]`.
--
-- **كشفه اختبارُ دورةٍ كاملة** (إيقافٌ ثمّ فكٌّ) نُفِّذت على القاعدة الحيّة
-- **داخل ترانزاكشن رُوجع** — لا على الورق ولا بعد الشحن.
-- **والدرسُ: نوعُ عمودٍ يُقرأ من الجدول لا يُفترض من اسمه.**
--
-- ⚠️ **و١٧٣ تُترك كما شُحنت ولا تُصحَّح في مكانها**: ملفُّ الهجرة سجلُّ ما
-- جرى — **وتعديلُه بأثرٍ رجعيّ يجعل الملفَّ يكذب على من يقرأ التاريخ.**
-- بيئةٌ جديدةٌ تُشغّل ١٧٣ ثمّ ١٧٥ فتصل إلى الصواب، والسجلُّ يبقى صادقاً.

create or replace function public.admin_suspend_user(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare
  v_posts uuid[];   -- 🔴 كانت bigint[]
  v_lists uuid[];
begin
  if not public.am_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'cannot_suspend_self' using errcode = '22023';
  end if;
  if coalesce((select is_admin from public.profiles where id = p_user), false) then
    raise exception 'cannot_suspend_admin' using errcode = '22023';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if (select suspended_at from public.profiles where id = p_user) is not null then
    raise exception 'already_suspended' using errcode = '22023';
  end if;

  update public.profiles
     set suspended_at = now(), suspended_reason = btrim(p_reason), suspended_by = auth.uid()
   where id = p_user;

  with flipped as (
    update public.title_posts set hidden = true
     where user_id = p_user and hidden = false
     returning id
  ) select coalesce(array_agg(id), '{}'::uuid[]) into v_posts from flipped;

  with flipped as (
    update public.user_lists set is_public = false
     where user_id = p_user and is_public = true
     returning id
  ) select coalesce(array_agg(id), '{}'::uuid[]) into v_lists from flipped;

  update auth.users set banned_until = 'infinity'::timestamptz where id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;

  perform public.log_admin('suspend_user', p_user, jsonb_build_object(
    'reason', btrim(p_reason),
    'posts',  to_jsonb(v_posts),
    'lists',  to_jsonb(v_lists)));
end;
$$;

create or replace function public.admin_unsuspend_user(p_user uuid)
returns void language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_detail jsonb;
begin
  if not public.am_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if (select suspended_at from public.profiles where id = p_user) is null then
    raise exception 'not_suspended' using errcode = '22023';
  end if;

  select a.detail into v_detail
    from public.admin_audit a
   where a.action = 'suspend_user' and a.target = p_user
   order by a.at desc
   limit 1;

  update public.profiles
     set suspended_at = null, suspended_reason = null, suspended_by = null
   where id = p_user;

  if v_detail ? 'posts' then
    update public.title_posts set hidden = false
     where user_id = p_user
       and id in (select (jsonb_array_elements_text(v_detail -> 'posts'))::uuid);  -- 🔴 كانت ::bigint
  end if;
  if v_detail ? 'lists' then
    update public.user_lists set is_public = true
     where user_id = p_user
       and id in (select (jsonb_array_elements_text(v_detail -> 'lists'))::uuid);
  end if;

  update auth.users set banned_until = null where id = p_user;

  perform public.log_admin('unsuspend_user', p_user, coalesce(v_detail, '{}'::jsonb));
end;
$$;

revoke all on function public.admin_suspend_user(uuid, text) from public, anon;
revoke all on function public.admin_unsuspend_user(uuid)     from public, anon;
grant execute on function public.admin_suspend_user(uuid, text) to authenticated;
grant execute on function public.admin_unsuspend_user(uuid)     to authenticated;
