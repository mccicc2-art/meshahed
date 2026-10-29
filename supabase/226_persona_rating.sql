-- =====================================================================
-- 226 — درجةُ شخصيّات لوبز AI على مراجعاتها (D-1565)
-- =====================================================================
-- أحمد ٢٩ أكتوبر ٢٠٢٦ (على لقطة صفّ «سامي» بجانب صفّ عضو): «تحت الاسم يكون مكتوب مراجعة و كذلك يقيم» — ثمّ «١أ ٢أ ٣أ … نفذ».
--
-- 🔑 **الدرجةُ تُرسم ولا تُحسب** (قراره «١أ»): عمودٌ في `persona_reviews` لا صفٌّ في `ratings` — فمتوسّطُ الجمهور والقوائمُ
--   وترتيبُ الأعمال والأشخاص لا تراها، كما لم ترَ مراجعاتِها قبل اليوم.
-- 🔑 **سلّمُ العضو نفسُه** («٢أ»): عددٌ صحيح ١–١٠ (`ratings.rating` smallint بالقيد نفسِه) — نجمةٌ واحدةٌ وشكلٌ واحد.
-- 🔑 **درجاتُ النماذج الثمانية من رأي كاتبها** («٣أ»: «اعملها انت حسب راي الشخصية»)، **وكلُّ مراجعةٍ بعدها بدرجة** — العمودُ
--   إلزاميٌّ، والكاتبُ (`persona_review_add`) يأخذها معاملاً.
-- ⚠️ الدوالُّ الثلاثُ التي تعيد صفوفاً تُسقط وتُبنى (نوعُ ما تعيده تغيّر، ولا يغيّره `create or replace`)، والكاتبُ والتعديلُ
--   يُسقطان لأنّ معاملاتهما تغيّرت — **ولا بيانَ يُمسّ غيرُ عمود الدرجة**.
--
-- ↩️ التراجع: أعد دوالّ الهجرة ٢٢٥ كما هي (الملفُّ نفسُه، الأقسام ٧ و٩ و١٠)، ثمّ
--   alter table public.persona_reviews drop column rating;

-- ── ١ · العمود، ودرجاتُ النماذج ─────────────────────────────────────────────────────────────────────────────────────
alter table public.persona_reviews add column if not exists rating smallint check (rating between 1 and 10);

update public.persona_reviews r set rating = v.rating
from public.personas p, (values
  ('adam',  'movie', 157336, 9),   -- إنترستيلر: «من أفضلها» لمن يحبّ الألغاز
  ('lina',  'movie', 157336, 8),   -- إنترستيلر: المشاعر صادقة، والعلمُ قد يُضيع
  ('sami',  'movie', 157336, 8),   -- إنترستيلر: «يستاهل؟ إيه» — بثلاث ساعاتٍ وشرحٍ ثقيل
  ('adam',  'tv',    70523,  9),   -- Dark الموسم الأول: لغزٌ يكافئ الانتباه
  ('lina',  'movie', 76,     9),   -- Before Sunrise: كيمياءٌ تنسيك أنّه تمثيل
  ('sami',  'tv',    136315, 8),   -- The Bear الموسم الأول: «ما فيها حشو» — بعد أوّلِ حلقةٍ فوضويّة
  ('faris', 'movie', 76341,  10),  -- Mad Max: Fury Road: مطاردةٌ لا ينزل توتّرها
  ('rami',  'movie', 60243,  9)    -- A Separation: دراما تبقى معك
) as v(slug, media_type, tmdb_id, rating)
where p.id = r.persona_id and p.slug = v.slug and r.media_type = v.media_type and r.tmdb_id = v.tmdb_id and r.rating is null;

-- كلُّ مراجعةٍ بدرجة من الآن (لا صفَّ بلا درجة: النماذجُ الثمانيةُ هي كلُّ ما في الجدول اليوم)
alter table public.persona_reviews alter column rating set not null;

-- ── ٢ · القراءة — الدرجةُ في صفّ العمل وصفّ الملفّ ───────────────────────────────────────────────────────────────────
drop function if exists public.title_persona_reviews(integer, text);
create function public.title_persona_reviews(t_id integer, m_type text)
returns table (persona_id uuid, username text, avatar_url text, scope_ar text, scope_en text,
               body_ar text, body_en text, has_spoiler boolean, publish_at timestamptz, rating smallint)
language sql stable security definer
set search_path = public, pg_temp as $$
  select r.persona_id, p.username, p.avatar_url, r.scope_ar, r.scope_en, r.body_ar, r.body_en, r.has_spoiler, r.publish_at, r.rating
    from public.persona_reviews r
    join public.profiles p on p.id = r.persona_id
   where r.tmdb_id = t_id and r.media_type = m_type
     and public.persona_review_visible(r.status, r.publish_at)
   order by r.publish_at desc
   limit 10;
$$;
revoke all on function public.title_persona_reviews(integer, text) from public;
grant execute on function public.title_persona_reviews(integer, text) to anon, authenticated;

drop function if exists public.persona_reviews_of(uuid, integer);
create function public.persona_reviews_of(p_persona uuid, p_limit integer default 60)
returns table (media_type text, tmdb_id integer, title text, poster_path text, scope_ar text, scope_en text,
               body_ar text, body_en text, has_spoiler boolean, publish_at timestamptz, rating smallint)
language sql stable security definer
set search_path = public, pg_temp as $$
  select r.media_type, r.tmdb_id, r.title, r.poster_path, r.scope_ar, r.scope_en, r.body_ar, r.body_en, r.has_spoiler, r.publish_at, r.rating
    from public.persona_reviews r
   where r.persona_id = p_persona
     and public.persona_review_visible(r.status, r.publish_at)
   order by r.publish_at desc
   limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;
revoke all on function public.persona_reviews_of(uuid, integer) from public;
grant execute on function public.persona_reviews_of(uuid, integer) to anon, authenticated;

-- ── ٣ · الكاتب — الدرجةُ معاملٌ إلزاميّ، ولا منحَ لأحد (المالكُ ينادي) ──────────────────────────────────────────────
drop function if exists public.persona_review_add(text, text, integer, text, text, text, text, text, text, jsonb, boolean, timestamptz);
create or replace function public.persona_review_add(
  p_slug text, p_media text, p_tmdb integer, p_title text, p_poster text,
  p_scope_ar text, p_scope_en text, p_body_ar text, p_body_en text,
  p_sources jsonb, p_spoiler boolean, p_publish_at timestamptz, p_rating smallint)
returns uuid language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  pid uuid;
  rid uuid;
begin
  select id into pid from public.personas where slug = p_slug;
  if pid is null then raise exception 'persona_review_add: unknown persona %', p_slug; end if;
  if p_rating is null or p_rating not between 1 and 10 then raise exception 'persona_review_add: rating 1-10 required'; end if;
  insert into public.persona_reviews (persona_id, media_type, tmdb_id, title, poster_path, scope_ar, scope_en,
                                      body_ar, body_en, sources, has_spoiler, publish_at, rating)
  values (pid, p_media, p_tmdb, nullif(btrim(p_title), ''), nullif(btrim(p_poster), ''), nullif(btrim(p_scope_ar), ''),
          nullif(btrim(p_scope_en), ''), btrim(p_body_ar), btrim(p_body_en), coalesce(p_sources, '[]'::jsonb),
          coalesce(p_spoiler, false), coalesce(p_publish_at, now()), p_rating)
  on conflict (persona_id, media_type, tmdb_id) do nothing
  returning id into rid;
  return rid;
end;
$$;
revoke all on function public.persona_review_add(text, text, integer, text, text, text, text, text, text, jsonb, boolean, timestamptz, smallint)
  from public, anon, authenticated;

-- ── ٤ · الإدارة — الدرجةُ في الطابور، وتُعدَّل كالنصّ ─────────────────────────────────────────────────────────────────
drop function if exists public.admin_persona_reviews(integer);
create function public.admin_persona_reviews(p_limit integer default 200)
returns table (id uuid, slug text, media_type text, tmdb_id integer, title text, scope_ar text, scope_en text,
               body_ar text, body_en text, has_spoiler boolean, status text, publish_at timestamptz,
               created_at timestamptz, visible boolean, likes integer, rating smallint)
language plpgsql stable security definer
set search_path = public, pg_temp as $$
begin
  if not public.am_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  return query
    select r.id, pe.slug, r.media_type, r.tmdb_id, r.title, r.scope_ar, r.scope_en, r.body_ar, r.body_en, r.has_spoiler,
           r.status, r.publish_at, r.created_at, public.persona_review_visible(r.status, r.publish_at),
           (select count(*)::integer from public.review_likes l
             where l.review_user_id = r.persona_id and l.tmdb_id = r.tmdb_id and l.media_type = r.media_type),
           r.rating
      from public.persona_reviews r
      join public.personas pe on pe.id = r.persona_id
     order by r.publish_at desc
     limit least(greatest(coalesce(p_limit, 200), 1), 500);
end;
$$;
revoke all on function public.admin_persona_reviews(integer) from public, anon;
grant execute on function public.admin_persona_reviews(integer) to authenticated;

drop function if exists public.admin_persona_review_update(uuid, text, text, text);
create or replace function public.admin_persona_review_update(p_id uuid, p_status text, p_body_ar text, p_body_en text, p_rating smallint default null)
returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if not public.am_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.persona_reviews set
    status     = coalesce(p_status, status),
    body_ar    = coalesce(nullif(btrim(p_body_ar), ''), body_ar),
    body_en    = coalesce(nullif(btrim(p_body_en), ''), body_en),
    rating     = coalesce(p_rating, rating),
    updated_at = now()
  where id = p_id;
end;
$$;
revoke all on function public.admin_persona_review_update(uuid, text, text, text, smallint) from public, anon;
grant execute on function public.admin_persona_review_update(uuid, text, text, text, smallint) to authenticated;

select count(*) filter (where rating is not null) as rated, count(*) as total from public.persona_reviews;
