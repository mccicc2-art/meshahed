-- ============================================================
--  ٦٢ — الردودُ على الآراء (D-193)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّل هذا الملف **قبل** نشر صفحة `‎/talk`.
--
--  **الحاجةُ التي أوجدته، بنصّ أحمد:** «إذا ضغطت على الفيلم ما أبغاه
--  يوديني صفحة الفيلم، أبغى صفحة تعليقات فقط كأني فاتح مجتمع، لكن فيه كل
--  التعليقات الي موجودة في صفحة الفيلم **ومربوطين ببعض**».
--
--  و«مربوطين ببعض» هي الكلمة المكلفة: الرأيُ اليوم صفٌّ في `ratings`
--  بمفتاحٍ مركّب (`user_id, tmdb_id, media_type`) — **صفٌّ واحد لكل شخصٍ
--  لكل عمل، لا يتشعّب**. فلا مكانَ لردٍّ على رأي.
--
--  **والطريقُ الآخر رُفض بعد عرضه:** توجيهُ الردّ إلى غرفة العمل (D-140)
--  كان بلا هجرةٍ إطلاقاً — واختار أحمد هذا. **وثمنُ اختياره مدفوعٌ هنا:
--  جدولٌ جديد، وسياساتُه، وبلاغٌ وحظرٌ من أوّل يوم.**
--
--  ================= خمسةُ قرارات، ولكلٍّ سببُه =================
--
--  ١) **الهدفُ رأيٌ لا معرّفُ صفّ.** `ratings` بلا `id`، فالردُّ يشير إلى
--     (صاحبِ الرأي + العمل) — نفسُ المفتاح الذي تشير به `review_reports`
--     و`review_likes` منذ D-124. **مفتاحُ إشارةٍ واحد في التطبيق كلّه**؛
--     ولو اخترعنا `id` هنا لصار للرأي هويّتان.
--
--  ٢) **سطرٌ واحد من التشعّب لا شجرة.** `parent_id` يشير إلى ردٍّ آخر،
--     **والمُشغِّل يمنع ردّاً على ردٍّ على ردّ**. شجرةٌ بلا حدٍّ تحتاج
--     رسماً متداخلاً وطيّاً وترقيماً، وفي مجتمعٍ بحجمنا **العمقُ الثالث
--     لا يُكتب أصلاً** — والحدُّ في القاعدة لا في الواجهة، فلا يكسره
--     مستدعٍ ثانٍ.
--
--  ٣) **لا سياسةَ قراءةٍ مفتوحة.** القراءةُ عبر `title_replies()` وحدها
--     (`security definer`) — فتبقى السياساتُ المفتوحة **أربعاً** كما
--     يشترط الفحصُ الصحّي. والإخفاءُ يُنفَّذ في SQL لا في الواجهة (D-011):
--     من أخفى اسمه يظهر ردُّه بلا اسمه ولا صورته.
--
--  ٤) **الحظرُ يُحترم في القراءة لا في العرض** (D-145): من حظرتَه لا
--     يظهر ردُّه لك، ومن حظرك لا يظهر ردُّك له. **ولو تُرك للواجهة
--     لظهر ثم اختفى** — وهو أسوأ من ألّا يظهر.
--
--  ٥) **الإخفاءُ بالبلاغ من أوّل يوم.** عمودُ `hidden` والمُشغِّلُ الذي
--     يرفعه عند عشرة بلاغات — **نفسُ عتبة `review_reports` وحرفيّتُها**،
--     فلا يتعلّم المستخدم قاعدتين. وسطحٌ عامٌّ جديد بلا بابِ بلاغٍ هو
--     كيف تُولد المشكلة التي تُعالَج متأخّرةً.
-- ============================================================

create table if not exists public.review_replies (
  id             uuid primary key default gen_random_uuid(),
  -- الرأيُ المردود عليه (القرار ١)
  review_user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id        integer not null,
  media_type     text not null check (media_type in ('tv', 'movie')),
  -- كاتبُ الردّ
  user_id        uuid not null references auth.users (id) on delete cascade,
  body           text not null check (length(btrim(body)) between 1 and 1000),
  -- ردٌّ على ردّ — عمقٌ واحد فقط (القرار ٢)
  parent_id      uuid references public.review_replies (id) on delete cascade,
  hidden         boolean not null default false,
  created_at     timestamptz not null default now()
);

alter table public.review_replies enable row level security;

-- القراءةُ الشائعة: كلُّ ردود عملٍ واحد بترتيبها الزمني
create index if not exists review_replies_title_idx
  on public.review_replies (tmdb_id, media_type, created_at);
-- «ردودي» — للحذف ولعدّاد المستخدم
create index if not exists review_replies_author_idx
  on public.review_replies (user_id, created_at desc);
create index if not exists review_replies_parent_idx
  on public.review_replies (parent_id);

-- ============================================================
--  حدُّ العمق: ردٌّ على ردّ نعم، وردٌّ على ردّ ردٍّ لا (القرار ٢)
-- ============================================================
create or replace function public.review_replies_depth_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    -- الأبُ موجودٌ وعلى نفس الرأي، ولا أبَ له هو
    if not exists (
      select 1 from public.review_replies p
      where p.id = new.parent_id
        and p.parent_id is null
        and p.review_user_id = new.review_user_id
        and p.tmdb_id = new.tmdb_id
        and p.media_type = new.media_type
    ) then
      raise exception 'reply depth or target mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists review_replies_depth on public.review_replies;
create trigger review_replies_depth
  before insert or update on public.review_replies
  for each row execute function public.review_replies_depth_guard();

-- ============================================================
--  السياسات — كتابةٌ باسمك، وقراءةٌ عبر الدالّة وحدها (القرار ٣)
-- ============================================================
drop policy if exists "reply as self" on public.review_replies;
create policy "reply as self" on public.review_replies
  for insert to authenticated
  with check (auth.uid() = user_id);

-- قراءةُ ردودك أنت وحدها من الجدول مباشرةً (للحذف والتحرير).
-- **وكلُّ قراءةٍ عامّة تمرّ بـ`title_replies()`** — فلا `qual='true'` هنا.
drop policy if exists "read own replies" on public.review_replies;
create policy "read own replies" on public.review_replies
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "delete own reply" on public.review_replies;
create policy "delete own reply" on public.review_replies
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
--  القارئ — ردودُ عملٍ واحد، بأسمائها وباحترام الإخفاء والحظر
-- ============================================================
create or replace function public.title_replies(
  p_tmdb integer,
  p_type text
)
returns table (
  id             uuid,
  review_user_id uuid,
  parent_id      uuid,
  author_id      uuid,
  nickname       text,
  username       text,
  avatar_url     text,
  hide_name      boolean,
  body           text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.review_user_id,
    r.parent_id,
    r.user_id as author_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.body,
    r.created_at
  from public.review_replies r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and r.tmdb_id = p_tmdb
    and r.media_type = p_type
    and r.hidden = false
    -- الحظرُ في الاتجاهين (القرار ٤)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
         or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
    )
  order by r.created_at asc
  limit 300;
$$;

revoke all on function public.title_replies(integer, text) from public;
grant execute on function public.title_replies(integer, text) to authenticated;

-- ============================================================
--  عدّادان لصفّ «الأعمال»: كم ردّاً وكم مشاهداً (D-193)
--
--  **ولماذا في دالّةٍ واحدة:** الصفّ يعرض عشرين عملاً، وعدُّ كلٍّ منهما
--  في نداءٍ منفصل عشرون نداءً. **وهي تُرجع الأعمال التي فيها ردٌّ أو
--  متابعٌ وحدها** — فلا تكبر بحجم TMDB بل بحجم استعمالنا.
--
--  و«المشاهد» = من يتابع العمل (`follows`) — أصدقُ ما نملك بلا عمودٍ
--  جديد، وهو ما اقترحه أحمد بديلاً عن «إعادة النشر» التي لا معنى لها
--  عندنا («وش المقصد في ريتويت؟»).
-- ============================================================
create or replace function public.title_talk_stats()
returns table (
  tmdb_id     integer,
  media_type  text,
  replies     bigint,
  watchers    bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select tmdb_id, media_type, count(*)::bigint as replies
    from public.review_replies
    where hidden = false
    group by 1, 2
  ),
  f as (
    select tmdb_id, media_type, count(*)::bigint as watchers
    from public.follows
    group by 1, 2
  )
  select
    coalesce(r.tmdb_id, f.tmdb_id)      as tmdb_id,
    coalesce(r.media_type, f.media_type) as media_type,
    coalesce(r.replies, 0)               as replies,
    coalesce(f.watchers, 0)              as watchers
  from r
  full outer join f
    on f.tmdb_id = r.tmdb_id and f.media_type = r.media_type
  where auth.uid() is not null;
$$;

revoke all on function public.title_talk_stats() from public;
grant execute on function public.title_talk_stats() to authenticated;

-- ============================================================
--  الإخفاءُ عند عشرة بلاغات — نفسُ عتبة `review_reports` (القرار ٥)
-- ============================================================
create table if not exists public.reply_reports (
  reply_id    uuid not null references public.review_replies (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text check (reason is null or length(btrim(reason)) <= 300),
  created_at  timestamptz not null default now(),
  primary key (reply_id, reporter_id)
);

alter table public.reply_reports enable row level security;

drop policy if exists "report reply as self" on public.reply_reports;
create policy "report reply as self" on public.reply_reports
  for insert to authenticated with check (auth.uid() = reporter_id);

drop policy if exists "read own reply reports" on public.reply_reports;
create policy "read own reply reports" on public.reply_reports
  for select to authenticated using (auth.uid() = reporter_id);

create or replace function public.reply_reports_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.reply_reports where reply_id = new.reply_id) >= 10 then
    update public.review_replies set hidden = true
    where id = new.reply_id and hidden = false;
  end if;
  return new;
end;
$$;

drop trigger if exists reply_reports_hide_trg on public.reply_reports;
create trigger reply_reports_hide_trg
  after insert on public.reply_reports
  for each row execute function public.reply_reports_hide();

-- ============================================================
--  التحقّق بعد التشغيل
--
--   ١) الجدولان والدالّتان:
--      select table_name from information_schema.tables
--      where table_schema='public' and table_name in ('review_replies','reply_reports');
--      select proname from pg_proc where proname in ('title_replies','title_talk_stats');
--
--   ٢) **السياساتُ المفتوحة أربعٌ ولا خمس** — وهذا أهمُّ فحصٍ هنا:
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
--
--   ٣) حدُّ العمق يعمل (المتوقَّع: خطأ عند الثالث):
--      -- ردٌّ على ردٍّ على ردّ يُرفض بـ'reply depth or target mismatch'
--
--   ٤) `grant` للمصادَقين وحدهم:
--      select has_function_privilege('public','public.title_replies(integer,text)','execute');
--      -- المتوقَّع: false
-- ============================================================
