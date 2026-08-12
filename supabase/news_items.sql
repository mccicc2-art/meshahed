-- ============================================================
--  Loopz — الأخبار الحقيقية: الجدول وبابَاه (هجرة 64، D-209)
--  شغّلها في Supabase → SQL Editor بعد list_cover.sql (63)
--
--  المرحلةُ الأولى (D-209) شحنت الفاحصَ وحده وأجابت السؤالَ الذي لا
--  يجيبه إلا الخادم: **أيُّ فيدٍ يُجلب من Vercel فعلاً؟** وهذه المرحلة
--  تخزّن ما يُجلب.
--
--  ⚠️ **ولا سياسةَ قراءةٍ مفتوحة خامسة:** الجدولُ محميٌّ بـRLS **بلا
--  سياسةٍ واحدة**، والبابانِ دالّتان `security definer` — قراءةٌ وكتابة.
--  **فالسياساتُ المفتوحة تبقى أربعاً** كما في الهجرتين ٦٢ و٦٣.
--
--  ⚠️ **وحدُّ الأمان يُقال صراحةً:** التطبيق لا يملك مفتاحَ خدمةٍ في
--  بيئته (قرارٌ قائم: كل سرٍّ إضافيّ خطوةٌ يدوية تُنسى)، فالكتابةُ تجري
--  بجلسة المستخدم الذي أطلق التجديد. **ولذلك لا يُوثَق بجسم الطلب:**
--  الدالّة أدناه ترفض كلَّ رابطٍ لا يقع نطاقُه في القائمة البيضاء، وكلَّ
--  مصدرٍ ليس في السجلّ، وتفرض سقفاً وطولاً وبرودةً بين الدفعات،
--  **و`on conflict do nothing` فلا يُعاد كتابةُ خبرٍ موجود.** أقصى ما
--  يستطيعه مسجَّلٌ خبيث: نصٌّ يشير إلى نطاقٍ إخباريٍّ نعرفه — لا رابطَ
--  خارجيّ ولا صورةَ من عنده. **والعلاجُ التامّ سطرٌ واحد يوم يُضاف مفتاح
--  الخدمة: `revoke execute … from authenticated`.**
--
--  آمنٌ للإعادة.
-- ============================================================

begin;

create table if not exists public.news_items (
  /* الرابطُ هو المفتاح: الفيدُ نفسُه قد يعيد الخبر بمعرّفٍ مختلف،
     والرابطُ لا يتغيّر — فلا تكرارَ ولو ابتُلع الفيدُ عشر مرّات */
  url          text primary key,
  source       text not null,
  /* اسمُ الناشر كما جاء في الفيد (جوجل نيوز يذيّل عنوانه بـ«— مصراوي»)،
     ويُخزَّن منفصلاً كي لا يُقرأ جزءاً من الخبر */
  source_label text,
  lang         text not null check (lang in ('ar', 'en')),
  title        text not null check (length(btrim(title)) between 3 and 300),
  summary      text check (summary is null or length(summary) <= 500),
  /* **ولا عمودَ صورة.** صورُ الفيد تُحجب أصلاً بسياسة المحتوى
     (`img-src` عندنا: TMDB وجوجل وسوبابيس لا غير)، **وفتحُها لكل ناشرٍ
     يعني فتحَ نطاقٍ لكل خبرٍ يدخل** — وهو نقيضُ القائمة البيضاء أدناه.
     فالصورةُ ملصقُ العمل بعد المطابقة، ومن لا عملَ له فبطاقةُ نصّ.
     **وفيدُ بحث جوجل بلا صورٍ أصلاً**، فلا شيءَ يُفقد. */
  published_at timestamptz,
  /* النسبةُ إلى عمل — **تبقى فارغةً حتى تُثبَّت بمعرّف TMDB** (D-144):
     المطابقةُ بالاسم هي التي كذبت علينا في جداول الجوائز */
  tmdb_id      integer,
  media_type   text check (media_type is null or media_type in ('tv', 'movie')),
  created_at   timestamptz not null default now()
);

create index if not exists news_items_lang_idx
  on public.news_items (lang, published_at desc nulls last);
create index if not exists news_items_title_idx
  on public.news_items (tmdb_id, media_type)
  where tmdb_id is not null;

alter table public.news_items enable row level security;
-- لا سياسة. القراءةُ والكتابةُ بالدالّتين أدناه وحدهما.

-- ============================================================
--  القائمةُ البيضاء للنطاقات — حدُّ الثقة الحقيقيّ
-- ============================================================
-- **ولماذا لا يُتبَع رابطُ جوجل إلى ناشره:** كان ذاك أصدقَ شكلاً، لكنه
-- **يهدم هذه القائمة** — إذ يصير النطاقُ أيَّ نطاقٍ في الدنيا، فيسقط
-- الحارسُ الوحيد الذي نملكه بلا مفتاح خدمة. **فيبقى رابطُ جوجل، ويُعرض
-- اسمُ الناشر بجانبه.**
create or replace function public.news_host_ok(p_url text)
returns boolean
language sql
immutable
as $$
  select p_url ~ '^https://([a-z0-9-]+\.)*(news\.google\.com|tvline\.com|screenrant\.com|slashfilm\.com|deadline\.com|variety\.com|animenewsnetwork\.com|myanimelist\.net|arabic\.cnn\.com|euronews\.com)/';
$$;

-- ============================================================
--  الكتابة
-- ============================================================
create or replace function public.set_news_items(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last  timestamptz;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'auth required';
  end if;

  /* برودةٌ بين الدفعات: التجديدُ يقع بحركة المرور، **فعشرةُ زوّارٍ في
     دقيقةٍ لا يعنون عشرَ دفعات**. وهي أيضاً سقفُ ما يستطيعه مسيءٌ. */
  select max(created_at) into v_last from public.news_items;
  if v_last is not null and v_last > now() - interval '5 minutes' then
    return 0;
  end if;

  with incoming as (
    select *
    from jsonb_to_recordset(coalesce(p_rows, '[]'::jsonb)) as x(
      url text, source text, source_label text, lang text,
      title text, summary text,
      published_at timestamptz, tmdb_id integer, media_type text
    )
    limit 120
  ),
  clean as (
    select
      i.url,
      i.source,
      nullif(left(btrim(i.source_label), 80), '')            as source_label,
      i.lang,
      left(btrim(i.title), 300)                              as title,
      nullif(left(btrim(coalesce(i.summary, '')), 500), '')  as summary,
      i.published_at,
      i.tmdb_id,
      i.media_type
    from incoming i
    where public.news_host_ok(i.url)
      and i.lang in ('ar', 'en')
      and i.source in (
        'tvline', 'screenrant', 'slashfilm', 'deadline', 'variety',
        'ann', 'mal', 'cnn-arabic-ent', 'euronews-arabic-culture',
        'gnews-ar-series', 'gnews-ar-movies', 'gnews-ar-anime'
      )
      and length(btrim(coalesce(i.title, ''))) between 3 and 300
      and (i.media_type is null or i.media_type in ('tv', 'movie'))
  )
  insert into public.news_items
    (url, source, source_label, lang, title, summary, published_at, tmdb_id, media_type)
  select url, source, source_label, lang, title, summary, published_at, tmdb_id, media_type
  from clean
  /* **لا يُعاد كتابةُ خبرٍ موجود**: أوّلُ نسخةٍ تدخل هي النسخة، فلا
     يستطيع نداءٌ لاحق تبديلَ عنوانِ خبرٍ مقروء */
  on conflict (url) do nothing;

  get diagnostics v_count = row_count;

  /* تنظيفٌ في نفس الدفعة: ألفُ خبرٍ سقفاً، والأقدمُ يخرج. جدولٌ ينمو
     بلا حدّ يصير كلفةً بلا قارئ — **ولا أحدَ يفتح خبرَ الشهر الماضي.** */
  delete from public.news_items n
  where n.url in (
    select url from public.news_items
    order by coalesce(published_at, created_at) desc
    offset 1000
  );

  return v_count;
end;
$$;

revoke all on function public.set_news_items(jsonb) from public;
grant execute on function public.set_news_items(jsonb) to authenticated;

-- ============================================================
--  القراءة
-- ============================================================
-- **التصفيةُ بلغة الواجهة — طلبُ أحمد الصريح.** ومن اختار الإنجليزية لا
-- يرى عناوينَ عربية والعكس: خبرٌ لا يُقرأ ليس خبراً.
create or replace function public.news_feed(p_lang text, p_limit integer default 30)
returns table (
  url          text,
  source       text,
  source_label text,
  title        text,
  summary      text,
  published_at timestamptz,
  tmdb_id      integer,
  media_type   text
)
language sql
stable
security definer
set search_path = public
as $$
  select n.url, n.source, n.source_label, n.title, n.summary,
         n.published_at, n.tmdb_id, n.media_type
  from public.news_items n
  where n.lang = case when p_lang = 'en' then 'en' else 'ar' end
  order by coalesce(n.published_at, n.created_at) desc
  limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;

revoke all on function public.news_feed(text, integer) from public;
grant execute on function public.news_feed(text, integer) to authenticated;

/* «متى آخرُ ابتلاع؟» — عليه يقوم التجديدُ بحركة المرور: من يفتح التبويب
   بعد ساعةٍ يُطلق دفعةً في الخلفية ولا ينتظرها. **رقمٌ واحد لا صفوف**
   (نمط `new_feed_count` في الهجرة ٥٨). */
create or replace function public.news_last_at()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select max(created_at) from public.news_items;
$$;

revoke all on function public.news_last_at() from public;
grant execute on function public.news_last_at() to authenticated;

/* **والسؤالُ يُطرح على القاعدة لا على الساعة:** «هل بردت الأخبار؟».
   قراءةُ `Date.now()` أثناء رسم صفحةٍ تنقض قاعدةَ نقاء React عندنا
   (و`eslint` يرفضها)، **والقاعدةُ تعرف وقتَها بنفسها** — فالجوابُ
   `boolean` واحد لا حسابٌ في الواجهة. */
create or replace function public.news_is_stale(p_minutes integer default 60)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select max(created_at) from public.news_items)
      < now() - make_interval(mins => least(greatest(coalesce(p_minutes, 60), 5), 1440)),
    true);
$$;

revoke all on function public.news_is_stale(integer) from public;
grant execute on function public.news_is_stale(integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select count(*)::int as tbl from pg_tables
--  where schemaname='public' and tablename='news_items';                 -- 1
-- select count(*)::int as pol from pg_policies where tablename='news_items'; -- 0
-- select count(*)::int as fns from pg_proc
--  where proname in ('set_news_items','news_feed','news_last_at','news_host_ok'); -- 4
-- select public.news_host_ok('https://news.google.com/rss/articles/x');  -- true
-- select public.news_host_ok('https://evil.example.com/x');              -- false
--
-- ⚠️ والسياساتُ المفتوحة تبقى **أربعاً**:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
