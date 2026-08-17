-- ============================================================
--  Loopz — «قوائمُ تناسبك» (الهجرة ١٠٢ · D-324)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  طلبُ أحمد: «هل بالإمكان تحسين اللستات بحيث يكون فيها for you
--  والأكثر شعبية؟»
--
--  **و«الأكثر شعبية» لم تكن تحتاج سطراً واحداً من SQL**: `top_saved_lists`
--  مبنيّةٌ منذ D-289 وتعمل في لوحة الأعضاء، **وإنما لم تكن تُقرأ في تبويب
--  القوائم**. فهذه الهجرةُ للشقّ الثاني وحدَه.
--
--  ============ لماذا التقاطعُ في القاعدة لا في العميل ============
--
--  الترتيبُ يحتاج أن يعرف: **كم عملاً في هذه القائمة موجودٌ في مكتبتي؟**
--  وحسابُه في العميل يعني جلبَ عناصر كلِّ قائمةٍ عامّة ثم مقارنتها بمكتبةٍ
--  كاملة — **١١٠٣ صفوفٍ اليوم، وتكبر بلا سقف**. **والمرشَّحون يُقصّون في
--  القاعدة قبل أن يُنادى لهم** (D-164): `join` واحدٌ يعطي العددَ والترتيب
--  والملصقات في نداءٍ واحد.
--
--  ============ ولا جدولَ ولا سياسة ============
--
--  **دالّةُ `security definer` وحدَها** — لا جدولَ جديد ولا سياسةَ خامسة،
--  **فالأربعُ المفتوحة تبقى أربعاً** (D-013). وهي تقرأ `follows` صاحبِها
--  وحدَه (`auth.uid()`) و`user_list_items` للقوائم **العامّة وحدها**،
--  **فلا تُخرج صفّاً لا يستطيع صاحبُ الطلب رؤيتَه أصلاً.**
--
--  ============ وحرّاسُها منسوخةٌ حرفاً من أختها ============
--
--  `hide_name` والحظر والملصقاتُ الثلاثة — **نسخةٌ بالحرف من
--  `top_saved_lists`** (D-145: وصفةٌ تُنسخ ثم يُصلَح أصلُها وحدَه يعود
--  عطلُها من بابٍ آخر — **فإن تغيّر حارسٌ هناك يتغيّر هنا في الدفعة
--  نفسها**). **وحسابُ لوبز داخلٌ** كما صار في `saved_lists_include_loopz`
--  (D-290) — قوائمُه محتوى المنتَج لا ضجيجاً.
--
--  ⚠️ **وقائمتي أنا خارجةٌ**: `l.user_id <> auth.uid()` — **اقتراحُ ما
--  أملكه ليس اكتشافاً**، وهي في «قوائمي» على بُعد ضغطة.
--
--  ⚠️ **وعتبةُ التطابق عملان لا واحد**: عملٌ واحدٌ مشترَكٌ صدفةٌ لا ذوق،
--  **وصفٌّ يقول «تناسبك» بحجّةٍ واحدة يكذب** (D-063).
-- ============================================================

begin;

create or replace function public.for_you_lists(
  p_limit integer default 12
)
returns table (
  list_id    uuid,
  name       text,
  owner_id   uuid,
  nickname   text,
  username   text,
  avatar_url text,
  hide_name  boolean,
  saves      integer,
  posters    text[]
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select f.tmdb_id, f.media_type
    from public.follows f
    where auth.uid() is not null and f.user_id = auth.uid()
  ),
  scored as (
    select i.list_id, count(*)::int as matched
    from public.user_list_items i
    join mine m on m.tmdb_id = i.tmdb_id and m.media_type = i.media_type
    group by i.list_id
    having count(*) >= 2
  )
  select
    l.id,
    l.name,
    l.user_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    -- **العائدُ يحمل «كم منها عندك» في خانة العدد** — نفسُ شكل أختها
    -- فيقرؤه المكوّنُ نفسُه بلا فرعٍ ثانٍ (D-002)، **والعنوانُ فوقه هو
    -- ما يقول معناه** (D-219: الرقمُ يخصّ الصفَّ الذي تحته).
    s.matched,
    coalesce(
      (
        select array_agg(i.poster_path order by i.rowid)
        from (
          select i2.poster_path, row_number() over () as rowid
          from public.user_list_items i2
          where i2.list_id = l.id and i2.poster_path is not null
          limit 3
        ) i
      ),
      '{}'::text[]
    )
  from scored s
  join public.user_lists l on l.id = s.list_id
  join public.profiles  p on p.id = l.user_id
  where l.is_public
    and l.user_id <> auth.uid()
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = l.user_id)
         or (b.blocker_id = l.user_id and b.blocked_id = auth.uid())
    )
  order by s.matched desc, l.updated_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$$;

revoke all on function public.for_you_lists(integer) from public;
grant execute on function public.for_you_lists(integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname = 'for_you_lists')        as fn,
--   (select count(*)::int from pg_policies where qual = 'true')                as open_policies;
-- المتوقّع: fn = 1 · open_policies = 4
