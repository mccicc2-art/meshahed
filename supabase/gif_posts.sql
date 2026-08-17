-- ═══════════════════════════════════════════════════════════════════════
--  الهجرة ١١١ — **معرّفٌ لا رابط: الـGIF يسكن عموداً باسمه** (D-362)
-- ═══════════════════════════════════════════════════════════════════════
--
-- طلبُ أحمد: «ابغا أضيف خيار جنب الصور GIF، خيار سريع وبديل عن الصور».
--
-- ================= لماذا عمودٌ لا حقيبة =================
--
-- **الحمولةُ التي تصير معنًى دائماً تسكن عموداً باسمها** — وهذا نصُّ
-- D-312 حرفاً يومَ خرجت الصورةُ من `data->>'img'` إلى `image_path`.
-- **وإعادةُ الـGIF إلى الحقيبة اليوم تكرارٌ لغلطٍ صحّحناه بالأمس**،
-- **وحقلٌ قائمٌ لا يُعاد استعماله لمعنًى ثانٍ** (D-224/D-271).
--
-- ================= ولماذا معرّفٌ لا رابط =================
--
-- 🔴 **رابطٌ يصل من عميلٍ ونحن نرسمه `<img>` للناس يُحرَس بالمصدر**
-- (D-298/D-302) — وحارسُ الصورة اليوم يشترط بادئةَ مخزننا نحن.
-- **والـGIF لا يسكن مخزننا** (وهو نصُّ طلبه: «خيار سريع»، فلا رفعَ ولا
-- تخزين). **فلا يُخزَّن رابطٌ إطلاقاً، يُخزَّن معرّفُ Giphy وحدَه**،
-- **والرابطُ يُركَّب في الواجهة من قالبٍ ثابت** — **فما يصل من العميل
-- سلسلةُ حروفٍ وأرقام لا عنوانٌ يذهب إلى أيّ مكان.**
-- **والحارسُ في القاعدة لا في الواجهة وحدَها** (D-193): `check` يرفض
-- كلَّ ما ليس `[A-Za-z0-9]` بطولٍ محدود.
--
-- ⚠️ **والقيدُ يُوسَّع لا يُضيَّق**: مشاركةُ إنسانٍ تصحّ بمتنٍ **أو**
-- صورةٍ (عموداً أو حقيبةً — الهجرة ٩٧) **أو GIF**. **والنشراتُ لم تُمَسّ.**
--
-- ⚠️ **و`drop function` لتغيّر العائد** (D-037): عمودٌ جديدٌ في ذيل
-- `title_thread` — **وهو حذفُ تعريفٍ لا حذفُ بيانات، في معاملةٍ واحدة**،
-- **وأذن أحمد: «اكمل كل المتبقي»** بعد إذنين سابقين بالنمط نفسِه (١٠٦/١١٠).
-- **والقرّاءُ المنشورون يتسامحون مع ذيلٍ لا يعرفونه** (D-179)، **والقاعدة
-- تسبق الشيفرة فلا نافذةَ ينكسر فيها شيء** (D-028).
-- ═══════════════════════════════════════════════════════════════════════

begin;

alter table public.title_posts add column if not exists gif_id text;

alter table public.title_posts drop constraint if exists title_posts_gif_id_shape;
alter table public.title_posts add constraint title_posts_gif_id_shape check (
  gif_id is null or gif_id ~ '^[A-Za-z0-9]{1,64}$'
);

alter table public.title_posts drop constraint if exists title_posts_body_or_kind;
alter table public.title_posts add constraint title_posts_body_or_kind check (
  (kind is null and (
    (body is not null and length(btrim(body)) between 1 and 2000)
    or (
      (image_path is not null or (data ->> 'img') is not null or gif_id is not null)
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
  image_path  text,
  gif_id      text
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
    coalesce(r.image_path, r.data ->> 'img'),
    r.gif_id
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

commit;

-- ═══════════════════════ التحقّق (يُشغَّل بعدها) ═══════════════════════
-- select
--   (select count(*)::int from information_schema.columns
--     where table_schema='public' and table_name='title_posts'
--       and column_name='gif_id')                                    as col,
--   (select count(*)::int from pg_constraint
--     where conname='title_posts_gif_id_shape')                      as shape,
--   (select count(*)::int from information_schema.columns
--     where table_schema='public' and table_name='title_thread'
--       and column_name='gif_id')                                    as fn_col,
--   (select count(*)::int from pg_policies where qual='true')        as open_policies;
-- المتوقَّع: col=1 | shape=1 | fn_col=1 | open_policies=4
