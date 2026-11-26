-- 271 — شاهد منصّةً ثالثة (المهمّة ٥٦٧، أحمد ٢٦ نوفمبر ٢٠٢٦: «التالي فالربط .. شاهد» · «١أ ٢أ نفذ»)
--
-- كـ268 لـOSN+ حرفاً: القيمةُ `shahid` تُضاف إلى ثلاثة قيود، ولا عمودَ ولا صفَّ يُمسّ.
--   platform_links.platform   — خانةُ الربط
--   watched_*.source          — وسمُ ما دخل المكتبة من شاهد («ما وصل» في صفحة المنصّة)
--   link_adds.source          — سطرُ الجرس لكلِّ دفعة (الهجرة ٢٦٩)
--
-- جُرّبت على `loopz-preview` ثمّ شُغّلت على الإنتاج بإذن أحمد ٢٦ نوفمبر («٢أ ااذن لك»).

alter table public.platform_links drop constraint if exists platform_links_platform_check;
alter table public.platform_links add constraint platform_links_platform_check
  check (platform in ('netflix', 'osn', 'shahid'));

alter table public.watched_episodes drop constraint if exists watched_episodes_source_check;
alter table public.watched_episodes add constraint watched_episodes_source_check
  check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix', 'osn', 'shahid'));

alter table public.watched_movies drop constraint if exists watched_movies_source_check;
alter table public.watched_movies add constraint watched_movies_source_check
  check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix', 'osn', 'shahid'));

alter table public.link_adds drop constraint if exists link_adds_source_check;
alter table public.link_adds add constraint link_adds_source_check
  check (source in ('netflix', 'osn', 'shahid'));

comment on table public.platform_links is
  'Streaming-platform links (Netflix 25 Nov 2026, OSN+ and Shahid 26 Nov 2026): one row per member and platform. No token, password or cookie is stored — the platform session lives only in the app''s browser on the member''s device. Takes one link slot like a device. Server only (src/lib/linkTokens.ts).';
