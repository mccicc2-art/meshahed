-- ============================================================
--  Loopz — 204: ما يقدر عليه كلُّ جهازٍ من الإشعارات (D-1408)
--  شغّله في Supabase → SQL Editor. آمنٌ لإعادة التشغيل. الخادمُ يعمل قبله وبعده (يرجع للدالّة القديمة إن غابت الجديدة).
--
--  لماذا: أندرويد يعرض إشعارَ Expo بنفسه والتطبيقُ في الخلفية — فلا زرّا «رد» و«تمييز كمقروءة» (تجربةُ أحمد ١٥ أكتوبر،
--  بناء 82). الحلُّ كالواتس: الخادمُ يرسل الرسالةَ «بياناتٍ» والتطبيقُ يرسم الإشعارَ بزرّيه. لكنّ بناءً أقدمَ يستلم البياناتِ
--  ولا يرسم شيئاً — فالخادمُ لا يرسل بالطريقة الجديدة إلّا لجهازٍ قال إنّه يقدر: `caps` تحوي «dm-data».
--
--  - العمودُ يُكتب مع كلِّ تسجيلٍ (كلَّ إقلاع): نسخةٌ أقدمُ على الجهاز نفسِه تمسحه فيرجع للطريقة القديمة.
--  - القيمُ محصورةٌ بقائمةٍ معروفة (القيد) — لا نصٌّ حرٌّ من الجهاز.
-- ============================================================

alter table public.device_tokens
  add column if not exists caps text[] not null default '{}';

alter table public.device_tokens drop constraint if exists device_tokens_caps_known;
alter table public.device_tokens
  add constraint device_tokens_caps_known check (caps <@ array['dm-data']::text[]);

-- الدالّةُ الجديدة بأربعة معاملات — القديمةُ (ثلاثة) تبقى لنسخة الخادم السابقة ولا تلمس `caps`
create or replace function public.register_push_token(p_token text, p_platform text, p_lang text, p_caps text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_caps text[] := coalesce(array(select distinct c from unnest(coalesce(p_caps, '{}')) c where c = 'dm-data'), '{}');
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

-- ===== الفحصُ بعد التشغيل =====
-- select column_name from information_schema.columns where table_name = 'device_tokens' and column_name = 'caps';   -- ١
-- select count(*) from pg_proc where proname = 'register_push_token';                                               -- ٢
