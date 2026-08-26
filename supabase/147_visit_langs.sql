-- ============================================================
--  Loopz — الهجرة ١٤٧ (D-666): عدّادُ لغاتِ الزوّار
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  🔑 **لماذا**: أحمد يريد الفرنسيةَ والتركية، **ونحن لا نعرف من أين
--  يأتي الزوّار ولا أيَّ لغةٍ يطلبها متصفّحُهم** — Web Analytics غيرُ
--  مفعَّل، والأعضاءُ الاثنان والثلاثون كلُّهم عربيٌّ أو إنجليزيّ.
--  **وألفُ نصٍّ في اللغة الخاطئة أغلى ألفَ مرّةٍ من عدّادٍ يسبقها.**
--
--  ⚠️ **ولا بياناتٍ شخصيّةً إطلاقاً**: الصفُّ **يومٌ ولغةٌ وعدد** — لا
--  عنوانَ IP ولا معرّفَ مستخدمٍ ولا مسار. **وما لا يُخزَّن لا يُسرَّب.**
--
--  ⚠️ **ولا سياسةَ على الجدول** (RLS مفعَّلٌ بلا سياسات): **الكتابةُ
--  بدالّة `security definer` وحدَها، والقراءةُ من اللوحة** —
--  **و`open_policies` يبقى أربعاً** (يُفحص بعد التشغيل).
-- ============================================================

create table if not exists public.visit_langs (
  day  date    not null default (now() at time zone 'utc')::date,
  lang text    not null,
  hits integer not null default 0,
  primary key (day, lang)
);

alter table public.visit_langs enable row level security;
revoke all on public.visit_langs from anon, authenticated;

--  🔑 **والتنقيةُ في القاعدة لا في المسار**: **الحارسُ الأخيرُ يجب أن
--  يكون حيث يُكتب الصفّ** (D-011/D-314) — فلا يكتب نصٌّ حرٌّ في عمودٍ
--  مهما نودي الباب. **وما خالف الشكلَ يُسجَّل `other` لا يُرفض**:
--  **رفضُ الغريب يُخفيه، وتسجيلُه يقول «هناك من لا نعرفه».**
create or replace function public.bump_visit_lang(p_lang text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v text;
begin
  v := lower(btrim(coalesce(p_lang, '')));
  --  «ar» · «fr-ma» · «zh-hant» — وما عداها `other`
  if v !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})?$' then
    v := 'other';
  end if;
  v := left(v, 12);

  insert into public.visit_langs (day, lang, hits)
  values ((now() at time zone 'utc')::date, v, 1)
  on conflict (day, lang) do update
    set hits = public.visit_langs.hits + 1;
end;
$$;

grant execute on function public.bump_visit_lang(text) to anon, authenticated;

--  الفحص بعد التشغيل — المتوقَّع: policies = 0 · open_policies = 4
--    select count(*) from pg_policies where tablename = 'visit_langs';
--    select public.bump_visit_lang('fr-MA');
--    select * from public.visit_langs order by day desc, hits desc;
--
--  والقراءةُ الأسبوعيّة (وهي كلُّ الغرض):
--    select lang, sum(hits) as hits
--    from public.visit_langs
--    where day >= current_date - 30
--    group by lang order by hits desc;
