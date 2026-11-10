-- 243 — البحثُ بوصف القصّة لبلس، وللمجانيّ ثلاثُ تجاربَ مدى الحياة (أحمد ١٠ نوفمبر: «١ أ / ٢ أ / ٣ أ»)
--
-- لماذا: كلُّ بحثٍ بالوصف يكلّف نداءَ نموذجٍ وعشرةَ نداءاتِ TMDB، وهو أوضحُ ما يُشعر بقيمة Plus. فالمجانيُّ يجرّبه
-- ثلاثَ مرّاتٍ ثم يُدعى للاشتراك. وتُحسب التجربةُ **إذا رجع البحثُ بنتائج** فقط (١ أ): وصفٌ قصيرٌ أو «لم أجد»
-- لا يأكل من رصيده. والرصيدُ مدى الحياة لا شهريّ (٣ أ)، ويبدأ الجميعُ اليوم من ثلاث (لا صفوفَ سابقة).
--
-- الجدولُ للخادم وحده: RLS مفعّلةٌ بلا سياسات، ولا صلاحيّةَ لـanon/authenticated — فلا يقرأ العضوُ عدّادَه
-- ولا يصفّره من التطبيق. الزيادةُ ذرّيّةٌ في دالّةٍ واحدة (insert … on conflict) فلا يضيع عدٌّ بين طلبين.
--
-- آمنٌ للتكرار. الكودُ يعمل قبلها: إن غاب الجدولُ فالقراءةُ تفشل فيُفتح البحثُ (لا نقفل ميزةً بعطلٍ عندنا).

create table if not exists public.ai_story_trials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  used int not null default 0 check (used >= 0),
  updated_at timestamptz not null default now()
);

alter table public.ai_story_trials enable row level security;
revoke all on table public.ai_story_trials from anon, authenticated;

create or replace function public.ai_story_trial_bump(p_user uuid)
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.ai_story_trials as t (user_id, used, updated_at)
  values (p_user, 1, now())
  on conflict (user_id) do update set used = t.used + 1, updated_at = now()
  returning t.used;
$$;

revoke all on function public.ai_story_trial_bump(uuid) from public, anon, authenticated;
grant execute on function public.ai_story_trial_bump(uuid) to service_role;

-- التحقّق
select
  to_regclass('public.ai_story_trials') is not null as trials_table,
  (select relrowsecurity from pg_class where oid = 'public.ai_story_trials'::regclass) as rls_on,
  not has_table_privilege('authenticated', 'public.ai_story_trials', 'select') as members_cannot_read,
  not has_function_privilege('authenticated', 'public.ai_story_trial_bump(uuid)', 'execute') as members_cannot_bump,
  has_function_privilege('service_role', 'public.ai_story_trial_bump(uuid)', 'execute') as server_can_bump;
