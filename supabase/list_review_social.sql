-- ============================================================
--  ١١٣ — الإعجابُ والردُّ على مراجعة القائمة (D-370)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  **البندُ الرابع من الخمسة الباقية** (`05_Todo`)، وطلبُ أحمد: «اكمل».
--
--  ============ سطحٌ رابعٌ للكلام، فوصفتُه وصفةُ إخوته ============
--
--  **ولا وصفةَ جديدةً هنا إطلاقاً**: `list_review_likes` منسوخٌ من
--  `review_likes` (١٩) بحرفه، و`list_review_replies` من `review_replies`
--  (٦٢) بحرفه — **حدُّ العمق، وسياسةُ «اكتب باسمك»، وقراءةٌ بدالّة
--  `definer` وحدَها، وبابُ بلاغٍ من أوّل يوم بعتبة العشرة** (D-193).
--  **ووصفةٌ تُنسخ ثم يُصلَح أصلُها وحدَه يعود عطلُها من بابٍ آخر**
--  (D-145) — فإن تغيّر حارسٌ هناك يتغيّر هنا في الدفعة نفسِها.
--
--  ============ لماذا الآن، وما الذي كان محجوزاً عليه ============
--
--  **صفُّ القائمة في خطّ المجتمع يُرسم بلا ذيلِ أفعالٍ عمداً منذ ١٠٦**
--  (`ActivityFeed`: «لا `list_review_likes` اليوم، **وزرٌّ لا يكتب شيئاً
--  أسوأُ من غيابه**» — D-123). **وهذا الجدولُ هو ما كان ينقص**، فالذيلُ
--  يُرسم في دفعته بلا كذبة.
--
--  ============ ثلاثةُ قراراتٍ تفترق فيها عن أصلها، ولكلٍّ سببُه ============
--
--  ١) **المفتاحُ (صاحبُ الرأي + القائمة) لا معرّفُ صفّ.** `list_reviews`
--     بلا `id` — مفتاحُها `(user_id, list_id)`، **وهو نفسُ المفتاح الذي
--     تشير به `list_review_reports` منذ ١٠٣**. **ولو اخترعنا `id` هنا
--     لصار للرأي هويّتان** (نصُّ القرار ١ في ٦٢).
--
--  ٢) **والحوارُ يموت بموت رأسِه** — `on delete cascade` بمفتاحٍ مركّبٍ
--     إلى `list_reviews`. **وهنا نفترق عن ٦٢ عمداً**: ردودُ الأعمال
--     هناك بلا مفتاحٍ أجنبيٍّ إلى `ratings`، **فردٌّ يبقى بعد أن يُحذف
--     رأسُه** — ولا يُرسم لأن الصفَّ اختفى، **ثم يعود إلى الظهور إن كتب
--     صاحبُه رأياً جديداً على العمل نفسِه**. **وحوارٌ يُبعث بعد دفنه أسوأُ
--     من حوارٍ يُدفن مع صاحبه**، **وحذفُ الرأي هنا ضغطةٌ واحدةٌ في
--     الصندوق** (`ListReviewForm`) لا فعلٌ نادر — **فالأثرُ يقع كثيراً لا
--     نادراً.** ⚠️ **والثمنُ يُقال قبل أن يُدفع**: من حذف رأيَه حذف كلامَ
--     الناس تحته. **وهو عرفُ تويتر حرفاً** (منشورٌ يُحذف بردوده).
--
--  ٣) **ولا سؤالَ عن `list_reviews` في أيّ سياسة.** سياستُها للقراءة
--     `auth.uid() = user_id` (١٠٣)، **والاستعلامُ الفرعيُّ داخل السياسة
--     يُنفَّذ بعين صاحب الطلب** — **فسؤالُ «هل ثمّة رأيٌ ليس لي؟» جوابُه
--     لا أبداً**، وهو عطلُ ١١٠/D-355 بحرفه. **فالوجودُ يضمنه المفتاحُ
--     الأجنبيُّ لا السياسة** (النظامُ يفحصه بعينه)، **والعلانيةُ تُسأل من
--     `user_lists` وحدَها** — ولها سياسةُ قراءةٍ عامّةٍ حقيقيّة
--     (`read public lists`, `using (is_public)`) **فالسؤالُ عنها يُجاب.**
-- ============================================================

begin;

-- ============================================================
--  ١ · الإعجاب — `review_likes` بمفتاح القوائم
-- ============================================================
create table if not exists public.list_review_likes (
  review_user_id uuid not null references auth.users (id) on delete cascade,
  list_id        uuid not null references public.user_lists (id) on delete cascade,
  liker_id       uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (review_user_id, list_id, liker_id),
  -- حذفُ المراجعة يحذف إعجاباتِها معها (القرار ٢)
  foreign key (review_user_id, list_id)
    references public.list_reviews (user_id, list_id) on delete cascade
);

alter table public.list_review_likes enable row level security;

-- لا يُعجب أحدٌ نيابةً عن غيره، ولا يُعجب المرء بمراجعة نفسه
drop policy if exists "insert own list review like" on public.list_review_likes;
create policy "insert own list review like" on public.list_review_likes
  for insert to authenticated
  with check (auth.uid() = liker_id and auth.uid() <> review_user_id);

drop policy if exists "delete own list review like" on public.list_review_likes;
create policy "delete own list review like" on public.list_review_likes
  for delete to authenticated using (auth.uid() = liker_id);

-- **وقراءةُ صفوفي أنا وحدَها** — والأعدادُ من دالّةٍ `definer` أدناه،
-- **فالسياساتُ المفتوحة تبقى أربعاً** (D-013)
drop policy if exists "read own list review likes" on public.list_review_likes;
create policy "read own list review likes" on public.list_review_likes
  for select to authenticated using (auth.uid() = liker_id);

create index if not exists list_review_likes_target_idx
  on public.list_review_likes (list_id, review_user_id);
create index if not exists list_review_likes_liker_idx
  on public.list_review_likes (liker_id);

-- ============================================================
--  ٢ · الردود — `review_replies` بمفتاح القوائم
-- ============================================================
create table if not exists public.list_review_replies (
  id             uuid primary key default gen_random_uuid(),
  -- الرأيُ المردود عليه (القرار ١)
  review_user_id uuid not null references auth.users (id) on delete cascade,
  list_id        uuid not null references public.user_lists (id) on delete cascade,
  -- كاتبُ الردّ
  user_id        uuid not null references auth.users (id) on delete cascade,
  body           text not null check (length(btrim(body)) between 1 and 1000),
  -- ردٌّ على ردّ — عمقٌ واحد فقط (القرار ٢ في ٦٢)
  parent_id      uuid references public.list_review_replies (id) on delete cascade,
  hidden         boolean not null default false,
  created_at     timestamptz not null default now(),
  foreign key (review_user_id, list_id)
    references public.list_reviews (user_id, list_id) on delete cascade
);

alter table public.list_review_replies enable row level security;

-- القراءةُ الشائعة: ردودُ قائمةٍ واحدةٍ بترتيبها الزمنيّ
create index if not exists list_review_replies_list_idx
  on public.list_review_replies (list_id, created_at);
-- «ردودي» — للحذف
create index if not exists list_review_replies_author_idx
  on public.list_review_replies (user_id, created_at desc);
create index if not exists list_review_replies_parent_idx
  on public.list_review_replies (parent_id);

-- ============================================================
--  حدُّ العمق: ردٌّ على ردّ نعم، وردٌّ على ردّ ردٍّ لا
--  **والحدُّ في القاعدة لا في الواجهة، فلا يكسره مستدعٍ ثانٍ** (٦٢)
-- ============================================================
create or replace function public.list_review_replies_depth_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    -- الأبُ موجودٌ وعلى نفس الرأي، ولا أبَ له هو
    if not exists (
      select 1 from public.list_review_replies p
      where p.id = new.parent_id
        and p.parent_id is null
        and p.review_user_id = new.review_user_id
        and p.list_id = new.list_id
    ) then
      raise exception 'reply depth or target mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists list_review_replies_depth on public.list_review_replies;
create trigger list_review_replies_depth
  before insert or update on public.list_review_replies
  for each row execute function public.list_review_replies_depth_guard();

-- ============================================================
--  السياسات — كتابةٌ باسمك على قائمةٍ معلنة، وقراءةٌ عبر الدالّة وحدها
--
--  ⚠️ **والعلانيةُ شرطُ كتابةٍ لا شرطُ عرض**: قائمةٌ خاصّة لا يقرؤها
--  أحد، **فردٌّ فيها وعدٌ كاذب** (نفسُ شرط `list_reviews` في ١٠٣).
--  **ولا يُسأل عن `list_reviews` هنا** — القرار ٣ أعلاه.
-- ============================================================
drop policy if exists "reply to list review as self" on public.list_review_replies;
create policy "reply to list review as self" on public.list_review_replies
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.user_lists l
      where l.id = list_id and l.is_public
    )
  );

drop policy if exists "read own list review replies" on public.list_review_replies;
create policy "read own list review replies" on public.list_review_replies
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "delete own list review reply" on public.list_review_replies;
create policy "delete own list review reply" on public.list_review_replies
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
--  ٣ · القارئ — ردودُ قائمةٍ واحدة، بأسمائها وباحترام الإخفاء والحظر
--
--  **نداءٌ واحدٌ للقائمة كلِّها لا لكلِّ رأي** (D-205): تبويبُ التقييمات
--  يعرض حتى خمسين رأياً، **وقراءةٌ لكلِّ واحدٍ خمسون رحلة.**
-- ============================================================
create or replace function public.list_review_replies_of(p_list uuid)
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
  from public.list_review_replies r
  join public.profiles p on p.id = r.user_id
  join public.user_lists l on l.id = r.list_id
  where auth.uid() is not null
    and r.list_id = p_list
    and l.is_public
    and r.hidden = false
    -- الحظرُ في الاتجاهين (القرار ٤ في ٦٢)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
         or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
    )
  order by r.created_at asc
  limit 300;
$$;

-- ============================================================
--  ٤ · الأعداد — قلوبٌ وردودٌ لكلِّ رأيٍ في قوائمَ بمعرّفاتها
--
--  **مصفوفةٌ لا معرّفٌ واحد** (D-205/D-329): صفحةُ القائمة تمرّر واحداً،
--  **وخطُّ المجتمع يمرّر قوائمَ صفوفِه كلَّها في نداءٍ واحد** — وهو ما
--  يجعل ذيلَ صفِّ القائمة ممكناً بلا رحلةٍ لكلِّ صفّ.
--
--  **والعامّةُ وحدَها** (`l.is_public`)، **والمحجوبةُ لا تُعدّ**
--  (`r.hidden`)، **ومن لا تراه لا يُحسب رأيُه** (`can_view_profile`) —
--  **نفسُ حرّاس `list_review_stats` في ١٠٣ حرفاً**، وإلّا اختلف الرقمُ
--  عن الصفوف التي تحته (D-219).
-- ============================================================
create or replace function public.list_review_social(p_lists uuid[])
returns table (
  list_id        uuid,
  review_user_id uuid,
  likes          integer,
  replies        integer,
  liked_by_me    boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.list_id,
    r.user_id as review_user_id,
    (select count(*)::int from public.list_review_likes k
      where k.list_id = r.list_id and k.review_user_id = r.user_id)      as likes,
    (select count(*)::int from public.list_review_replies p
      where p.list_id = r.list_id and p.review_user_id = r.user_id
        and p.hidden = false)                                            as replies,
    exists (
      select 1 from public.list_review_likes k
      where k.list_id = r.list_id and k.review_user_id = r.user_id
        and k.liker_id = auth.uid()
    )                                                                    as liked_by_me
  from public.list_reviews r
  join public.user_lists l on l.id = r.list_id
  where auth.uid() is not null
    and r.list_id = any (p_lists)
    and l.is_public
    and coalesce(r.hidden, false) = false
    and public.can_view_profile(r.user_id);
$$;

-- ============================================================
--  ٥ · الإخفاءُ عند عشرة بلاغات — نفسُ عتبة `reply_reports` حرفاً
--  **وسطحٌ عامٌّ جديدٌ بلا بابِ بلاغٍ هو كيف تُولد المشكلة** (D-193)
-- ============================================================
create table if not exists public.list_reply_reports (
  reply_id    uuid not null references public.list_review_replies (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text check (reason is null or length(btrim(reason)) <= 300),
  created_at  timestamptz not null default now(),
  primary key (reply_id, reporter_id)
);

alter table public.list_reply_reports enable row level security;

drop policy if exists "report list reply as self" on public.list_reply_reports;
create policy "report list reply as self" on public.list_reply_reports
  for insert to authenticated with check (auth.uid() = reporter_id);

drop policy if exists "read own list reply reports" on public.list_reply_reports;
create policy "read own list reply reports" on public.list_reply_reports
  for select to authenticated using (auth.uid() = reporter_id);

create or replace function public.list_reply_reports_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.list_reply_reports where reply_id = new.reply_id) >= 10 then
    update public.list_review_replies set hidden = true
    where id = new.reply_id and hidden = false;
  end if;
  return new;
end;
$$;

drop trigger if exists list_reply_reports_hide_trg on public.list_reply_reports;
create trigger list_reply_reports_hide_trg
  after insert on public.list_reply_reports
  for each row execute function public.list_reply_reports_hide();

revoke all on function public.list_review_replies_of(uuid) from public;
grant execute on function public.list_review_replies_of(uuid) to authenticated;
revoke all on function public.list_review_social(uuid[]) from public;
grant execute on function public.list_review_social(uuid[]) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_tables
--     where schemaname = 'public'
--       and tablename in ('list_review_likes','list_review_replies','list_reply_reports')) as tbls,
--   (select count(*)::int from pg_proc
--     where proname in ('list_review_replies_of','list_review_social'))                    as fns,
--   (select count(*)::int from pg_policies where qual = 'true')                            as open_policies;
-- المتوقّع: tbls = 3 · fns = 2 · open_policies = 4
