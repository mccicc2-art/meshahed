-- ============================================================
--  ٧٣ — الردودُ على نشرات Loopz (D-236)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  **الحاجةُ التي أوجدته، بنصّ أحمد:** «إذا ضغطت على أيقونة التعليق أقدر
--  مثل باقي النشرات أكتب، مو لازم يفتح الصفحة» — و«نشرات Loopz لازم فيه
--  إحصائية».
--
--  ================= لماذا جدولٌ ثالث ولم تكفِ الجداول =================
--
--  **الجدارُ الذي اصطدمنا به مقيسٌ لا مُخمَّن:** `review_replies.review_user_id`
--  عمودٌ `references auth.users (id)` — **وكذلك `profiles.id`**. فكلُّ ما
--  يُنسب إلى «صاحبِ رأي» في هذا التطبيق يشترط صفَّ مصادقةٍ حقيقياً،
--  **و«Loopz» ليس إنساناً سجّل بجوجل**. فالردُّ على نشرتنا لا مكان له في
--  الجدول القائم.
--
--  **وثلاثةُ طرقٍ عُرضت على أحمد واختار الثالث:**
--    أ) صفٌّ حقيقيٌّ في `auth.users` لـLoopz — يعمل بلا تغييرِ مخطّط،
--       **لكنّه إنشاءُ هويّة مصادقة** ولا تفعله الجلسة.
--    ب) فكُّ ارتباط `review_replies` عن `auth.users` — **يمسّ جدولاً حيّاً
--       بسياساته**، وأخطرُها.
--    ج) **جدولٌ خاصٌّ بردود المنشورات** — **لا يمسّ شيئاً قائماً**، ويعطي
--       عدّادَ ردودٍ حقيقياً للنشرة. **اختيارُ أحمد: «ج».**
--
--  ================= خمسةُ قرارات، ولكلٍّ سببُه =================
--
--  ١) **الهدفُ `post_key` لا `(عمل + نوع)`.** الردُّ على **هذه النشرة**
--     لا على العمل: للعمل الواحد نشراتٌ كثيرة («تجدَّد» ثم «موعدُ الموسم»)،
--     **وخلطُها في خيطٍ واحد يجعل الردَّ يبدو جواباً على خبرٍ لم يُقرأ**.
--     و`news_posts.key` مفتاحٌ أوّليٌّ نصّيٌّ مركَّب (`kind:media:id:dedupe`)
--     **فالتكرارُ مستحيلٌ بالبناء** — وهو أصدقُ مِرساة.
--
--  ٢) **ولا `foreign key` إلى `news_posts`، ومعه حارسٌ في المقصّ.**
--     المولّدُ يقصّ ما بعد ٣٠٠ منشور (انظر `prune_news_posts`)، **و`cascade`
--     كان سيمحو كلامَ الناس مع منشورٍ قديم**. فالقصُّ صار **يتخطّى كلَّ
--     منشورٍ عليه ردّ** — **لا نحذف ما تكلّم عليه أحد**؛ والقيدُ يُترك
--     مرفوعاً لأن الحارسَ في المقصّ أصدقُ من انهيارٍ متسلسل.
--
--  ٣) **سطرٌ واحد من التشعّب لا شجرة** — نفسُ حدّ D-193 حرفاً، ونفسُ
--     المُشغِّل. **والحدُّ في القاعدة لا في الواجهة** فلا يكسره مستدعٍ ثانٍ.
--
--  ٤) **لا سياسةَ قراءةٍ مفتوحة.** القراءةُ عبر `news_post_thread()` وحدها،
--     **فتبقى السياساتُ المفتوحة أربعاً** كما يشترط الفحصُ الصحّي.
--     والإخفاءُ (`hide_name`) والحظرُ في الاتجاهين يُنفَّذان في SQL لا في
--     الواجهة (D-011/D-145).
--
--  ٥) **بابُ البلاغ من أوّل يوم** — عتبةُ عشرة ونفسُ الشكل. **وسطحٌ عامٌّ
--     جديد بلا بابِ بلاغ هو كيف تُولد المشكلة** (D-193).
-- ============================================================

create table if not exists public.news_post_replies (
  id         uuid primary key default gen_random_uuid(),
  -- النشرةُ المردود عليها (القرار ١) — بلا قيدٍ أجنبيّ (القرار ٢)
  post_key   text not null check (length(btrim(post_key)) between 1 and 120),
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 1000),
  -- ردٌّ على ردّ — عمقٌ واحد فقط (القرار ٣)
  parent_id  uuid references public.news_post_replies (id) on delete cascade,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.news_post_replies enable row level security;

-- القراءةُ الشائعة: كلُّ ردود نشرةٍ واحدة بترتيبها الزمني
create index if not exists news_post_replies_post_idx
  on public.news_post_replies (post_key, created_at);
-- «ردودي» — للحذف ولعدّاد المستخدم
create index if not exists news_post_replies_author_idx
  on public.news_post_replies (user_id, created_at desc);
create index if not exists news_post_replies_parent_idx
  on public.news_post_replies (parent_id);

-- ============================================================
--  حدُّ العمق: ردٌّ على ردّ نعم، وردٌّ على ردّ ردٍّ لا (القرار ٣)
-- ============================================================
create or replace function public.news_post_replies_depth_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    -- الأبُ موجودٌ وعلى نفس النشرة، ولا أبَ له هو
    if not exists (
      select 1 from public.news_post_replies p
      where p.id = new.parent_id
        and p.parent_id is null
        and p.post_key = new.post_key
    ) then
      raise exception 'reply depth or target mismatch';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists news_post_replies_depth on public.news_post_replies;
create trigger news_post_replies_depth
  before insert or update on public.news_post_replies
  for each row execute function public.news_post_replies_depth_guard();

-- ============================================================
--  السياسات — كتابةٌ باسمك، وقراءةٌ عبر الدالّة وحدها (القرار ٤)
-- ============================================================
drop policy if exists "news reply as self" on public.news_post_replies;
create policy "news reply as self" on public.news_post_replies
  for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "read own news replies" on public.news_post_replies;
create policy "read own news replies" on public.news_post_replies
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "delete own news reply" on public.news_post_replies;
create policy "delete own news reply" on public.news_post_replies
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================
--  القارئ — ردودُ نشرةٍ واحدة، باحترام الإخفاء والحظر
-- ============================================================
create or replace function public.news_post_thread(p_key text)
returns table (
  id         uuid,
  parent_id  uuid,
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
    r.user_id as author_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.body,
    r.created_at
  from public.news_post_replies r
  join public.profiles p on p.id = r.user_id
  where auth.uid() is not null
    and r.post_key = p_key
    and r.hidden = false
    -- الحظرُ في الاتجاهين (D-145)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
         or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
    )
  order by r.created_at asc
  limit 300;
$$;

revoke all on function public.news_post_thread(text) from public;
grant execute on function public.news_post_thread(text) to authenticated;

-- ============================================================
--  العدّاد — كم ردّاً على كلِّ نشرةٍ من قائمةٍ واحدة
--
--  **نداءٌ واحد للخطّ كلِّه لا نداءٌ لكل صفّ** (D-164)، ويعيد **ما فيه
--  ردٌّ وحده** — فلا يكبر بحجم الأرشيف بل بحجم الكلام.
-- ============================================================
create or replace function public.news_reply_counts(keys text[])
returns table (post_key text, replies bigint)
language sql
stable
security definer
set search_path = public
as $$
  select r.post_key, count(*)::bigint
  from public.news_post_replies r
  where auth.uid() is not null
    and r.hidden = false
    and r.post_key = any (keys)
  group by r.post_key;
$$;

revoke all on function public.news_reply_counts(text[]) from public;
grant execute on function public.news_reply_counts(text[]) to authenticated;

-- ============================================================
--  الإخفاءُ عند عشرة بلاغات — نفسُ عتبة `reply_reports` (القرار ٥)
-- ============================================================
create table if not exists public.news_reply_reports (
  reply_id    uuid not null references public.news_post_replies (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text check (reason is null or length(btrim(reason)) <= 300),
  created_at  timestamptz not null default now(),
  primary key (reply_id, reporter_id)
);

alter table public.news_reply_reports enable row level security;

drop policy if exists "report news reply as self" on public.news_reply_reports;
create policy "report news reply as self" on public.news_reply_reports
  for insert to authenticated with check (auth.uid() = reporter_id);

drop policy if exists "read own news reply reports" on public.news_reply_reports;
create policy "read own news reply reports" on public.news_reply_reports
  for select to authenticated using (auth.uid() = reporter_id);

create or replace function public.news_reply_reports_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.news_reply_reports where reply_id = new.reply_id) >= 10 then
    update public.news_post_replies set hidden = true
    where id = new.reply_id and hidden = false;
  end if;
  return new;
end;
$$;

drop trigger if exists news_reply_reports_hide_trg on public.news_reply_reports;
create trigger news_reply_reports_hide_trg
  after insert on public.news_reply_reports
  for each row execute function public.news_reply_reports_hide();

-- ============================================================
--  المقصُّ يتخطّى ما تُكلِّم عليه (القرار ٢)
--
--  **نسخةٌ محدَّثة من `prune_news_posts`** — الأصلُ في `news_posts.sql`
--  يحذف ما بعد ٣٠٠ منشور بلا شرط. **وبعد اليوم صار للمنشور كلامٌ تحته**،
--  **ولا نحذف ما تكلّم عليه أحد.**
-- ============================================================
create or replace function public.prune_news_posts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.news_posts p
  where p.key in (
    select key from public.news_posts order by published_at desc offset 300
  )
  and not exists (
    select 1 from public.news_post_replies r where r.post_key = p.key
  );
$$;

-- ============================================================
--  التحقّق بعد التشغيل
--
--   ١) الجدولان والدوالّ الثلاث:
--      select table_name from information_schema.tables
--      where table_schema='public'
--        and table_name in ('news_post_replies','news_reply_reports');
--      select proname from pg_proc
--      where proname in ('news_post_thread','news_reply_counts','prune_news_posts');
--
--   ٢) **السياساتُ المفتوحة أربعٌ ولا خمس** — أهمُّ فحصٍ هنا:
--      select tablename, policyname from pg_policies
--      where schemaname='public' and qual='true';
--
--   ٣) العدّادُ يعمل ويعيد فارغاً بلا كلام:
--      select * from public.news_reply_counts(array['nope']);
--
--   ٤) `grant` للمصادَقين وحدهم:
--      select has_function_privilege('public','public.news_post_thread(text)','execute');
--      -- المتوقَّع: false
-- ============================================================
