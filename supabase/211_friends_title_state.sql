-- ============================================================
--  Loopz — 211: حالُ صديقك مع العمل في «ماذا يشاهد أصدقاؤك» (D-1445)
--  أحمد ١٦ أكتوبر: «كيف الواحد يفرّق بين اللي قيّم واللي شاهد بس والحلقة» — «يهمّني تقييمه وأنه شاهد».
--  شغّله في Supabase → SQL Editor. آمنٌ لإعادة التشغيل. **الواجهةُ تعمل قبله وبعده**: قبله تُبنى الشارةُ من خطّ النشاط
--  (تقييمُ آخر ٣٠ يوماً · الموسمُ بلا حلقة)، وبعده من هنا (التقييمُ أيّاً كان وقتُه · آخرُ موسمٍ وحلقة · خلّصه).
--
--  - **دالّةٌ لا سياسة**: التقييماتُ والحلقاتُ تبقى «صفوفي وحدي»؛ هذه تقرأ لأعمالٍ وأشخاصٍ بعينهم فقط.
--  - **الحراسةُ حراسةُ الصفّ نفسِه** (`following_activity_v2`): من أتابعه · ملفُّه يُرى (`can_view_profile`) · لا حظرَ بيننا ·
--    التقييمُ المخفيّ (`hidden`) لا يُقرأ. وحدٌّ: ٦٠ شخصاً و٦٠ عملاً في النداء.
--  - «خلّصه»: الفيلمُ في `watched_movies`؛ والمسلسلُ حين يبلغ عددُ حلقاته المشاهدة ما عُرض منه (`follows.aired_episodes`).
-- ============================================================

create or replace function public.friends_title_state(p_users uuid[], p_tmdb integer[], p_media text[])
returns table (user_id uuid, tmdb_id integer, media_type text, rating smallint, last_season integer, last_episode integer, done boolean)
language sql
stable
security definer
set search_path to 'public'
as $$
  with circle as (
    select uf.following_id as uid
    from public.user_follows uf
    where auth.uid() is not null
      and uf.follower_id = auth.uid()
      and uf.following_id = any (p_users[1:60])
      and public.can_view_profile(uf.following_id)
      and not public.is_blocked(auth.uid(), uf.following_id)
  ),
  titles as (
    select t.tmdb_id, t.media_type
    from unnest(p_tmdb[1:60], p_media[1:60]) as t(tmdb_id, media_type)
    where t.media_type in ('tv', 'movie')
  ),
  pairs as (
    select c.uid, t.tmdb_id, t.media_type from circle c cross join titles t
  )
  select
    p.uid, p.tmdb_id, p.media_type,
    (select r.rating from public.ratings r
      where r.user_id = p.uid and r.tmdb_id = p.tmdb_id and r.media_type = p.media_type and coalesce(r.hidden, false) = false
      limit 1),
    le.season_number, le.episode_number,
    case
      when p.media_type = 'movie' then exists (
        select 1 from public.watched_movies w where w.user_id = p.uid and w.movie_tmdb_id = p.tmdb_id)
      else coalesce((
        select f.aired_episodes > 0 and (
          select count(*) from public.watched_episodes w
          where w.user_id = p.uid and w.show_tmdb_id = p.tmdb_id and w.season_number > 0
        ) >= f.aired_episodes
        from public.follows f where f.user_id = p.uid and f.tmdb_id = p.tmdb_id and f.media_type = 'tv'), false)
    end
  from pairs p
  left join lateral (
    select w.season_number, w.episode_number
    from public.watched_episodes w
    where p.media_type = 'tv' and w.user_id = p.uid and w.show_tmdb_id = p.tmdb_id and w.season_number > 0
    order by w.season_number desc, w.episode_number desc
    limit 1
  ) le on true;
$$;
revoke all on function public.friends_title_state(uuid[], integer[], text[]) from public, anon;
grant execute on function public.friends_title_state(uuid[], integer[], text[]) to authenticated;

-- تحقّق: select to_regprocedure('public.friends_title_state(uuid[],integer[],text[])');
