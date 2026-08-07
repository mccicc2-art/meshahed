-- ============================================================
--  Loopz — نبذة الملف الشخصي (bio)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر الكود الذي يقرأ العمود أو يكتبه.
-- ============================================================

-- سطرٌ أو سطران لا صفحة: النبذة تُقرأ تحت الاسم في بطاقةٍ ضيّقة، وفقرةٌ
-- كاملة تكسر البطاقة في كل موضع تظهر فيه. ١٦٠ حرفاً حدُّ ما يُقرأ بلمحة.
alter table public.profiles
  add column if not exists bio text;

alter table public.profiles
  drop constraint if exists profiles_bio_len;

alter table public.profiles
  add constraint profiles_bio_len
  check (bio is null or length(btrim(bio)) <= 160);

-- ============================================================
--  إظهارها في العرض العامّ
--
--  النبذة تتبع الاسم في الإخفاء: من أخفى اسمه أخفى تعريفه بنفسه معه —
--  وإلا صار «مصمّم من الرياض» تعريفاً كافياً لمن أراد أن يبقى مجهولاً.
--
--  والعمود يُضاف في **ذيل** العرض لا في وسطه: `create or replace view`
--  لا يقبل عموداً جديداً في وسط عرضٍ قائم (نفس سبب موضع cover_pos
--  و avatar_pos في image_positions.sql).
-- ============================================================
create or replace view public.public_profiles
with (security_invoker = false)
as
  select
    p.id,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.nickname end   as nickname,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.username end   as username,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.avatar_url end as avatar_url,
    p.cover_url,
    p.favorite_genres,
    coalesce(p.hide_name, false) as hide_name,
    p.cover_pos,
    p.avatar_pos,
    case when coalesce(p.hide_name, false) and p.id is distinct from auth.uid()
         then null else p.bio end        as bio
  from public.profiles p;

revoke all on public.public_profiles from public, anon;
grant select on public.public_profiles to authenticated;

-- التحقّق بعد التشغيل:
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name='profiles' and column_name='bio';
--   select column_name from information_schema.columns
--   where table_schema='public' and table_name='public_profiles' and column_name='bio';
