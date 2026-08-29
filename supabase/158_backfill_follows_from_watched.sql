-- ============================================================================
-- 158_backfill_follows_from_watched.sql — من أشّر حلقةً فمسلسلُه في مكتبته
-- ============================================================================
--
-- **سؤالُ أحمد**: «هذا المسلسل مثلاً ليه ماهو موجود في المكتبة؟» —
-- Arrow، ٩٢ حلقةً مؤشَّرة، ٥٤٪، **وليس في المكتبة.**
--
-- 🔴 **والعلّةُ بنيويّةٌ لا عارضة**: **المكتبةُ تُبنى من `follows`**
-- (`getFollows` في `app/library/page.tsx`)، **والتأشيرُ يكتب في
-- `watched_episodes` ولا يمسّ `follows` أبداً** (`toggleEpisode`).
-- **فالبابان لا يلتقيان**: صفحةُ العمل تقول «شاهدتَ ٩٢ من ١٧٠» — تقرأ
-- الحلقات — **والمكتبةُ لا تعرف العملَ أصلاً** لأنّها تقرأ المتابعات.
--
-- 📏 **والمقيسُ في الإنتاج قبل الإصلاح**:
--   ٤١ زوجاً (مستخدم، عمل) · ١٢ حساباً · ٣٨ عملاً · **٣١٦٢ حلقةً
--   مؤشَّرةً خارج المكتبات.** **فهي ليست حالةَ أحمد وحدَه.**
--
-- ⚖️ **وحكمُه: «نعم — من أوّل تأشير»** (سُئل صراحةً). **والحجّةُ في
-- الشاشة نفسِها**: «تأشيرُ أيّ حلقةٍ يعلّم كلَّ ما قبلها مشاهَداً» —
-- **فالتأشيرُ إقرارٌ بمتابعةٍ لا لمسةٌ عابرة.**
--
-- 🔑 **وهذا الملفُّ يصلح الماضي، والشيفرةُ تصلح المستقبل**
-- (`ensureShowFollowed` في `actions.ts`، تناديها `toggleEpisode` و
-- `watchUpTo` و`setSeasonWatched`).
--
-- ============================================================================
-- ⚠️ **وهذا تعديلُ بياناتٍ قائمة، خارجَ الإذن الدائم** — **أُذن له
-- بالاسم**: سُئل «الخمسةُ القائمة؟» فأجاب **«أضِفها للجميع»**.
-- **وهو إضافةٌ لا حذفٌ ولا استبدال**: `on conflict do nothing` — **صفٌّ
-- قائمٌ لا يُلمس**، فلا `dropped` يُمحى ولا `rewatch_count` ولا `genres`.
-- ============================================================================

insert into public.follows (user_id, tmdb_id, media_type, title, poster_path, added_at)
select g.user_id,
       g.show_tmdb_id,
       'tv',
       -- **العنوانُ يُنسخ من صفِّ متابعٍ آخرَ للعمل نفسِه إن وُجد**،
       -- **وإلّا فارغٌ ويُصلَح عند أوّل فتحٍ للمكتبة**: `localizeFollows`
       -- تقرأ الاسمَ من TMDB وقتَ الرسم (المخزَّنُ تخبئةٌ لا مصدر)،
       -- و`FollowMetaSync` تكتبه في القاعدة بعدها. **فلا اسمَ فارغٌ يُرى.**
       coalesce(src.title, ''),
       src.poster_path,
       -- ⚖️ **و`added_at` وقتُ أوّل تأشيرٍ لا وقتُ الهجرة**: ترتيبُ
       -- «المضاف حديثاً» يجب أن يقول متى دخل العملُ حياتَه فعلاً،
       -- **لا متى انتبهنا نحن للعطل.**
       g.first_tick
  from (
    select w.user_id, w.show_tmdb_id, min(w.watched_at) as first_tick
      from public.watched_episodes w
     where not exists (
       select 1 from public.follows f
        where f.user_id = w.user_id and f.tmdb_id = w.show_tmdb_id and f.media_type = 'tv')
     group by 1, 2
  ) g
  left join lateral (
    select f2.title, f2.poster_path
      from public.follows f2
     where f2.tmdb_id = g.show_tmdb_id and f2.media_type = 'tv'
       and coalesce(f2.title, '') <> ''
     order by f2.added_at
     limit 1
  ) src on true
on conflict (user_id, tmdb_id, media_type) do nothing;

-- ============================================================================
-- التحقّق (المتوقَّع بين القوسين)
-- ============================================================================
-- ١) لا فجوةَ باقية:                                            (صفر)
--    select count(*) from (
--      select distinct w.user_id, w.show_tmdb_id from public.watched_episodes w
--       where not exists (select 1 from public.follows f
--         where f.user_id=w.user_id and f.tmdb_id=w.show_tmdb_id and f.media_type='tv')) s;
-- ٢) Arrow في مكتبة أحمد بعنوانه:                    (yes title=Arrow)
-- ٣) عناوينُ فارغةٌ تنتظر أوّلَ فتحِ مكتبة:                       (١٣)
--    select count(*) from public.follows where coalesce(title,'')='';
--
-- ============================================================================
-- التراجع (إن لزم) — **يحذف ما أنشأه هذا الملفُّ وحدَه**
-- ============================================================================
-- **العلامةُ أنّ `added_at` يساوي أوّلَ تأشيرٍ بالضبط، والعنوانَ لم
-- يُلمس بعد** — ولذلك يُشغَّل التراجعُ **قبل** أوّل فتحِ مكتبةٍ يصلح
-- العناوين. وإن فات ذلك فالحذفُ يدويٌّ بقائمة الأزواج.
--   delete from public.follows f
--    where f.media_type = 'tv'
--      and f.added_at = (select min(w.watched_at) from public.watched_episodes w
--                         where w.user_id = f.user_id and w.show_tmdb_id = f.tmdb_id)
--      and f.stats_updated_at is null
--      and f.genres is null;
-- ⚠️ **وهو تقريبٌ لا يقين**: من تابَع عملاً في اللحظة نفسِها التي أشّر
-- فيها أوّلَ حلقةٍ يقع في المصفاة. **والأسلمُ قائمةُ الأزواج المطبوعةُ
-- في تقرير الجولة.**
-- ============================================================================
