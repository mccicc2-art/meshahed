-- ============================================================
--  Meshahed — دوال تجميع لتقليل حجم القراءات
--  شغّله في Supabase → SQL Editor
-- ============================================================

-- ---------- ملخّص المشاهدة لكل مسلسل ----------
-- كانت الرئيسية والمكتبة تسحبان كل صفوف watched_episodes (آلاف الصفوف
-- لمن يتابع مسلسلات طويلة) لمجرّد حساب عدد الحلقات لكل عمل.
-- هذه الدالة ترجع صفاً واحداً لكل مسلسل بدلاً من صف لكل حلقة.
create or replace function public.watch_summary()
returns table (
  show_tmdb_id  integer,
  watched       integer,
  last_watched  timestamptz,
  minutes       bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    show_tmdb_id,
    count(*)::integer                        as watched,
    max(watched_at)                          as last_watched,
    coalesce(sum(coalesce(runtime, 40)), 0)  as minutes
  from public.watched_episodes
  where user_id = auth.uid()
  group by show_tmdb_id;
$$;

revoke all on function public.watch_summary() from public;
grant execute on function public.watch_summary() to authenticated;

-- ---------- عدّاد تفاعلات الأخبار ----------
-- كانت getReactions تقرأ جدول التفاعلات كاملاً (بما فيه user_id لكل شخص)
-- ثم تعدّ في الذاكرة. الآن يعدّ Postgres، ولا يخرج أي معرّف مستخدم.
create or replace function public.reaction_counts(ids integer[])
returns table (tmdb_id integer, media_type text, n integer)
language sql
stable
security invoker
set search_path = public
as $$
  select r.tmdb_id, r.media_type, count(*)::integer
  from public.post_reactions r
  where r.tmdb_id = any(ids)
  group by r.tmdb_id, r.media_type;
$$;

revoke all on function public.reaction_counts(integer[]) from public;
grant execute on function public.reaction_counts(integer[]) to authenticated;

-- فهرس يخدم الترتيب الزمني في «آخر ما شاهدت»
create index if not exists watched_ep_user_time_idx
  on public.watched_episodes (user_id, watched_at desc);
