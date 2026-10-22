-- =====================================================================
-- 222 — ربطُ Stremio: رمزُ الإضافة · إشاراتُ «فتحتها في Stremio»
-- =====================================================================
-- خطّةُ Stremio (`claude/PLAN-STREMIO.md`)، وأحمد ٢٢ أكتوبر ٢٠٢٦: «نفذ».
--
-- ١. `stremio_links`: رمزٌ واحدٌ لكلِّ عضو، يُحفظ بصمتُه (sha-256) لا هو — الرمزُ يسكن في رابط الإضافة داخل حساب Stremio،
--    وقدرتُه الوحيدةُ «سجّل إشارة». للخادم وحده (RLS بلا سياسة، بلا منح) كـ`widget_tokens`.
-- ٢. `watch_signals`: «فتح العضوُ هذه الحلقة/هذا الفيلم في Stremio» — سؤالٌ ينتظر جوابه (✓ شفتها / ✕ لا).
--    🔑 الفتحُ ليس مشاهدة («المكتبة مقدّسة»): لا يُعلَّم شيءٌ هنا؛ الجوابُ وحده يعلّم، بفعل الخادم المعتاد.
--    صاحبُه يقرأ إشاراتِه ويحدّث حالتَها وحده (RLS)، والإنشاءُ بـ`record_watch_signal` للخادم وحده.
-- ٢-ب. 🆕 (أحمد ٢٢ أكتوبر «أ مع ج») — `played_at`: Stremio يطلب الترجماتِ حين يبدأ المشغّلُ تشغيلَ مصدرٍ لا حين تُفتح صفحةُ
--    الحلقة، فطلبُ الترجمة = «شغّلها». الإشارةُ تُنشأ بالفتح (`stream`) وتُختم بالتشغيل (`subtitles`)، والرئيسيّةُ تسأل عن
--    المختومة وحدها — من فتح الصفحةَ وخرج لا يُسأل. وتمامُ المشاهدة لا يصلنا من Stremio أصلاً، فالسؤالُ باقٍ.
-- ٣. `record_watch_signal(...)`: ذرّيّة — ما شوهد سابقاً لا يُسأل عنه (إعادةُ المشاهدة صامتة، قرار ٩)، وإشارةٌ تنتظر للشيء
--    نفسِه يُحدَّث وقتُها فقط، وإلّا تُضاف. والسقفُ ٢٠٠ منتظرةٍ لكلِّ عضو: الأقدمُ يخرج (الإشارةُ تبقى حتى يُجاب عنها —
--    قرار ٣ — لكن رابطاً مسروقاً لا يملأ الجدول بلا نهاية). والمُجابُ عنه بعد ٩٠ يوماً يُكنس هنا.
-- إضافيّةٌ كلُّها: جدولان ودالّة، لا يُلمس شيءٌ قائم.
-- ⚖️ أثرٌ معروفٌ في المستشار: «rls_enabled_no_policy» +١ (`stremio_links`، كـ`widget_tokens`) — مقصود.
--
-- ↩️ التراجع:
--   drop function if exists public.record_watch_signal(uuid, text, integer, integer, integer, boolean);
--   drop table if exists public.watch_signals;
--   drop table if exists public.stremio_links;

create table if not exists public.stremio_links (
  token_hash   text        primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  user_id      uuid        not null unique references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
alter table public.stremio_links enable row level security;
revoke all on table public.stremio_links from anon, authenticated;
comment on table public.stremio_links is
  'Stremio addon link (22 Oct 2026): one per member, sha-256 of the token only. The token can only record watch signals. Server only (src/lib/stremio.ts).';

create table if not exists public.watch_signals (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  source      text        not null default 'stremio' check (source in ('stremio')),
  media_type  text        not null check (media_type in ('tv', 'movie')),
  tmdb_id     integer     not null check (tmdb_id > 0),
  season      integer     check (season is null or season between 0 and 1000),
  episode     integer     check (episode is null or episode between 1 and 20000),
  state       text        not null default 'pending' check (state in ('pending', 'watched', 'dismissed')),
  seen_at     timestamptz not null default now(),
  played_at   timestamptz,
  answered_at timestamptz,
  check ((media_type = 'movie' and season is null and episode is null)
      or (media_type = 'tv' and season is not null and episode is not null))
);
-- إشارةٌ منتظرةٌ واحدةٌ لكلِّ عملٍ وحلقة: الفتحُ الثاني يحدّث وقتها ولا يكرّرها
create unique index if not exists watch_signals_pending_uq
  on public.watch_signals (user_id, source, media_type, tmdb_id, coalesce(season, -1), coalesce(episode, -1))
  where state = 'pending';
create index if not exists watch_signals_user_idx on public.watch_signals (user_id, state, seen_at desc);
alter table public.watch_signals enable row level security;
revoke all on table public.watch_signals from anon, authenticated;
grant select on table public.watch_signals to authenticated;
grant update (state, answered_at) on table public.watch_signals to authenticated;
drop policy if exists watch_signals_select_own on public.watch_signals;
create policy watch_signals_select_own on public.watch_signals
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists watch_signals_update_own on public.watch_signals;
create policy watch_signals_update_own on public.watch_signals
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
comment on table public.watch_signals is
  'Stremio (22 Oct 2026): «the member opened this episode/movie in Stremio» — a question awaiting ✓/✕. Opening is not watching: nothing is marked from here. Created by record_watch_signal() only; the owner reads and answers.';

create or replace function public.record_watch_signal(
  p_user uuid, p_type text, p_tmdb integer, p_season integer, p_episode integer, p_played boolean default false
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
     or (p_type = 'tv' and (s is null or s not between 0 and 1000 or e is null or e not between 1 and 20000)) then
    raise exception 'record_watch_signal: bad arguments' using errcode = '22023';
  end if;
  -- ما شوهد لا يُسأل عنه (قرار ٩: إعادةُ المشاهدة صامتة)
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
   where w.user_id = p_user and w.source = 'stremio' and w.state = 'pending'
     and w.media_type = p_type and w.tmdb_id = p_tmdb
     and coalesce(w.season, -1) = coalesce(s, -1) and coalesce(w.episode, -1) = coalesce(e, -1);
  get diagnostics n = row_count;
  if n > 0 then
    return 'touched';
  end if;
  insert into public.watch_signals (user_id, source, media_type, tmdb_id, season, episode, played_at)
  values (p_user, 'stremio', p_type, p_tmdb, s, e, case when coalesce(p_played, false) then now() end)
  on conflict do nothing;
  -- السقف: ٢٠٠ منتظرةٍ لكلِّ عضو، والأقدمُ يخرج
  delete from public.watch_signals w
   where w.id in (
     select x.id from public.watch_signals x
      where x.user_id = p_user and x.state = 'pending'
      order by x.seen_at desc
      offset 200);
  -- والمُجابُ عنه بعد ٩٠ يوماً لا حاجة له
  delete from public.watch_signals w
   where w.user_id = p_user and w.state <> 'pending' and w.answered_at < now() - interval '90 days';
  return 'added';
end;
$$;
revoke all on function public.record_watch_signal(uuid, text, integer, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.record_watch_signal(uuid, text, integer, integer, integer, boolean) to service_role;
comment on function public.record_watch_signal(uuid, text, integer, integer, integer, boolean) is
  'Stremio (22 Oct 2026): record «opened» (stream request) or «played» (p_played — subtitles request) for p_user. Returns watched (already watched — nothing recorded) | touched | added. Service role only (addon routes).';
