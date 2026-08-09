-- ============================================================
--  Loopz — عدد أصوات IMDb في المخزن (D-132) — رقم ٤٩
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّله **قبل** نشر ترتيب TOP 250 الجديد. وإن لم يُشغَّل فلا شيء
--  ينكسر: `set_imdb_ratings` تتجاهل المفتاح الزائد بصمت، والترتيب يسقط
--  إلى «بالتقييم ثم بأصوات TMDB» — أضعف، لا مكسور.
--
--  **لماذا العدد وليس التقييم وحده:**
--  فيلمٌ تقييمه ٩٫٤ بألف صوت ليس أعلى من «الأب الروحي» ٩٫٢ بمليونَي صوت،
--  و«الترتيب بالمتوسّط وحده» هو بالضبط ما جعل قائمتنا تحوي «أعمالاً غير
--  مقيَّمة وضعيفة» في نظر المجتمع. IMDb نفسها لا ترتّب بالمتوسّط: تنشر
--  صيغةً بايزيّة معلَنة تسحب المتوسّط نحو متوسّط القائمة بقدر قلّة
--  الأصوات — وتلك الصيغة تحتاج **عدد الأصوات**، وهو ما يضيفه هذا العمود.
--
--    weighted = (v / (v + m)) · R + (m / (v + m)) · C
--    R = تقييم العمل · v = أصواته · m = عتبة الأصوات · C = متوسّط البِركة
--
--  OMDb يعيد `imdbVotes` في نفس الردّ الذي نأخذ منه التقييم — فالعمود
--  **لا يكلّف طلباً واحداً إضافياً**. كنّا نرمي الرقم ونحن نقرؤه.
--
--  idempotent: إعادة تشغيله آمنة.
-- ============================================================

alter table public.imdb_ratings
  add column if not exists imdb_votes bigint;

-- ============================================================
--  الكتابة دفعةً — نفس الدالّة بمفتاحٍ خامس. `coalesce` على الموجود
--  يمنع نشرةً قديمة (قبل النشر) من مسح الأصوات بـnull وهي لا تعرفها.
-- ============================================================
create or replace function public.set_imdb_ratings(p_rows jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.imdb_ratings (media_type, tmdb_id, imdb_id, imdb_rating, imdb_votes, updated_at)
  select
    r ->> 'media_type',
    (r ->> 'tmdb_id')::bigint,
    nullif(r ->> 'imdb_id', ''),
    nullif(r ->> 'imdb_rating', '')::numeric,
    nullif(r ->> 'imdb_votes', '')::bigint,
    now()
  from jsonb_array_elements(p_rows) as r
  where (r ->> 'media_type') in ('movie', 'tv')
    and (r ->> 'tmdb_id') ~ '^\d+$'
  on conflict (media_type, tmdb_id) do update
    set imdb_id     = excluded.imdb_id,
        imdb_rating = excluded.imdb_rating,
        imdb_votes  = coalesce(excluded.imdb_votes, public.imdb_ratings.imdb_votes),
        updated_at  = now();
$$;

revoke all on function public.set_imdb_ratings(jsonb) from public;
grant execute on function public.set_imdb_ratings(jsonb) to authenticated;
-- التسخين المجدوَل يعمل بلا جلسة مستخدم (Vercel Cron → مفتاح الخدمة)
grant execute on function public.set_imdb_ratings(jsonb) to service_role;

-- ============================================================
--  التحقّق بعد التشغيل
--
--   ١) العمود:
--      select column_name from information_schema.columns
--      where table_schema='public' and table_name='imdb_ratings';
--      -- المتوقّع: media_type · tmdb_id · imdb_id · imdb_rating
--      --           · updated_at · imdb_votes
--
--   ٢) الدالّة تقبل المفتاح الجديد:
--      select public.set_imdb_ratings('[{"media_type":"movie","tmdb_id":238,
--        "imdb_id":"tt0068646","imdb_rating":"9.2","imdb_votes":"2100000"}]'::jsonb);
--      select imdb_rating, imdb_votes from public.imdb_ratings
--      where media_type='movie' and tmdb_id=238;
--
--   ٣) **الاستعلام الصحّي لم يتغيّر** — لا جدول ولا سياسة جديدة، وسياسة
--      القراءة العامة على `imdb_ratings` كانت موجودة منذ الهجرة 44:
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
--      -- المتوقَّع: user_follows · communities · imdb_ratings
-- ============================================================
