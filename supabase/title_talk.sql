-- ============================================================
--  ٧٨ — title_talk · النقاشُ كيانٌ مستقلّ عن الرأي (D-254)
--
--  **تصحيحُ أحمد بنصّه:** «عندك لبس — النقاش ليس الريفيو، يختلف».
--  وهو محقّ: بنيتُ بطاقاتِ «نقاش» من الآراء المكتوبة، **ولقطتُه أسئلةٌ
--  لها ٥٩ ردّاً** — وذلك ليس مراجعةً ولا ردّاً على مراجعة.
--
--  ================= ما الفرقُ بالضبط =================
--
--  **الرأيُ حكمٌ على عمل**: صاحبُه واحد، ومعه نجمة، ومكانُه صفحةُ العمل
--  وخطُّ النشاط وصفحتُه `/review`. **والنقاشُ مكانٌ يُدخَل**: لا صاحبَ
--  له، ولا نجمةَ فيه، **وقيمتُه في تراكم الردود لا في جودة السطر**.
--  **وخلطُهما جعل `/talk` تعرض آراءً وتسمّي نفسها نقاشاً.**
--
--  ================= قرارا أحمد اللذان يحكمان هذا الملفّ =================
--
--  **(١) غرفةٌ واحدة لكل عمل، عنوانُها مولَّد** — لا يفتح أحدٌ نقاشاً
--  ولا يكتب عنواناً. **فلا جدولَ للغرف أصلاً:** الغرفةُ هي `(tmdb_id,
--  media_type)`، **وتولد بأوّل مشاركةٍ فيها وتموت بآخرها** — وجدولُ غرفٍ
--  فارغةٍ سجلٌّ لا قارئ له (D-224).
--
--  **(٢) `/talk` تصير نقاشاً خالصاً** — الآراءُ تخرج منها إلى خطّ النشاط
--  وصفحة العمل وصفحات `/review`.
--
--  ================= ولماذا العنوانُ والملصقُ في صفّ المشاركة =================
--
--  `title_snapshots` لا تحمل عنواناً ولا ملصقاً، **و`ratings` تحملهما
--  على كل صفّ منذ أوّل يوم** — فالنمطُ قائمٌ في المخطط لا يُخترع هنا.
--  **والبديلُ نداءُ TMDB لكل غرفةٍ في القائمة** — أربعون نداءً لفتحةِ
--  تبويب (D-164).
--
--  ================= والعمقُ مقيَّدٌ بأربع درجات =================
--
--  Reddit بلا قاع، **وشاشةُ الهاتف لها قاع**: كلُّ درجةٍ تأكل من العرض،
--  والخامسةُ تجعل الكلمةَ في السطر. **فالقيدُ في القاعدة لا في الواجهة**
--  (D-193) — والواجهةُ تُزيح ثلاثاً ثم تسطّح.
--
--  التحقّق:
--    select count(*) from public.title_talk_rooms(5);
--    select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';   -- أربعٌ لا خامسة
-- ============================================================

create table if not exists public.title_posts (
  id          uuid primary key default gen_random_uuid(),
  tmdb_id     integer not null,
  media_type  text not null check (media_type in ('tv', 'movie')),
  -- العنوانُ والملصقُ والغلافُ مع الصفّ (نمطُ `ratings` نفسُه) — انظر أعلاه.
  -- **والغلافُ لخلفيّة البطاقة** (طلبُ أحمد: «الخلفية تكون من غلاف الفلم»)
  title         text,
  poster_path   text,
  backdrop_path text,
  user_id     uuid not null references auth.users (id) on delete cascade,
  body        text not null check (length(btrim(body)) between 1 and 2000),
  parent_id   uuid references public.title_posts (id) on delete cascade,
  -- يحسبها المُشغِّل ولا يرسلها العميل: رقمٌ يكتبه العميل يكذب
  depth       smallint not null default 0,
  hidden      boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.title_posts enable row level security;

create index if not exists title_posts_room_idx
  on public.title_posts (tmdb_id, media_type, created_at);
create index if not exists title_posts_parent_idx
  on public.title_posts (parent_id);
create index if not exists title_posts_author_idx
  on public.title_posts (user_id, created_at desc);

-- **العمقُ يُحسب ويُقيَّد** — والردُّ لا يعبر غرفتين
create or replace function public.title_posts_depth_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  if new.parent_id is null then
    new.depth := 0;
    return new;
  end if;
  select depth, tmdb_id, media_type into p
    from public.title_posts where id = new.parent_id;
  if p is null then
    raise exception 'parent not found';
  end if;
  if p.tmdb_id <> new.tmdb_id or p.media_type <> new.media_type then
    raise exception 'parent belongs to another room';
  end if;
  if p.depth >= 3 then
    raise exception 'reply depth limit reached';
  end if;
  new.depth := p.depth + 1;
  return new;
end;
$$;

drop trigger if exists title_posts_depth on public.title_posts;
create trigger title_posts_depth
  before insert or update on public.title_posts
  for each row execute function public.title_posts_depth_guard();

drop policy if exists "talk as self" on public.title_posts;
create policy "talk as self" on public.title_posts
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "read own talk" on public.title_posts;
create policy "read own talk" on public.title_posts
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "delete own talk" on public.title_posts;
create policy "delete own talk" on public.title_posts
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
--  خيطُ الغرفة — مسطَّحٌ بالعمق، والواجهةُ تبنيه شجرةً
--  **والفرزُ في الذاكرة ما دام السقفُ ٣٠٠** (D-240)
-- ============================================================
create or replace function public.title_thread(t_id integer, m_type text)
returns table (
  id         uuid,
  parent_id  uuid,
  depth      smallint,
  author_id  uuid,
  nickname   text,
  username   text,
  avatar_url text,
  hide_name  boolean,
  body       text,
  created_at timestamptz
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
    r.created_at
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

-- ============================================================
--  الغرفُ الحيّة — بطاقاتُ تبويب «نقاش»
--  **ولا غرفةَ فارغة**: الغرفةُ تولد بأوّل مشاركة
--
--  ⚠️ **واسمُها `title_talk_rooms` لا `title_rooms`** — والاسمُ الثاني
--  **مشغولٌ منذ `title_communities.sql`** بغرف المجتمعات التلقائية
--  (يقرؤه `data.ts` وتملؤه مهمّةُ الكرون `loopz-title-communities`).
--  **والقاعدةُ ردّت المحاولةَ بنفسها** («cannot change return type of
--  existing function») — **وهو الدليلُ على أن الفحص قبل الاستبدال ليس
--  ترفاً** (D-214): اسمٌ يبدو حرّاً قد يكون بيتَ ميزةٍ أخرى.
-- ============================================================
create or replace function public.title_talk_rooms(p_limit integer default 40)
returns table (
  tmdb_id     integer,
  media_type  text,
  title         text,
  poster_path   text,
  backdrop_path text,
  posts         bigint,
  last_at       timestamptz,
  faces         jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select r.*
    from public.title_posts r
    where auth.uid() is not null
      and r.hidden = false
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
           or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
      )
  ),
  agg as (
    select
      v.tmdb_id,
      v.media_type,
      count(*)::bigint            as posts,
      max(v.created_at)           as last_at,
      /* **العنوانُ والملصقُ من أحدث صفٍّ يحملهما**: العملُ قد يُعاد
         تسميتُه أو يتغيّر ملصقُه، **وأحدثُ ما كتبه الناس أقربُ للحقّ** */
      (array_remove(array_agg(v.title order by v.created_at desc), null))[1]         as title,
      (array_remove(array_agg(v.poster_path order by v.created_at desc), null))[1]   as poster_path,
      (array_remove(array_agg(v.backdrop_path order by v.created_at desc), null))[1] as backdrop_path
    from visible v
    group by v.tmdb_id, v.media_type
  ),
  /* **الوجوهُ أشخاصٌ لا مشاركات** — أحدثُ خمسةِ متكلّمين، كلٌّ مرّةً */
  last_faces as (
    select
      d.tmdb_id, d.media_type,
      jsonb_agg(
        jsonb_build_object(
          'id', d.user_id,
          'nickname',   case when coalesce(d.hide_name, false) then null else d.nickname end,
          'username',   case when coalesce(d.hide_name, false) then null else d.username end,
          'avatar_url', case when coalesce(d.hide_name, false) then null else d.avatar_url end,
          'hide_name',  coalesce(d.hide_name, false)
        )
        order by d.seen desc
      ) as faces
    from (
      select distinct on (v.tmdb_id, v.media_type, v.user_id)
        v.tmdb_id, v.media_type, v.user_id,
        max(v.created_at) over (partition by v.tmdb_id, v.media_type, v.user_id) as seen,
        p.nickname, p.username, p.avatar_url, p.hide_name
      from visible v
      join public.profiles p on p.id = v.user_id
    ) d
    group by d.tmdb_id, d.media_type
  )
  select
    a.tmdb_id, a.media_type, a.title, a.poster_path, a.backdrop_path,
    a.posts, a.last_at,
    coalesce(f.faces, '[]'::jsonb)
  from agg a
  left join last_faces f
    on f.tmdb_id = a.tmdb_id and f.media_type = a.media_type
  order by a.last_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;
revoke all on function public.title_talk_rooms(integer) from public;
grant execute on function public.title_talk_rooms(integer) to authenticated;

-- ============================================================
--  **سطحٌ عامٌّ جديد يولد ببابِ بلاغه** (D-193/D-249)
--  عشرةُ بلاغاتٍ تُخفي المشاركة — نفسُ عتبة `news_reply_reports`
-- ============================================================
create table if not exists public.title_post_reports (
  post_id     uuid not null references public.title_posts (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text check (reason is null or length(btrim(reason)) <= 300),
  created_at  timestamptz not null default now(),
  primary key (post_id, reporter_id)
);

alter table public.title_post_reports enable row level security;

drop policy if exists "report talk as self" on public.title_post_reports;
create policy "report talk as self" on public.title_post_reports
  for insert to authenticated with check (auth.uid() = reporter_id);

drop policy if exists "read own talk reports" on public.title_post_reports;
create policy "read own talk reports" on public.title_post_reports
  for select to authenticated using (auth.uid() = reporter_id);

create or replace function public.title_post_reports_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.title_post_reports where post_id = new.post_id) >= 10 then
    update public.title_posts set hidden = true
    where id = new.post_id and hidden = false;
  end if;
  return new;
end;
$$;

drop trigger if exists title_post_reports_hide_trg on public.title_post_reports;
create trigger title_post_reports_hide_trg
  after insert on public.title_post_reports
  for each row execute function public.title_post_reports_hide();
