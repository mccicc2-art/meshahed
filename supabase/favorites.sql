-- ============================================================
--  Loopz — المفضّلات بلا جدول جديد (هجرة 55، D-130)
--  شغّلها في Supabase → SQL Editor بعد title_art.sql (54)
--
--  الفكرة (ب٣ من بريف ٩ أغسطس): «المفضّلة» **قائمةٌ مثبّتة** في
--  `user_lists` بعلامةٍ في `kind` — لا جدولٌ ثانٍ.
--
--  ولماذا هذا هو الصواب لا اختصاراً: محرّك القوائم يملك أصلاً المشاركة
--  (D-053/D-054) والحفظ لدى الغير (D-068) والترتيب اليدوي والسحب
--  (D-043) والظهور في `/lists` وفي البروفايل. جدولٌ جديد يعني كتابة
--  هذه الخمسة **مرّةً ثانية**، ثم صيانتها في مكانين إلى الأبد. والعلامة
--  في `kind` ترثها كلَّها مجاناً.
--
--  وقاعدة «واحدةٌ لكل شخص» تُفرض كما فُرضت في غرف الناس (D-140):
--  **فهرسٌ فريد جزئيّ**، لا قيدٌ شامل يمنع بقية القوائم.
-- ============================================================

-- ============================================================
--  ١) نوعٌ رابع للقائمة
-- ============================================================
alter table public.user_lists drop constraint if exists user_lists_kind_check;
alter table public.user_lists
  add constraint user_lists_kind_check
  check (kind in ('regular', 'ranked', 'watch_order', 'favorites'));

-- لكل شخصٍ قائمةُ مفضّلاتٍ واحدة — وبقية قوائمه بلا حدّ
create unique index if not exists user_lists_favorites_idx
  on public.user_lists (user_id) where kind = 'favorites';

-- ============================================================
--  ٢) القلب: فعلٌ واحد يُنشئ القائمة عند أوّل مرّة ويقلب العضوية
-- ============================================================
-- لماذا دالّة لا ثلاثة نداءات من العميل: «ابحث عن القائمة، أنشئها إن
-- غابت، ثم أضف أو احذف» ثلاث رحلاتٍ وسباقٌ حقيقيّ — ضغطتان سريعتان
-- على قلبين مختلفين تُنشئان قائمتين. هنا نقلةٌ واحدة، والفهرس الفريد
-- أعلاه هو الحارس الأخير.
--
-- تُرجع الحالة **بعد** الفعل: `true` = صار مفضّلاً.
create or replace function public.toggle_favorite(
  p_tmdb      integer,
  p_type      text,
  p_title     text,
  p_poster    text,
  p_list_name text default 'Favorites'
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare me uuid := auth.uid(); lid uuid; had boolean;
begin
  if me is null then return false; end if;
  if p_tmdb is null or p_tmdb <= 0 or p_type not in ('tv', 'movie') then return false; end if;

  select id into lid from public.user_lists where user_id = me and kind = 'favorites';

  if lid is null then
    insert into public.user_lists (user_id, name, kind, is_public)
    values (
      me,
      left(btrim(coalesce(nullif(btrim(p_list_name), ''), 'Favorites')), 60),
      'favorites',
      false                      -- خاصّةٌ حتى يعلنها صاحبها بنفسه
    )
    on conflict (user_id) where kind = 'favorites' do nothing
    returning id into lid;
    -- سباقُ ضغطتين: الخاسر يقرأ صفّ الفائز
    if lid is null then
      select id into lid from public.user_lists where user_id = me and kind = 'favorites';
    end if;
  end if;

  select true into had from public.user_list_items
  where list_id = lid and tmdb_id = p_tmdb and media_type = p_type;

  if had then
    delete from public.user_list_items
    where list_id = lid and tmdb_id = p_tmdb and media_type = p_type;
    update public.user_lists set updated_at = now() where id = lid;
    return false;
  end if;

  insert into public.user_list_items (list_id, tmdb_id, media_type, title, poster_path)
  values (lid, p_tmdb, p_type, nullif(btrim(coalesce(p_title, '')), ''), p_poster)
  on conflict do nothing;
  update public.user_lists set updated_at = now() where id = lid;
  return true;
end;
$$;
revoke all on function public.toggle_favorite(integer, text, text, text, text) from public;
grant execute on function public.toggle_favorite(integer, text, text, text, text) to authenticated;

-- ============================================================
--  ٣) مفضّلاتي — مجموعةٌ تُقرأ مرّةً وتُطبَّق على كل قلب
-- ============================================================
-- نداءٌ واحد بدل سؤالٍ لكل عمل. `security definer` ليس لتجاوز حراسة —
-- الصفوف صفوفُ صاحبها أصلاً — بل ليكون **نداءً واحداً** بدل ربطٍ
-- من العميل عبر جدولين.
create or replace function public.my_favorites()
returns table (tmdb_id integer, media_type text)
language sql
stable
security definer
set search_path = public
as $$
  select i.tmdb_id, i.media_type
  from public.user_list_items i
  join public.user_lists l on l.id = i.list_id
  where l.user_id = auth.uid() and l.kind = 'favorites';
$$;
revoke all on function public.my_favorites() from public;
grant execute on function public.my_favorites() to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'user_lists_kind_check';        -- يجب أن يضمّ 'favorites'
-- select indexname from pg_indexes where tablename='user_lists';
-- select proname from pg_proc where proname in ('toggle_favorite','my_favorites');
--
-- ⚠️ السياسات المفتوحة تبقى **أربعاً** — هذه الهجرة لا تضيف جدولاً ولا
-- سياسة، فترث سياسات `user_lists`/`user_list_items` كما هي:
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
