-- 195 — إشعاراتُ الدفع (Push): رموزُ الأجهزة · تفضيلاتُ الأنواع · سجلُّ ما أُرسل (D-1305)
--
-- قرارُ أحمد (٦ أكتوبر ٢٠٢٦): كلُّ الأحداث — رسالة · متابعة وطلبُها · ردّ وإعجاب · حلقةٌ جديدة لعملٍ يتابعه.
-- الإرسالُ من الخادم عبر خدمة Expo (مفتاحُ FCM V1 عند Expo لا عندنا)، فالقاعدةُ تحمل ثلاثةَ أشياء فقط:
--
--   device_tokens — رمزُ Expo لكلِّ جهاز ولغتُه. **الرمزُ هو المفتاح** لا (المستخدم، الرمز): جهازٌ واحدٌ
--                   لحسابٍ واحدٍ في كلِّ لحظة — من دخل بعدك على الجهاز نفسِه يأخذ صفَّه، فلا تصل إشعاراتُك
--                   إلى شاشةٍ لم تعد لك.
--   push_prefs    — ما كتمه صاحبُه من الأنواع (مصفوفةُ أسماء). غيابُ الصفّ = الكلُّ مفعَّل.
--   push_sent     — مفتاحٌ لكلِّ ما أُرسل: إعجابٌ يُسحب ويُعاد لا يرنّ مرّتين، وحلقةُ اليوم لا تُعلَن مرّتين،
--                   ودورةُ الحلقات لا تجري مرّتين في نافذتها (التجديدُ بحركة المرور، بلا cron — نمطُ D-210).
--
-- 🔒 **قراءةُ رموزِ غيرك للخادم وحدَه** (`service_role`): رمزُ Expo يُرسَل إليه بلا مفتاحٍ منّا، فتسريبُه بابُ
-- إزعاج. لذلك: سياسةُ القراءة لصاحب الصفّ وحدَه، والتسجيلُ والنسيانُ بدالّتَي `definer` لا بكتابةٍ مباشرة
-- (التسجيلُ ينقل صفّاً من حسابٍ إلى حساب — وسياسةٌ تسمح بذلك تسمح بأكثر منه).
--
-- إضافاتٌ فقط: ثلاثةُ جداول ودالّتان. لا `drop` ولا `revoke` على شيءٍ قائم، ولا صفَّ قائماً يُمسّ.
--
-- شُغّلت على الإنتاج ٦ أكتوبر ٢٠٢٦ بإذن أحمد («ااذن لك ب 1») بهذا النصّ حرفاً، بعد تجربتها على `loopz-preview`.
-- لا تُعاد كما هي على قاعدةٍ فيها السياستان (`create policy` الثانية تفشل ولا تُفسد شيئاً).

create table if not exists public.device_tokens (
  token      text primary key
             check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_:\-]{8,200}\]$'),
  user_id    uuid not null references auth.users (id) on delete cascade,
  platform   text not null default 'android' check (platform in ('android', 'ios')),
  lang       text not null default 'ar' check (lang in ('ar', 'en')),
  created_at timestamptz not null default now(),
  seen_at    timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens (user_id);

alter table public.device_tokens enable row level security;

create policy "own device tokens (read)"
  on public.device_tokens for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.device_tokens from anon;
revoke insert, update, delete, truncate on public.device_tokens from authenticated;

create table if not exists public.push_prefs (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  muted      text[] not null default '{}'
             check (muted <@ array['messages', 'follows', 'likes', 'replies', 'episodes']::text[]),
  updated_at timestamptz not null default now()
);

alter table public.push_prefs enable row level security;

create policy "own push prefs"
  on public.push_prefs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

revoke all on public.push_prefs from anon;

create table if not exists public.push_sent (
  key text primary key check (char_length(key) between 1 and 200),
  at  timestamptz not null default now()
);

create index if not exists push_sent_at_idx on public.push_sent (at);

-- بلا سياسة: لا يقرؤه ولا يكتبه إلّا الخادمُ بمفتاح الخدمة
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- تسجيلُ جهازي: يُدرج الصفَّ أو ينقله إليّ (دخولُ حسابٍ آخر على الجهاز نفسِه) ويحدّث اللغة.
create or replace function public.register_push_token(p_token text, p_platform text, p_lang text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.device_tokens (token, user_id, platform, lang)
  values (
    p_token,
    auth.uid(),
    case when p_platform = 'ios' then 'ios' else 'android' end,
    case when p_lang = 'en' then 'en' else 'ar' end
  )
  on conflict (token) do update
    set user_id  = excluded.user_id,
        platform = excluded.platform,
        lang     = excluded.lang,
        seen_at  = now();
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;

-- نسيانُ جهاز عند الخروج. **بلا جلسة عمداً**: الخروجُ يسبق النداء، ومن يحمل الرمزَ هو الجهازُ نفسُه.
-- أسوأُ ما يفعله من عرف رمزَ غيره أن يوقف إشعاراتِه حتى يفتح التطبيقَ ثانيةً.
create or replace function public.forget_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.device_tokens where token = p_token;
$$;

revoke all on function public.forget_push_token(text) from public;
grant execute on function public.forget_push_token(text) to anon, authenticated;

-- ===== الفحصُ بعد التشغيل =====
-- select table_name from information_schema.tables
--  where table_schema = 'public' and table_name in ('device_tokens', 'push_prefs', 'push_sent');   -- ٣
-- select proname from pg_proc where proname in ('register_push_token', 'forget_push_token');       -- ٢
-- select count(*) from pg_policies where qual = 'true';                                            -- كما كان قبلها
