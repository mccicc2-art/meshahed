-- ============================================================
--  إعادة المشاهدة 🔁 — شغّله في Supabase → SQL Editor
--
--  النموذج: بدء الإعادة يختم لحظةً على صفّ المتابعة، والتقدّم يُحسب
--  من الحلقات المؤشَّرة بعد تلك اللحظة. صفوف الحلقات لا تُحذف أبداً —
--  اليوميات تعرض دائماً آخر مشاهدة لكل حلقة.
-- ============================================================

alter table public.follows
  add column if not exists rewatch_count int not null default 0,
  add column if not exists rewatch_started_at timestamptz;

-- ملخّص المشاهدة يحترم الإعادة: ما قبل لحظة البدء لا يُحسب تقدّماً
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
    w.show_tmdb_id,
    count(*)::integer                          as watched,
    max(w.watched_at)                          as last_watched,
    coalesce(sum(coalesce(w.runtime, 40)), 0)  as minutes
  from public.watched_episodes w
  left join public.follows f
    on  f.user_id    = w.user_id
    and f.tmdb_id    = w.show_tmdb_id
    and f.media_type = 'tv'
  where w.user_id = auth.uid()
    and (f.rewatch_started_at is null or w.watched_at >= f.rewatch_started_at)
  group by w.show_tmdb_id;
$$;

revoke all on function public.watch_summary() from public;
grant execute on function public.watch_summary() to authenticated;
