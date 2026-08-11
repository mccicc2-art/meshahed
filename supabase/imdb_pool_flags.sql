-- ============================================================
--  ٦٠ — علَما البِركة: `is_doc` ورفعُ شرط `tv` عن `is_anime`
--
--  **هجرةٌ واحدة تسدّ دَينَين معلَنين** (البند ١١ في `05_Todo`):
--
--   • **D-165 — الوثائقيات:** رفوف «أفضل ٥٠» تُخرج الوثائقيات، واليوم
--     تعرفها بنداء TMDB لكل عنوان — **نحو ثمانين نداءً لكل رسمة رفّ**.
--     و`imdb_pool` لا تحمل نوعاً أصلاً، فالعلم يُكتب مرّةً عند الحلّ
--     (نفسُ ردّ `/find` الذي يعطي `is_anime`) ويُقرأ ألف مرّة.
--
--   • **D-169/D-170 — أفلام الأنمي:** `is_anime` يشترط `media_type='tv'`
--     في الشيفرة، **وترتيبُ `case` هنا يشترطه ثانيةً**: `when
--     p.media_type = 'movie' then 'movie'` يسبق فحصَ الأنمي، فحتى لو
--     وصل فيلمُ أنمي بعلَمه لسقط في صنف الأفلام. فالإصلاح في الطرفين
--     معاً — **وهذا نصفُه.**
--
--  ⚠️ **آمنةٌ اليوم بلا أثر:** لا صفَّ في البِركة اليوم بـ`is_anime`
--  وهو فيلم (الشيفرة تمنعه)، فإعادةُ ترتيب `case` لا تغيّر تصنيف صفٍّ
--  واحد. و`is_doc` يبدأ `false` للجميع فلا يسقط شيءٌ من رفٍّ.
--  **الأثر يظهر بعد شيئين معاً:** شحنِ الشيفرة التي ترسل العلَمين، ثم
--  إعادةِ ملء البِركة (`/api/imdb-chart?part=0…15` ثم `?step=build`).
--
--  ترتيب التشغيل: بعد ٥٩. لا سياسة قراءةٍ جديدة — **تبقى أربعاً.**
-- ============================================================

-- ------------------------------------------------------------
--  ١) العمودان
-- ------------------------------------------------------------
alter table public.imdb_pool
  add column if not exists is_doc boolean not null default false;

-- والقائمة النهائية تحمله أيضاً: الرفّ يقرأ `imdb_chart` لا البِركة،
-- فعلَمٌ يقف عند المسوّدة لا يوفّر نداءً واحداً على الرفوف
alter table public.imdb_chart
  add column if not exists is_doc boolean not null default false;

-- الفهرس يضمّ العلَم الجديد: القراءةُ الشائعة «صنفٌ بلا وثائقيات مرتّبٌ
-- بالأصوات». والقديم يُترك — `if not exists` لا تُعدّل فهرساً قائماً
create index if not exists imdb_pool_kind_idx
  on public.imdb_pool (media_type, is_anime, is_doc, votes desc);

-- ------------------------------------------------------------
--  ٢) الكاتب يقبل العلَمين
--
--  `coalesce(... , false)` لا `not null` بلا افتراض: دفعةٌ قديمة من
--  شيفرةٍ لم تُشحن بعد لا تحمل المفتاح — **والقارئ المتسامح يمنع أن
--  تسقط الدفعة كلّها لأجل حقلٍ ناقص**.
-- ------------------------------------------------------------
create or replace function public.set_imdb_pool(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.imdb_pool
    (tconst, tmdb_id, media_type, title, poster_path, rating, votes,
     is_anime, is_doc, updated_at)
  select
    r ->> 'tconst',
    (r ->> 'tmdb_id')::bigint,
    r ->> 'media_type',
    r ->> 'title',
    r ->> 'poster_path',
    (r ->> 'rating')::numeric,
    (r ->> 'votes')::bigint,
    coalesce((r ->> 'is_anime')::boolean, false),
    coalesce((r ->> 'is_doc')::boolean, false),
    now()
  from jsonb_array_elements(p_rows) as r
  where r ? 'tconst'
    and r ? 'tmdb_id'
    and (r ->> 'media_type') in ('movie', 'tv')
  on conflict (tconst) do update set
    tmdb_id     = excluded.tmdb_id,
    media_type  = excluded.media_type,
    title       = excluded.title,
    poster_path = excluded.poster_path,
    rating      = excluded.rating,
    votes       = excluded.votes,
    is_anime    = excluded.is_anime,
    is_doc      = excluded.is_doc,
    updated_at  = excluded.updated_at;

  get diagnostics n = row_count;
  return n;
end;
$$;

-- ------------------------------------------------------------
--  ٣) البنّاء — **الأنمي يُفحص أوّلاً**، والعلَم يُحمل إلى القائمة
--
--  ما تغيّر عن ٥٠ سطراً بسطر:
--   • `case when p.is_anime then 'anime' … ` سبق فحصَ الأفلام (مرّتين:
--     في `kind` وفي نافذة `avg_rating`) — **فصار فيلمُ الأنمي أنمي**.
--   • عتبةُ الأصوات تتبع الصنف لا الوسيط: فيلمُ أنميٍ يدخل بخمسة آلاف
--     كأخيه المسلسل، لا بخمسةٍ وعشرين ألفاً — **وإلا لسقط نصفُ الصنف
--     الجديد وهو يُولد** (روح الربيع تجاوزها، وأعمالٌ أقلّ شهرةً لا).
--   • `is_doc` يُنقل كما هو.
--  وما لم يتغيّر: الصيغة البايزيّة، و`where true` في الحذف (مصيدة
--  `safeupdate`)، والسقف.
-- ------------------------------------------------------------
create or replace function public.build_imdb_chart(p_limit integer default 250)
returns TABLE (kind text, n integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 250), 10), 500);
begin
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
        case when p.is_anime then 5000
             when p.media_type = 'movie' then 25000
             else 5000 end as m,
        avg(p.rating) over (
          partition by case when p.is_anime then 'anime'
                            when p.media_type = 'movie' then 'movie'
                            else 'tv' end
        ) as avg_rating
      from public.imdb_pool p
      where p.votes >= case when p.is_anime then 5000
                            when p.media_type = 'movie' then 25000
                            else 5000 end
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
--  التحقّق بعد التشغيل — شغّله فعلاً ولا تكتفِ بوجوده
--
--   ١) العمودان موجودان (المتوقَّع صفّان):
--      select table_name, column_name from information_schema.columns
--      where table_schema='public' and column_name='is_doc'
--        and table_name in ('imdb_pool','imdb_chart');
--
--   ٢) البنّاء يعمل ولم يفقد شيئاً (المتوقَّع نفس أعداد ما قبل الهجرة —
--      لأن لا صفَّ يحمل العلَمين الجديدين بعد):
--      select * from public.build_imdb_chart(250);
--
--   ٣) السياسات المفتوحة **أربعٌ لا خمس**:
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
--
--   ٤) **بعد شحن الشيفرة وإعادة ملء البِركة** — وهنا وحده يظهر الأثر:
--      select kind, count(*) from public.imdb_chart group by kind;
--      -- المتوقَّع: أنميٌّ فيه **أفلامٌ لأوّل مرّة** (روح الربيع · اسمك)
--      select count(*) from public.imdb_pool where is_doc;
--      -- المتوقَّع: أكبر من صفر (Planet Earth وأخواتها)
-- ============================================================
