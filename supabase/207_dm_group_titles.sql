-- ============================================================
--  Loopz — 207: بطاقةُ عملٍ في رسائل القروب (D-1435)
--  أحمد ١٦ أكتوبر: «إذا ضغطت زر البحث يخليني أقدر أبحث في مكاني بحيث أختار الفلم وأرسله في المحادثة مباشرة».
--  شغّله في Supabase → SQL Editor. آمنٌ لإعادة التشغيل. **الواجهةُ تعمل قبله وبعده**: قبله تُقرأ القروبُ بأعمدة ٢٠٥
--  وإرسالُ عملٍ يُرفض رفضاً مقروءاً؛ بعده تظهر البطاقات.
--
--  - أربعةُ أعمدةٍ كمشاركات الخاص (`title_shares`): النوعُ والمعرّفُ، والاسمُ والملصقُ لقطةٌ وقتَ الإرسال.
--  - قيدُ المحتوى يُستبدل: الرسالةُ العاديّةُ نصٌّ أو GIF أو صورةٌ **أو عمل**، والعملُ لا يجتمع مع صورةٍ أو GIF،
--    وتعليقُه اختياريّ. سطرُ النظام لا يحمل عملاً. ما عدا ذلك قيدُ ٢٠٥ حرفاً.
--  - لا سياسةَ جديدة: «members send as self» تحكم الأعمدةَ الجديدة كما تحكم القديمة.
-- ============================================================

alter table public.dm_group_messages add column if not exists tmdb_id integer;
alter table public.dm_group_messages add column if not exists media_type text;
alter table public.dm_group_messages add column if not exists title text;
alter table public.dm_group_messages add column if not exists poster_path text;

alter table public.dm_group_messages drop constraint if exists dm_group_messages_content_check;
alter table public.dm_group_messages add constraint dm_group_messages_content_check check (
  length(body) <= 1000
  and (
    (
      kind = 'system' and sys is not null and gif_id is null and image_path is null and reply_to is null
      and tmdb_id is null and media_type is null and title is null and poster_path is null
    )
    or (
      kind = 'text' and sys is null and sys_target is null
      and (length(btrim(body)) >= 1 or gif_id is not null or image_path is not null or tmdb_id is not null)
      and not (gif_id is not null and image_path is not null)
      and not (tmdb_id is not null and (gif_id is not null or image_path is not null))
      and (gif_id is null or (gif_id ~ '^[A-Za-z0-9]{1,64}$' and length(btrim(body)) = 0))
      and (image_path is null or image_path ~ ('^' || sender_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$'))
      and (
        (tmdb_id is null and media_type is null and title is null and poster_path is null)
        or (
          -- «is not null» صريحة: مقارنةٌ مع null تعطي null، والقيدُ يمرّر null — فنوعٌ بلا معرّفٍ كان سيمرّ
          tmdb_id is not null and tmdb_id > 0 and media_type is not null and media_type in ('tv', 'movie')
          and (title is null or length(title) <= 300)
          and (poster_path is null or poster_path ~ '^/[A-Za-z0-9_.-]{1,100}$')
        )
      )
    )
  )
);
