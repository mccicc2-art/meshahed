-- ============================================================
--  Loopz — القائمةُ المرتَّبة تخزّن رتبتَها (الهجرة ١١٦)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ============ 🔴 عطلٌ كشفه صفٌّ واحدٌ في مكانه الخطأ ============
--
--  **المقيس**: بعد توليد «برلين — الدبّ الذهبي» فُتحت القائمةُ فإذا
--  أوّلُها **«The Apprenticeship of Duddy Kravitz» (١٩٧٤)** لا فائزُ
--  ٢٠٢٦. والاستعلامُ يقول السبب:
--    select sort_order, title from user_list_items where list_id = '…';
--    → **`sort_order` = NULL في كلِّ الصفوف.**
--
--  **و`upsert_curated_list` (١٠٤) لم تكن تكتب العمود أصلاً**: تُدرج
--  الصفوفَ بلا رتبة، **فيصير ترتيبُ العرض ترتيبَ ما تعيده القاعدة** —
--  وكلُّها أُدرجت في جملةٍ واحدةٍ فـ`added_at` متساوٍ إلى الميلي‑ثانية،
--  **والتعادلُ يُفكُّ بترتيبٍ فيزيائيٍّ لا يَعِد به أحد.**
--
--  🔑 **ولهذا بدت القوائمُ صحيحةً شهراً**: الترتيبُ الفيزيائيُّ **صادف**
--  ترتيبَ الإدراج في أكثرها — **وبافتا خرجت مرتَّبةً تماماً في الدفعة
--  نفسِها التي خرجت فيها برلين مقلوبة.** **وما يعمل بالمصادفة يُقرأ
--  «يعمل» حتى يكذّبه أوّلُ استثناء** (D-181).
--
--  ⚠️ **والعطلُ يمسّ كلَّ قائمةٍ منسّقة لا الجوائزَ وحدَها**: «أفضل ٢٥٠»
--  رتبتُها معناها، **وعوالمُ مارفل ترتيبُها ترتيبُ الأحداث** (D-074)
--  — **وقائمةٌ اسمُها «بترتيب الأحداث» تعرض ترتيباً عشوائيّاً تكذب**
--  (D-219). **فالإصلاحُ في الدالّة يسري على الاثنتين والأربعين.**
--
--  ============ والعلاجُ عمودٌ يُكتب لا فرزٌ عند القراءة ============
--
--  **`with ordinality`**: رتبةُ العنصر في المصفوفة هي رتبتُه في القائمة
--  — **والمستدعي يرسلها مرتَّبةً أصلاً** (`awardWinners` بالسنة تنازليّاً،
--  و`topChartRows` بالتقييم، والعوالمُ بترتيب قاموسها). **فالقاعدةُ
--  تحفظ ما أُرسل، ولا تعيد ترتيبَ ما لا تعرف معناه.**
--
--  ⚠️ **و`sort_order` يبدأ من صفر** — نفسُ عرف `reorder_list` (D-043)،
--  **ولا يُقرأ رقمُه للعرض**: البطاقةُ ترقّم بموضعها لا بقيمته.
--
--  ============ ولا `drop` ولا حذفَ بيانات ============
--
--  **جسمُ الدالّة وحدَه تغيّر** — التوقيعُ والعائدُ كما هما (D-037).
--  **والصفوفُ القائمةُ تبقى بلا رتبةٍ حتى يُعاد توليدُها** — وهو ما
--  يقع بعد الهجرة مباشرةً بنداءٍ لكلِّ سلغ.
-- ============================================================

begin;

create or replace function public.upsert_curated_list(
  p_slug  text,
  p_name  text,
  p_kind  text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  the_list uuid;
begin
  if not public.am_admin() then
    raise exception 'forbidden';
  end if;

  select id into owner_id from public.profiles where coalesce(is_system, false) limit 1;
  if owner_id is null then
    raise exception 'no system account';
  end if;

  select id into the_list from public.user_lists
  where user_id = owner_id and source_slug = p_slug;

  if the_list is null then
    insert into public.user_lists (user_id, name, kind, is_public, source_slug)
    values (owner_id, p_name, p_kind, true, p_slug)
    returning id into the_list;
  else
    update public.user_lists
    set name = p_name, kind = p_kind, is_public = true, updated_at = now()
    where id = the_list;
    delete from public.user_list_items where list_id = the_list;
  end if;

  -- 🆕 **الرتبةُ تُكتب** (D-390): موضعُ العنصر في المصفوفة هو رتبتُه
  insert into public.user_list_items
    (list_id, tmdb_id, media_type, title, poster_path, sort_order)
  select the_list,
         (t.e ->> 'tmdbId')::int,
         t.e ->> 'mediaType',
         t.e ->> 'title',
         t.e ->> 'posterPath',
         (t.n - 1)::int
  from jsonb_array_elements(p_items) with ordinality as t(e, n)
  on conflict do nothing;

  return the_list;
end;
$$;

revoke all on function public.upsert_curated_list(text, text, text, jsonb) from public;
grant execute on function public.upsert_curated_list(text, text, text, jsonb) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--      where n.nspname='public' and p.proname='upsert_curated_list'
--        and pg_get_functiondef(p.oid) like '%with ordinality%')        as writes_rank,
--   (select count(*)::int from pg_policies where qual = 'true')         as open_policies;
-- المتوقّع: writes_rank = 1 · open_policies = 4
--
-- ثم يُعاد توليدُ القوائم كلِّها، ويُقاس أثرُه:
--   select count(*) filter (where sort_order is null) as unranked
--   from public.user_list_items i
--   join public.user_lists l on l.id = i.list_id
--   where l.source_slug is not null;
-- المتوقَّع بعد التوليد: unranked = 0
