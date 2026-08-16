-- ============================================================
--  ٩٧ — news_by_title_and_cleanups · **ثلاثُ رخيصاتٍ مؤجَّلة** (D-312)
--  تُشغَّل بعد talk_rooms_week.sql (96)
--
--  بنودُ `05_Todo` الثلاثة التي انتظرت الإذن — وأذن أحمد
--  («نفّذ كل شي ماعدا ٦ و١١»):
--
--  ١) **`loopz_news` تعرف عملاً** — دالّةٌ ثالثةُ الوسائط **لا `drop`
--     للقديمة**: تبويبُ «أخبار» في صفحة العمل كان يقرأ ثلاثمئةٍ
--     ويرشّح في الواجهة، **وسقفُ الدالّة ٦٠ أصلاً فكان يرشّح ممّا
--     وصل لا ممّا وُجد** — والقصُّ الآن في القاعدة (D-164).
--
--  ٢) **`image_path` عمودٌ حقيقيٌّ في `title_posts`** — الصورةُ سكنت
--     `data` يومَ D-298 لأن العمودَ كان يوجب `drop` خارجَ الإذن،
--     **وحقيبةُ `jsonb` لمعنيين بابُ العطل الصامت** (D-224).
--     **والصفوفُ القائمة تُدوَّر** (`update` بإذن اليوم)، والقيدُ
--     يُوسَّع، **و`title_thread` تُحذف وتُعاد بعمودها** (D-037) —
--     تُرجع `coalesce` **فصفُّ النافذة الانتقالية لا يفقد صورته.**
--
--  ٣) **و`likes_in` يسقط من الدالّتين** — بلا قارئٍ منذ D-285
--     («الأكشنُ مشاركةٌ + رأي، ولا إعجاب»)، **وعمودٌ يُحسب ولا
--     يُقرأ ثمنُ `join` يُدفع مع كلِّ فتحة** (D-214) — `drop`
--     للدالّتين لأن العائد يتغيّر (D-037)، **والقارئُ المنشور
--     متسامحٌ** (`?? 0`) فلا يسقط قبل النشر.
--
--  آمنةٌ للإعادة، ولا سياسةَ قراءةٍ خامسة.
-- ============================================================

begin;

-- ============ ١ · loopz_news عن عملٍ بعينه ============
create or replace function public.loopz_news(p_limit integer, p_tmdb integer, p_media text)
returns table (
  key          text,
  kind         text,
  tmdb_id      integer,
  media_type   text,
  title        text,
  poster_path  text,
  data         jsonb,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.key, p.kind, p.tmdb_id, p.media_type, p.title, p.poster_path, p.data, p.published_at
  from public.news_posts p
  where p.tmdb_id = p_tmdb and p.media_type = p_media
  order by p.published_at desc
  limit least(greatest(coalesce(p_limit, 20), 1), 60);
$$;

revoke all on function public.loopz_news(integer, integer, text) from public;
grant execute on function public.loopz_news(integer, integer, text) to authenticated;

-- ============ ٢ · الصورةُ عموداً حقيقيّاً ============
alter table public.title_posts
  add column if not exists image_path text;

--  **تدويرُ القائم** — الصفوفُ التي كتبت صورتَها في `data` منذ D-298
update public.title_posts
   set image_path = data ->> 'img'
 where (data ->> 'img') is not null
   and image_path is null;

--  **والقيدُ يُوسَّع لا يُبدَّل معناه** (درسُ ٩٣: حين يصير للمعنى شكلٌ
--  ثانٍ تُوسَّع كلُّ حراسته) — وفرعُ `data` يبقى لنافذة النشر القصيرة
alter table public.title_posts drop constraint if exists title_posts_body_or_kind;

alter table public.title_posts add constraint title_posts_body_or_kind check (
  (kind is null and (
    (body is not null and length(btrim(body)) between 1 and 2000)
    or (
      (image_path is not null or (data ->> 'img') is not null)
      and (body is null or length(btrim(body)) <= 2000)
    )
  ))
  or (kind is not null and body is null)
);

drop function if exists public.title_thread(integer, text);

create or replace function public.title_thread(t_id integer, m_type text)
returns table (
  id          uuid,
  parent_id   uuid,
  depth       smallint,
  author_id   uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  body        text,
  created_at  timestamptz,
  kind        text,
  data        jsonb,
  spoiler     jsonb,
  has_spoiler boolean,
  image_path  text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.parent_id,
    r.depth,
    r.user_id as author_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.body,
    r.created_at,
    r.kind,
    r.data,
    r.spoiler,
    coalesce(r.has_spoiler, false),
    /* **حزامُ النافذة**: صفٌّ كتبه المنشورُ القديم بين الهجرة والنشر
       صورتُه في `data` وحدَها — و`coalesce` يسلّمها باسم العمود */
    coalesce(r.image_path, r.data ->> 'img')
  from public.title_posts r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and r.tmdb_id = t_id
    and r.media_type = m_type
    and r.hidden = false
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
         or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
    )
  order by r.created_at asc
  limit 300;
$$;

revoke all on function public.title_thread(integer, text) from public;
grant execute on function public.title_thread(integer, text) to authenticated;

-- ============ ٣ · سقوطُ likes_in من الدالّتين ============
drop function if exists public.people_leaderboard(integer);

create or replace function public.people_leaderboard(p_limit integer default 20)
returns table (
  user_id     uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  posts       integer,
  reviews     integer,
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
  )
  select
    pe.id,
    case when pe.hide_name then null else pe.nickname end,
    case when pe.hide_name then null else pe.username end,
    case when pe.hide_name then null else pe.avatar_url end,
    pe.hide_name,
    coalesce(pn.c, 0),
    coalesce(rn.c, 0),
    (coalesce(pn.c, 0) + coalesce(rn.c, 0))::int,
    (coalesce(pp.c, 0) + coalesce(rp.c, 0))::int
  from people pe
  left join posts_now    pn on pn.user_id = pe.id
  left join posts_prev   pp on pp.user_id = pe.id
  left join reviews_now  rn on rn.user_id = pe.id
  left join reviews_prev rp on rp.user_id = pe.id
  where (coalesce(pn.c, 0) + coalesce(rn.c, 0)) > 0
  order by (coalesce(pn.c, 0) + coalesce(rn.c, 0)) desc, pe.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

revoke all on function public.people_leaderboard(integer) from public;
grant execute on function public.people_leaderboard(integer) to authenticated;

drop function if exists public.people_featured(integer, integer);

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
  )
  select
    pe.id,
    case when pe.hide_name then null else pe.nickname end,
    case when pe.hide_name then null else pe.username end,
    case when pe.hide_name then null else pe.avatar_url end,
    pe.hide_name,
    coalesce(pn.c, 0),
    coalesce(rn.c, 0),
    (coalesce(pn.c, 0) + coalesce(rn.c, 0))::int,
    0::int
  from people pe
  left join posts_now   pn on pn.user_id = pe.id
  left join reviews_now rn on rn.user_id = pe.id
  where (coalesce(pn.c, 0) + coalesce(rn.c, 0)) > 0
  order by (coalesce(pn.c, 0) + coalesce(rn.c, 0)) desc, pe.id
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

revoke all on function public.people_featured(integer, integer) from public;
grant execute on function public.people_featured(integer, integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — صفٌّ واحدٌ مجمّع (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname='loopz_news')          as news_overloads,
--   (select count(*)::int from information_schema.columns
--      where table_schema='public' and table_name='title_posts'
--        and column_name='image_path')                                      as img_col,
--   (select count(*)::int from public.title_posts
--      where image_path is not null)                                        as img_rows,
--   (select count(*)::int from pg_proc
--      where proname='title_thread'
--        and pg_get_functiondef(oid) like '%image_path%')                   as thread_has_img,
--   (select count(*)::int from pg_proc
--      where proname in ('people_leaderboard','people_featured')
--        and pg_get_functiondef(oid) like '%likes_in%')                     as still_likes_in,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                           as open_policies;
--
--  **المتوقَّع:** `news_overloads=2 | img_col=1 | thread_has_img=1 |
--  still_likes_in=0 | open_policies=4`، **و`img_rows` عددُ صور D-298
--  القائمة.**
