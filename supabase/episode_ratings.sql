-- ============================================================
--  Loopz — تقييم الحلقات (D-139) — رقم ٥٢
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  **لماذا جدولٌ ثانٍ ولا يكفي `ratings`:** مفتاح `ratings` هو
--  (مستخدم + عمل + نوع)، ولا موضع فيه للموسم والحلقة. وتوسيعُه بعمودين
--  يُبطل مفتاحه الأوّليّ ويكسر كل قارئٍ له — والقرّاء عشرة. جدولٌ أخوه
--  أسلم، وهو ما تفعله Serializd نفسها: رأيٌ في الحلقة ورأيٌ في المسلسل
--  شيئان مختلفان لا درجتان من شيء.
--
--  **قرار أحمد (٩ Aug): التقييم يعني المشاهدة.** لا تُقيَّم حلقةٌ لم
--  تُشاهَد — الحالة «مقيَّمة وغير مشاهَدة» لا معنى لها عند المستخدم، وهي
--  أوّل ما يُبلَّغ عنه عطلاً. لذلك الكتابة تمرّ بدالّةٍ واحدة تكتب
--  الصفَّين معاً في معاملةٍ واحدة، لا بنداءَين من العميل قد ينجح أحدهما.
--
--  **والخصوصية كغيرها:** القراءة عن شخصٍ آخر تمرّ بـ`can_view_profile`،
--  والجدول نفسه مغلقٌ على صاحبه — لا سياسة قراءةٍ مفتوحة خامسة.
-- ============================================================

create table if not exists public.episode_ratings (
  user_id        uuid not null references auth.users (id) on delete cascade,
  show_tmdb_id   integer not null,
  season_number  smallint not null,
  episode_number smallint not null,
  rating         smallint not null check (rating between 1 and 10),
  /* المراجعة اختيارية وقصيرة: رأيٌ في حلقةٍ واحدة لا مقال. والحدُّ هنا
     كالحدّ في `ratings` — يُفرض في الواجهة أيضاً كي تكون الرسالة للمستخدم
     لا رسالة قاعدة بيانات */
  review         text check (review is null or length(review) <= 2000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, show_tmdb_id, season_number, episode_number)
);

alter table public.episode_ratings enable row level security;

-- صفوفك أنت وحدها مباشرةً؛ وقراءةُ غيرك عبر الدالّة أدناه (D-012)
drop policy if exists "own episode ratings" on public.episode_ratings;
create policy "own episode ratings" on public.episode_ratings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

/* فهرسٌ للقراءة بالمسلسل: كل استعلاماتنا «تقييماتي في هذا المسلسل»،
   والمفتاح الأوّليّ يخدمها أصلاً بادئةً (user_id, show_tmdb_id).
   والفهرس الزمنيّ لخطّ النشاط — بلا شرطٍ زمنيّ يمسح الجدول كاملاً */
create index if not exists episode_ratings_recent_idx
  on public.episode_ratings (user_id, updated_at desc);

-- ============================================================
--  الكتابة: تقييمٌ ومشاهدةٌ في معاملةٍ واحدة
-- ============================================================
create or replace function public.set_episode_rating(
  p_show      integer,
  p_season    integer,
  p_episode   integer,
  p_rating    integer,
  p_review    text default null,
  p_runtime   integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'auth required';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 10 then
    raise exception 'rating out of range';
  end if;

  insert into public.episode_ratings
    (user_id, show_tmdb_id, season_number, episode_number, rating, review)
  values (uid, p_show, p_season, p_episode, p_rating, nullif(btrim(p_review), ''))
  on conflict (user_id, show_tmdb_id, season_number, episode_number) do update
    set rating     = excluded.rating,
        review     = excluded.review,
        updated_at = now();

  /* **المشاهدة تتبع التقييم ولا تُعاد كتابتها إن سبقت** (`do nothing`):
     إعادةُ الطابع الزمني هنا تنقل حلقةً شاهدتَها العام الماضي إلى يوميات
     اليوم لمجرّد أنك قيّمتها الآن — كذبٌ في السجلّ. */
  insert into public.watched_episodes
    (user_id, show_tmdb_id, season_number, episode_number, runtime)
  values (uid, p_show, p_season, p_episode, p_runtime)
  on conflict (user_id, show_tmdb_id, season_number, episode_number) do nothing;
end;
$$;

revoke all on function public.set_episode_rating(integer, integer, integer, integer, text, integer) from public;
grant execute on function public.set_episode_rating(integer, integer, integer, integer, text, integer) to authenticated;

-- ============================================================
--  الحذف — إزالةُ الرأي وحدها، والمشاهدة تبقى
--
--  «سحبتُ تقييمي» ليست «لم أشاهدها»: من يمسح رأيه في حلقةٍ شاهدها لا
--  يقصد محو سجلّ مشاهدتها ولا خفضَ عدّاد وقته.
-- ============================================================
create or replace function public.clear_episode_rating(
  p_show integer, p_season integer, p_episode integer
)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.episode_ratings
  where user_id = auth.uid()
    and show_tmdb_id = p_show
    and season_number = p_season
    and episode_number = p_episode;
$$;

revoke all on function public.clear_episode_rating(integer, integer, integer) from public;
grant execute on function public.clear_episode_rating(integer, integer, integer) to authenticated;

-- ============================================================
--  القراءة: تقييمات شخصٍ في مسلسلٍ واحد
--
--  تخدم سطحين: حلقاتي في صفحة المسلسل (p_user = أنا)، ومتوسّط الحلقات
--  عند من أتابعه لاحقاً. البوّابة أوّلَ سطر كبقيّة دوال الملف.
-- ============================================================
create or replace function public.episode_ratings_of(p_user uuid, p_show integer)
returns table (
  season_number  smallint,
  episode_number smallint,
  rating         smallint,
  review         text,
  updated_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select er.season_number, er.episode_number, er.rating, er.review, er.updated_at
  from public.episode_ratings er
  where er.user_id = p_user
    and er.show_tmdb_id = p_show
    and public.can_view_profile(p_user)
  order by er.season_number, er.episode_number;
$$;

revoke all on function public.episode_ratings_of(uuid, integer) from public;
grant execute on function public.episode_ratings_of(uuid, integer) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select tablename, policyname from pg_policies
-- where schemaname='public' and tablename='episode_ratings';
-- -- سياسةٌ واحدة (own episode ratings)، ولا يجوز ظهور الجدول في qual='true'
--
-- select proname, prosecdef from pg_proc
-- where proname in ('set_episode_rating','clear_episode_rating','episode_ratings_of');
-- -- ثلاثٌ، كلّها prosecdef = true
--
-- select tablename, policyname from pg_policies
-- where schemaname='public' and qual='true';
-- -- تبقى **أربعاً**: user_follows · communities · imdb_ratings · imdb_chart
