-- ============================================================
--  ٨٩ — الأكشنُ عملٌ لا استقبال · وعدّادُ ردودِ الآراء (D-285)
--  تُشغَّل بعد people_top_review_one.sql (٨٨)
--
--  ⚠️  **بلا `drop` إطلاقاً** — `create or replace` وحدها.
--  الأعمدةُ لم تتغيّر، والدالّةُ الثالثة جديدةٌ باسمٍ لم يُستعمل.
--  **ولا جدولَ ولا عمودَ ولا سياسةَ خامسة** — والسياساتُ المفتوحة تبقى أربعاً.
--
--  ================= ١ · اللايك ليس أكشناً =================
--
--  **طلبُ أحمد بلقطةٍ وخطٍّ أحمر تحت «2 likes» و«0 likes»:**
--  «احذف اللايك، ما أبغاه يحسبه أكشن».
--
--  **وهو محقٌّ بحجّةٍ أعمق من الذوق:** `likes_in` **إعجاباتٌ استقبلها
--  صاحبُ الرأي، لا فعلٌ فعله**. فكان العدّادُ يخلط **ما تعمله** بـ**ما
--  يُفعل بك** — ويُقرأ «٩ تفاعلات» لمن كتب ثلاثةَ آراء وتلقّى ستّةَ
--  إعجابات. **ولوحةٌ اسمُها «الأكثر مشاركةً» تقيس المشاركة لا الشعبيّة.**
--
--  **والأثرُ يقع في ثلاثة مواضع:** `total` و`prev_total` **وسطرُ
--  المكوّنات في الواجهة** — والثلاثةُ تتحرّك معاً أو يكذب أحدُها (D-219).
--
--  **⬜ ودَينٌ يُكتب ولا يُخفى:** `likes_in` **يبقى عموداً في الدالّتين
--  بلا قارئ** بعد هذه الدفعة. حذفُه يغيّر الأعمدةَ فيوجب `drop` — **وهو
--  خارج الإذن الدائم**، **وسُئل أحمد فقال إنه لم يفهم السؤال**،
--  **والإذنُ الذي لا يُفهَم ليس إذناً** (D-252/D-285). يُحذف يومَ يوجد
--  سببٌ آخر يستحقّ `drop`، أو بكلمةٍ صريحة منه.
--
--  ================= ٢ · وردودُ الآراء يُعدُّ لها =================
--
--  **طلبُ أحمد في ترجيح خطّ النشاط:** «كل لايك ينقص من وقته نص ساعة
--  وكل رد ساعة». **وشُحن نصفُها في D-283** — الإعجابُ يُحسب، **والردُّ
--  لا**، لأن عدّادَ الردود عندنا **لنشراتنا وحدها** (`news_reply_counts`،
--  الهجرة ٧٣) **ولا عدّادَ لرأي إنسان**.
--
--  **وهذه تُكملها.** المفتاحُ نصّيٌّ بصيغة `commentViewKey`:
--  `c:<user_id>:<media_type>:<tmdb_id>` — **وهي الصيغةُ التي يقرؤها
--  أربعةُ مواضع أصلاً** (D-237)، فلا صيغةَ خامسة تُخترع.
--
--  ⚠️ **والحارسُ في جسم الدالّة لا في الدور** (D-261): `auth.uid()`
--  وحظرٌ متبادَل — **ومن حظرتَه لا يرفع صفَّك ولا تُعدّ ردودُه لك.**
-- ============================================================

begin;

-- ============ ١ · اللوحةُ الأسبوعيّة ============
-- **نفسُ الأعمدة العشرة حرفاً** — والتغييرُ في `total` و`prev_total` فقط.
create or replace function public.people_leaderboard(p_limit integer default 20)
returns table (
  user_id     uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  posts       integer,
  reviews     integer,
  likes_in    integer,   -- ⬜ بلا قارئ بعد D-285 — انظر الرأس
  total       integer,
  prev_total  integer
)
language sql
stable
security definer
set search_path = public
as $$
  with anchor as (
    select
      (
        date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '2 days')
        - interval '2 days'
      ) at time zone 'Asia/Riyadh' as t0
  ),
  bounds as (
    select
      t0,
      t0 - interval '7 days'                as t_prev,
      t0 - interval '7 days' + (now() - t0) as t_prev_end
    from anchor
  ),
  people as (
    select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false) as hide_name
    from public.profiles p
    where auth.uid() is not null
      and coalesce(p.is_system, false) = false
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
  ),
  posts_now as (
    select r.user_id, count(*)::int c
    from public.title_posts r, bounds
    where r.kind is null and r.hidden = false and r.created_at >= bounds.t0
    group by r.user_id
  ),
  posts_prev as (
    select r.user_id, count(*)::int c
    from public.title_posts r, bounds
    where r.kind is null and r.hidden = false
      and r.created_at >= bounds.t_prev and r.created_at < bounds.t_prev_end
    group by r.user_id
  ),
  reviews_now as (
    select g.user_id, count(*)::int c
    from public.ratings g, bounds
    where g.review is not null and length(btrim(g.review)) > 0
      and g.updated_at >= bounds.t0
    group by g.user_id
  ),
  reviews_prev as (
    select g.user_id, count(*)::int c
    from public.ratings g, bounds
    where g.review is not null and length(btrim(g.review)) > 0
      and g.updated_at >= bounds.t_prev and g.updated_at < bounds.t_prev_end
    group by g.user_id
  ),
  likes_now as (
    select l.review_user_id as user_id, count(*)::int c
    from public.review_likes l, bounds
    where l.created_at >= bounds.t0
    group by l.review_user_id
  )
  select
    pe.id,
    case when pe.hide_name then null else pe.nickname end,
    case when pe.hide_name then null else pe.username end,
    case when pe.hide_name then null else pe.avatar_url end,
    pe.hide_name,
    coalesce(pn.c, 0),
    coalesce(rn.c, 0),
    coalesce(ln.c, 0),
    --  ⚖️ **الأكشنُ = مشاركة + رأي** — ولا إعجاباً (D-285)
    (coalesce(pn.c, 0) + coalesce(rn.c, 0))::int,
    (coalesce(pp.c, 0) + coalesce(rp.c, 0))::int
  from people pe
  left join posts_now    pn on pn.user_id = pe.id
  left join posts_prev   pp on pp.user_id = pe.id
  left join reviews_now  rn on rn.user_id = pe.id
  left join reviews_prev rp on rp.user_id = pe.id
  left join likes_now    ln on ln.user_id = pe.id
  where (coalesce(pn.c, 0) + coalesce(rn.c, 0)) > 0
  order by (coalesce(pn.c, 0) + coalesce(rn.c, 0)) desc, pe.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.people_leaderboard(integer) from public;
grant execute on function public.people_leaderboard(integer) to authenticated;

-- ============ ٢ · و«المميّزون» بالقاعدة نفسِها ============
-- **الشكلُ الواحد يُتعمَّد ليقرأه المكوّنُ الواحد** (D-145/D-270)،
-- **فلو تغيّر معنى «أكشن» في إحداهما دون الأخرى لعرضت البطاقتان
-- المتجاورتان رقمين بمعنيين** — وهو أخبثُ ما يقع لأنه لا يُرى.
create or replace function public.people_featured(
  p_days  integer default 90,
  p_limit integer default 3
)
returns table (
  user_id     uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  posts       integer,
  reviews     integer,
  likes_in    integer,   -- ⬜ بلا قارئ — كأختها
  total       integer,
  prev_total  integer
)
language sql
stable
security definer
set search_path = public
as $$
  with win as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 90), 1), 365)) as t0
  ),
  people as (
    select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false) as hide_name
    from public.profiles p
    where auth.uid() is not null
      and coalesce(p.is_system, false) = false
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
  ),
  posts_now as (
    select r.user_id, count(*)::int c
    from public.title_posts r, win
    where r.kind is null and r.hidden = false and r.created_at >= win.t0
    group by r.user_id
  ),
  reviews_now as (
    select g.user_id, count(*)::int c
    from public.ratings g, win
    where g.review is not null and length(btrim(g.review)) > 0
      and g.updated_at >= win.t0
    group by g.user_id
  ),
  likes_now as (
    select l.review_user_id as user_id, count(*)::int c
    from public.review_likes l, win
    where l.created_at >= win.t0
    group by l.review_user_id
  )
  select
    pe.id,
    case when pe.hide_name then null else pe.nickname end,
    case when pe.hide_name then null else pe.username end,
    case when pe.hide_name then null else pe.avatar_url end,
    pe.hide_name,
    coalesce(pn.c, 0),
    coalesce(rn.c, 0),
    coalesce(ln.c, 0),
    (coalesce(pn.c, 0) + coalesce(rn.c, 0))::int,
    --  **صفرٌ دائماً** — نافذةٌ واحدةٌ لا نافذتان (D-270)
    0::int
  from people pe
  left join posts_now   pn on pn.user_id = pe.id
  left join reviews_now rn on rn.user_id = pe.id
  left join likes_now   ln on ln.user_id = pe.id
  where (coalesce(pn.c, 0) + coalesce(rn.c, 0)) > 0
  order by (coalesce(pn.c, 0) + coalesce(rn.c, 0)) desc, pe.id
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

revoke all on function public.people_featured(integer, integer) from public;
grant execute on function public.people_featured(integer, integer) to authenticated;

-- ============ ٣ · عدّادُ ردودِ الآراء ============
-- **يُكمل صيغةَ أحمد**: كلُّ ردٍّ ينقص من عمر الصفّ ساعةً (D-283).
-- **والمفتاحُ صيغةُ `commentViewKey` نفسُها** — لا صيغةَ خامسة (D-237).
create or replace function public.review_reply_counts(keys text[])
returns table (post_key text, replies bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    'c:' || r.review_user_id::text || ':' || r.media_type || ':' || r.tmdb_id::text as post_key,
    count(*)::bigint
  from public.review_replies r
  where auth.uid() is not null
    and r.hidden = false
    and ('c:' || r.review_user_id::text || ':' || r.media_type || ':' || r.tmdb_id::text) = any (keys)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
         or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
    )
  group by r.review_user_id, r.media_type, r.tmdb_id;
$$;

revoke all on function public.review_reply_counts(text[]) from public;
grant execute on function public.review_reply_counts(text[]) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname='people_leaderboard')   as lb,
--   (select count(*)::int from pg_proc where proname='people_featured')      as feat,
--   (select count(*)::int from pg_proc where proname='review_reply_counts')  as rrc,
--   (select count(*)::int from pg_proc
--      where proname='people_leaderboard'
--        and pg_get_functiondef(oid) like '%-- ⚖️%')                          as no_likes,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                           as open_policies;
--
--  **المتوقَّع:** `lb=1 | feat=1 | rrc=1 | no_likes=1 | open_policies=4`.
--
--  ⚠️ **والحَكَمُ بعدها الصفحةُ الحيّة** (D-247/D-275): تُشغَّل بدور
--  `postgres` فتعود اللوحتان فارغتين (`auth.uid()` فارغ). **الدليلُ أن
--  يُفتح تبويبُ الأعضاء فلا يُذكر إعجابٌ في سطر المكوّنات**، وأن يتغيّر
--  رقمُ «N actions» لمن كانت إعجاباتُه تُحسب له.
--
--  ⚠️ **وشيفرةُ الواجهة تُشحن بعد هذه الهجرة لا قبلها** (D-028): السطرُ
--  الذي يعرض «١ post · ١١ reviews · ٠ likes» يسقط منه الثالث، **والدالّةُ
--  ما زالت تُرجع العمود** فلا ينكسر شيءٌ في الحالة الوسيطة.
-- ============================================================
