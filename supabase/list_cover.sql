-- ============================================================
--  Loopz — غلافُ القائمة (هجرة 63، D-208)
--  شغّلها في Supabase → SQL Editor بعد review_replies.sql (62)
--
--  طلبُ أحمد حرفياً: «والليست في مكتبتي اعملها بنفس الطريقة بحيث
--  الشخص يقدر يحطّ صورة للستّة من هيدرات الأفلام التي ضمن اللستة».
--  أي: للقائمة وجهٌ يختاره صاحبها، **من خلفيّات الأعمال التي فيها**.
--
--  ⚠️ ولماذا ثلاثةُ أعمدةٍ لا عمودٌ واحد: `cover_backdrop` وحده يكفي
--  للعرض، **لكنه لا يقول من أين جاء** — فمن أراد تبديلَه لا يعرف أيَّ
--  عملٍ كان مختاراً، ومن حذف ذلك العمل من قائمته يبقى غلافُه معلّقاً
--  بلا نسب. المعرّفُ والنوعُ يجعلان الاختيار **قابلاً للقراءة** لا
--  مجرّدَ مسارِ صورة (نفس سبب حفظ `tmdb_id` في `title_art`).
--
--  ولا صورَ تُرفع ولا حصّةَ تخزين: **مسارُ نصٍّ من TMDB لا غير** —
--  والفعلُ يمرّره على `safeImagePath` قبل الكتابة (نمط هجرة ٥٤).
--
--  آمنٌ للإعادة. ولا سياسة جديدة: الأعمدة تسكن `user_lists` فترثُ
--  سياساتِها الأربع كما هي — **والسياساتُ المفتوحة تبقى أربعاً.**
-- ============================================================

begin;

alter table public.user_lists
  add column if not exists cover_tmdb_id    integer,
  add column if not exists cover_media_type text,
  add column if not exists cover_backdrop   text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_lists_cover_type_check') then
    alter table public.user_lists
      add constraint user_lists_cover_type_check
      check (cover_media_type is null or cover_media_type in ('tv', 'movie'));
  end if;
end $$;

-- مسارُ TMDB شكلُه معروف: شرطةٌ ثم اسمُ ملفٍّ بلا مسافات. القيدُ هنا
-- حزامٌ ثانٍ فوق `safeImagePath` في الشيفرة — فلا يدخل رابطٌ خارجيّ
-- لو نُسي التنقيح في مسارٍ مستقبليّ.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_lists_cover_path_check') then
    alter table public.user_lists
      add constraint user_lists_cover_path_check
      check (cover_backdrop is null or cover_backdrop ~ '^/[A-Za-z0-9._-]{4,64}$');
  end if;
end $$;

-- ============================================================
--  my_lists — البطاقةُ تعرف غلافَها
-- ============================================================
-- تُسقط وتُعاد لا `create or replace`: تغيّرُ أعمدة الإرجاع يرفضه
-- Postgres في الاستبدال. و`posters` تبقى كما هي — **الغلافُ يزيد ولا
-- يستبدل**: قائمةٌ بلا غلافٍ تعرض ملصقاتها كما تعرضها اليوم بالضبط
-- (قاعدة D-152: افتراضُ أيِّ تفضيلٍ جديد هو السلوكُ القائم).
drop function if exists public.my_lists();

create function public.my_lists()
returns table (
  id           uuid,
  name         text,
  subtitle     text,
  kind         text,
  is_public    boolean,
  created_at   timestamptz,
  item_count   integer,
  shows_count  integer,
  movies_count integer,
  posters      text[],
  -- غلافُ القائمة: الخلفية للعرض، والمعرّفُ والنوعُ ليعرف المنتقي ما المختار
  cover_backdrop   text,
  cover_tmdb_id    integer,
  cover_media_type text
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.subtitle,
    l.kind,
    l.is_public,
    l.created_at,
    (select count(*)::integer
       from public.user_list_items i
      where i.list_id = l.id),
    (select count(*)::integer
       from public.user_list_items i
      where i.list_id = l.id and i.media_type = 'tv'),
    (select count(*)::integer
       from public.user_list_items i
      where i.list_id = l.id and i.media_type = 'movie'),
    (select array_agg(p order by ord)
       from (select i.poster_path as p,
                    row_number() over (order by i.added_at desc) as ord
               from public.user_list_items i
              where i.list_id = l.id and i.poster_path is not null
              order by i.added_at desc
              limit 12) s),
    l.cover_backdrop,
    l.cover_tmdb_id,
    l.cover_media_type
  from public.user_lists l
  where l.user_id = auth.uid()
  order by l.created_at desc;
$$;

revoke all on function public.my_lists() from public;
grant execute on function public.my_lists() to authenticated;
revoke execute on function public.my_lists() from anon;

-- ============================================================
--  public_list — الغلافُ يسافر مع الرابط
-- ============================================================
-- القائمةُ المشاركة تُفتح لزائرٍ بلا حساب (security2.sql §القوائم
-- المعلنة). **والغلافُ هو وجهُها**، فحجبُه عمّن فُتح له الرابط يعني أن
-- من شارك قائمتَه شارك نصفَها. لا عمودَ جديدٍ يُكشف غيرَه، والدالّة
-- تبقى محصورةً بـ`is_public` كما هي.
drop function if exists public.public_list(uuid);

create function public.public_list(p_id uuid)
returns table (
  id             uuid,
  name           text,
  subtitle       text,
  kind           text,
  created_at     timestamptz,
  owner_id       uuid,
  owner_nickname text,
  owner_username text,
  owner_avatar   text,
  cover_backdrop text,
  items          jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.name,
    l.subtitle,
    l.kind,
    l.created_at,
    l.user_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    l.cover_backdrop,
    coalesce(
      (select jsonb_agg(x order by x.sort_order nulls last, x.added_at desc)
         from (select i.tmdb_id, i.media_type, i.title, i.poster_path,
                      i.added_at, i.sort_order
                 from public.user_list_items i
                where i.list_id = l.id
                order by i.sort_order nulls last, i.added_at desc
                limit 500) x),
      '[]'::jsonb)
  from public.user_lists l
  join public.profiles p on p.id = l.user_id
  where l.id = p_id and l.is_public;
$$;

revoke all on function public.public_list(uuid) from public;
grant execute on function public.public_list(uuid) to anon, authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select column_name from information_schema.columns
--  where table_name = 'user_lists' and column_name like 'cover%';
-- -- المتوقَّع ثلاثة: cover_backdrop · cover_media_type · cover_tmdb_id
--
-- select count(*)::int as cover_cols from information_schema.columns
--  where table_name = 'user_lists' and column_name like 'cover%';   -- 3
--
-- select proname, pronargs from pg_proc
--  where proname in ('my_lists', 'public_list');                    -- صفّان
--
-- ⚠️ والسياساتُ المفتوحة تبقى **أربعاً** — هذه الهجرة لا تضيف خامسة:
-- select tablename, policyname from pg_policies
--   where schemaname = 'public' and qual = 'true';
