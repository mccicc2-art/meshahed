-- ============================================================
-- 235 — سيرفرات البيت: Plex · Jellyfin · Emby (أحمد ٤ نوفمبر: «١ أ · ٢ أ · ٣ أ · ٤ أ»، ثمّ الشاشة «ب» والبطاقة «أ» ولـLoopz+ وحده)
--
-- 🔑 **رابطٌ واحدٌ لكلِّ عضو يقبله السيرفراتُ الثلاثة** (`/api/v1/home-server/<token>`): السيرفرُ يرسل حين تنتهي حلقةٌ أو فيلم،
-- **ولا يُعلَّم شيءٌ منه** — يُسجَّل سؤالاً («شفتها؟») في جدول إشارات Stremio نفسِه (هجرة ٢٢٢)، والعضوُ يجيب ✓ أو ✕ («٢ أ»).
-- - `home_server_links`: بصمةُ الرمز (sha-256) لا هو — شكلُ `stremio_links` بحرفه؛ ولا يصله إلّا مفتاحُ الخدمة.
-- - `watch_signals.source`: يقبل `plex` و`jellyfin` و`emby` بجانب `stremio`.
-- - `record_watch_signal`: يأخذ المصدر (`p_source`، والغيابُ `stremio` فنداءُ الإضافة الحاليّ لا يتغيّر)، **والسؤالُ واحدٌ للحلقة
--   مهما تعدّدت أجهزتُها**: إشارةٌ منتظرةٌ للحلقة نفسِها من مصدرٍ آخر تُلمس ولا تُكرَّر.
-- - `watched_episodes.source` / `watched_movies.source` (D-1505): شارةُ السجلّ تقول «Plex» لما أجاب عنه العضو من سؤال Plex.
--
-- ⚠️ لا شيءَ يُحذف: الجدولُ جديد، والقيودُ تتّسع ولا تضيق، والدالّةُ تُستبدل بتوقيعٍ أوسع (والقديمُ يُسقط كي لا يلتبس النداء).
-- ============================================================

create table if not exists public.home_server_links (
  token_hash   text        primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id      uuid        not null unique references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.home_server_links enable row level security;
revoke all on table public.home_server_links from anon, authenticated;
comment on table public.home_server_links is
  'Home servers (4 Nov 2026): one webhook link per member for Plex / Jellyfin / Emby, sha-256 of the token only. The token can only record watch signals. Server only (src/lib/homeServer.ts).';

alter table public.watch_signals drop constraint if exists watch_signals_source_check;
alter table public.watch_signals
  add constraint watch_signals_source_check check (source in ('stremio', 'plex', 'jellyfin', 'emby'));

alter table public.watched_episodes drop constraint if exists watched_episodes_source_check;
alter table public.watched_episodes
  add constraint watched_episodes_source_check check (source in ('stremio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby'));
alter table public.watched_movies drop constraint if exists watched_movies_source_check;
alter table public.watched_movies
  add constraint watched_movies_source_check check (source in ('stremio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby'));

drop function if exists public.record_watch_signal(uuid, text, integer, integer, integer, boolean);
create or replace function public.record_watch_signal(
  p_user uuid, p_type text, p_tmdb integer, p_season integer, p_episode integer, p_played boolean default false,
  p_source text default 'stremio'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  s integer := case when p_type = 'tv' then p_season end;
  e integer := case when p_type = 'tv' then p_episode end;
  n integer;
begin
  if p_user is null or p_type not in ('tv', 'movie') or p_tmdb is null or p_tmdb < 1
     or coalesce(p_source, '') not in ('stremio', 'plex', 'jellyfin', 'emby')
     or (p_type = 'tv' and (s is null or s not between 0 and 1000 or e is null or e not between 1 and 20000)) then
    raise exception 'record_watch_signal: bad arguments' using errcode = '22023';
  end if;
  if p_type = 'movie' and exists (
       select 1 from public.watched_movies w where w.user_id = p_user and w.movie_tmdb_id = p_tmdb) then
    return 'watched';
  end if;
  if p_type = 'tv' and exists (
       select 1 from public.watched_episodes w
       where w.user_id = p_user and w.show_tmdb_id = p_tmdb and w.season_number = s and w.episode_number = e) then
    return 'watched';
  end if;
  /* سؤالٌ واحدٌ للحلقة: المنتظرُ من أيِّ مصدرٍ يُلمس (وقتُه، و«شُغّل» إن جاء) ولا يُضاف ثانٍ */
  update public.watch_signals w
     set seen_at = now(),
         played_at = case when coalesce(p_played, false) then coalesce(w.played_at, now()) else w.played_at end
   where w.user_id = p_user and w.state = 'pending'
     and w.media_type = p_type and w.tmdb_id = p_tmdb
     and coalesce(w.season, -1) = coalesce(s, -1) and coalesce(w.episode, -1) = coalesce(e, -1);
  get diagnostics n = row_count;
  if n > 0 then
    return 'touched';
  end if;
  insert into public.watch_signals (user_id, source, media_type, tmdb_id, season, episode, played_at)
  values (p_user, p_source, p_type, p_tmdb, s, e, case when coalesce(p_played, false) then now() end)
  on conflict do nothing;
  delete from public.watch_signals w
   where w.id in (
     select x.id from public.watch_signals x
      where x.user_id = p_user and x.state = 'pending'
      order by x.seen_at desc
      offset 200);
  delete from public.watch_signals w
   where w.user_id = p_user and w.state <> 'pending' and w.answered_at < now() - interval '90 days';
  return 'added';
end;
$$;
revoke all on function public.record_watch_signal(uuid, text, integer, integer, integer, boolean, text) from public, anon, authenticated;
grant execute on function public.record_watch_signal(uuid, text, integer, integer, integer, boolean, text) to service_role;
comment on function public.record_watch_signal(uuid, text, integer, integer, integer, boolean, text) is
  'Stremio (22 Oct 2026) + home servers (4 Nov 2026): record «opened» / «played» (p_played) for p_user from p_source (stremio | plex | jellyfin | emby). One pending question per title/episode across sources. Returns watched | touched | added. Service role only.';

-- التحقّق
select
  to_regclass('public.home_server_links') is not null as links_table,
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'watch_signals_source_check') as signals_source,
  (select count(*) from pg_proc where proname = 'record_watch_signal') as fn_count,
  (select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'record_watch_signal') as fn_args;
