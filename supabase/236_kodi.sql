-- ============================================================
-- 236 — Kodi في سيرفرات البيت (أحمد ٥ نوفمبر: «١ أ · ٢ أ · ٣ أ» ثمّ الرمز داخل التبويب «أ»، «نفذ»)
--
-- 🔑 **Kodi لا يرسل من نفسه** — إضافةُ Loopz (`service.loopz`، مصدرُها `src/lib/kodiAddon.ts`) ترسل حين تنتهي حلقةٌ أو فيلم، إلى رابطٍ
-- **خاصٍّ بـKodi** لا رابطِ Plex/Jellyfin/Emby: الرابطُ الواحدُ للعضو (هجرة ٢٣٥) يُستبدل بإصداره، وإصدارُه لـKodi كان سيُسقط
-- رابطَ سيرفره الآخر. فجدولٌ ثانٍ بالشكل نفسِه (`kodi_links`) ومعه اسمُ الجهاز.
-- - **الربطُ برمزٍ من ستّة أرقام** (`kodi_pair_codes`): التطبيقُ يطلبه، والعضوُ يكتبه في إعدادات الإضافة بالريموت، والإضافةُ تبدّله
--   برابطها. بصمةُ الرمز لا هو، وعمرُه عشرُ دقائق، ويُستعمل مرّةً، ورمزٌ واحدٌ للعضو.
-- - `kodi` مصدرٌ رابعٌ في الأسئلة وشاراتِ السجلّ، و`record_watch_signal` تقبله.
-- ⚠️ لا شيءَ يُحذف: جدولان جديدان، والقيودُ تتّسع، والدالّةُ بتوقيعها نفسِه.
-- ============================================================

create table if not exists public.kodi_links (
  token_hash   text        primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id      uuid        not null unique references auth.users (id) on delete cascade,
  device       text        check (device is null or length(device) <= 80),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.kodi_links enable row level security;
revoke all on table public.kodi_links from anon, authenticated;
comment on table public.kodi_links is
  'Kodi add-on link (5 Nov 2026): one per member, sha-256 of the token only, plus the Kodi device name. The token can only record watch signals. Server only (src/lib/linkTokens.ts).';

create table if not exists public.kodi_pair_codes (
  code_hash  text        primary key check (code_hash ~ '^[0-9a-f]{64}$'),
  user_id    uuid        not null unique references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.kodi_pair_codes enable row level security;
revoke all on table public.kodi_pair_codes from anon, authenticated;
comment on table public.kodi_pair_codes is
  'Kodi pairing (5 Nov 2026): a six-digit code shown in the app, typed in the add-on, exchanged once for a kodi_links token. sha-256 only, 10 minutes, one per member. Server only.';

alter table public.watch_signals drop constraint if exists watch_signals_source_check;
alter table public.watch_signals
  add constraint watch_signals_source_check check (source in ('stremio', 'plex', 'jellyfin', 'emby', 'kodi'));
alter table public.watched_episodes drop constraint if exists watched_episodes_source_check;
alter table public.watched_episodes
  add constraint watched_episodes_source_check check (source in ('stremio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi'));
alter table public.watched_movies drop constraint if exists watched_movies_source_check;
alter table public.watched_movies
  add constraint watched_movies_source_check check (source in ('stremio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi'));

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
     or coalesce(p_source, '') not in ('stremio', 'plex', 'jellyfin', 'emby', 'kodi')
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

-- التحقّق
select
  to_regclass('public.kodi_links') is not null as kodi_links,
  to_regclass('public.kodi_pair_codes') is not null as pair_codes,
  (select pg_get_constraintdef(oid) from pg_constraint where conname = 'watch_signals_source_check') as signals_source,
  position('kodi' in pg_get_functiondef('public.record_watch_signal(uuid,text,integer,integer,integer,boolean,text)'::regprocedure)) > 0 as fn_accepts_kodi;
