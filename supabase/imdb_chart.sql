-- ============================================================
--  Loopz — قائمة IMDb الحقيقية من ملفّاتها المفتوحة (D-135) — رقم ٥٠
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّله **قبل** استدعاء `/api/imdb-chart`. وإن لم يُشغَّل فلا شيء
--  ينكسر: القوائم تسقط إلى مسار D-132 (بِركة TMDB مرتّبةً بتقييم IMDb).
--
--  **لماذا هذا الملف موجود أصلاً:**
--  في D-132 صار الترتيب والأرقام من IMDb، لكن **بِركة المرشّحين بقيت من
--  TMDB** — أي أن عملاً في قائمة IMDb الحقيقية قد يغيب عن قائمتنا لأنه
--  لم يدخل أربعمئة TMDB أصلاً. وهذا نقصٌ لا يراه إلا من يعرف القائمة عن
--  ظهر قلب، وهم بالضبط من يختبروننا.
--
--  IMDb تنشر ملفّاتها مجاناً (`datasets.imdbws.com`) وتحدّثها يومياً.
--  `title.ratings.tsv` فيه **تقييم وعدد أصوات كل عملٍ في IMDb** — مليونٌ
--  ونصف سطر. منه تُبنى البِركة الحقيقية بلا وسيط.
--
--  **ما لا يفعله هذا الملف، بصدق:** `title.basics` (١٫٥ جيجابايت) لا
--  يُقرأ — يقتل أي وظيفةٍ بلا خادمٍ دائم. فنوعُ العمل (أفيلمٌ هو أم
--  مسلسل أم **حلقة**) يُعرف من TMDB عند حلّ المعرّف لا من الملف. ولولا
--  ذلك لتصدّرت حلقاتُ المسلسلات القائمة: «Ozymandias» تقييمها ٩٫٩.
--
--  جدولان: `imdb_pool` مسوّدةٌ تُملأ على دفعات، و`imdb_chart` النتيجة
--  النهائية التي تقرأها الصفحات. الفصل مقصود: المَلء يُستأنف مرّاتٍ،
--  والقائمة المعروضة يجب ألّا تُرى نصف ممتلئة.
--
--  idempotent: إعادة تشغيله آمنة.
-- ============================================================

-- ============================================================
--  ١) المسوّدة — ما حُلّ من معرّفات IMDb إلى أعمال TMDB
-- ============================================================
create table if not exists public.imdb_pool (
  tconst      text primary key,
  tmdb_id     bigint not null,
  media_type  text not null check (media_type in ('movie', 'tv')),
  title       text,
  poster_path text,
  rating      numeric not null,
  votes       bigint not null,
  -- أنمي: مسلسلٌ رسومٌ متحرّكة بلغةٍ أصلية يابانية — يُقرأ من ردّ
  -- `/find` نفسه (genre_ids + original_language) بلا نداءٍ ثانٍ
  is_anime    boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table public.imdb_pool enable row level security;
-- لا سياسة قراءة: المسوّدة لا تُقرأ من العميل إطلاقاً، والكتابة definer

create index if not exists imdb_pool_rank_idx
  on public.imdb_pool (media_type, is_anime, votes desc);

-- ============================================================
--  ٢) القائمة النهائية — ما تقرأه الصفحات
-- ============================================================
create table if not exists public.imdb_chart (
  kind        text not null check (kind in ('movie', 'tv', 'anime')),
  rank        integer not null,
  tconst      text not null,
  tmdb_id     bigint not null,
  media_type  text not null check (media_type in ('movie', 'tv')),
  title       text,
  poster_path text,
  rating      numeric not null,
  votes       bigint not null,
  updated_at  timestamptz not null default now(),
  primary key (kind, rank)
);

alter table public.imdb_chart enable row level security;

-- القراءة عامة كـ`imdb_ratings` (44): أرقامٌ علنية بلا عمود مستخدم.
-- ⚠️ **سياسةٌ مفتوحة رابعة** — حدِّث الاستعلام الصحّي في `04`.
drop policy if exists imdb_chart_read on public.imdb_chart;
create policy imdb_chart_read on public.imdb_chart
  for select using (true);

-- ============================================================
--  ٣) الكتابة — دالّتان definer، لا كتابة مباشرة (قاعدة RLS في 00)
-- ============================================================
create or replace function public.set_imdb_pool(p_rows jsonb)
returns integer
language sql
security definer
set search_path = public
as $$
  with ins as (
    insert into public.imdb_pool
      (tconst, tmdb_id, media_type, title, poster_path, rating, votes, is_anime, updated_at)
    select
      r ->> 'tconst',
      (r ->> 'tmdb_id')::bigint,
      r ->> 'media_type',
      nullif(r ->> 'title', ''),
      nullif(r ->> 'poster_path', ''),
      (r ->> 'rating')::numeric,
      (r ->> 'votes')::bigint,
      coalesce((r ->> 'is_anime')::boolean, false),
      now()
    from jsonb_array_elements(p_rows) as r
    where (r ->> 'media_type') in ('movie', 'tv')
      and (r ->> 'tmdb_id') ~ '^\d+$'
      and (r ->> 'tconst') ~ '^tt\d+$'
    on conflict (tconst) do update
      set tmdb_id     = excluded.tmdb_id,
          media_type  = excluded.media_type,
          title       = excluded.title,
          poster_path = excluded.poster_path,
          rating      = excluded.rating,
          votes       = excluded.votes,
          is_anime    = excluded.is_anime,
          updated_at  = now()
    returning 1
  )
  select count(*)::integer from ins;
$$;

/**
 *  التثبيت: يبني الأصناف الثلاثة من المسوّدة **دفعةً واحدة داخل معاملة**
 *  فلا تُرى القائمة نصف ممتلئة.
 *
 *  الترتيب هو صيغة IMDb البايزيّة نفسها المستعملة في `omdb.ts` — عتبة
 *  ٢٥ ألف صوت للأفلام وخمسة آلاف للمسلسلات والأنمي، ومتوسّط البِركة
 *  يُحسب من المؤهَّلين وحدهم. تكرار الصيغة هنا مقصود: القائمة تُبنى
 *  مرّةً كل حين في القاعدة، ولا يجوز أن ينتظر بناؤها رحلةً إلى العميل.
 */
create or replace function public.build_imdb_chart(p_limit integer default 250)
returns TABLE (kind text, n integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 250), 10), 500);
begin
  delete from public.imdb_chart;

  insert into public.imdb_chart
    (kind, rank, tconst, tmdb_id, media_type, title, poster_path, rating, votes)
  select k.kind, k.rn, k.tconst, k.tmdb_id, k.media_type, k.title,
         k.poster_path, k.rating, k.votes
  from (
    select
      c.kind,
      row_number() over (
        partition by c.kind
        order by (c.votes::numeric / (c.votes + c.m)) * c.rating
               + (c.m::numeric / (c.votes + c.m)) * c.avg_rating desc,
                 c.votes desc
      ) as rn,
      c.tconst, c.tmdb_id, c.media_type, c.title, c.poster_path, c.rating, c.votes
    from (
      select
        p.*,
        case when p.media_type = 'movie' then 'movie'
             when p.is_anime then 'anime'
             else 'tv' end as kind,
        case when p.media_type = 'movie' then 25000 else 5000 end as m,
        avg(p.rating) over (
          partition by case when p.media_type = 'movie' then 'movie'
                            when p.is_anime then 'anime'
                            else 'tv' end
        ) as avg_rating
      from public.imdb_pool p
      where p.votes >= case when p.media_type = 'movie' then 25000 else 5000 end
    ) c
  ) k
  where k.rn <= lim;

  return query
    select ic.kind, count(*)::integer from public.imdb_chart ic group by ic.kind;
end;
$$;

revoke all on function public.set_imdb_pool(jsonb) from public;
revoke all on function public.build_imdb_chart(integer) from public;
grant execute on function public.set_imdb_pool(jsonb) to authenticated;
grant execute on function public.build_imdb_chart(integer) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
--
--   ١) الجدولان والدالّتان:
--      select tablename from pg_tables where schemaname='public'
--        and tablename in ('imdb_pool','imdb_chart');
--      select proname from pg_proc
--        where proname in ('set_imdb_pool','build_imdb_chart');
--
--   ٢) بعد تشغيل `/api/imdb-chart` (انظر `19_Tools_And_Access.md`):
--      select kind, count(*), min(rating), max(rating) from public.imdb_chart
--      group by kind;
--      -- المتوقّع: movie/tv/anime بـ٢٥٠ لكلٍّ (أو أقلّ للأنمي)
--
--      select rank, title, rating, votes from public.imdb_chart
--      where kind='movie' order by rank limit 10;
--      -- المتوقّع: Shawshank · Godfather · Dark Knight … بأصواتٍ بالملايين
--
--   ٣) ⚠️ **الاستعلام الصحّي تغيّر**: صارت أربع سياساتٍ مفتوحة لا ثلاث —
--      `user_follows` · `communities` · `imdb_ratings` · **`imdb_chart`**.
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
-- ============================================================
