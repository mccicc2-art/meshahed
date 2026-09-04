-- ============================================================
-- 178 — LOOPZ-AUD-0040: سحبُ ما لا يُستدعى (A) وقبولُ service_role في حرّاس
--       الكتابة الثلاثة (B-1) — تمهيداً لـB-2 بعد D-898
-- ============================================================
-- 🗂️ **ملفٌّ يوثّق ما شُغِّل، لا ملفٌّ ينتظر التشغيل**: طُبِّق على الإنتاج
-- ٣ سبتمبر ٢٠٢٦ ≈22:30 UTC باسم `aud0040_set_a_revised_and_b1_service_role_guards`
-- في `schema_migrations` (بأمر أحمد الصريح؛ الاعتمادُ الموثَّق تعليقُ PR #19 رقم 116).
-- **مُجرَّبٌ أوّلاً على `loopz-preview`** بثلاثة أشكالِ دور. رُقّم ١٧٨ هنا ليأخذ
-- موضعَه في ترتيب التشغيل — **وبيئةٌ جديدةٌ لا تُبنى من مؤشِّر** (قاعدةُ الملفّ).
--
-- ═══ المجموعة A — ما لا يستدعيه التطبيق يُسحب فوراً، بصفر أثر ═══
-- ⚠️ **النسخةُ الأصليّة من A كانت تسحب أيضاً عن عشر دوالِّ `ops_*`** — وقد
-- أُسقطت تلك الدوالُّ وسكيما `ops` كلُّها في جلسة D-901 قبل ساعات. **وREVOKE على
-- دالّةٍ غائبة يُسقط المعاملةَ كلَّها**، فنُقِّح النصُّ إلى ما هو قائمٌ فعلاً —
-- **والدرسُ: نصُّ صلاحيّاتٍ كُتب أمسِ يُعاد قياسُه على القاعدة قبل تشغيله اليوم.**
--
-- ═══ المجموعة B-1 — ولمَ لزمت قبل المفتاح ═══
-- 🔴 **خطأٌ كاد يمرّ**: الدوالُّ الثلاث ترفع `auth required` حين `auth.uid()`
-- فارغ، **وعميلُ service_role لا جلسةَ له فـ`uid` فارغٌ دائماً** — فلو وُضع
-- `SUPABASE_SERVICE_ROLE_KEY` قبل هذه الهجرة **لتوقّفت الأخبارُ واللقطاتُ
-- والنشراتُ بصمت** (الكاتبُ يبتلع فشلَه بالتصميم). فتقبل الحرّاسُ الدورَ نفسَه
-- بديلاً عن الجلسة: **لا المجهولُ يمرّ ولا المسجَّلُ يكسب شيئاً لم يكن يملكه.**
-- **وأجسامُ الدوالّ منقولةٌ حرفاً من تصدير الإنتاج ٣ سبتمبر** عدا سطرَ الحارس.
--
-- ⏭️ **B-2 لا تُشغَّل من هذا الملفّ**: سحبُ EXECUTE عن دوالّ الكتابة العشر
-- **لا يجوز قبل أن يُثبَت أنّ الخادمَ يكتب فعلاً بـservice_role** — والإثباتُ من
-- سجلّات الطلبات (`request.sb.jwt.apikey.payload.role`) لا من نجاح النشر، لأنّ
-- `createServiceClient()` **يرتدّ بصمتٍ إلى عميل الجلسة** إن غاب المفتاح أو
-- فسدت قيمتُه — فينجح كلُّ شيءٍ ظاهريّاً ثمّ ينكسر لحظةَ السحب.
--
-- rollback: `GRANT EXECUTE ON FUNCTION <الأسماء نفسُها> TO anon, authenticated;`
--           (و`TO PUBLIC` للمساعدات الثلاث)، وأجسامُ B-1 تعود بحذف شطر
--           `and coalesce(auth.role(), '') <> 'service_role'` من الحرّاس الثلاثة.
-- ============================================================

-- ─── A ─────────────────────────────────────────────────────────────────────
-- دالّةٌ ميّتة: لا مستدعيَ لها في الشيفرة (فُحصت `main` كلُّها) فلا تُترك مفتوحة
revoke execute on function public.set_news_items(jsonb) from public, anon, authenticated;

-- منحُ PUBLIC شاذٌّ على ثلاثِ مساعدات — ومنحُ `anon`/`authenticated` الصريحُ يبقى
-- (المسارُ وحاجزُه هما البابُ الحقيقيُّ لهذه الثلاث، لا PostgREST مباشرةً)
revoke execute on function
  public.news_host_ok(text),
  public.bump_visit_lang(text),
  public.log_runtime_error(text, text, text, text)
from public;

-- ─── B-1 ───────────────────────────────────────────────────────────────────
set check_function_bodies = off;

create or replace function public.set_title_snapshots(p_rows jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_count integer;
begin
  -- D-898 (LOOPZ-AUD-0040 · المجموعة B): الخادمُ يكتب بمفتاح service_role ولا
  -- جلسةَ له، فـauth.uid() فارغ. يُقبل الدورُ نفسُه بديلاً عن الجلسة؛ ولا يمرّ
  -- المجهول ولا المسجَّل إلا كما كان (وبعد REVOKE لا يمرّ المسجَّل أصلاً).
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'auth required';
  end if;
  with incoming as (
    select *
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      tmdb_id integer, media_type text, status text, release_date text,
      next_air_date text, seasons integer, trailer_key text,
      last_air_date text, next_season_date text, next_season_num integer,
      theatrical_date text, chart_rank integer, providers text
    )
    limit 60
  )
  insert into public.title_snapshots
    (tmdb_id, media_type, status, release_date, next_air_date, seasons, trailer_key,
     last_air_date, next_season_date, next_season_num, theatrical_date,
     chart_rank, providers, updated_at)
  select
    i.tmdb_id, i.media_type,
    left(i.status, 40), left(i.release_date, 10), left(i.next_air_date, 10),
    i.seasons, left(i.trailer_key, 40),
    left(i.last_air_date, 10), left(i.next_season_date, 10), i.next_season_num,
    left(i.theatrical_date, 10), i.chart_rank, left(i.providers, 200), now()
  from incoming i
  where i.tmdb_id is not null
    and i.media_type in ('tv', 'movie')
  on conflict (tmdb_id, media_type) do update
     set status           = excluded.status,
         release_date     = excluded.release_date,
         next_air_date    = excluded.next_air_date,
         seasons          = excluded.seasons,
         trailer_key      = excluded.trailer_key,
         last_air_date    = excluded.last_air_date,
         next_season_date = excluded.next_season_date,
         next_season_num  = excluded.next_season_num,
         theatrical_date  = excluded.theatrical_date,
         chart_rank       = excluded.chart_rank,
         providers        = excluded.providers,
         updated_at       = now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

create or replace function public.set_news_posts(p_rows jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_count integer;
begin
  -- D-898 (LOOPZ-AUD-0040 · المجموعة B): الخادمُ يكتب بمفتاح service_role ولا
  -- جلسةَ له، فـauth.uid() فارغ. يُقبل الدورُ نفسُه بديلاً عن الجلسة؛ ولا يمرّ
  -- المجهول ولا المسجَّل إلا كما كان (وبعد REVOKE لا يمرّ المسجَّل أصلاً).
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'auth required';
  end if;
  with incoming as (
    select *
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      key text, kind text, tmdb_id integer, media_type text,
      title text, poster_path text, data jsonb
    )
    limit 60
  )
  insert into public.news_posts (key, kind, tmdb_id, media_type, title, poster_path, data)
  select
    left(x.key, 120), x.kind, x.tmdb_id, x.media_type,
    left(btrim(x.title), 300), left(x.poster_path, 120),
    coalesce(x.data, '{}'::jsonb)
  from incoming x
  where x.key is not null
    and x.kind in (
      'trailer', 'date', 'season', 'status', 'season_date', 'theatrical',
      'released', 'chart', 'provider', 'report'
    )
    and x.tmdb_id is not null
    and x.media_type in ('tv', 'movie')
    and length(btrim(coalesce(x.title, ''))) between 1 and 300
    and length(coalesce(x.data, '{}'::jsonb)::text) <= 400
    and (
      x.kind <> 'report'
      or (
        (x.data ->> 'event') in ('renewed', 'canceled', 'delayed')
        and coalesce(length(x.data ->> 'source'), 0) between 1 and 40
        and (
          (x.data ->> 'url') is null
          or public.news_host_ok(x.data ->> 'url')
        )
      )
    )
  on conflict (key) do nothing;
  get diagnostics v_count = row_count;
  delete from public.news_posts p
  where p.key in (
    select key from public.news_posts order by published_at desc offset 300
  );
  return v_count;
end;
$function$;

create or replace function public.set_talk_bulletins(p_rows jsonb)
 returns integer
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_count integer;
  /* **الهويّةُ هنا لا عند العميل** — وهي نفسُها ثابتُ `lib/loopz.ts`
     (D-252). **والمعرّفُ المحجوز لا يشبه الرايات.** */
  v_loopz constant uuid := '100b2000-0000-4000-8000-000000000001';
begin
  /* **زائرٌ لا يولّد** — نفسُ حارس `set_news_posts` */
  -- D-898 (LOOPZ-AUD-0040 · المجموعة B): الخادمُ يكتب بمفتاح service_role ولا
  -- جلسةَ له، فـauth.uid() فارغ. يُقبل الدورُ نفسُه بديلاً عن الجلسة؛ ولا يمرّ
  -- المجهول ولا المسجَّل إلا كما كان (وبعد REVOKE لا يمرّ المسجَّل أصلاً).
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'auth required';
  end if;

  with incoming as (
    select *
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      bulletin_key  text,
      kind          text,
      tmdb_id       integer,
      media_type    text,
      title         text,
      poster_path   text,
      backdrop_path text,
      data          jsonb,
      spoiler       jsonb
    )
    /* **سقفُ النداء الواحد** — والسقفُ الحقيقيُّ في `talkBulletins.ts`
       أضيقُ منه (ثلاثٌ في الدورة)؛ **هذا حدُّ القاعدة لا حدُّ المنتج** */
    limit 10
  )
  insert into public.title_posts (
    tmdb_id, media_type, title, poster_path, backdrop_path,
    user_id, body, parent_id, kind, bulletin_key, data, spoiler
  )
  select
    x.tmdb_id,
    x.media_type,
    left(btrim(x.title), 300),
    left(x.poster_path, 120),
    left(x.backdrop_path, 120),
    v_loopz,      -- الهويّة
    null,         -- **لا متنَ من العميل**
    null,         -- **جذرٌ دائماً: لا حقنَ في حديث أحد**
    x.kind,
    left(x.bulletin_key, 120),
    coalesce(x.data, '{}'::jsonb),
    x.spoiler
  from incoming x
  where x.bulletin_key is not null
    and length(btrim(x.bulletin_key)) > 0
    /* **قائمةٌ بيضاء في القاعدة لا في الشيفرة وحدها** — نسخةٌ قديمة من
       التطبيق لا تُدخل نوعاً أسقطناه (نفسُ حارس `set_news_posts`) */
    and x.kind in ('episode')
    and x.tmdb_id is not null
    and x.media_type in ('tv', 'movie')
    and length(btrim(coalesce(x.title, ''))) between 1 and 300
    /* **وطولُ النثر المحجوب مقصوص** — الحقلُ حرٌّ فحدُّه في القاعدة */
    and (
      x.spoiler is null
      or (
        jsonb_typeof(x.spoiler) = 'object'
        and coalesce(length(x.spoiler::text), 0) <= 4000
      )
    )
    and jsonb_typeof(coalesce(x.data, '{}'::jsonb)) = 'object'
    and coalesce(length(x.data::text), 0) <= 2000
  on conflict (bulletin_key) where bulletin_key is not null do nothing;

  get diagnostics v_count = row_count;
  return coalesce(v_count, 0);
end;
$function$;

-- ============================================================
--  التحقّق بعد التشغيل (قراءةً — لا استدعاءَ للدوالّ على الإنتاج):
--    select proname, prosecdef,
--           has_function_privilege('anon', oid, 'EXECUTE') as anon_exec,
--           position('service_role' in prosrc) > 0          as guard_ok
--    from pg_proc where pronamespace = 'public'::regnamespace
--      and proname in ('set_news_items','set_news_posts','set_title_snapshots','set_talk_bulletins');
--  المرصود بعد التشغيل: anon 132 · authenticated 172 · PUBLIC 14 · service_role 179
--  (أساسٌ جديد بعد هجرات ١٧٢→١٧٧ — والأعدادُ الأقدم لم تعد مرجعاً)
-- ============================================================
