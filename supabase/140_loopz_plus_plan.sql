-- 140: Loopz+ (D-633) — بنيةُ الخطط، بلا لمسِ صفٍّ قائم.
--
-- ثلاثُ قيمٍ لا اثنتان: `partner` تدخل الآن **وإن لم تُبنَ سطوحُها بعد**
-- — إضافةُ قيمةٍ إلى قيدٍ قائمٍ لاحقاً تعني هجرةً ثانيةً على جدولٍ حيّ،
-- **والقيمةُ التي لا يكتبها أحدٌ لا تكلّف شيئاً.**
--
-- و`plus_until` منفصلةٌ عن `plan` عمداً: **الخطّةُ ما اشتراه، والتاريخُ
-- إلى متى** — ودمجُهما يجعل انتهاءَ الاشتراك حدفاً لهويّةِ ما اشترى.
-- و`founder` صفتٌ لا خطّة: **تبقى بعد أيِّ تغييرٍ في الخطّة** (بإذن أحمد
-- الصريح: «نعم امنح المؤسسين»).
alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists plus_until timestamptz,
  add column if not exists founder boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_plan_check') then
    alter table public.profiles
      add constraint profiles_plan_check check (plan in ('free', 'plus', 'partner'));
  end if;
end $$;

-- ⚠️ **والعرضُ يُعاد كما هو حرفاً ويُذيَّل بعمودين** — لا يُعاد ترتيبُه:
-- Postgres يرفض تبديلَ أسماء أعمدةِ عرضٍ قائم، **وقارئوه يسمّون أعمدةً
-- بعينها.** وقناعُ `hide_name` يبقى كما كتبه D-011.
-- **و`plus_until` لا تدخل العرض**: الشارةُ تُرى والتاريخُ لا يُرى — فلا
-- يعرف الناسُ متى ينتهي اشتراكُ غيرهم.
create or replace view public.public_profiles as
  select
    id,
    case when coalesce(hide_name, false) and id is distinct from auth.uid() then null::text
         else nickname end as nickname,
    case when coalesce(hide_name, false) and id is distinct from auth.uid() then null::text
         else username end as username,
    case when coalesce(hide_name, false) and id is distinct from auth.uid() then null::text
         else avatar_url end as avatar_url,
    cover_url,
    favorite_genres,
    coalesce(hide_name, false) as hide_name,
    cover_pos,
    avatar_pos,
    case when coalesce(hide_name, false) and id is distinct from auth.uid() then null::text
         else bio end as bio,
    coalesce(is_private, false) as is_private,
    coalesce(hide_follow_lists, false) as hide_follow_lists,
    profile_prefs,
    plan,
    founder
  from profiles p;

grant select on public.public_profiles to anon, authenticated;