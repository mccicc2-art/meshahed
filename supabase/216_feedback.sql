-- ============================================================
--  216 — «أرسل مشكلة أو اقتراح» (D-1499، أحمد ٢١ أكتوبر: «نبي مكان يقدر الشخص يكتب مشكلة او اقتراح
--  ويرفعها بشكل سريع»، واختياراتُه: التطبيق والويب · المسجَّلون وحدهم · نصٌّ بلا صور · بلا تنبيهٍ فوريّ).
--
--  🔑 **صفرُ سياسات على الجدول عمداً** (شكلُ `featured_lists`، D-349): الكتابةُ بدالّةٍ واحدة
--  (`send_feedback`) تقرّر الكاتبَ من الجلسة وتحرس السقف، والقراءةُ والحكمُ بدالّتين يحرسهما
--  `am_admin()` **في الجسم** (D-011). فلا يقرأ أحدٌ ملاحظاتِ غيره، ولا يكتب باسم غيره، ولا يُغرق.
--
--  ⚖️ **والسقفُ في القاعدة لا في الخادم وحده**: عدّادُ الخادم في ذاكرة نسخةٍ واحدة، ونسخُ Vercel
--  كثيرة؛ خمسٌ في الساعة لكلّ حساب تُقرأ هنا من الصفوف نفسِها فلا تُتجاوز بتعدّد النسخ.
--
--  آمنةٌ للتشغيل مرّتين. ولا `drop` لشيءٍ قائم.
--  الرجوع: drop function public.send_feedback(text,text,text,text,text,text);
--          drop function public.admin_feedback_queue(text,int);
--          drop function public.admin_feedback_done(uuid,boolean);
--          drop table public.feedback;
-- ============================================================

create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('bug', 'idea')),
  body         text not null check (length(btrim(body)) between 3 and 1000),
  -- ما يعيد المشكلةَ دون أن يكتبه أحد: من أين، وبأيِّ نسخة، وعلى أيِّ جهاز
  platform     text not null check (platform in ('android', 'ios', 'web')),
  app_version  text check (app_version is null or length(app_version) <= 40),
  device       text check (device is null or length(device) <= 80),
  screen       text check (screen is null or length(screen) <= 60),
  created_at   timestamptz not null default now(),
  -- «تمّت»: من أغلقها ومتى — ويُعاد فتحُها بمسحهما
  done_at      timestamptz,
  done_by      uuid references auth.users (id) on delete set null
);

alter table public.feedback enable row level security;

-- الصفحةُ تقرأ الجديدَ أوّلاً، والسقفُ يعدّ آخرَ ساعةٍ لصاحبه
create index if not exists feedback_open_idx on public.feedback (created_at desc) where done_at is null;
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);

-- لا سياساتٍ ولا صلاحياتٍ مباشرة: الدوالُّ الثلاث هي الباب الوحيد
revoke all on table public.feedback from public, anon, authenticated;

-- ------------------------------------------------------------
--  الإرسال
-- ------------------------------------------------------------
create or replace function public.send_feedback(
  p_kind text, p_body text, p_platform text,
  p_app_version text default null, p_device text default null, p_screen text default null
) returns uuid
language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if (select count(*) from public.feedback f
      where f.user_id = uid and f.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'feedback_rate_limited';
  end if;
  insert into public.feedback (user_id, kind, body, platform, app_version, device, screen)
  values (uid, p_kind, btrim(p_body), p_platform,
          left(nullif(btrim(p_app_version), ''), 40),
          left(nullif(btrim(p_device), ''), 80),
          left(nullif(btrim(p_screen), ''), 60))
  returning id into new_id;
  return new_id;
end $$;

revoke all on function public.send_feedback(text, text, text, text, text, text) from public, anon;
grant execute on function public.send_feedback(text, text, text, text, text, text) to authenticated;

-- ------------------------------------------------------------
--  القراءة (الإدارة وحدها) — p_state: open · bug · idea · done
-- ------------------------------------------------------------
create or replace function public.admin_feedback_queue(p_state text default 'open', lim int default 200)
returns table (id uuid, kind text, body text, platform text, app_version text, device text, screen text,
               created_at timestamptz, done_at timestamptz, author uuid, username text, nickname text)
language sql stable security definer set search_path = public, pg_temp as $$
  select f.id, f.kind, f.body, f.platform, f.app_version, f.device, f.screen,
         f.created_at, f.done_at, f.user_id, p.username, p.nickname
  from public.feedback f
  left join public.profiles p on p.id = f.user_id
  where public.am_admin()
    and case coalesce(p_state, 'open')
          when 'done' then f.done_at is not null
          when 'bug'  then f.done_at is null and f.kind = 'bug'
          when 'idea' then f.done_at is null and f.kind = 'idea'
          else f.done_at is null
        end
  order by case when coalesce(p_state, 'open') = 'done' then f.done_at else f.created_at end desc
  limit greatest(1, least(coalesce(lim, 200), 500));
$$;

revoke all on function public.admin_feedback_queue(text, int) from public, anon;
grant execute on function public.admin_feedback_queue(text, int) to authenticated;

-- ------------------------------------------------------------
--  «تمّت» / إعادةُ الفتح (الإدارة وحدها)
-- ------------------------------------------------------------
create or replace function public.admin_feedback_done(p_id uuid, p_done boolean default true)
returns void
language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.am_admin() then raise exception 'not_admin'; end if;
  update public.feedback
     set done_at = case when p_done then now() else null end,
         done_by = case when p_done then auth.uid() else null end
   where id = p_id;
end $$;

revoke all on function public.admin_feedback_done(uuid, boolean) from public, anon;
grant execute on function public.admin_feedback_done(uuid, boolean) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل:
--    select (select count(*) from pg_policies where tablename = 'feedback') as pol,       -- 0
--           (select count(*) from pg_proc where proname in
--              ('send_feedback','admin_feedback_queue','admin_feedback_done')) as fns,   -- 3
--           (select relrowsecurity from pg_class where relname = 'feedback') as rls;      -- true
-- ============================================================
