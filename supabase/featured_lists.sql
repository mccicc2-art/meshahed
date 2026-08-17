-- ============================================================
--  Loopz — قائمةُ الأسبوع: تثبيتٌ تحريريٌّ لا خوارزمية (الهجرة ١٠٨)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  طلبُ أحمد: «تحط بعد البيك فور يو تريندينج ليست — حالياً الكلُّ يتكلّم
--  عن ليست تخصّ مارفل لفلم دووم الي بيعرض ١٨ سبتمبر، هذي تعتبر ليست
--  مهمّة».
--
--  ============ ولماذا تحريريٌّ لا حسابيّ — وقد سُئل واختار ============
--
--  **الحسابيُّ ممكنٌ بلا جدولٍ أصلاً**: `list_saves.created_at` موجودٌ
--  منذ يومه، **فعدُّ الحفظ في سبعة أيّامٍ دالّةٌ واحدة**. **ورُفض الآن
--  لسببٍ مقيس:** بقاعدةٍ فيها حفظاتٌ معدودة **يعود الصفُّ فارغاً أو
--  بقائمةٍ حفظها شخصان** — **وصفٌّ يقول «الرائجة» عن قائمةٍ حفظها اثنان
--  يكذب** (D-219)، **وصندوقٌ فارغٌ تحت عنوانٍ يَعِد أسوأ من غيابه**
--  (D-181).
--
--  **والحقيقةُ التي يعرفها أحمد ولا تعرفها القاعدة**: أن فيلماً يُعرض في
--  ١٨ سبتمبر يجعل قائمتَه مهمّةً **قبل** أن يحفظها أحد. **والتحريريُّ هو
--  الأداةُ التي تحمل معرفةً سابقةً للبيانات.**
--
--  ⚠️ **وهذا ليس جدولاً جديداً بقدر ما هو `title_room_global_pins`
--  ثانيةً** (D-314): نفسُ الشكل — مفتاحٌ واحد، صفرُ سياساتٍ مفتوحة،
--  الكاتبُ `am_admin()` **في جسم الدالّة لا في الواجهة** (D-011/D-193)،
--  والقارئُ دالّةُ `definer` تُعيد المعرّفات وحدَها.
--
--  ⚠️ **والعامّةُ وحدَها تُثبَّت**: تثبيتُ قائمةٍ خاصّةٍ يفتح بابَ عرضِ
--  اسمِها على الجميع — **تسريبٌ بثوب تحرير** (نصُّ `top_saved_lists`).
-- ============================================================

begin;

create table if not exists public.featured_lists (
  -- حذفُ القائمة يُسقط تثبيتَها: مرجعٌ إلى لا شيء ليس مرجعاً (نصّ `list_saves`)
  list_id    uuid primary key references public.user_lists (id) on delete cascade,
  -- **رتبةٌ صغيرةٌ تعلو** — ولا `sort_order` فارغٍ يُخمَّن (D-043)
  rank       integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.featured_lists enable row level security;

-- **ولا سياسةَ واحدة**: القراءةُ بدالّة `definer` والكتابةُ بدالّةٍ
-- حارسُها `am_admin()` — **فالجدولُ مقفلٌ تماماً على الأدوار**، والسياساتُ
-- المفتوحة تبقى أربعاً (D-013/D-314).

create or replace function public.set_featured_list(p_list uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.am_admin() then
    raise exception 'forbidden';
  end if;

  if p_on then
    if not exists (
      select 1 from public.user_lists l where l.id = p_list and l.is_public
    ) then
      raise exception 'list must be public';
    end if;
    insert into public.featured_lists (list_id) values (p_list)
    on conflict (list_id) do nothing;
  else
    delete from public.featured_lists where list_id = p_list;
  end if;
end;
$$;

revoke all on function public.set_featured_list(uuid, boolean) from public;
grant execute on function public.set_featured_list(uuid, boolean) to authenticated;

-- **القارئُ يُسقط ما لم يعد عامّاً** — قائمةٌ ثُبِّتت ثم صارت خاصّةً
-- تختفي من الصفّ بلا تدخّل (D-063: الحارسُ يُقرأ حيث تُقرأ الصفوف).
create or replace function public.featured_list_ids()
returns table (list_id uuid, rank integer)
language sql
stable
security definer
set search_path = public
as $$
  select f.list_id, f.rank
  from public.featured_lists f
  join public.user_lists l on l.id = f.list_id
  where l.is_public
  order by f.rank asc, f.created_at desc
  limit 12;
$$;

revoke all on function public.featured_list_ids() from public;
grant execute on function public.featured_list_ids() to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_tables where tablename = 'featured_lists')      as tbl,
--   (select count(*)::int from pg_policies where tablename = 'featured_lists')    as pol_here,
--   (select count(*)::int from pg_proc
--      where proname in ('set_featured_list','featured_list_ids'))                as fns,
--   (select count(*)::int from pg_policies where qual = 'true')                   as open_policies;
-- المتوقّع: tbl = 1 · pol_here = 0 · fns = 2 · open_policies = 4
--
-- والتثبيتُ يُجرَّب بحسابٍ إداريّ:
--   select public.set_featured_list('‹list-uuid›', true);
--   select * from public.featured_list_ids();
