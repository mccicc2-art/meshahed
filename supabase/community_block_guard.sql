-- ============================================================
--  Loopz — المحظورُ لا يظهر في خطّ المجتمع (الهجرة ١٠٩ · D-351)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  **سدادُ دَينٍ أُعلن يومَ وُلد** (الهجرة ١٠٦): يومَ مُدَّ خطُّ المجتمع
--  بفرع القوائم **حُرِس الفرعُ الجديد بـ`is_blocked` وبقي الفرعُ القديم
--  بلا حارس** — كما وُلد في الهجرة ٢٧. **وكُتب ديناً معلَناً ولم يُصلَح
--  صامتاً في هجرةٍ عن شيءٍ آخر** (D-155)، **وهذه هجرتُه بذاته.**
--
--  ============ ما كان يحدث فعلاً ============
--
--  **من حظرتَه كان كلامُه يصلك في تبويب «المجتمع»** — بينما `/people`
--  ودوالُّ الإشعارات والمراجعات كلُّها تحرسه منذ D-145. **وحارسٌ يُطبَّق في
--  خمسة أبوابٍ ويُنسى في السادس ليس حارساً** (D-145 بنصّها: وصفةٌ تُنسخ ثم
--  يُصلَح أصلُها وحدَه يعود عطلُها من بابٍ آخر).
--
--  ⚠️ **والحظرُ في لوبز ذو اتّجاهين** (`is_blocked(a, b)` تفحص الطرفين
--  — D-145): من حظرتَه لا تراه، **ومن حظرك لا تراه** — فلا يُقرأ الغيابُ
--  إشارةً إلى أحد.
--
--  ⚠️ **ولا تغيير في التوقيع**: الأعمدةُ الخمسةَ عشرة نفسُها (١٠٦)،
--  **فـ`create or replace` تكفي ولا `drop`** (D-037) — الجسمُ وحدَه تغيّر
--  بسطرٍ واحد في الفرع الأوّل.
-- ============================================================

begin;

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
  list_slug   text
)
language sql
stable
security definer
set search_path = public
as $$
  with feed as (
    -- كلامُ الناس على الأعمال — **وحارسُ الحظر أخيراً** (D-351)
    select
      r.user_id as id,
      r.tmdb_id, r.media_type, r.rating, r.review, r.title, r.poster_path,
      r.updated_at,
      null::uuid as list_id,
      null::text as list_name,
      null::text as list_slug
    from public.ratings r
    where auth.uid() is not null
      and r.user_id <> auth.uid()
      and length(btrim(coalesce(r.review, ''))) > 0
      and coalesce(r.hidden, false) = false
      and not public.is_blocked(auth.uid(), r.user_id)

    union all

    -- كلامُ الناس على القوائم (الهجرة ١٠٦)
    select
      lr.user_id,
      0, 'movie', lr.rating, lr.body, ul.name, null::text,
      lr.updated_at,
      ul.id, ul.name, ul.source_slug
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
    x.updated_at, x.list_id, x.list_name, x.list_slug
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
--   (select count(*)::int from pg_proc where proname = 'community_activity')  as fn,
--   (select count(*)::int from pg_proc p
--      where p.proname = 'community_activity'
--        and pg_get_functiondef(p.oid) like '%is_blocked(auth.uid(), r.user_id)%') as guarded,
--   (select count(*)::int from pg_policies where qual = 'true')               as open_policies;
-- المتوقّع: fn = 1 · guarded = 1 · open_policies = 4
