-- 276 — برايم فيديو المنصّةُ الرابعة (المهمّة ٦٠٤، أحمد ٢٨ نوفمبر ٢٠٢٦: «الان برايم»، «١أ»، «نفذ وااذن لك بالهجره وارفع»)
--
-- الطريقةُ نفسُها: الدخولُ والقراءةُ في متصفّح التطبيق على جهاز العضو، ولا شيءَ من برايم يُحفظ هنا. هنا القيودُ وحدَها تتّسع
-- لـ`prime` — في الربط، ووسمِ المصدر على المشاهدة، وسطرِ الجرس، وسؤالِ «شاهدتها؟» (T579).
-- الفحص S0: `claude/STUDY-PRIME-S0-2026-11-28.md`. جُرّبت على `loopz-preview` أوّلاً.

alter table public.platform_links drop constraint if exists platform_links_platform_check;
alter table public.platform_links add constraint platform_links_platform_check
  check (platform in ('netflix', 'osn', 'shahid', 'prime'));

alter table public.watched_episodes drop constraint if exists watched_episodes_source_check;
alter table public.watched_episodes add constraint watched_episodes_source_check
  check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix', 'osn', 'shahid', 'prime'));

alter table public.watched_movies drop constraint if exists watched_movies_source_check;
alter table public.watched_movies add constraint watched_movies_source_check
  check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix', 'osn', 'shahid', 'prime'));

alter table public.link_adds drop constraint if exists link_adds_source_check;
alter table public.link_adds add constraint link_adds_source_check
  check (source in ('netflix', 'osn', 'shahid', 'prime'));

alter table public.watch_signals drop constraint if exists watch_signals_source_check;
alter table public.watch_signals add constraint watch_signals_source_check
  check (source = any (array['stremio', 'nuvio', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix', 'osn', 'shahid', 'prime']));
