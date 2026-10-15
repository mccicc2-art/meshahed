-- ============================================================
--  Loopz — 206: «dm-native» — إشعارُ الرسالة يرسمه كودُ التطبيق الأصليّ (1.12.7)
--  شغّله في Supabase → SQL Editor. آمنٌ لإعادة التشغيل. الخادمُ يعمل قبله وبعده:
--  قبله تُسقط الدالّةُ «dm-native» بصمت فيبقى كلُّ جهازٍ على الإشعار العاديّ (بلا زرّين في الخلفية) — لا شيءَ ينكسر.
--
--  لماذا: «dm-data» (الهجرة ٢٠٤، D-1408) كان لرسم الجافاسكربت، وأندرويد لا يشغّله في الخلفية. البناءُ 1.12.7 يرسم
--  الإشعارَ بكودٍ أصليٍّ (Kotlin) ويقول ذلك بقدرةٍ جديدة «dm-native» — والقيدُ والدالّةُ يعرفان «dm-data» وحدَه.
-- ============================================================

alter table public.device_tokens drop constraint if exists device_tokens_caps_known;
alter table public.device_tokens
  add constraint device_tokens_caps_known check (caps <@ array['dm-data', 'dm-native']::text[]);

create or replace function public.register_push_token(p_token text, p_platform text, p_lang text, p_caps text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_caps text[] := coalesce(array(select distinct c from unnest(coalesce(p_caps, '{}')) c where c in ('dm-data', 'dm-native')), '{}');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.device_tokens (token, user_id, platform, lang, caps)
  values (
    p_token,
    auth.uid(),
    case when p_platform = 'ios' then 'ios' else 'android' end,
    case when p_lang = 'en' then 'en' else 'ar' end,
    v_caps
  )
  on conflict (token) do update
    set user_id  = excluded.user_id,
        platform = excluded.platform,
        lang     = excluded.lang,
        caps     = excluded.caps,
        seen_at  = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text, text[]) from public, anon;
grant execute on function public.register_push_token(text, text, text, text[]) to authenticated;

-- «رد» من الإشعار (`/api/v1/widget/dm-reply`) يسأل البوّابَ نفسَه بعميل الخدمة — منحٌ صريحٌ لا اعتمادٌ على الافتراضيّ.
-- بدونه يُرفض كلُّ ردٍّ للخاص (المسارُ يعدّ خطأَ البوّاب رفضاً لا سماحاً).
grant execute on function public.can_message(uuid, uuid) to service_role;

-- ===== الفحصُ بعد التشغيل =====
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'device_tokens_caps_known';   -- فيها dm-native
-- بعد أن يفتح جهازُ أندرويد ببناء 1.12.7 التطبيق:
-- select platform, caps, seen_at from public.device_tokens order by seen_at desc limit 5;          -- {dm-native}
