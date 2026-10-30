-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
-- 228 · شخصيّات لوبز AI — الدفعة الثانية (D-1605): النشاطُ لمن يتابعها · مرشّحو الكتابة · الكاتبُ المفحوص
--
-- أحمد ٣٠ أكتوبر: «١أ ٢أ ٣ب» ثمّ «من يتابع الشخصية يرى مراجعاتها في النشاط» ثمّ «١ب ٢أ — في المجتمع ما يظهر إلا في حال
-- تابعهم الشخص» ثمّ «نفذ و شغل الهجرة». الكاتبُ مهمّةٌ مجدولةٌ من Claude كلَّ ستّ ساعات (لا مفتاحَ API)، ٣–٥ في الساعة على
-- مدار اليوم، تُدرج بـ`persona_review_add_checked` وحدَها.
--
-- 🔑 **دوالُّ فقط**: لا جدولَ جديد ولا عمودَ ولا حذف — والقديمُ كلُّه كما هو (`persona_review_add` باقيةٌ للمالك).
-- ⚖️ **المنحُ كأخواتها**: القارئةُ للمسجَّل وحدَه (الزائرُ لا يتابع أحداً)، و`anon` يُسحب منه صراحةً (المنحُ الافتراضيّ في
--    Supabase يعطيه كلَّ دالّةٍ جديدة — درسُ D-1596)؛ والمرشّحون والكاتبُ للمالك وحدَه (لا منحَ لأحد، كـ`persona_review_add`).
-- ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════

-- ── ١ · النشاطُ لمن يتابع — مراجعاتُ الشخصيّات التي يتابعها السائلُ وحدَها، الأحدثُ أوّلاً، قبل المؤشّر ───────────────────
-- لماذا المتابعةُ شرطٌ في القاعدة لا في الواجهة: ٧٢–١٢٠ مراجعةً في اليوم تُغرق خطَّ من لم يطلبها؛ فالدالّةُ لا تعيد لغير
-- المتابِع شيئاً أصلاً، وأيُّ سطحٍ يقرؤها يقرؤها بالحدّ نفسِه (D-011).
create or replace function public.followed_persona_reviews(p_before timestamptz default null, p_limit integer default 30)
returns table (persona_id uuid, username text, avatar_url text, media_type text, tmdb_id integer, title text,
               poster_path text, scope_ar text, scope_en text, body_ar text, body_en text, has_spoiler boolean,
               publish_at timestamptz, rating smallint)
language sql stable security definer
set search_path = public, pg_temp as $$
  select r.persona_id, p.username, p.avatar_url, r.media_type, r.tmdb_id, r.title, r.poster_path,
         r.scope_ar, r.scope_en, r.body_ar, r.body_en, r.has_spoiler, r.publish_at, r.rating
    from public.persona_reviews r
    join public.user_follows f on f.following_id = r.persona_id and f.follower_id = auth.uid()
    join public.profiles p on p.id = r.persona_id
   where public.persona_review_visible(r.status, r.publish_at)
     and r.publish_at < coalesce(p_before, 'infinity'::timestamptz)
   order by r.publish_at desc
   limit least(greatest(coalesce(p_limit, 30), 1), 60);
$$;
revoke all on function public.followed_persona_reviews(timestamptz, integer) from public;
revoke all on function public.followed_persona_reviews(timestamptz, integer) from anon;
grant execute on function public.followed_persona_reviews(timestamptz, integer) to authenticated, service_role;

-- ── ٢ · مرشّحو الكتابة — أعمالٌ لم تكتب عنها الشخصيّةُ بعد، من ثلاثة منابع، والأوّلُ أوّلاً ──────────────────────────────
-- trending: ما أضافه أعضاءُ لوبز لمكتباتهم في أسبوعين (`follows.added_at`) — «الرائج عندنا» أصدقُ من رائج TMDB لجمهورنا.
-- new:      موسمٌ جديدٌ أو حلقةٌ عرضت في شهر، أو فيلمٌ دخل السينما في ٤٥ يوماً (`title_snapshots`) — بعنوانه من مكتبةٍ ما.
-- chart:    قوائم IMDb (أفلام · مسلسلات · أنمي، بلا الوثائقيّات) بترتيبها.
-- الذوقُ يقرّره الكاتب (الأنواعُ معروفةٌ لمنبع المكتبة وحدَه، أرقامُ TMDB)، و`others` كم شخصيّةً أخرى كتبت عن العمل —
-- شخصيّتان على عملٍ واحد مقبولٌ حين يضيف كلٌّ زاويةً (القرار ٣ في الخطّة)، لا أكثر.
create or replace function public.persona_candidates(p_slug text, p_limit integer default 60)
returns table (source text, media_type text, tmdb_id integer, title text, poster_path text, genres integer[],
               chart_kind text, chart_rank integer, adders integer, others integer)
language sql stable security definer
set search_path = public, pg_temp as $$
  with me as (
    select id from public.personas where slug = p_slug
  ),
  done as (
    select r.media_type, r.tmdb_id from public.persona_reviews r join me on me.id = r.persona_id
  ),
  trending as (
    select 'trending'::text as source, f.media_type, f.tmdb_id, max(f.title) as title, max(f.poster_path) as poster_path,
           max(f.genres) as genres,
           null::text as chart_kind, null::integer as chart_rank, count(distinct f.user_id)::integer as adders, 1 as pri
      from public.follows f
     where f.added_at > now() - interval '14 days'
     group by f.media_type, f.tmdb_id
  ),
  fresh as (
    select 'new'::text, s.media_type, s.tmdb_id, max(f.title), max(f.poster_path),
           max(f.genres),
           null::text, null::integer, count(distinct f.user_id)::integer, 2
      from public.title_snapshots s
      join public.follows f on f.media_type = s.media_type and f.tmdb_id = s.tmdb_id
     /* التواريخُ نصٌّ `YYYY-MM-DD` في `title_snapshots` — فالمقارنةُ نصّيّةٌ بالشكل نفسِه (والفارغُ لا يقع في المدى) */
     where (s.media_type = 'tv' and (left(s.last_air_date, 10) between to_char(now() - interval '30 days', 'YYYY-MM-DD') and to_char(now(), 'YYYY-MM-DD')
                                  or left(s.next_season_date, 10) between to_char(now() - interval '30 days', 'YYYY-MM-DD') and to_char(now(), 'YYYY-MM-DD')))
        or (s.media_type = 'movie' and left(s.theatrical_date, 10) between to_char(now() - interval '45 days', 'YYYY-MM-DD') and to_char(now(), 'YYYY-MM-DD'))
     group by s.media_type, s.tmdb_id
  ),
  chart as (
    select 'chart'::text, c.media_type, c.tmdb_id::integer, c.title, c.poster_path, null::integer[],
           c.kind, c.rank, 0, 3
      from public.imdb_chart c
     where not coalesce(c.is_doc, false) and c.tmdb_id is not null and c.media_type in ('tv', 'movie')
  ),
  pool as (
    select distinct on (x.media_type, x.tmdb_id) x.*
      from (select * from trending union all select * from fresh union all select * from chart) x
     where not exists (select 1 from done d where d.media_type = x.media_type and d.tmdb_id = x.tmdb_id)
       and x.title is not null
     order by x.media_type, x.tmdb_id, x.pri
  )
  select p.source, p.media_type, p.tmdb_id, p.title, p.poster_path, p.genres, p.chart_kind, p.chart_rank, p.adders,
         (select count(*)::integer from public.persona_reviews r where r.media_type = p.media_type and r.tmdb_id = p.tmdb_id)
    from pool p
   where exists (select 1 from me)
   order by p.pri, p.adders desc, p.chart_rank nulls last, random()
   limit least(greatest(coalesce(p_limit, 60), 1), 200);
$$;
revoke all on function public.persona_candidates(text, integer) from public, anon, authenticated;

-- ── ٣ · الكاتبُ المفحوص — الفحوصُ في القاعدة كي لا يتخطّاها كاتبٌ مستعجل؛ يُرجع السببَ حين يرفض ────────────────────────
-- الحدود (D-1605): النصّان ٨٠–٧٠٠ حرفاً (العيّناتُ ١٢٦–٢٧١) · لا ادّعاءَ مشاهدةٍ ولا بكاء (الشخصيّةُ لم تشاهد شيئاً — قرارُ
-- الخطّة) · الدرجةُ ١–١٠ · النشرُ خلال الساعات الستّ القادمة · سقفُ الساعة الواحدة `per_hour_max` للشخصيّات كلِّها · ٣٠ في
-- اليوم لكلِّ شخصيّة · لا كتابةَ والإيقافُ قائم · ولا تكرار (المفتاحُ الفريدُ القائم).
create or replace function public.persona_review_add_checked(
  p_slug text, p_media text, p_tmdb integer, p_title text, p_poster text,
  p_scope_ar text, p_scope_en text, p_body_ar text, p_body_en text,
  p_sources jsonb, p_spoiler boolean, p_publish_at timestamptz, p_rating smallint)
returns jsonb language plpgsql security definer
set search_path = public, pg_temp as $$
declare
  pid uuid;
  s public.persona_settings%rowtype;
  ar text := btrim(coalesce(p_body_ar, ''));
  en text := btrim(coalesce(p_body_en, ''));
  banned text[] := array['شفته', 'شفتها', 'شاهدته', 'شاهدتها', 'حضرته', 'حضرتها', 'بكيت', 'دموعي',
                         'i watched', 'i saw it', 'i cried', 'when i saw', 'my tears', 'i rewatched'];
  w text;
  hour_n integer;
  day_n integer;
  rid uuid;
begin
  select id into pid from public.personas where slug = p_slug;
  if pid is null then return jsonb_build_object('ok', false, 'reason', 'unknown_persona'); end if;
  select * into s from public.persona_settings where id = 1;
  if coalesce(s.paused, false) then return jsonb_build_object('ok', false, 'reason', 'paused'); end if;
  if p_media not in ('tv', 'movie') or coalesce(p_tmdb, 0) <= 0 then return jsonb_build_object('ok', false, 'reason', 'bad_title'); end if;
  if char_length(ar) not between 80 and 700 then return jsonb_build_object('ok', false, 'reason', 'length_ar'); end if;
  if char_length(en) not between 80 and 700 then return jsonb_build_object('ok', false, 'reason', 'length_en'); end if;
  foreach w in array banned loop
    if position(w in lower(ar || ' ' || en)) > 0 then return jsonb_build_object('ok', false, 'reason', 'banned_phrase', 'phrase', w); end if;
  end loop;
  if p_rating is null or p_rating not between 1 and 10 then return jsonb_build_object('ok', false, 'reason', 'rating'); end if;
  if p_publish_at is null or p_publish_at < now() - interval '5 minutes' or p_publish_at > now() + interval '6 hours 15 minutes' then
    return jsonb_build_object('ok', false, 'reason', 'publish_window');
  end if;
  select count(*) into hour_n from public.persona_reviews
   where publish_at >= date_trunc('hour', p_publish_at) and publish_at < date_trunc('hour', p_publish_at) + interval '1 hour';
  if hour_n >= coalesce(s.per_hour_max, 5) then return jsonb_build_object('ok', false, 'reason', 'hour_full'); end if;
  select count(*) into day_n from public.persona_reviews where persona_id = pid and created_at > now() - interval '24 hours';
  if day_n >= 30 then return jsonb_build_object('ok', false, 'reason', 'daily_cap'); end if;
  rid := public.persona_review_add(p_slug, p_media, p_tmdb, p_title, p_poster, p_scope_ar, p_scope_en, ar, en,
                                   p_sources, p_spoiler, p_publish_at, p_rating);
  if rid is null then return jsonb_build_object('ok', false, 'reason', 'duplicate'); end if;
  return jsonb_build_object('ok', true, 'id', rid);
end;
$$;
revoke all on function public.persona_review_add_checked(text, text, integer, text, text, text, text, text, text, jsonb, boolean, timestamptz, smallint)
  from public, anon, authenticated;
