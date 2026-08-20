-- ============================================================
--  Loopz — الهجرة ١٢٢: قوائم التشغيل (D-505)
--  شغّله في Supabase → SQL Editor
--
--  طلب أحمد (٢٠ أغسطس): «يقدر يعمل لسته مثل أي لسته عادية ويحط
--  أفلامه ويعمل لليست بلاي ليست، وتظهر في كنتنيو واتش — كل ما يحط
--  صح على الفلم يظهر اللي بعده».
--
--  عمود واحد لا جدول: «قائمة تشغيل» صفةٌ للقائمة لا كيانٌ جديد،
--  وبطاقة «تابِع المشاهدة» تُبنى من عناصر القائمة القائمة أصلاً.
--  ولا سياسة جديدة: سياسة "own lists" (for all) تغطي تحديث العمود،
--  والعمود لا يدخل قراءة العلن بشيء حسّاس (مجرد راية عرض عند صاحبها).
--
--  والكود يحتملها غائبة: قبل تشغيلها يعيد الاستعلام خطأ عمود مجهول
--  فتعود getMyPlaylistsBrief بمصفوفة فارغة ولا بطاقة — بلا شاشة خطأ.
-- ============================================================

alter table public.user_lists
  add column if not exists is_playlist boolean not null default false;

-- تحقُّق الصحّة (المتوقَّع: صفٌّ واحد باسم العمود):
-- select column_name, data_type, column_default
-- from information_schema.columns
-- where table_schema = 'public' and table_name = 'user_lists'
--   and column_name = 'is_playlist';
-- ثم سياسات العلن كما هي:
-- select count(*) from pg_policies where schemaname='public' and qual='true';
-- المتوقَّع: 4
