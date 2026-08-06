-- ==========================================================================
-- lists2.sql — نوع القائمة وترتيبها اليدوي
--
-- القائمة كانت شيئاً واحداً: مجموعةٌ مرتّبة بتاريخ الإضافة. وهي في الواقع
-- ثلاثة أشياء مختلفة المعنى: مجموعةٌ لا ترتيب لها، وقائمةٌ مرتّبة من الأفضل
-- إلى الأقل، وترتيبُ مشاهدةٍ زمنيّ (خطّ مارفل الزمني مثلاً). النوع هو ما
-- يقرّر هل للأرقام معنى أصلاً — فبدونه يكون الرقم على الملصق زخرفةً كاذبة.
--
-- `sort_order` يبقى NULL في القائمة العادية، فيسقط الترتيب تلقائياً إلى
-- `added_at desc` — أي أن السلوك القديم هو الحالة الافتراضية بلا هجرة بيانات.
--
-- يُنفَّذ مرّةً واحدة في لوحة Supabase. آمنٌ للإعادة.
-- ==========================================================================

-- ---------- نوع القائمة ----------
alter table public.user_lists
  add column if not exists kind text not null default 'regular';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_lists_kind_check') then
    alter table public.user_lists
      add constraint user_lists_kind_check
      check (kind in ('regular', 'ranked', 'watch_order'));
  end if;
end $$;

-- ---------- الترتيب اليدوي ----------
-- `sort_order` لا `position`: الأخيرة اسم دالّةٍ في SQL، وتسميةُ عمودٍ باسم
-- دالّةٍ قياسية تنفجر في أول تعبيرٍ لا يقتبسها.
alter table public.user_list_items
  add column if not exists sort_order integer;

create index if not exists user_list_items_sorted_idx
  on public.user_list_items (list_id, sort_order nulls last, added_at desc);

-- ---------- حفظ الترتيب في استدعاءٍ واحد ----------
-- خمسون عملاً تعني خمسين تحديثاً منفصلاً لو كُتب من العميل، وكلٌّ منها رحلة
-- شبكة. هنا جملةٌ واحدة: موضعُ المفتاح في المصفوفة هو رقم العنصر.
--
-- الدالّة `security invoker` عمداً لا `definer`: سياسة «own list items»
-- موجودة أصلاً وتحصر التعديل بصاحب القائمة، فمن يستدعيها على قائمة غيره
-- يُحدِّث صفراً من الصفوف. لا داعي لفتح سطحِ `definer` جديدٍ (انظر D-010).
create or replace function public.reorder_list(p_list uuid, p_keys text[])
returns void
language sql
as $$
  update public.user_list_items i
     set sort_order = nullif(array_position(p_keys, i.media_type || '-' || i.tmdb_id), 0)
   where i.list_id = p_list;
$$;

revoke all on function public.reorder_list(uuid, text[]) from public;
grant execute on function public.reorder_list(uuid, text[]) to authenticated;
