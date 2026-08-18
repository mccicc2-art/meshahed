-- ============================================================
--  Loopz — عتبةُ الأنمي وحدَها تنزل إلى عشرة آلاف (الهجرة ١١٥)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️⚠️ **الكودُ يُنشر أوّلاً ثم تُشغَّل هذه الهجرة** — وإلّا فلا أثرَ
--  لها أصلاً: **الحاجزُ يُطبَّق عند القراءة أيضاً** (D-323/`MIN_CHART_VOTES`)،
--  **فصفوفٌ تُبنى بعشرة آلافٍ ويقرؤها كودٌ يحرس بعشرين تسقط بصمت.**
--
--  ============ الإذن، ولمن هو ============
--
--  🔑 **موافقةُ أحمد بنصّها: «موافق»** على البابِ الثاني من D-382:
--  «تُخفَّض عتبةُ الأنمي وحدَها إلى ١٠٬٠٠٠ — نقضٌ صريحٌ لـD-323/D-365
--  يُسجَّل باسمه».
--
--  ============ ⚖️ ونقضٌ يُسجَّل باسمه لا يُمرَّر صامتاً ============
--
--  **D-323 (طلبُ أحمد نفسِه: «أي فلم أو مسلسل لم يصل ٢٠ ألف صوت يسقط»)
--  وD-365 (التي أنزلت العتبةَ إلى جسم البناء) — تطبيقُهما على الأنمي
--  يسقط هنا.** **والقاعدةُ الأمُّ باقيةٌ حرفاً**: «رقمٌ يكذب أسوأُ من لا
--  رقم» (D-219)، **والفيلمُ والمسلسلُ لم يُمسّا.**
--
--  **والذي تغيّر أن العشرين ألفاً كانت رقماً واحداً يحرس بِركتين
--  مختلفتين**: فيلمٌ إنجليزيٌّ يبلغها في شهرٍ من عرضه، **وأشهرُ الأنمي
--  كلِّه في IMDb ٢٠٦ أعمالٍ فوق الخمسة آلاف** (D-382). **فالعتبةُ تُقاس
--  بالبِركة التي تقف عليها لا بالرقم الذي نُسخ من صنفٍ آخر** — وهي
--  D-378 بحرفها.
--
--  ============ والمقيس قبل القرار، لا بعده ============
--
--  في `imdb_pool` اليومَ: **`≥20k = 136` · `≥15k = 165` · `≥10k = 188`
--  · `≥5k = 206`** (والبِركةُ لا تحوي أنمي دون الخمسة آلاف أصلاً).
--  **فالعشرةُ آلاف تكسب اثنين وخمسين عملاً** ولا تبلغ القاع.
--
--  ⚠️ **ولا تبلغ ٢٥٠ ولن تبلغها** (D-382): الباقي غيرُ موجودٍ في IMDb
--  فوق هذه العتبة، **والقائمةُ تُكمَّل بذيل مسار D-132** كما هي منذ
--  D-135. **والاسمُ ما زال يَعِد ٢٥٠** — **وهذا هو البابُ الثالث الذي لم
--  يُختَر، ويبقى مفتوحاً في `05`.**
--
--  ============ ولا `drop` ============
--
--  **جسمُ الدالّة وحدَه تغيّر بسطر** — التوقيعُ والعائدُ كما هما
--  (D-037)، **ولا جدولَ ولا سياسةَ ولا بيانات.**
-- ============================================================

begin;

create or replace function public.build_imdb_chart(p_limit integer default 250)
returns TABLE (kind text, n integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 250), 10), 500);
begin
  -- ⚠️ `where true` صراحةً — `safeupdate` تمنع الحذفَ الشامل بلا شرط
  delete from public.imdb_chart where true;

  insert into public.imdb_chart
    (kind, rank, tconst, tmdb_id, media_type, title, poster_path, rating, votes, is_doc)
  select k.kind, k.rn, k.tconst, k.tmdb_id, k.media_type, k.title,
         k.poster_path, k.rating, k.votes, k.is_doc
  from (
    select
      c.kind,
      row_number() over (
        partition by c.kind
        order by (c.votes::numeric / (c.votes + c.m)) * c.rating
               + (c.m::numeric / (c.votes + c.m)) * c.avg_rating desc,
                 c.votes desc
      ) as rn,
      c.tconst, c.tmdb_id, c.media_type, c.title, c.poster_path,
      c.rating, c.votes, c.is_doc
    from (
      select
        p.*,
        case when p.is_anime then 'anime'
             when p.media_type = 'movie' then 'movie'
             else 'tv' end as kind,
        -- ⚠️ **وثابتُ بايز `m` لم يُمَسّ** (D-365): العتبةُ تقول *من يدخل
        -- السباق*، و`m` يقول *كم يُسحب المتسابقُ نحو المتوسّط* —
        -- **ورقمان بمعنيين لا يُوحَّدان لأنهما تصادفا** (D-219).
        case when p.is_anime then 5000
             when p.media_type = 'movie' then 25000
             else 5000 end as m,
        avg(p.rating) over (
          partition by case when p.is_anime then 'anime'
                            when p.media_type = 'movie' then 'movie'
                            else 'tv' end
        ) as avg_rating
      from public.imdb_pool p
      -- ⚖️ **السطرُ كلُّه**: الأنمي عشرةُ آلاف، والمسلسلُ عشرون،
      -- والفيلمُ خمسةٌ وعشرون — **وثلاثةُ أرقامٍ لثلاث بِرَك** (D-385).
      where p.votes >= case when p.is_anime then 10000
                            when p.media_type = 'movie' then 25000
                            else 20000 end
    ) c
  ) k
  where k.rn <= lim;

  return query
    select ic.kind, count(*)::integer from public.imdb_chart ic group by ic.kind;
end;
$$;

revoke all on function public.build_imdb_chart(integer) from public;
grant execute on function public.build_imdb_chart(integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname='public' and p.proname='build_imdb_chart'
--        and pg_get_functiondef(p.oid) like '%then 10000%')            as anime_floor,
--   (select count(*)::int from pg_policies where qual = 'true')        as open_policies;
-- المتوقّع: anime_floor = 1 · open_policies = 4
--
-- ثم البناءُ وقراءةُ أثره:
--   select * from public.build_imdb_chart(250);
--   select kind, count(*), min(votes) from public.imdb_chart group by kind;
-- المتوقَّع: anime = 188 (كان 136) · movie = 250 · tv = 250.
