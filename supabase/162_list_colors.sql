-- ============================================================================
-- 162_list_colors.sql — لونُ غلاف القائمة (D-824)
-- ============================================================================
--
-- **البندُ الخامسُ من خطّة الـ٢٤**: «أغلفةُ القوائم وألوانُها» —
-- **والغلافُ قائمٌ منذ D-208، والجديدُ اللون.**
--
-- 🔑 **والعمودُ يخزّن رمزاً لا لوناً**: **الجدولُ يحفظ `amber`،
-- **والقيمةُ الستّ عشريّةُ في `lib/listColors.ts`** — **فالقائمةُ
-- تُوسَّع بلا هجرةٍ ثانية**، **وتتبع الثيمَ يومَ نريدها أن تتبعه**
-- (D-145: قاعدةٌ واحدةٌ في موضعٍ واحد). **ولونٌ حرٌّ من المستخدم يعني
-- نصّاً أبيضَ على أصفرَ فاتحٍ لا يُقرأ** — **والقائمةُ المغلقة تمنع
-- ذلك في مصدره** (D-636).
--
-- ⚖️ **واللونُ والصورةُ لا يجتمعان**: **غلافٌ واحدٌ لا اثنان** —
-- **والفعلُ `setListCover` يمحو أحدَهما حين يُكتب الآخر** (D-462).
--
-- ⚠️ **ولا صفَّ قائمٌ يُمسّ**: `add column` بلا قيمةٍ افتراضيّة —
-- **والغائبُ يعني «كما كانت» تماماً** (ملصقاتُها أو غلافُها).
--
-- 🔴 **والدالّتان تُعاد كتابتُهما من تعريفهما الحيِّ لا من ملفّ المستودع**
--    (`pg_get_functiondef`): **ملفُّ المستودع قد يكون بائتاً**، **والحيُّ
--    هو ما يُنفَّذ.** **والزيادةُ عمودٌ واحدٌ في آخر الصفّ وآخر التعريف**
--    — **فلا يتبدّل موضعُ عمودٍ قائمٍ عند قارئٍ يقرأ بالترتيب.**
-- ⚠️ **و`create or replace` لا تكفي حين يتبدّل نوعُ العائد** — **فتُسقط
--    الدالّةُ وتُبنى**، **وهجرةٌ في معاملةٍ واحدة لا تترك نافذةً.**
--
-- 🔴🔴 **وإسقاطُ دالّةٍ يُسقط أذونَها معها، والافتراضُ بعدها `PUBLIC`** —
--    **وهو أوسعُ ممّا كان**: `my_lists` اليومَ لـ`authenticated` و
--    `service_role` **بلا `anon`**، **ودالّةٌ جديدةٌ بلا سطرٍ تصير
--    منفَّذةً للجميع.** **فالأذونُ تُقرأ قبل الإسقاط وتُعاد بعده حرفاً**
--    — **وتوسيعُ إذنٍ صامتاً أخطرُ من عطلٍ يُرى** (D-011: الحارسُ في
--    القاعدة لا في السطر الذي يستدعيها).

-- ============================================================
--  ١) العمودُ ورمزُه
-- ============================================================
alter table public.user_lists add column if not exists cover_color text;

-- **ورمزٌ لا يُعرف يُرفض عند الكتابة لا يُصحَّح عند القراءة** — والشكلُ
-- وحدَه هنا، **والقائمةُ المعتمدةُ في الشيفرة**: قيدٌ يعدّد الثمانيةَ
-- يعني هجرةً كلَّما أُضيف لون.
alter table public.user_lists drop constraint if exists user_lists_cover_color_check;
alter table public.user_lists
  add constraint user_lists_cover_color_check
  check (cover_color is null or cover_color ~ '^[a-z]{3,12}$');

grant update (cover_color) on public.user_lists to authenticated;

comment on column public.user_lists.cover_color is
  'رمزُ لونِ الغلاف — القيمُ في lib/listColors.ts. null = لا لون. ولا يجتمع مع cover_backdrop.';

-- ============================================================
--  ٢) قوائمي — نفسُ التعريف الحيِّ وعمودٌ في آخره
-- ============================================================
drop function if exists public.my_lists();
create function public.my_lists()
returns table (
  id uuid, name text, subtitle text, kind text, is_public boolean,
  created_at timestamptz, item_count integer, shows_count integer,
  movies_count integer, posters text[], cover_backdrop text,
  cover_tmdb_id integer, cover_media_type text, cover_color text
)
language sql
stable
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
    l.cover_media_type,
    l.cover_color
  from public.user_lists l
  where l.user_id = auth.uid()
  order by l.created_at desc;
$$;

-- **الأذونُ كما كانت بالضبط، لا أوسع** (`proacl` قبل الإسقاط:
-- postgres · authenticated · service_role — **ولا `anon`**)
revoke all on function public.my_lists() from public;
grant execute on function public.my_lists() to postgres, authenticated, service_role;
-- 🔴 **وسطرٌ زائدٌ ليس زخرفاً**: **`revoke ... from public` لا تكفي** —
--    **Supabase تمنح `anon` و`authenticated` تنفيذَ كلِّ دالّةٍ جديدةٍ
--    بـ`alter default privileges`**، **فتُكتب المنحةُ باسم `anon`
--    صراحةً لا عبر `PUBLIC`.** **قِيس بعد التنفيذ فوُجد `anon=X`
--    زائداً، فسُحب.** **ولا ضررَ وقع** (الدالّةُ ليست `security definer`
--    وتصفّي بـ`auth.uid()` وفوقها RLS) — **لكنّ إذناً وُسّع بلا قصدٍ
--    يُعاد ولو لم يُثمر عطلاً.**
-- 🔑 **والقاعدةُ**: **بعد كلِّ `drop function` يُقرأ `proacl` ويُقارن بما
--    كان** — **ولا يُفترض أنّ سطرَ `grant` أعاد الحال.**
revoke execute on function public.my_lists() from anon;

-- ============================================================
--  ٣) القائمةُ المعلنة — واللونُ يسافر مع الرابط كما يسافر الغلاف
-- ============================================================
drop function if exists public.public_list(uuid);
create function public.public_list(p_id uuid)
returns table (
  id uuid, name text, subtitle text, kind text,
  created_at timestamptz, owner_id uuid, owner_nickname text,
  owner_username text, owner_avatar text, cover_backdrop text,
  cover_color text, items jsonb
)
language sql
stable
security definer
set search_path to 'public'
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
    l.cover_color,
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

-- **وهذه للزائر أيضاً** (`anon`) — **لأنّ «المعلنة» تعني معلنةً لمن لا
-- حسابَ له** (D-053/D-627)، **وهو نصُّ `proacl` قبل الإسقاط.**
revoke all on function public.public_list(uuid) from public;
grant execute on function public.public_list(uuid) to postgres, anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- ═══ فحصٌ صحّيّ ═══
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='user_lists' and column_name='cover_color';
-- select proname, provolatile, prosecdef from pg_proc p
--   join pg_namespace n on n.oid=p.pronamespace
--  where n.nspname='public' and proname in ('my_lists','public_list');
--  -- المتوقَّع: my_lists s/f · public_list s/t (كما كانتا)
-- select count(*) from public.user_lists;              -- المتوقَّع ٧٧ بلا تغيّر
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';         -- المتوقَّع خمسٌ بلا زيادة
-- 🔴 select proname, proacl::text from pg_proc p
--      join pg_namespace n on n.oid=p.pronamespace
--     where n.nspname='public' and proname in ('my_lists','public_list');
--  -- المتوقَّع: my_lists بلا anon · public_list بها — **وبلا `=X/` عارٍ للجميع**
