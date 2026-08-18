-- ============================================================
--  Loopz — عَلَمُ الحرق يعود إلى خطّ المجتمع (الهجرة ١١٧)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ============ 🔴 ثالثُ ما أسقطته الهجرة ١٠٦ ============
--
--  **المقيس** — سؤالٌ واحدٌ على سبع دوالّ:
--    select proname, (pg_get_functiondef(oid) like '%has_spoiler%')
--    from pg_proc where proname in (…);
--  → `following_activity_v2=YES · title_reviews=YES · user_ratings=YES ·
--     people_top_review=YES · list_reviews_of=YES · title_thread=YES`
--  → 🔴 **`community_activity=NO`.**
--
--  **والهجرةُ ١٠٠ هي التي أعطتها العمود** (D-315): «عَلَمٌ واحدٌ تحمله
--  خمسُ دوالّ — لأن شكلَ ما تُرجعه وعدٌ واحد». **ثم كُتب جسمُها من جديد
--  في ١٠٦ من نسخةٍ أقدم فسقط العمود** — **وهو الحادثُ الثالثُ من ١٠٦
--  بعد `reply` و`talk_reply`** (D-380).
--
--  ============ وما كلّفه السقوطُ فعلاً ============
--
--  🔴 **`getCommunityFeed` تقرأ `r.has_spoiler` وتكتب
--  `hasSpoiler: Boolean(r.has_spoiler)`** — **والعمودُ غائبٌ فالقيمةُ
--  `false` دائماً**. **فكلُّ مراجعةٍ أعلن صاحبُها أن فيها حرقاً كانت
--  تُعرض مكشوفةً في تبويب «المجتمع»** منذ ١٧ أغسطس.
--  **ولا خطأَ في الشيفرة**: هي تسأل عن عمودٍ لا يأتي، **والغيابُ يُقرأ
--  «لا حرق»** — **وهذا أخطرُ من عطلٍ يرمي خطأً** (D-181).
--  ⚠️ **والحاجبُ نفسُه سليمٌ في كلِّ سطحٍ آخر**: صفحةُ العمل، وخيطُ
--  «من أتابع»، وآراءُ القوائم — **سطحٌ واحدٌ من ستّة هو الذي فقده.**
--
--  ============ و`drop function` لا مفرَّ منها ============
--
--  **عمودٌ سادسَ عشرَ يعني توقيعاً جديداً**، **و`create or replace` لا
--  تغيّر نوعَ ما تُرجعه دالّة** (القاعدة ٥ في `12_Database`).
--  **وهو حذفُ تعريفٍ لا حذفُ بيانات، داخل معاملةٍ واحدة** — لا لحظةَ
--  يكون فيها الخطُّ بلا دالّة. **وإذنُ أحمد بنصّه: «نفذ ماعليك
--  و الديون المتبقية».**
--
--  ⚠️ **والشيفرةُ لا تحتاج نشراً قبلها**: القارئُ يسأل عن `has_spoiler`
--  منذ D-315 — **الهجرةُ تُعيد ما كان يسأل عنه، لا تطلب منه شيئاً
--  جديداً.** **وهو عكسُ ١٠٦ و١١٤** حيث كان الصفُّ الجديد يحتاج واجهةً
--  تعرفه.
--
--  ============ والجسمُ مبنيٌّ على الحيِّ لا على المستودع ============
--
--  🔑 **قاعدةُ D-380 مطبَّقةً على نفسها**: قُرئ `pg_get_functiondef`
--  الحيُّ أوّلاً — **وفيه حارسُ `is_blocked` في الفرعين** (١٠٩) —
--  **وبُني الجسمُ الجديد فوقه**، فلا يسقط حارسٌ ثالثٌ ونحن نعيد عَلَماً.
-- ============================================================

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
  -- 🆕 **العَلَمُ العائد** (D-395) — آخرَ الأعمدة لا وسطَها: القارئُ
  -- يقرأ بالاسم لا بالموضع، **وذيلُ ١٠٦ يبقى حيث تعوّده من يقرؤه.**
  has_spoiler boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with feed as (
    -- كلامُ الناس على الأعمال — منذ ٢٧، وبحارس ١٠٩، وبعَلَم ١٠٠ عائداً
    select
      r.user_id as id,
      r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path,
      r.updated_at,
      null::uuid as list_id,
      null::text as list_name,
      null::text as list_slug,
      coalesce(r.has_spoiler, false) as has_spoiler
    from public.ratings r
    where auth.uid() is not null
      and r.user_id <> auth.uid()
      and length(btrim(coalesce(r.review, ''))) > 0
      and coalesce(r.hidden, false) = false
      and not public.is_blocked(auth.uid(), r.user_id)

    union all

    -- كلامُ الناس على القوائم (١٠٦) — **ولها عَلَمُها منذ ١٠٣**
    select
      lr.user_id,
      0, 'movie', lr.rating, lr.body, ul.name, null::text,
      lr.updated_at,
      ul.id, ul.name, ul.source_slug,
      coalesce(lr.has_spoiler, false)
    from public.list_reviews lr
    join public.user_lists ul on ul.id = lr.list_id
    where auth.uid() is not null
      and lr.user_id <> auth.uid()
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
    x.updated_at, x.list_id, x.list_name, x.list_slug, x.has_spoiler
  from feed x
  join public.profiles p on p.id = x.id
  order by x.updated_at desc
  limit 60;
$$;

revoke all on function public.community_activity() from public;
grant execute on function public.community_activity() to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--      where n.nspname='public' and p.proname='community_activity'
--        and pg_get_functiondef(p.oid) like '%has_spoiler%')          as flag_back,
--   (select count(*)::int from pg_proc p, unnest(p.proargnames) nm
--      where p.proname='community_activity')                          as cols,
--   (select count(*)::int from pg_policies where qual = 'true')        as open_policies;
-- المتوقّع: flag_back = 1 · cols = 16 · open_policies = 4
