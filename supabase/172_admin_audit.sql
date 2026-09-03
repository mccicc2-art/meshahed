-- ============================================================
--  ١٧٢ — سجلُّ الأفعال الإداريّة (D-901)
--  شغّل في: Supabase Dashboard > SQL Editor
-- ============================================================
-- **لماذا هذا أوّلاً:** لا أثرَ اليوم لمن وافق على شريكٍ أو رفض توثيقاً.
-- وبعد ثغرتَي تصعيد الامتياز في D-773 — **على هذه الطاولة نفسِها** —
-- فعلٌ إداريٌّ بلا سجلٍّ مخاطرةٌ لا تُبرَّر، خصوصاً حين يصير الفعلُ
-- «أوقِف حساباً». **وهذا البند لا يكسر شيئاً، فيسبق ما بعده.**

create table if not exists public.admin_audit (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  actor  uuid references auth.users (id) on delete set null,
  action text not null,
  target uuid,
  detail jsonb not null default '{}'::jsonb
);

create index if not exists admin_audit_at_idx     on public.admin_audit (at desc);
create index if not exists admin_audit_target_idx on public.admin_audit (target, at desc);

-- ⚠️ **بصفرِ سياسات** — نمطُ `runtime_errors` (١٤٨) و`visit_langs` (١٤٧):
-- الكتابةُ بدوالِّ definer وحدَها والقراءةُ بدالّةِ المدير،
-- **فيبقى `open_policies` خمساً كما هو.**
alter table public.admin_audit enable row level security;

-- الكاتبُ الوحيد: تُستدعى من داخل دوالِّ `admin_*` لا من عميلٍ أبداً.
create or replace function public.log_admin(
  p_action text, p_target uuid, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public, pg_temp as $$
  insert into public.admin_audit (actor, action, target, detail)
  values (auth.uid(), p_action, p_target, coalesce(p_detail, '{}'::jsonb));
$$;

-- ⚠️ Supabase تمنح `execute` افتراضيّاً — فالنزعُ صريحٌ لا مفترض (درسُ ١٥٦).
revoke all on function public.log_admin(text, uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_audit_log(lim int default 100)
returns table (at timestamptz, actor uuid, actor_name text, action text,
               target uuid, target_name text, detail jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.at, a.actor, ap.username, a.action, a.target, tp.username, a.detail
  from public.admin_audit a
  left join public.profiles ap on ap.id = a.actor
  left join public.profiles tp on tp.id = a.target
  where public.am_admin()          -- الحارسُ في الجسم (D-011)
  order by a.at desc
  limit least(greatest(coalesce(lim, 100), 1), 500);
$$;

revoke all on function public.admin_audit_log(int) from public, anon;
grant execute on function public.admin_audit_log(int) to authenticated;
