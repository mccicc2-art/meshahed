-- ============================================================
-- 267 — Nuvio جهازٌ لحاله: رابطٌ وخانةٌ ومصدر (أحمد ٢٦ نوفمبر: «ربط ستريميو لحال ونوفيو لحال — ممكن الشخص بيربط الحسابين»
--        ثمّ «نعم نبقيه كذا» للخانات، ثمّ «كمل نوفيو»)
--
-- 🔑 **الإضافةُ نفسُها، والرابطُ غيرُه**: Nuvio يثبّت إضافاتِ Stremio، وإضافةُ Loopz اشتغلت فيه كما هي (تجربةُ ٢٦ نوفمبر على
-- جهاز: «Dressed to Kill» ⇐ بطاقةُ «شاهدته؟»). لكنّ الإضافةَ لا تعرف من يسألها — فرابطُ Stremio في Nuvio يسجّل «Stremio».
-- فلـNuvio جدولُه كـKodi (هجرة ٢٣٦): رابطٌ لكلِّ عضو، بصمتُه (sha-256) لا هو، وبادئةُ رمزه `ln_` تقول أيُّ تطبيقٍ هذا.
-- - **خانةٌ لحاله** (D-1640 بلا تغيير): المجانيُّ يربط Stremio أو Nuvio، والاثنان مع بلس.
-- - **`nuvio` مصدرٌ للسؤال وللمكتبة**: البطاقةُ تقول «Nuvio · شغّلتها الآن»، و✓ يكتب شارةَ المصدر `nuvio` في السجلّ.
-- - **يسأل دائماً** كـStremio: الإضافةُ تعرف «شغّلها» لا «خلّصها» — «سجّل بلا سؤال» لا يمسّه (في الخادم).
--
-- ⚠️ لا شيءَ يُحذف: جدولٌ جديد، وقيودُ المصدر تتّسع بقيمة، والدالّةُ نفسُها بقائمةٍ أوسع (نصُّها كما على الإنتاج ٢٦ نوفمبر).
-- الخادمُ يعمل قبل الهجرة: إصدارُ رابط Nuvio يفشل («upstream») وكلُّ ما سواه كما كان. **تُشغّل الهجرةُ قبل الدفع.**
-- ============================================================

create table if not exists public.nuvio_links (
  token_hash   text        primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id      uuid        not null unique references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  stopped_at   timestamptz
);
alter table public.nuvio_links enable row level security;
revoke all on table public.nuvio_links from anon, authenticated;
comment on table public.nuvio_links is
  'Nuvio (26 Nov 2026): the Loopz Stremio add-on installed in Nuvio, with its own link — one per member, sha-256 of the token only (prefix ln_). The token can only record watch signals. stopped_at = over the member''s device slots after a downgrade. Server only (src/lib/linkTokens.ts).';

alter table public.watch_signals drop constraint if exists watch_signals_source_check;
alter table public.watch_signals
  add constraint watch_signals_source_check check (source in ('stremio', 'nuvio', 'plex', 'jellyfin', 'emby', 'kodi'));

alter table public.watched_episodes drop constraint if exists watched_episodes_source_check;
alter table public.watched_episodes
  add constraint watched_episodes_source_check check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix'));
alter table public.watched_movies drop constraint if exists watched_movies_source_check;
alter table public.watched_movies
  add constraint watched_movies_source_check check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix'));

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
     or coalesce(p_source, '') not in ('stremio', 'nuvio', 'plex', 'jellyfin', 'emby', 'kodi')
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
