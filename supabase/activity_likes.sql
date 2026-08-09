-- ============================================================
--  Loopz — إعجابٌ بحدثٍ لا برأي (D-124)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md) — رقم ٤٦
--
--  ⚠️ شغّله **قبل** نشر واجهة الإعجاب على أحداث المشاهدة.
--  ⚠️ يعتمد على الهجرة ٤٥ (`activity_v2.sql`) — نفس مفتاح التجميع.
--
--  بعد D-123 صار الخطّ يحمل مشاهدةً وإضافةً لا مراجعةً فقط، وهذه لا
--  مراجعة لها فلا مكان لها في `review_likes` (مفتاحه المراجعة). فبقيت
--  أحداثٌ تُقرأ ولا يُمكن التفاعل معها — نصفُ حلقةٍ اجتماعية.
--
--  **والقرار المعماريّ الذي يجب ألّا يُنقض:** الصفُّ الذي يحمل تقييماً
--  يبقى إعجابُه في `review_likes` القائم. «أعجبني رأيك» يجب أن يكون
--  **رقماً واحداً** في الخطّ وفي صفحة العمل؛ جدولان لمعنًى واحد =
--  عدّادان يتناقضان أمام المستخدم. هذا الجدول لأحداث المشاهدة وحدها.
-- ============================================================

-- ============================================================
--  ١) الجدول — مفتاحه هو مفتاح تجميع الخطّ نفسه
--
--  (فاعل، عمل، جهة، **يوم**) هو ما يُعرّف صفّاً واحداً في
--  `following_activity_v2`. فالإعجاب يشير إلى الصفّ الذي رآه المُعجِب،
--  لا إلى «كل ما فعله فلان بهذا العمل» — ولو أسقطنا اليوم لالتصق إعجاب
--  اليوم بمشاهدة الشهر الماضي.
-- ============================================================
create table if not exists public.activity_likes (
  actor_id   uuid not null references auth.users (id) on delete cascade,
  tmdb_id    integer not null,
  media_type text not null check (media_type in ('tv', 'movie')),
  day        date not null,
  liker_id   uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (actor_id, tmdb_id, media_type, day, liker_id),
  -- لا يُعجب المرء بنفسه — القاعدة هي الحارس لا الواجهة (نمط review_likes)
  check (actor_id <> liker_id)
);

alter table public.activity_likes enable row level security;

-- فهرسٌ على الفاعل: سؤال الخطّ «كم إعجاباً لأحداث هؤلاء؟»
create index if not exists activity_likes_actor_idx
  on public.activity_likes (actor_id, day desc);

-- ============================================================
--  ٢) السياسات — صفوفك أنت فقط، ولا قراءة عامة
--
--  **لا سياسة `using(true)` هنا**: الأعداد تُقرأ عبر دالّة definer
--  كإعجابات المراجعات تماماً، فلا يتغيّر استعلام `qual='true'` الصحّي.
--  والقراءة المباشرة مقصورةٌ على إعجاباتك أنت — من أعجب بماذا ليس
--  معلومةً عامة.
-- ============================================================
drop policy if exists "read own activity likes" on public.activity_likes;
create policy "read own activity likes" on public.activity_likes
  for select to authenticated using (auth.uid() = liker_id);

drop policy if exists "like as self" on public.activity_likes;
create policy "like as self" on public.activity_likes
  for insert to authenticated with check (auth.uid() = liker_id);

drop policy if exists "unlike own" on public.activity_likes;
create policy "unlike own" on public.activity_likes
  for delete to authenticated using (auth.uid() = liker_id);

-- ============================================================
--  ٣) أعداد الخطّ — توأمُ `feed_review_likes` بمفتاحٍ فيه يوم
--
--  ترجع العدد و«هل أعجبتُ به» **بلا أي معرّف مُعجِب** — نفس عقد
--  الدالّة الأخرى. وزيادةً عليها: **حارس `can_view_profile`** — من
--  نادى الدالّة بمعرّف حسابٍ خاصٍّ لا يتابعه أخذ صفراً، فلا يُستدلّ على
--  نشاطٍ محجوبٍ من عدّاد إعجاباته.
-- ============================================================
create or replace function public.feed_activity_likes(uids uuid[])
returns table (
  actor_id    uuid,
  tmdb_id     integer,
  media_type  text,
  day         date,
  likes       integer,
  liked_by_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.actor_id,
    l.tmdb_id,
    l.media_type,
    l.day,
    count(*)::integer,
    bool_or(l.liker_id = auth.uid())
  from public.activity_likes l
  where l.actor_id = any(uids)
    and public.can_view_profile(l.actor_id)
  group by l.actor_id, l.tmdb_id, l.media_type, l.day;
$$;

revoke all on function public.feed_activity_likes(uuid[]) from public;
grant execute on function public.feed_activity_likes(uuid[]) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل:
--
--   ١) الجدول والسياسات الثلاث:
--      select policyname from pg_policies
--      where schemaname='public' and tablename='activity_likes';
--      -- read own activity likes / like as self / unlike own
--
--   ٢) الدالّة:
--      select proname from pg_proc where proname='feed_activity_likes';
--
--   ٣) **الاستعلام الصحّي لم يتغيّر** — لا سياسة مفتوحة من هذه الهجرة:
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
--      -- المتوقّع كما هو: communities · imdb_ratings · user_follows
-- ============================================================
