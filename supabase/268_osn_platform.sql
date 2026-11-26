-- ====== 268 — OSN+ منصّةً ثانيةً في الربط (المهمّة ٥٥٧، أحمد ٢٦ نوفمبر «٢أ») ======
--
-- ١. `platform_links.platform` يقبل `osn` مع `netflix`. لا رمزَ ولا كوكي في الجدول — جلسةُ OSN+ تعيش في متصفّح التطبيق على
--    جهاز العضو وحده، كنتفليكس (هجرة ٢٦٥).
-- ٢. مصدرُ المشاهدة `osn` في `watched_episodes` و`watched_movies`: شارةُ المصدر، وعدُّ «الـN عملاً تبقى في مكتبتك» عند الفكّ.
--    القيدُ يُعاد بناؤه بقيمه الإحدى عشرة القائمة (بعد ٢٦٧) و`osn` — لا يُكتب من هجرةٍ أقدم.
--
-- لا صفَّ يتغيّر: القيودُ تتّسع فقط.
--
-- ↩️ التراجع (بعد التأكّد ألّا صفوفَ بمصدر `osn` ولا منصّة `osn`، أو بتحويلها أوّلاً):
--   delete from public.platform_links where platform = 'osn';
--   update public.watched_episodes set source = 'import' where source = 'osn';
--   update public.watched_movies   set source = 'import' where source = 'osn';
--   alter table public.platform_links drop constraint if exists platform_links_platform_check,
--     add constraint platform_links_platform_check check (platform in ('netflix'));
--   alter table public.watched_episodes drop constraint if exists watched_episodes_source_check,
--     add constraint watched_episodes_source_check check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix'));
--   alter table public.watched_movies drop constraint if exists watched_movies_source_check,
--     add constraint watched_movies_source_check check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix'));

alter table public.platform_links drop constraint if exists platform_links_platform_check;
alter table public.platform_links add constraint platform_links_platform_check
  check (platform in ('netflix', 'osn'));

alter table public.watched_episodes drop constraint if exists watched_episodes_source_check;
alter table public.watched_episodes add constraint watched_episodes_source_check
  check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix', 'osn'));

alter table public.watched_movies drop constraint if exists watched_movies_source_check;
alter table public.watched_movies add constraint watched_movies_source_check
  check (source in ('stremio', 'nuvio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix', 'osn'));

comment on table public.platform_links is
  'Streaming-platform links (Netflix 25 Nov 2026, OSN+ 26 Nov 2026): one row per member and platform. No token, password or cookie is stored — the platform session lives only in the app''s browser on the member''s device. Takes one link slot like a device. Server only (src/lib/linkTokens.ts).';

-- ✅ التحقّق:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conname in ('platform_links_platform_check', 'watched_episodes_source_check', 'watched_movies_source_check');
