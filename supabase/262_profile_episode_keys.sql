-- ============================================================
--  ٢٦٢ — profile_episode_keys · **«وين واصل» على ملصقات ملفِّ عضو** (T523)
--
--  أحمد ٢٢ نوفمبر ٢٠٢٦: «فالملف الشخصي المفترض اعمال انا شفتها او قاعد اشوفها مع خط ورقم الحلقة اللي انا واصل لها ·
--  عشان اللي يدخل ملفي يشوف انا وش شفت و وين واصل فيه» — «١٩ مثل ف المكتبة»: قرصُ «S2 E6» كقرص المكتبة (T492).
--
--  🔑 **لماذا دالّة**: قرصُ المكتبة يُحسب من مفاتيح الحلقات (`nextUnwatchedEpisode`) — وجدولُ `watched_episodes` لا يُقرأ إلا
--  لصاحبه (سياستُه). والعدُّ وحدَه (`user_watch_overview`) لا يقول أين الفجوة. وعميلُ الخدمة مسيَّجٌ (D-898) فلا يُفتح لهذا.
--  فدالّةٌ definer بحارس `user_watch_overview` نفسِه حرفاً (`can_view_profile`): من يرى خيطَ التقدّم على الملصق يرى رقمَ حلقته.
--  ⚖️ **والإعادةُ تُحترم في القاعدة**: من بدأ إعادة مسلسلٍ تُحسب له حلقاتُه بعدها وحدَها (شرطُ «تابِع المشاهدة» نفسُه)؛
--  و`skip_mode` صاحبِ الملفّ في كلِّ صفّ (قيمةٌ واحدة) ليُخفى الفلرُ عنده كما يُخفى في مكتبته.
--  ⚖️ **والحدُّ ٨٠ عملاً** — سقفُ قرص المكتبة؛ والنتيجةُ تُقرأ صفحاتٍ (ألفُ صفٍّ للطلب).
--
--  إضافيّةٌ كلُّها؛ الكودُ قبلها يرسم الملصقَ بلا قرص.
--  تحقُّقها:
--    select has_function_privilege('anon', 'public.profile_episode_keys(uuid,integer[])', 'execute'); -- t
-- ============================================================

create or replace function public.profile_episode_keys(target uuid, p_shows integer[])
returns table (show_tmdb_id integer, season_number integer, episode_number integer, skip_mode text)
language sql
stable
security definer
set search_path = public
as $$
  select w.show_tmdb_id, w.season_number, w.episode_number,
         (select p.skip_mode from public.profiles p where p.id = target)
  from public.watched_episodes w
  left join public.follows f
    on f.user_id = w.user_id and f.media_type = 'tv' and f.tmdb_id = w.show_tmdb_id
  where w.user_id = target
    and public.can_view_profile(target)
    and w.show_tmdb_id = any (p_shows[1:80])
    and (f.rewatch_started_at is null or w.watched_at >= f.rewatch_started_at)
  order by 1, 2, 3;
$$;
revoke all on function public.profile_episode_keys(uuid, integer[]) from public;
grant execute on function public.profile_episode_keys(uuid, integer[]) to anon, authenticated;
