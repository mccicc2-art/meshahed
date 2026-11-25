-- =====================================================================
-- 265 — ربطُ منصّات البثّ: نتفليكس أوّلاً (خطّة `claude/PLAN-NETFLIX-SYNC.md`، أحمد ٢٥ نوفمبر ٢٠٢٦: «نفذ»)
-- =====================================================================
-- ١. `platform_links`: صفٌّ لكلِّ منصّةٍ مربوطةٍ عند العضو. **لا رمزَ فيه ولا كلمةَ مرور ولا كوكي**: الدخولُ إلى نتفليكس يعيش
--    في متصفّح التطبيق على جهاز العضو وحده، والخادمُ لا يعرف إلا أنّ الربطَ قائمٌ، واسمَ الملفّ الشخصيّ الذي اختاره،
--    ومتى زامن آخرَ مرّة، وأحدثَ مشاهدةٍ دخلت مكتبتَه.
--    - يأخذ **خانةً** من خانات الربط كأيِّ جهاز (مجّاني ١ · بلس ٥ · ذهبي بلا حدّ)، والنزولُ يُوقفه ولا يحذفه (`stopped_at`) كإخوته.
--    - `since_at`: «من الآن فقط» (أحمد ٢٥ نوفمبر) — ما شوهد قبله لا يدخل المكتبة أبداً، حتى في الاستيراد اللاحق من صفحة نتفليكس.
--      `null` = «استيراد الكل».
--    - `last_item_at`: أحدثُ مشاهدةٍ قرأناها — المزامنةُ التالية تقرأ ما بعده وحده.
--    - `last_used_at`: آخرُ مزامنة — هو «آخرُ استعمال» الذي يحكم به المدار (رابطٌ نام ٩٠ يوماً لا يُعدّ، A-05).
--    للخادم وحده (RLS بلا سياسة، بلا منح) كـ`stremio_links` و`kodi_links`.
-- ٢. مصدرُ المشاهدة `netflix` في `watched_episodes` و`watched_movies` (D-1505): شارةُ المصدر، وعدُّ «الـN عملاً تبقى في مكتبتك»
--    عند الفكّ. يُعاد بناءُ القيد بقيمه الثماني القائمة و`netflix` — القائمةُ القديمةُ كلُّها باقية.
-- إضافيّةٌ كلُّها: جدولٌ وقيدان أوسع، لا يُلمس صفٌّ قائم.
-- ⚖️ أثرٌ معروفٌ في المستشار: «rls_enabled_no_policy» +١ (`platform_links`) — مقصود، كإخوته.
--
-- ↩️ التراجع (بعد التأكّد ألّا صفوفَ بمصدر `netflix`، أو بتحويلها إلى `import` أوّلاً):
--   update public.watched_episodes set source = 'import' where source = 'netflix';
--   update public.watched_movies   set source = 'import' where source = 'netflix';
--   alter table public.watched_episodes drop constraint if exists watched_episodes_source_check,
--     add constraint watched_episodes_source_check check (source in ('stremio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi'));
--   alter table public.watched_movies drop constraint if exists watched_movies_source_check,
--     add constraint watched_movies_source_check check (source in ('stremio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi'));
--   drop table if exists public.platform_links;

create table if not exists public.platform_links (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  platform      text        not null check (platform in ('netflix')),
  profile_label text        check (profile_label is null or char_length(profile_label) <= 80),
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz,
  last_item_at  timestamptz,
  since_at      timestamptz,
  stopped_at    timestamptz,
  unique (user_id, platform)
);
alter table public.platform_links enable row level security;
revoke all on table public.platform_links from anon, authenticated;
comment on table public.platform_links is
  'Streaming-platform links (25 Nov 2026, Netflix first): one row per member and platform. No token, password or cookie is stored — the Netflix session lives only in the app''s browser on the member''s device. Takes one link slot like a device. Server only (src/lib/linkTokens.ts).';

-- مصدرُ المشاهدة: القيدُ على الإنتاج اليومَ بقيمه الثماني (قُرئ من `pg_constraint` في ٢٥ نوفمبر قبل كتابة هذا الملفّ) —
-- يُعاد بناؤه بها كلِّها و`netflix` معها. ⚠️ لا تُكتب القائمةُ من ٢٣١ وحدها: سيرفراتُ البيت وKodi أضافت أربعاً بعدها.
alter table public.watched_episodes drop constraint if exists watched_episodes_source_check;
alter table public.watched_episodes add constraint watched_episodes_source_check
  check (source in ('stremio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix'));
alter table public.watched_movies drop constraint if exists watched_movies_source_check;
alter table public.watched_movies add constraint watched_movies_source_check
  check (source in ('stremio', 'widget', 'import', 'auto', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix'));
