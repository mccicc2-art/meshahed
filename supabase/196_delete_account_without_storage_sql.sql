-- 196 — حذفُ الحساب لا يلمس `storage.objects` بـSQL (D-1340)
--
-- العطل (١٠ أكتوبر ٢٠٢٦، من سجلّ القاعدة ١٠:١٥:١٦ بتوقيت الرياض):
--   POST /rest/v1/rpc/delete_my_account ⇒ 403
--   42501 «Direct deletion from storage tables is not allowed. Use the Storage API instead.»
--   المصدر: `storage.protect_delete()` — تريغر `protect_objects_delete`
--   (BEFORE DELETE … FOR EACH STATEMENT) أضافته Supabase على `storage.objects`.
--
-- `delete_my_account` (الهجرة ٥٦، D-146) كانت تبدأ بـ`delete from storage.objects`
-- لصور العضو. التريغر **على مستوى الجملة** فيرفض حتى حذفَ صفرِ صفوف — فارتدّت
-- المعاملةُ كلُّها عند كلِّ عضو: **لم يكن حسابٌ واحدٌ يُحذف**، والشاشةُ تعرض
-- «Minified React error #441».
--
-- العلاج: الملفّاتُ يحذفها فعلُ الخادم `deleteMyAccount` عبر Storage API بجلسة العضو
-- (`avatars` و`partner-ids` — الثاني لم تكن الدالّةُ تمسّه أصلاً، فكانت وثيقةُ الشريك
-- تبقى بعد صاحبها)، وهذه الدالّةُ تحذف صفَّ `auth.users` وحدَه فيجرّ الباقي.
--
-- ⚠️ **ولا `set_config('storage.allow_delete_query', …)` هنا**: يُسكت التريغرَ ويمحو
-- الصفَّ ويترك الملفَّ نفسَه في المخزن — وهو بالضبط ما وُضع التريغرُ ليمنعه.
--
-- `create or replace` لدالّةٍ قائمة: لا جدولَ ولا سياسةَ ولا صفَّ يُمسّ، والمنحُ كما هو.
-- تُشغَّل **مع** نشر `deleteMyAccount` الجديد: قبله تُبقي صورَ المحذوف، وبعده بلاها
-- يفشل الحذفُ كما كان.

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

  -- الصفُّ الواحد الذي يجرّ الباقي (كلُّ مفاتيح `public` إليه cascade أو set null)
  delete from auth.users where id = uid;
  get diagnostics gone = row_count;

  -- صفرُ صفوفٍ يعني أن الحذف لم يحدث — فلا نقول للمستخدم إنه حدث.
  if gone = 0 then
    raise exception 'account deletion did not remove the auth row';
  end if;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- التحقّق بعد التشغيل (المتوقَّع: false · true · true):
-- select position('storage.objects' in prosrc) > 0 as touches_storage,
--        position('delete from auth.users' in prosrc) > 0 as deletes_auth_row,
--        has_function_privilege('authenticated','public.delete_my_account()','execute') as can_run
--   from pg_proc where proname='delete_my_account' and pronamespace='public'::regnamespace;
