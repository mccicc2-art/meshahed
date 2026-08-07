-- ============================================================
--  Loopz — فورية الرسائل: publication للـ Realtime (39)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ⚠️ شغّله **قبل** نشر كود الاشتراك (usePoll v2 / D-069).
--
--  لماذا الآن وقد أُجِّل: التأجيل كان بانتظار التحقق من سلوك RLS تحت
--  WALRUS — وسياساتُ القراءة على جداول الرسائل الأربعة أعمدةٌ مباشرة
--  (auth.uid() = طرف الصفّ) أو EXISTS بسيطة، وكلّها ممّا يقيّمه WALRUS
--  بأمان. والحدثُ عندنا إشارةُ إيقاظٍ للتجديد لا ناقلُ بيانات: القراءة
--  تبقى من مسار الخادم المحروس نفسه، فلا يُفتح مسارٌ ثانٍ.
-- ============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'title_shares', 'list_shares', 'share_replies', 'community_messages'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- التحقّق:
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public'
order by tablename;
