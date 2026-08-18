-- ═══════════════════════════════════════════════════════════════════════
--  الهجرة ١١٩ — **كلامُك يعود إلى خطّك، وللقائمة وجهٌ** (D-424/D-425)
-- ═══════════════════════════════════════════════════════════════════════
--
--  بلاغُ أحمد على لقطةٍ من «النشاط»: «Mesh علّقت على لسته المفروض صورة
--  اللستة تطلع هنا، **و كذلك خلّي الشخص يشوف نشراته في اكتيفتي**».
--
--  ================= ١) الاستثناءُ عاد من حيث حُذف =================
--
--  🔴 **وهذه ليست ميزةً جديدة، هذه هجرةُ ٧٦ تُعاد**: D-251 حذف بنصّه
--  السطرَ `r.user_id <> auth.uid()` من `community_activity`، وحجّتُه
--  مكتوبةٌ هناك: **«لا خطَّ اجتماعيٌّ في الدنيا يُخفي عن الكاتب ما كتب —
--  من كتب رأياً ولم يره في مكانه ظنّ أنه لم يُنشر»**.
--
--  ⚠️ **ثمّ أعادته الهجرةُ ١٠٦ وهي لا تقصده**: كانت تضيف خيطَ القوائم
--  فأعادت كتابة الدالّة كلَّها، **ونُسخ الشرطُ القديم مع ما نُسخ** —
--  **وإعادةُ كتابة دالّةٍ كاملةٍ لإضافة عمودٍ تُعيد معها كلَّ ما أُصلح
--  فيها قبلَ ذلك**، وهذا هو الدرسُ لا العطل. **فمن يعيد كتابة دالّةٍ
--  يقرأ تاريخَها أوّلاً.**
--
--  **والشرطُ يسقط من الخيطين معاً**: رأيُك على عملٍ ورأيُك على قائمة —
--  **فالسببُ واحدٌ ولا نصفَ إصلاح** (D-214).
--
--  ⚠️ **ولا يُفتح شيءٌ جديد** (نصُّ ٧٦ حرفاً): الصفُّ صفُّك، تقرؤه في
--  ملفّك وفي غرفة العمل أصلاً — **استثناءٌ يُزال لا قراءةٌ تُمنَح.**
--  **و`hide_name` يبقى حارساً**: من أخفى اسمَه يرى صفَّه مخفيّاً كما
--  يراه غيرُه (D-241).
--
--  ================= ٢) وللقائمة وجهٌ لا فراغ =================
--
--  **صفُّ القائمة اليوم بلا عمودِ صورةٍ عمداً** — وحجّتُه في `ActivityFeed`
--  كانت: **«لا ملصقَ لها أصلاً، وإطارٌ فارغٌ بعرض ٨٤px يُقرأ صورةً لم
--  تُحمَّل»** (D-181). **والحجّةُ ماتت يوم صار للقائمة غلافٌ مختار**
--  (`cover_backdrop`، الهجرة ٩٣/D-208) — **فالفراغُ الآن ليس صدقاً، هو
--  بيانٌ عندنا لا نعرضه.**
--
--  ⚠️ **وعمودٌ باسمه لا `poster_path` يُحمَّل معنًى ثانياً**: الغلافُ
--  **عريضٌ ١٦:٩** والملصقُ **٢:٣**، **وحقلٌ قائمٌ لا يُعاد استعماله
--  لمعنًى ثانٍ** (D-224/D-312) — **ومقاسان في حقلٍ واحدٍ يقصّ أحدهما.**
--
--  ⚠️ **و`drop function` لتغيّر العائد** (D-037): حذفُ تعريفٍ لا حذفُ
--  بيانات، في معاملةٍ واحدة، **وأذن أحمد: «ممتاز نفّذ الكل»** بعد أذونٍ
--  سابقةٍ بالنمط نفسِه (١٠٦/١١٠/١١١/١١٨).
--  **والقارئُ المنشورُ يتسامح مع ذيلٍ لا يعرفه** (D-179)، **والقاعدةُ
--  تسبق الشيفرة فلا نافذةَ ينكسر فيها شيء** (D-028).
-- ═══════════════════════════════════════════════════════════════════════

-- ⚠️ ⚠️ **والجسمُ يُبنى على التعريف الحيِّ لا على هجرةٍ قديمة** — وهذه
-- **غلطةٌ وقعتُ فيها في أوّل كتابةٍ لهذه الهجرة**: نسختُ جسمَ ١٠٦
-- **فأسقطتُ `has_spoiler` (D-395/الهجرة ١١٧) وحارسَ الحظر عن فرع
-- التقييمات** — **وهي بحرفها سيرةُ ١٠٦ نفسِها التي تشكو منها هذه
-- الهجرةُ أعلاه.** **فالقاعدةُ تُطبَّق على نفسِها** (D-380): من يعيد
-- كتابة دالّةٍ يبدأ من `pg_get_functiondef` الحيّ، **لا من آخر ملفٍّ
-- يتذكّره.**

begin;

drop function if exists public.community_activity();

create or replace function public.community_activity()
returns table (
  id          uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  tmdb_id     integer,
  media_type  text,
  rating      smallint,
  review      text,
  title       text,
  poster_path text,
  updated_at  timestamptz,
  list_id     uuid,
  list_name   text,
  list_slug   text,
  -- عَلَمُ الحرق العائد (D-395، الهجرة ١١٧) — **يبقى في موضعه**
  has_spoiler boolean,
  -- 🆕 غلافُ القائمة (D-425) — آخرَ الأعمدة، **وذيلُ ١١٧ لا يتزحزح**
  list_cover  text
)
language sql
stable
security definer
set search_path = public
as $$
  with feed as (
    -- كلامُ الناس على الأعمال — **وكلامُك أنت معهم** (D-251، الهجرة ٧٦)
    select
      r.user_id as id,
      r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path,
      r.updated_at,
      null::uuid as list_id,
      null::text as list_name,
      null::text as list_slug,
      coalesce(r.has_spoiler, false) as has_spoiler,
      null::text as list_cover
    from public.ratings r
    where auth.uid() is not null
      and length(btrim(coalesce(r.review, ''))) > 0
      and coalesce(r.hidden, false) = false
      and not public.is_blocked(auth.uid(), r.user_id)

    union all

    -- كلامُ الناس على القوائم (الهجرة ١٠٣) — **وكلامُك أنت معهم**
    select
      lr.user_id,
      0, 'movie', lr.rating, lr.body, ul.name, null::text,
      lr.updated_at,
      ul.id, ul.name, ul.source_slug,
      coalesce(lr.has_spoiler, false),
      ul.cover_backdrop
    from public.list_reviews lr
    join public.user_lists ul on ul.id = lr.list_id
    where auth.uid() is not null
      and length(btrim(coalesce(lr.body, ''))) > 0
      and coalesce(lr.hidden, false) = false
      and ul.is_public
      and not public.is_blocked(auth.uid(), lr.user_id)
  )
  select
    x.id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    x.tmdb_id, x.media_type, x.rating, x.review, x.title, x.poster_path,
    x.updated_at, x.list_id, x.list_name, x.list_slug, x.has_spoiler, x.list_cover
  from feed x
  join public.profiles p on p.id = x.id
  order by x.updated_at desc
  limit 60;
$$;

revoke all on function public.community_activity() from public;
grant execute on function public.community_activity() to authenticated;

commit;

-- ═══════════════════════ التحقّق (يُشغَّل بعدها) ═══════════════════════
-- select
--   (pg_get_function_result(p.oid) like '%list_cover text%')   as cover_col,
--   (pg_get_function_result(p.oid) like '%has_spoiler%')       as flag_kept,
--   (pg_get_functiondef(p.oid) like '%<> auth.uid()%')         as excludes_self,
--   (select count(*)::int from pg_policies where qual='true')  as open_policies
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname='public' and p.proname='community_activity';
-- المتوقَّع: cover_col=t | flag_kept=t | excludes_self=f | open_policies=4
