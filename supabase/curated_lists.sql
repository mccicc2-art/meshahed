-- ============================================================
--  Loopz — المجموعاتُ المنسّقة تصير قوائمَ حقيقية (الهجرة ١٠٤ · D-328)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  طلبُ أحمد: «احتاج أي ليست أقدر أقسمها وأقدر أكتب عليها تعليق… تعمل
--  صفحة خاصة أو ما أضغط عليه مثل الأفلام، أهم شي تكون احترافية ومرتّبة».
--
--  ============ التشخيص: النقصُ ليس في المشاركة ============
--
--  **قوائمُ الناس تُشارَك وتُعلَّق عليها منذ اليوم** (D-327) — **والناقصُ
--  أن «مارفل» و«TOP 250» و«الجوائز» ليست قوائمَ أصلاً**: تُولَّد عند
--  الضغط وتُعرض في ورقة معاينة، **بلا صفٍّ في القاعدة ولا عنوانٍ في
--  المتصفّح** — فلا شيءَ يُشارَك ولا صفَّ يُعلَّق عليه.
--
--  ============ والعلاجُ ليس سطحاً رابعاً ============
--
--  **بل أن تصير قوائمَ كسائر القوائم، بحساب لوبز** — وهو **بالضبط ما
--  فعلته D-317** في قائمة Doomsday. فتأخذ **مجّاناً**: الصفحةَ والرابطَ
--  والمشاركةَ والقلبَ **والتقييمَ والتعليقات** وظهورَها في «الأكثر
--  حفظاً» — **بلا جدولٍ جديد ولا مسارِ عرضٍ ثانٍ** (D-068: بطاقةٌ واحدة
--  تعني منطقاً واحداً).
--
--  **والبديلُ المرفوض `/sets/[slug]`**: يعني جدولَ تعليقاتٍ ثانياً
--  بمفتاح `slug` — **ونسخةٌ ثانية من الحرّاس هي كيف يُصلَح حارسٌ في
--  مكانٍ ويُنسى في الآخر** (D-145، ودرسُ خيط الملصق قبل ساعات).
--
--  ============ `source_slug` — دَينٌ مُعلَنٌ يُسدَّد ============
--
--  العمودُ مكتوبٌ في `05_Todo` منذ أسابيع. **وهو مفتاحُ الهويّة**: به
--  تُعرف «قائمةُ مارفل» فتُحدَّث ولا تتكرّر، **وبه يُرسم اسمُها بلغة
--  القارئ من `universes.ts`** بدل اسمٍ مجمَّدٍ بلغة يوم التوليد
--  (D-147/D-273: المولَّدُ يُترجَم عند العرض لا يُخزَّن بلغتين).
--
--  ⚠️ **والكاتبُ إداريٌّ وحدَه** (`am_admin()` من D-314): **قوائمُ لوبز
--  محتوى المنتَج**، ولو فُتح بابُها لأيّ حساب لكتب أيٌّ كان باسمه.
-- ============================================================

begin;

alter table public.user_lists
  add column if not exists source_slug text;

create unique index if not exists user_lists_source_slug_idx
  on public.user_lists (user_id, source_slug)
  where source_slug is not null;

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

  insert into public.user_list_items (list_id, tmdb_id, media_type, title, poster_path)
  select the_list,
         (e ->> 'tmdbId')::int,
         e ->> 'mediaType',
         e ->> 'title',
         e ->> 'posterPath'
  from jsonb_array_elements(p_items) as e
  on conflict do nothing;

  return the_list;
end;
$$;

create or replace function public.curated_list_ids()
returns table (source_slug text, list_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select l.source_slug, l.id
  from public.user_lists l
  join public.profiles p on p.id = l.user_id
  where coalesce(p.is_system, false) and l.source_slug is not null and l.is_public;
$$;

revoke all on function public.upsert_curated_list(text, text, text, jsonb) from public;
grant execute on function public.upsert_curated_list(text, text, text, jsonb) to authenticated;
revoke all on function public.curated_list_ids() from public;
grant execute on function public.curated_list_ids() to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from information_schema.columns
--      where table_name = 'user_lists' and column_name = 'source_slug')            as col,
--   (select count(*)::int from pg_proc
--      where proname in ('upsert_curated_list','curated_list_ids'))                as fns,
--   (select count(*)::int from pg_policies where qual = 'true')                    as open_policies;
-- المتوقّع: col = 1 · fns = 2 · open_policies = 4
