-- ============================================================
--  ٨٨ — people_top_review_one · **تعليقٌ واحدٌ لكلِّ شخص** (D-275)
--  تُشغَّل بعد talk_rooms_episode.sql (87)
--
--  ================= العطلُ كما رُئي حيّاً =================
--
--  **قسمُ «أعلى التعليقات إعجاباً» عرض KHLD في بطاقتين من ثلاث.**
--  والدالّةُ تفرز الآراء بالإعجاب **ولا تعرف أصحابها**، فمن كتب رأيين
--  محبوبين أخذ ثلثَي القسم.
--
--  **واسمٌ مرّتين في ثلاثِ بطاقاتٍ يُقرأ عطلاً لا صدارة** — والقارئُ
--  يظنّ الصفحةَ تكرّر لا أن الرجل كتب مرّتين. **وقسمٌ من ثلاثة يملؤه
--  شخصان ليس «أعلى التعليقات»، هو «أعلى الكاتبين»** (D-257: اسمٌ بقي
--  بعد أن تغيّر ما يسمّيه).
--
--  ================= والعلاجُ حيث يقع الفرز =================
--
--  **`distinct on (user_id)` بعد العدّ وقبل الترتيب النهائيّ**: يُختار
--  أعلى رأيٍ لكلِّ شخص، ثم تُرتَّب الأوائلُ بينهم. **ولا يقع القصُّ في
--  الواجهة** — القاعدةُ تُسلّم `p_limit` صفّاً كلُّها صالحة، **وقاعدةٌ
--  تُسلّم مرشَّحاً ترفضه الشيفرةُ حتماً هي الهدر** (D-164).
--
--  ⚠️ **والتوقيعُ لم يتغيّر فلا `drop`**: نفسُ المعاملين ونفسُ الأعمدة
--  الثلاثةَ عشر — **`create or replace` تكفي، ولا نسخةَ ثانية تُولد**
--  (D-037 تُقرأ بشرطها: الحذفُ لتغيُّر التوقيع لا لتغيُّر الجسم).
--
--  آمنةٌ للإعادة، ولا جدولَ ولا عمودَ ولا سياسةَ خامسة.
-- ============================================================

begin;

create or replace function public.people_top_review(
  p_days  integer default 30,
  p_limit integer default 3
)
returns table (
  user_id     uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  title       text,
  poster_path text,
  review      text,
  rating      smallint,
  likes       integer,
  created_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with liked as (
    select
      g.user_id,
      case when coalesce(p.hide_name,false) then null else p.nickname end   as nickname,
      case when coalesce(p.hide_name,false) then null else p.username end   as username,
      case when coalesce(p.hide_name,false) then null else p.avatar_url end as avatar_url,
      coalesce(p.hide_name, false)                                          as hide_name,
      g.tmdb_id, g.media_type, g.title, g.poster_path,
      g.review, g.rating,
      count(l.*)::int as likes,
      g.updated_at
    from public.ratings g
    join public.profiles p on p.id = g.user_id
    join public.review_likes l
      on l.review_user_id = g.user_id and l.tmdb_id = g.tmdb_id and l.media_type = g.media_type
    where auth.uid() is not null
      and g.review is not null and length(btrim(g.review)) > 0
      and g.updated_at >= now() - make_interval(days => least(greatest(coalesce(p_days,30),1), 365))
      and coalesce(p.is_system, false) = false
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = g.user_id)
           or (b.blocker_id = g.user_id and b.blocked_id = auth.uid())
      )
    group by g.user_id, p.hide_name, p.nickname, p.username, p.avatar_url,
             g.tmdb_id, g.media_type, g.title, g.poster_path, g.review, g.rating, g.updated_at
  ),
  --  **أعلى رأيٍ لكلِّ شخص** — والتعادلُ يُحسم بالأحدث
  best as (
    select distinct on (k.user_id) k.*
    from liked k
    order by k.user_id, k.likes desc, k.updated_at desc
  )
  select
    b.user_id, b.nickname, b.username, b.avatar_url, b.hide_name,
    b.tmdb_id, b.media_type, b.title, b.poster_path,
    b.review, b.rating, b.likes, b.updated_at
  from best b
  order by b.likes desc, b.updated_at desc
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

revoke all on function public.people_top_review(integer, integer) from public;
grant execute on function public.people_top_review(integer, integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname='people_top_review')  as overloads,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                          as open_policies;
--
--  **المتوقَّع:** `overloads=1 | open_policies=4`.
--  ⚠️ **والفحصُ الحقيقيُّ في الواجهة لا هنا**: تُشغَّل بدور `postgres`
--  فتعود فارغةً (`auth.uid()` فارغ) — **والحكمُ أن يُفتح القسمُ حيّاً
--  فلا يتكرّر اسمٌ فيه** (D-247/D-263).
