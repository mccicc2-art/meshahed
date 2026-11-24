-- 264 — الملفُّ يرى المكتبةَ كلَّها لا أحدثَ ألفٍ منها (T536، أحمد ٢٤ نوفمبر «١أ ااذن لك»)
--
-- لماذا: `user_public_follows` تقف عند أحدث ألف عمل، و`user_watched_movie_ids` عند ألف فيلمٍ بلا ترتيب. عضوةٌ استوردت
-- ١٣٥٨ فيلماً من Letterboxd بعد مسلسلاتها فصار ملفُّها «٠ مسلسل · ٦٤٧ فيلم»: المسلسلاتُ الأقدم خرجت من الألف، والأفلامُ
-- عُدّت من تقاطع ألفين. والمسلسلاتُ في مكتبتها لم تُحذف — فإضافتُها من جديد لا تغيّر شيئاً.
--
-- كيف: الدوالُّ الثلاث بلا سقفٍ داخلها وبترتيبٍ ثابت، والقارئُ (`src/lib/data.ts`) يقرأ صفحاتٍ بـ`range` لأن PostgREST يقصّ
-- كلَّ ردٍّ عند ألف صفّ. التوقيعُ والأعمدةُ والحارسُ (`can_view_profile`) كما هي — `create or replace` بلا `drop`، فالصلاحياتُ باقية.
--
-- رجوع: أعد التعريفات السابقة (`limit 1000` في الأولى والثالثة، وبلا `order by` في الثانية والثالثة).

create or replace function public.user_public_follows(target uuid)
returns table(tmdb_id integer, media_type text, title text, poster_path text, added_at timestamp with time zone,
              total_episodes integer, aired_episodes integer, next_air_date date, dropped boolean)
language sql
stable security definer
set search_path to 'public'
as $function$
  select f.tmdb_id, f.media_type, f.title, f.poster_path, f.added_at,
         f.total_episodes, f.aired_episodes, f.next_air_date,
         coalesce(f.dropped, false)
  from public.follows f
  where f.user_id = target
    and public.can_view_profile(target)
  order by f.added_at desc, f.media_type, f.tmdb_id;
$function$;

create or replace function public.user_watch_overview(target uuid)
returns table(show_tmdb_id integer, watched integer)
language sql
stable security definer
set search_path to 'public'
as $function$
  select w.show_tmdb_id, count(*)::integer
  from public.watched_episodes w
  where w.user_id = target
    and public.can_view_profile(target)
  group by w.show_tmdb_id
  order by w.show_tmdb_id;
$function$;

create or replace function public.user_watched_movie_ids(target uuid)
returns table(movie_tmdb_id integer)
language sql
stable security definer
set search_path to 'public'
as $function$
  select w.movie_tmdb_id from public.watched_movies w
  where w.user_id = target
    and public.can_view_profile(target)
  order by w.movie_tmdb_id;
$function$;

notify pgrst, 'reload schema';
