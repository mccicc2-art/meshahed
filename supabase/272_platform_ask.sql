-- 272 — «شاهدتها؟» بدل الإضافة التلقائيّة من المنصّات (T579، أحمد ٢٦ نوفمبر ٢٠٢٦)
--
-- قرارُ أحمد: «احيانا شخصين يستخدمون نفس الملف الشخصي .. نحط خيار داخل ربط نيتفليكس و شاهد و OSN يقدر يطفي التسجيل التلقائي
-- و يسير يسأله هل شاهدت او لا» — «١أ» مفتاحٌ آخرَ صفحة المنصّة · «٢ب» السؤالُ في الرئيسيّة لكلِّ عملٍ دفعةً واحدة.
--
-- إضافتان فقط — لا جدولَ جديد:
--   platform_links.auto_add   — مفتاحُ كلِّ منصّةٍ على حدة. `true` (الافتراضيّ) كما كان: ما في سجلّ المنصّة يدخل المكتبة.
--                               `false`: ما ظهر في السجلّ يصير سؤالاً «شاهدتها؟» ولا يُكتب إلّا بجواب العضو.
--   watch_signals.source      — السؤالُ نفسُه الذي يسأله Stremio وKodi (البطاقةُ والجرسُ و«عرض الكل» كما هي): `netflix` · `osn` · `shahid`.
--
-- الكتابةُ للخادم وحده كما كانت (لا منحةَ للعضو على العمود الجديد).
-- جُرّبت على `loopz-preview` أوّلاً.

alter table public.platform_links
  add column if not exists auto_add boolean not null default true;

alter table public.watch_signals drop constraint if exists watch_signals_source_check;
alter table public.watch_signals
  add constraint watch_signals_source_check
  check (source = any (array['stremio', 'nuvio', 'plex', 'jellyfin', 'emby', 'kodi', 'netflix', 'osn', 'shahid']));

comment on column public.platform_links.auto_add is
  'T579 (272) — true: platform history is added to the library automatically; false: each item becomes a «watched it?» question (watch_signals) answered by the member.';
