-- ============================================================
--  Loopz — الهجرة ١٤٨ (D-668): سجلُّ أخطاء الخادم
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  🔴 **لماذا الآن**: شاشةُ «صار خلل غير متوقّع» ظهرت لحساب `teamesh`
--  **ثلاث مرّاتٍ في تحقيقاتٍ ثلاثة** (D-612 · D-626 · D-652) —
--  **وفي كلِّ مرّةٍ شُخِّصت بالاستنتاج لا بالنصّ**، لأن سجلّاتِ Vercel
--  محجوبةٌ عن هذا المشروع (`403 Forbidden` — أُعيد فحصُها اليوم).
--  **ورمزُ الخطأ الذي يراه المستخدم (`digest`) بصمةٌ بلا معنى ما لم
--  تُقابَل بنصّها.**
--
--  🔑 **فالبابُ الذي نملكه هو قاعدتُنا**: `onRequestError` في
--  `instrumentation.ts` يكتب هنا **المسارَ والبصمةَ والنصَّ** — **فأوّلُ
--  تكرارٍ للعطل يصير مقروءاً بدل أن يُخمَّن.**
--
--  ⚠️ **ولا هويّةَ فيه**: لا معرّفَ مستخدمٍ ولا IP ولا ترويسات —
--  **المسارُ عامٌّ والنصُّ نصُّنا نحن.** **والنصُّ مقصوصٌ عند ٤٠٠ حرفٍ
--  في القاعدة نفسِها** فلا يتسرّب متنٌ طويلٌ من رسالةٍ غير متوقّعة.
--
--  ⚠️ **ولا سياسةَ على الجدول** (RLS مفعَّلٌ بصفرِ سياسات): الكتابةُ
--  بدالّة definer والقراءةُ من اللوحة — **و`open_policies` يبقى أربعاً.**
-- ============================================================

create table if not exists public.runtime_errors (
  id      bigserial primary key,
  at      timestamptz not null default now(),
  route   text,
  digest  text,
  kind    text,
  message text
);

create index if not exists runtime_errors_at_idx on public.runtime_errors (at desc);

alter table public.runtime_errors enable row level security;
revoke all on public.runtime_errors from anon, authenticated;

--  **والقصُّ في القاعدة لا في المسار** (D-011/D-314): الحارسُ الأخيرُ
--  حيث يُكتب الصفّ — **فلا يكتب نصٌّ طويلٌ مهما نودي الباب.**
create or replace function public.log_runtime_error(
  p_route text, p_digest text, p_kind text, p_message text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.runtime_errors (route, digest, kind, message)
  values (
    left(coalesce(p_route, ''), 160),
    left(coalesce(p_digest, ''), 40),
    left(coalesce(p_kind, ''), 80),
    left(coalesce(p_message, ''), 400)
  );
end;
$$;

grant execute on function public.log_runtime_error(text, text, text, text) to anon, authenticated;

--  الفحص بعد التشغيل — المتوقَّع: policies = 0 · open_policies = 4
--    select count(*) from pg_policies where tablename = 'runtime_errors';
--
--  والقراءةُ عند أوّل بلاغٍ قادم (وهي كلُّ الغرض):
--    select at, route, digest, kind, message
--    from public.runtime_errors order by at desc limit 20;
