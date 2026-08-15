-- ============================================================
--  ٨٠ — talk_bulletins · نشراتُ Loopz في غرف النقاش (D-261)
--  تُشغَّل بعد talk_reply_signals.sql (79)
--
--  **طلبُ أحمد بنصّه:** «من مهام Loopz في غرف النقاشات أنه ينشّط الغرفة…
--  نزول حلقة كذا بعنوان كذا وأخذت تقييم كذا، ويذكر أبرز ما فيها — بحيث
--  فقط يكتب للمسلسلات الترينديق».
--
--  ================= قراران أخذهما أحمد صراحةً =================
--
--  **(١) النشرةُ حقائقُ لا جملة.** الصفُّ يحمل رقمَ الحلقة وعنوانَها
--  ومدّتَها وتقييمَها في `data`، **والجملةُ تُصاغ عند العرض** من
--  `lib/i18n.ts` — **وهو نفسُه مبدأ D-211/`newsLine.ts` القائم**:
--  الخبرُ الواحد يُقرأ بالعربية والإنجليزية بلا عمودٍ ثانٍ، ومن بدّل
--  لغتَه وجد النشرةَ بلغته، **وتصحيحُ صياغةٍ يقع في `i18n.ts` وحدَه.**
--  ⚠️ **والبديلُ كان عطلاً مؤجَّلاً:** جملةٌ عربيةٌ محفوظةٌ في `body`
--  تصل القارئَ الإنجليزيَّ عربيةً **إلى الأبد، ولا علاجَ إلا حذفُ الصفّ.**
--
--  **(٢) الكتابةُ بحركة المرور لا بسرٍّ.** الدالّةُ ممنوحةٌ لـ`authenticated`
--  **كما هي `set_news_posts` حرفاً** (هجرة ٦٧) — **ولا عميلَ
--  `service_role` في هذا المشروع أصلاً**، ونمطُ التوليد كلُّه
--  «بحركة المرور، بلا سرٍّ وبلا صفِّ cron» (D-210/D-215).
--  **والحارسُ ليس في الدور بل في الدالّة:**
--    · **الهويّةُ ثابتةٌ في جسم الدالّة** — العميل لا يرسل `user_id`،
--      **فلا يستطيع أحدٌ أن ينشر باسم نفسه ولا باسم غيره.**
--    · **`parent_id` لا يُكتب أبداً** — النشرةُ جذرٌ دائماً، **فلا تُحقَن
--      ردّاً داخل حديث أحد.**
--    · **`body` لا يُقبل من العميل** — لا نصَّ حرّاً في متن النشرة.
--    · **قائمةٌ بيضاء لـ`kind`** وسقفُ عشرةِ صفوفٍ للنداء الواحد.
--    · **ومفتاحٌ فريدٌ جزئيّ** يجعل النشرةَ الواحدة مرّةً واحدة مهما
--      تكرّرت الدورة (D-130).
--  ⚠️ **وثمنٌ يُقال ولا يُخبَّأ:** `data` و`spoiler` حقولٌ حرّةٌ يرسلها
--  العميل، **فمن زوّر نداءً استطاع أن يدسّ ادّعاءً على شكل حلقة باسم
--  Loopz** — وهو **بعينه** سطحُ الثقة القائم اليوم في `set_news_posts`
--  (ترسل `title` و`data` حرَّين منذ الهجرة ٦٧). **لا يزيد بذرّة، ولا
--  يُدَّعى أنه صفر.** وحدُّه: نصٌّ مقصوصُ الطول، **يمرّ على React هرباً**
--  فلا HTML ولا سكربت.
--
--  ================= وما لا تفعله هذه الهجرة =================
--
--  **لا جدولَ جديداً، ولا سياسةَ قراءةٍ مفتوحة** — النشرةُ صفٌّ في
--  `title_posts` تقرؤه `title_thread` القائمة. **والسياساتُ المفتوحة
--  تبقى أربعاً.**
--
--  آمنةٌ للإعادة.
-- ============================================================

begin;

-- ============================================================
--  ١) الأعمدةُ الأربعة — كلُّها `null` للبشر
-- ============================================================

/* **مفتاحُ النشرة**: `ep:tv:1399:8:6` — يُبنى في `lib/talkBulletins.ts`.
   **وبلا مفتاحٍ تُكرَّر النشرةُ كلَّ دورة** (D-130). */
alter table public.title_posts
  add column if not exists bulletin_key text;

/* **نوعُ النشرة** — `episode` اليوم وحده. **والنوعُ عمودٌ لا استنتاجٌ من
   `bulletin_key is not null`**: يوم تُضاف نشرةُ موسمٍ أو مقطعٍ دعائيّ
   يكون التمييزُ قائماً، **ولأن القالبَ يُختار به عند العرض.**
   ⚠️ **وهو أيضاً حارسُ البشر:** صفٌّ `kind is null` هو كلامُ إنسان. */
alter table public.title_posts
  add column if not exists kind text;

/* **الحقائق** — `{"s":8,"e":6,"name":"…","runtime":80,"vote":9.9,"air":"…"}`.
   **ولا جملةَ محفوظة** (القرار ١ أعلاه). */
alter table public.title_posts
  add column if not exists data jsonb;

/* **ما خلف حاجب الحرق** (قرارُ أحمد الأوّل في `05`): وصفُ TMDB وحدَه —
   **والنشرةُ فوقه حقائقُ بلا حرق** (رقمُ الحلقة · عنوانُها · مدّتُها ·
   تقييمُها).
   ⚠️ **و`jsonb` لا `text`، والسببُ هو سببُ القرار (١) نفسُه**: الوصفُ
   نصُّ TMDB **بلغةٍ بعينها** — `{"ar":"…","en":"…"}` — **ونصٌّ واحدٌ
   محفوظٌ كان سيصل نصفَ القرّاء بلغةٍ لا يقرؤونها.** وهو عمودٌ واحدٌ
   لمعنًى واحد («النثرُ المحجوب»)، **يخدم نشرةَ Loopz اليوم ويخدم
   إنساناً يعلّم كلامَه حرقاً غداً** بمفتاحٍ واحدٍ في لغته. */
alter table public.title_posts
  add column if not exists spoiler jsonb;

-- ============================================================
--  ٢) `body` يصير اختيارياً — للنشرة وحدها
-- ============================================================
--  **النشرةُ بلا متن** بحكم القرار (١): متنُها يُصاغ عند العرض.
--  **وكلامُ الإنسان يبقى إلزامياً كما كان** — القيدُ ينتقل من العمود
--  إلى الجدول ليقول الشرطين معاً بدل أن يسقط أحدهما.
--
--  ⚠️ **والقيدُ القديم يُحذف باسمه المقروء من الكتالوج لا بالتخمين**:
--  اسمُ قيد العمود يولّده Postgres، **واسمٌ مُخمَّنٌ يجعل الهجرة تمرّ
--  وقد أبقت القيدَ** — فيفشل أوّلُ إدراجٍ للنشرة، بعد الشحن.
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'title_posts'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%btrim(body)%'
  loop
    execute format('alter table public.title_posts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.title_posts alter column body drop not null;

alter table public.title_posts drop constraint if exists title_posts_body_or_kind;
alter table public.title_posts add constraint title_posts_body_or_kind check (
  /* كلامُ إنسان: متنٌ إلزاميٌّ بحدّه القديم نفسِه */
  (kind is null and body is not null and length(btrim(body)) between 1 and 2000)
  /* نشرةُ Loopz: بلا متن، وحقائقُها في `data` */
  or (kind is not null and body is null)
);

-- ============================================================
--  ٣) الفهرسُ الفريد الجزئيّ — «نشرةٌ واحدة لكل حلقة» (D-130)
-- ============================================================
create unique index if not exists title_posts_bulletin_key_uidx
  on public.title_posts (bulletin_key)
  where bulletin_key is not null;

-- ============================================================
--  ٤) الكاتبةُ باسم Loopz
-- ============================================================
create or replace function public.set_talk_bulletins(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  /* **الهويّةُ هنا لا عند العميل** — وهي نفسُها ثابتُ `lib/loopz.ts`
     (D-252). **والمعرّفُ المحجوز لا يشبه الرايات.** */
  v_loopz constant uuid := '100b2000-0000-4000-8000-000000000001';
begin
  /* **زائرٌ لا يولّد** — نفسُ حارس `set_news_posts` */
  if auth.uid() is null then
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
$$;

revoke all on function public.set_talk_bulletins(jsonb) from public;
grant execute on function public.set_talk_bulletins(jsonb) to authenticated;

-- ============================================================
--  ٥) المرشَّحون — **يُقصّون قبل نداء TMDB لا بعده** (D-164)
-- ============================================================
--  **ولا نداءَ لاختيارهم أصلاً**: `title_snapshots` تحمل `last_air_date`
--  لكل عملٍ مراقَب — **تملؤها دورةُ الأخبار بحركة المرور** منذ الهجرة ٦٦.
--  فالسؤالُ «أيُّ مسلسلٍ نزلت له حلقةٌ في آخر ٤٨ ساعة؟» **جوابُه في
--  القاعدة**، وTMDB لا يُنادى إلا للفائزين الثلاثة.
--
--  **والنطاقُ هو ما اختاره أحمد**: قائمةُ المراقبة نفسُها =
--  `imdb_chart` ∪ `follows` (انظر `news_watch_slice`) — **الترينديق ∪ ما
--  في مكتبات المستخدمين.**
--  ⚠️ **وحدُّه يُقال ولا يُخبَّأ:** «الترينديق» هنا **جدولُنا** لا نقطةُ
--  `/trending` في TMDB؛ ومسلسلٌ رائجٌ لا يتابعه أحدٌ ولا يدخل الجدولَ
--  **لا يصله Loopz** حتى يدخل أحدَهما.
--
--  **ومن نُشر له لا يُنادى له**: الفهرسُ الفريد يمنع التكرار عند الكتابة،
--  **وهذا يمنع النداءَ من أصله.**
create or replace function public.talk_bulletin_slice(p_limit integer default 3)
returns table (
  tmdb_id       integer,
  media_type    text,
  last_air_date text,
  chart_rank    integer
)
language sql
stable
security definer
set search_path = public
as $$
  select s.tmdb_id, s.media_type, s.last_air_date, s.chart_rank
  from public.title_snapshots s
  where auth.uid() is not null
    and s.media_type = 'tv'
    and s.last_air_date is not null
    /* **الشكلُ يُفحص قبل التحويل** — نصٌّ مشوَّهٌ يرمي الاستعلامَ كلَّه */
    and s.last_air_date ~ '^\d{4}-\d{2}-\d{2}$'
    and s.last_air_date::date >= (now() at time zone 'utc')::date - 2
    and not exists (
      select 1
      from public.title_posts p
      where p.kind = 'episode'
        and p.tmdb_id = s.tmdb_id
        and p.media_type = s.media_type
        /* **نشرنا له بعد بثِّ هذه الحلقة** — فلا حاجةَ لسؤال TMDB.
           **والمقارنةُ بالتاريخ لا بالمفتاح** لأن رقمَ الحلقة لا يُعرف
           إلا بعد النداء — **والقصُّ قبله هو المقصود.** */
        and p.created_at::date >= s.last_air_date::date
    )
  /* **الرائجُ أوّلاً** ثم الأحدثُ بثّاً */
  order by s.chart_rank asc nulls last, s.last_air_date desc
  limit least(greatest(coalesce(p_limit, 3), 1), 10);
$$;

revoke all on function public.talk_bulletin_slice(integer) from public;
grant execute on function public.talk_bulletin_slice(integer) to authenticated;

-- ============================================================
--  ٦) بوّابةُ الاستحقاق — «هل حان الرصدُ التالي؟»
-- ============================================================
--  **تُسأل في القاعدة لا على ساعة الرسم** (نمطُ `news_gen_stale` حرفاً).
--  **ولا جدولَ حالةٍ جديد**: أحدثُ نشرةٍ هي الساعة.
create or replace function public.talk_bulletin_stale(p_minutes integer default 180)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select max(created_at) from public.title_posts where kind is not null)
      < now() - make_interval(mins => least(greatest(coalesce(p_minutes, 180), 30), 1440)),
    true);
$$;

revoke all on function public.talk_bulletin_stale(integer) from public;
grant execute on function public.talk_bulletin_stale(integer) to authenticated;

-- ============================================================
--  ٧) `title_thread` تحمل الأعمدةَ الثلاثة الجديدة
-- ============================================================
--  ⚠️ **والدالّةُ المتغيّر عائدها تُحذف أوّلاً** (D-037) — Postgres يردّ
--  `create or replace` بـ«cannot change return type of existing
--  function». **والأعمدةُ الجديدة تُلحق بالآخر** فلا يتزحزح قارئٌ قائم.
drop function if exists public.title_thread(integer, text);

create or replace function public.title_thread(t_id integer, m_type text)
returns table (
  id         uuid,
  parent_id  uuid,
  depth      smallint,
  author_id  uuid,
  nickname   text,
  username   text,
  avatar_url text,
  hide_name  boolean,
  body       text,
  created_at timestamptz,
  -- 🆕 D-261
  kind       text,
  data       jsonb,
  spoiler    jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.parent_id,
    r.depth,
    r.user_id as author_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.body,
    r.created_at,
    r.kind,
    r.data,
    r.spoiler
  from public.title_posts r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and r.tmdb_id = t_id
    and r.media_type = m_type
    and r.hidden = false
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
         or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
    )
  order by r.created_at asc
  limit 300;
$$;

revoke all on function public.title_thread(integer, text) from public;
grant execute on function public.title_thread(integer, text) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **استعلامٌ واحدٌ يُرجع صفّاً مجمّعاً** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from information_schema.columns
--      where table_schema='public' and table_name='title_posts'
--        and column_name in ('bulletin_key','kind','data','spoiler'))      as cols,
--   (select count(*)::int from pg_indexes
--      where schemaname='public' and indexname='title_posts_bulletin_key_uidx') as uidx,
--   (select count(*)::int from pg_constraint
--      where conname='title_posts_body_or_kind')                            as chk,
--   (select count(*)::int from pg_proc
--      where proname in ('set_talk_bulletins','talk_bulletin_slice','talk_bulletin_stale','title_thread')) as fns,
--   (select count(*)::int from public.title_posts where kind is not null)   as bulletins,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                           as open_policies;
--
--  **المتوقَّع:** `cols=4 | uidx=1 | chk=1 | fns=4 | bulletins=0 | open_policies=4`
--
--  ⚠️ **وفحصٌ ثانٍ يُشغَّل بعد أوّل دورةٍ حيّة** (وليس الآن):
-- select count(*)::int as loopz_roots
--   from public.title_posts
--  where kind = 'episode'
--    and user_id = '100b2000-0000-4000-8000-000000000001'
--    and parent_id is null
--    and body is null;   -- = عددُ النشرات، ولا صفَّ خارج هذا الشكل
