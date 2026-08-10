-- ============================================================
--  Loopz — أغلفة وبوسترات شخصية (هجرة 54، D-131)
--  شغّلها في Supabase → SQL Editor بعد title_communities.sql (53)
--
--  الفكرة (ب٤ من بريف ٩ أغسطس): كل عملٍ في TMDB له ١٥–٤٠ ملصقاً
--  وخلفية. المستخدم يختار **أيَّها يريد أن يرى** — فيصير عملُ مكتبته
--  بوجهٍ اختاره هو.
--
--  ⚠️ لماذا جدولٌ جديد ولم نكتفِ بـ`follows.poster_path` الموجود أصلاً
--  ولكل مستخدمٍ صفُّه فيه: لأن `following_activity_v2` تقرأ
--  `f.poster_path` لبناء خطّ النشاط — فتغييرُه يسرّب اختيارَ الشخص إلى
--  **فيد كل من يتابعه**. وذلك ينقض ق٨ حرفياً: الاختيار يظهر في سطوح
--  صاحبه وحدها، ولا يمسّ ما يراه الآخرون في اكتشف أو في فيدهم. جدولٌ
--  منفصل هو الفرق بين «زينتي» و«تشويهُ ما يراه الناس».
--
--  ولا صورَ تُرفع ولا حصّةَ تخزين: **مسارُ نصٍّ من TMDB لا غير**.
-- ============================================================

create table if not exists public.title_art (
  user_id       uuid not null references auth.users (id) on delete cascade,
  tmdb_id       integer not null,
  media_type    text not null check (media_type in ('tv', 'movie')),
  /* مسار TMDB وحده (`/abc.jpg`) — والفعل يتحقّق منه بـ`safeImagePath`
     قبل الكتابة، فلا يدخل رابطٌ خارجيّ من متصفّح */
  poster_path   text,
  backdrop_path text,
  updated_at    timestamptz not null default now(),
  primary key (user_id, tmdb_id, media_type),
  /* صفٌّ لا يحمل أيّ اختيار لا معنى له — يُحذف بدل أن يبقى فارغاً */
  constraint title_art_not_empty
    check (poster_path is not null or backdrop_path is not null)
);

alter table public.title_art enable row level security;

-- صاحبها وحده يقرأ صفوفَه ويكتبها. لا سياسة قراءةٍ مفتوحة هنا —
-- ورؤية الزائر لبروفايل غيره تمرّ بدالّة definer أدناه لا بسياسة.
drop policy if exists "own art read" on public.title_art;
create policy "own art read" on public.title_art
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own art write" on public.title_art;
create policy "own art write" on public.title_art
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "own art update" on public.title_art;
create policy "own art update" on public.title_art
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own art delete" on public.title_art;
create policy "own art delete" on public.title_art
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
--  اختيارات صاحب بروفايلٍ يزوره غيره
-- ============================================================
-- بروفايل الشخص من سطوحه (ق٨)، فما اختاره يظهر فيه لزائره أيضاً —
-- لكن **خلف نفس بوابة الخصوصية** التي تحرس كل شيءٍ آخر في البروفايل.
-- `can_view_profile` هي البوابة الواحدة (D-061/D-070)، ولا باب ثانٍ.
create or replace function public.profile_title_art(p_user uuid)
returns table (tmdb_id integer, media_type text, poster_path text, backdrop_path text)
language sql
stable
security definer
set search_path = public
as $$
  select a.tmdb_id, a.media_type, a.poster_path, a.backdrop_path
  from public.title_art a
  where a.user_id = p_user
    and (auth.uid() = p_user or public.can_view_profile(p_user))
$$;
revoke all on function public.profile_title_art(uuid) from public;
grant execute on function public.profile_title_art(uuid) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select tablename from pg_tables where schemaname='public' and tablename='title_art';
-- select policyname from pg_policies where tablename='title_art';   -- المتوقَّع أربع
-- select proname from pg_proc where proname='profile_title_art';
--
-- ⚠️ السياسات المفتوحة تبقى **أربعاً** — هذه الهجرة لا تضيف خامسة:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
