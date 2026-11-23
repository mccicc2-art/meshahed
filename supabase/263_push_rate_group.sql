-- 263 — «تذكير التقييم» مفتاحٌ في إعدادات الإشعارات (T530، أحمد ٢٣ نوفمبر)
--
-- لماذا: «بانتظار تقييمك» يرسل إشعاراً أسبوعيّاً لمن ينتظره عشرةُ أعمالٍ فأكثر (أحمد «٢ أ وب وج»)، ووُعد العضوُ بأن يُطفئه
-- من إعدادات الإشعارات كبقيّة الأنواع. قيدُ `push_prefs.muted` لا يقبل إلّا المفاتيحَ الستّة، فيُستبدل بنظيره مع «rate».
--
-- لا يمسّ بيانات. آمنٌ للتكرار. الكودُ قبلها: الإشعارُ يُرسل، ومفتاحُه في التطبيق يفشل حفظُه برسالة خطأ — فتُشغَّل قبل النشر.
-- الرجوع: القيدُ نفسُه بالمفاتيح الستّة (بعد حذف «rate» من صفوف `muted` إن وُجد).

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.push_prefs'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) like '%muted%'
  loop
    execute format('alter table public.push_prefs drop constraint %I', c);
  end loop;
end $$;
alter table public.push_prefs add constraint push_prefs_muted_check
  check (muted <@ array['messages', 'follows', 'likes', 'replies', 'episodes', 'auto', 'rate']::text[]);

-- التحقّق
select position('rate' in (select pg_get_constraintdef(oid) from pg_constraint where conname = 'push_prefs_muted_check')) > 0 as prefs_accept_rate;
