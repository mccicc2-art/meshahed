-- ============================================================
--  Loopz — حذف الحساب يحذف الحساب فعلاً (هجرة 56، D-146)
--  شغّلها في Supabase → SQL Editor بعد favorites.sql (55)
--
--  العطل: `delete_my_account` في security.sql كُتبت حين كان في المخطّط
--  أحد عشر جدولاً، فعدّدتها بأسمائها. ثم صار في `public` **أربعةٌ
--  وأربعون** مفتاحاً أجنبياً يشير إلى `auth.users` — والدالّة ما زالت
--  عند أحد عشر. فمن يحذف حسابه اليوم تبقى بعده: رسائلُه في المجتمعات،
--  وحظرُه لغيره، ومشاركاتُه وردودُه، وتقييماتُ حلقاته، وأغلفتُه
--  الشخصية، وبلاغاتُه، ومتابعاتُه للفنانين، ومنحُ مكتبته.
--
--  **وهذا ليس دَيناً تقنياً بل عطلُ خصوصية:** الشاشة تقول «حُذف حسابك»
--  وهي لا تقول الصدق.
--
--  والعلاج ليس إطالةَ القائمة — القائمة هي المرض. أيُّ جدولٍ يُضاف غداً
--  يعيد العطل نفسه بصمت، ولا شيء في الشيفرة يذكّر أحداً.
--
--  **القرار: صفٌّ واحد يجرّ الباقي.** كل مفاتيح `public` الأربعة
--  والأربعين إلى `auth.users` هي `on delete cascade` **بلا استثناء**
--  (مقيسٌ على الإنتاج قبل كتابة هذا الملف)، فحذفُ صفّ المستخدم من
--  `auth.users` يمحو أثره كلَّه — واليومَ وبعد عشرين جدولاً.
--
--  وصلاحيةُ ذلك مقيسةٌ لا مفترَضة: الدالّة `security definer` يملكها
--  `postgres`، و`has_table_privilege('postgres','auth.users','delete')`
--  = true، و`rolbypassrls` له = true (و`auth.users` عليها RLS).
--  التعليق القديم «يحتاج مفتاح خدمة — خارج النطاق» كان **خطأً**.
-- ============================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gone integer;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- ١) الصور أوّلاً: `storage.objects` لا يشير إلى `auth.users`، فلا
  --    يجرّه الشلّال. وهي أوّلاً لا آخراً كي تسقط داخل نفس المعاملة إن
  --    فشل ما بعدها — إمّا يذهب كلُّ شيء أو لا شيء.
  delete from storage.objects
  where bucket_id = 'avatars'
    and (storage.foldername(name))[1] = uid::text;

  -- ٢) الصفّ الواحد الذي يجرّ الباقي
  delete from auth.users where id = uid;
  get diagnostics gone = row_count;

  -- ٣) صفرُ صفوفٍ يعني أن الحذف **لم يحدث** — فلا نقول للمستخدم إنه حدث.
  --    (صلاحيةٌ سُحبت، أو صفٌّ غاب.) الخطأ يصعد إلى الواجهة، والمعاملة
  --    كلها ترتدّ فلا تبقى صورٌ محذوفةٌ وحسابٌ قائم.
  if gone = 0 then
    raise exception 'account deletion did not remove the auth row';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- ١) لا مفتاح إلى auth.users خارج cascade — **يجب أن يعود صفراً**.
--    إن عاد غيرَ صفر فقد أُضيف جدولٌ يكسر الفرضية: أصلح المفتاح
--    (`on delete cascade`) ولا تُطِل قائمةً في الدالّة.
-- select count(*) from pg_constraint
--   where contype='f' and confrelid='auth.users'::regclass
--     and connamespace::regnamespace::text='public'
--     and confdeltype <> 'c';
--
-- ٢) الدالّة قائمة ومملوكة لمن يملك الصلاحية:
-- select proname, proowner::regrole::text, prosecdef
--   from pg_proc where proname='delete_my_account';
--
-- ٣) الصلاحية نفسها (تشخيصٌ إن فشل الحذف يوماً):
-- select has_table_privilege('postgres','auth.users','delete') as can_delete,
--        (select rolbypassrls from pg_roles where rolname='postgres') as bypassrls;
--
-- ⚠️ لا تختبرها بحسابٍ حقيقي. الاختبار الوحيد الآمن حسابٌ تجريبيّ
--    يُنشأ لهذا الغرض ثم يُحذف.
-- ============================================================
