-- ============================================================
--  ٩٣ — «صورةٌ بلا نصٍّ مشاركة» (D-302)
--  بلاغُ أحمد: «الصور ما تقدر ترسل إلا بعد ما تكتب نص».
-- ============================================================
--
--  العطلُ لم يكن في الواجهة ولا في الفعل: كلاهما يقبل الصورةَ وحدَها
--  منذ D-298 (`ready = نصٌّ || صورة`، و`if (!body && !imageUrl) return`).
--  والرافضُ هو القيدُ في القاعدة — `title_posts_body_or_kind` المكتوبُ
--  في الهجرة ٨٤ يومَ كان للمتن شكلٌ واحدٌ فقط:
--
--      (kind is null and body is not null and length(btrim(body)) between 1 and 2000)
--      or (kind is not null and body is null)
--
--  فالمشاركةُ بصورةٍ ونصٍّ فارغ تسقط عند الإدراج، فيرتدّ الصفُّ
--  التفاؤليُّ ويظهر نصُّ الخطأ الأحمر الذي صوّره أحمد.
--
--  ⚠️ والدرسُ مسجَّلٌ في `07`: **حين يصير للمعنى شكلٌ ثانٍ، تُوسَّع كلُّ
--  حراسته لا حراسةُ الطبقة التي عدّلتَها** — الواجهةُ والفعلُ وُسِّعا
--  في D-298 والقاعدةُ نُسيت، **وأصدقُ الطبقات هي التي رفضت.**
--
--  ولا `drop` إلا لقيدٍ نُعيد كتابتَه في الجملة التالية، داخل معاملةٍ
--  واحدة: **لا دالّةَ تُحذف، ولا عمود، ولا صفٌّ واحدٌ يُمَسّ.**
-- ============================================================

begin;

alter table public.title_posts drop constraint if exists title_posts_body_or_kind;

alter table public.title_posts add constraint title_posts_body_or_kind check (
  /* كلامُ إنسان: متنٌ بحدّه القديم نفسِه… */
  (kind is null and (
    (body is not null and length(btrim(body)) between 1 and 2000)
    /* …أو صورةٌ في الحمولة، والنصُّ حينئذٍ اختياريٌّ بحدّه نفسِه.
       و`->>` لا `?`: المعنى واحدٌ، وعلامةُ الاستفهام تُقرأ في بعض
       الأدوات وسيطاً فتنكسر الجملةُ حيث لا عطلَ فيها. */
    or ((data ->> 'img') is not null and (body is null or length(btrim(body)) <= 2000))
  ))
  /* نشرةُ Loopz: بلا متن، وحقائقُها في `data` — كما هي منذ ٨٤ */
  or (kind is not null and body is null)
);

commit;

-- ============================================================
--  فحصُ الصحّة بعد التشغيل — يُتوقَّع: ok = 1
-- ============================================================
-- select count(*)::int as ok
--   from pg_constraint c
--   join pg_class r on r.oid = c.conrelid
--   join pg_namespace n on n.oid = r.relnamespace
--  where n.nspname = 'public'
--    and r.relname = 'title_posts'
--    and c.conname = 'title_posts_body_or_kind'
--    and pg_get_constraintdef(c.oid) like '%img%';
