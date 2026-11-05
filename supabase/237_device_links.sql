-- ============================================================
-- 237 — مدارُ الأجهزة: العدّ والفصلُ لكلِّ سيرفر والتسجيلُ بلا سؤال (أحمد ٥ نوفمبر: «موافق عالكل وااذن لك بالهجره» ثمّ «نفذ»)
--
-- 🔑 **الربطُ صار خاناتٍ تُعدّ** لا ميزةً مقفلة: المجانيُّ جهازٌ واحدٌ من «من أجهزتك»، وبلس خمسة. العدُّ نفسُه في TypeScript
-- (`src/core/deviceLinks.ts`) لأنّه يقرأ الخطّة من الملفّ الشخصيّ، والقاعدةُ تحفظ ما يحتاجه فقط:
-- - `home_server_links.server`: **رابطٌ لكلِّ نوع** (Plex · Jellyfin · Emby) — فرابطٌ واحدٌ لا يُلصق في ثلاثة سيرفرات، و«فك الربط»
--   يوقف ذلك السيرفر وحده. فقيدُ «رابطٌ واحدٌ للعضو» يسقط ويحلّ محلَّه: واحدٌ لكلِّ (عضو، نوع)، وواحدٌ بلا نوع.
-- - `home_server_links.kinds`: **الرابطُ القديم لا يُقسم** — لا شيءَ يقول أيُّ سيرفرٍ استعمله. فيبقى بلا نوع، ويُضاف إليه كلُّ نوعٍ
--   يرسل منه أوّلَ مرّة (إن بقيت خانة)، ويُعدّ خانةً لكلِّ نوعٍ رآه (وخانةً واحدةً قبل أوّل إرسال). ورابطٌ يُصدره تطبيقٌ قديم (1.13.x)
--   بلا نوع يمشي على الطريق نفسِه.
-- - `stopped_at` في الجداول الثلاثة: **النزولُ من بلس لا يحذف شيئاً** — ما زاد على الخانات يُوقف (يبقى أحدثُها استعمالاً) ويعود
--   إن اختاره العضو في «اختر ما يبقى» أو اشترك ثانية.
-- - `profiles.auto_mark`: «سجّل بلا سؤال» — لبلس، **مفعّلٌ للمشترك من البداية** (أحمد: «خله شغال من البداية للمشترك»)، ولا يمسّ
--   Stremio أبداً (لا نعرف أنّه خلّص الحلقة). العضو يغيّره من صفحة الربط عبر الخادم، فلا منحةَ تعديلٍ له.
--
-- ⚠️ لا شيءَ يُحذف من البيانات: أعمدةٌ تُضاف بقيمٍ افتراضيّة، والقيدُ الوحيدُ الساقطُ يحلّ محلَّه فهرسان أدقّ. الخادمُ يعمل قبل
-- الهجرة وبعدها (يقرأ الأعمدة الجديدة إن وُجدت) — ومع ذلك تُشغّل الهجرةُ قبل الدفع.
-- ============================================================

alter table public.home_server_links add column if not exists server text;
alter table public.home_server_links add column if not exists kinds text[] not null default '{}';
alter table public.home_server_links add column if not exists stopped_at timestamptz;

alter table public.home_server_links drop constraint if exists home_server_links_server_check;
alter table public.home_server_links
  add constraint home_server_links_server_check check (server is null or server in ('plex', 'jellyfin', 'emby'));
alter table public.home_server_links drop constraint if exists home_server_links_kinds_check;
alter table public.home_server_links
  add constraint home_server_links_kinds_check check (kinds <@ array['plex', 'jellyfin', 'emby']::text[]);

-- واحدٌ لكلِّ (عضو، نوع)، وواحدٌ بلا نوع — يُنشآن قبل إسقاط القيد القديم كي لا تمرّ لحظةٌ بلا حارس
create unique index if not exists home_server_links_user_server_uq
  on public.home_server_links (user_id, server) where server is not null;
create unique index if not exists home_server_links_user_unbound_uq
  on public.home_server_links (user_id) where server is null;
create index if not exists home_server_links_user_idx on public.home_server_links (user_id);
alter table public.home_server_links drop constraint if exists home_server_links_user_id_key;

alter table public.stremio_links add column if not exists stopped_at timestamptz;
alter table public.kodi_links add column if not exists stopped_at timestamptz;

comment on table public.home_server_links is
  'Home servers (4 Nov 2026; per kind since 237, 5 Nov): one webhook link per member per server kind (plex/jellyfin/emby), plus at most one unbound legacy link whose kinds grow on first event. sha-256 of the token only. stopped_at = over the member''s slots after a downgrade. Server only (src/lib/homeServer.ts).';
comment on column public.home_server_links.kinds is
  'Unbound (server is null) links only: the server kinds that have sent events through this token. Each counts as one device slot.';
comment on column public.stremio_links.stopped_at is
  'Set when the link is over the member''s device slots (downgrade); events are ignored until it is kept again.';
comment on column public.kodi_links.stopped_at is
  'Set when the link is over the member''s device slots (downgrade); events are ignored until it is kept again.';

alter table public.profiles add column if not exists auto_mark boolean not null default true;
comment on column public.profiles.auto_mark is
  '«سجّل بلا سؤال» (5 Nov 2026): Plus only; home servers and Kodi mark the finished title directly instead of asking. Never Stremio. Written by the server only.';
