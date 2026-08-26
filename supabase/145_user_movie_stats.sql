-- ============================================================
--  Loopz — الهجرة ١٤٥ (D-649): دقائقُ أفلامِ عضوٍ عامّة
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ بنيةٌ فقط. والسياساتُ المفتوحةُ تبقى أربعاً.
-- ============================================================

--  🔴 **ولماذا لا تكفي `user_watched_movie_ids`**: تُرجع معرّفاتٍ لا
--  دقائق — **ووقتُ المشاهدة بلا أفلامِه نصفُ رقمٍ يرتدي زيَّ كلٍّ**
--  (D-217). **وصفحةُ إحصائياتِ العضو تعرض الوقتَ الكاملَ أو لا تعرضه.**
--
--  🔑 **و`110` هو الافتراضُ نفسُه الذي تحسب به `watchedMovieMinutes`**
--  في `lib/data.ts` — **ورقمان لشيءٍ واحدٍ يفترقان عند أوّل تعديل**
--  (D-145). **فإن تغيّر أحدُهما يوماً يتغيّر الآخرُ معه في الجولة نفسِها.**
--
--  🔑 **والحارسُ `can_view_profile` وحدَه** — نفسُ حارس كلِّ دالّةِ ملفٍّ
--  عامّ، **ولا سياسةَ قراءةٍ خامسةٌ تُفتح.**
create or replace function public.user_movie_stats(target uuid)
returns table (
  watched integer,
  minutes bigint
)
language sql
stable
security definer
set search_path = 'public'
as $$
  select count(*)::integer,
         coalesce(sum(coalesce(w.runtime, 110)), 0)
  from public.watched_movies w
  where w.user_id = target
    and (auth.uid() = target or public.can_view_profile(target));
$$;

revoke all on function public.user_movie_stats(uuid) from public;
grant execute on function public.user_movie_stats(uuid) to authenticated, anon;
