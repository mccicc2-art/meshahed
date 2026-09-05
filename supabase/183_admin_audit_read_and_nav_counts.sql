-- ============================================================
--  ١٨٣ — سجلُّ الإدارة يُقرأ، وأرقامُ الطوابير في نداءٍ خفيف
--        (D-923، حكمُ أحمد: «صفحة الأدمن تحتاج تحسيناً وترتيباً
--         بحيث تسهّل المتابعة وفيها كل شيء»)
-- ============================================================
-- 🔴 **سجلٌّ يُكتب ولا يُقرأ ليس سجلّاً**: `admin_audit` (١٧٢) تمتلئ منذ
--    أسابيع — كشفُ بريد، إضافةُ مختبِر، منحُ صلاحية — **وبصفرِ سياساتٍ
--    على الجدول لا يستطيع أحدٌ رؤيتَها**، ولا بابَ لها في الواجهة.
--    **وقد صار في اللوحة مديران** (KHLD، ٥ سبتمبر): «من فعل ماذا ومتى»
--    سؤالٌ له جوابٌ مخزَّنٌ ينقصه بابٌ فقط.
--
-- 🔑 **والأسماءُ تُضَمّ في القاعدة لا في الصفحة**: صفٌّ فيه `uuid` وحدَه
--    يُجبر الواجهةَ على رحلةٍ ثانيةٍ لكلِّ سطر. `left join` هنا مرّةً.
--
-- 🔑 **ونداءُ الشريط خفيفٌ عمداً — لا `admin_overview`**: الشريطُ يُرسم في
--    **كلِّ** صفحةِ إدارة، و`admin_overview` تقيس أحجامَ الجداول وتجمع
--    أخطاءَ ثلاثين يوماً — **ثمنُ لوحةِ قيادةٍ كاملةٍ لأربعة أرقام.**
--    خمسةُ `count` على جداولَ صغيرةٍ هي كلُّ ما يلزم.
--
-- ⚖️ **ولا سياسةَ جديدة ولا عمودَ جديد**: قراءةٌ محضةٌ عبر `definer`
--    بحارس `am_admin()` في الجسم — **الحكمُ في القاعدة** (D-011).

-- ============ ١) سجلُّ الإدارة — من فعل ماذا ومتى ============
-- **الحدُّ مقيَّدٌ في الجسم** (١…٢٠٠): معاملٌ من الواجهة لا يفتح باباً
-- لسحب الجدول كلِّه في نداءٍ واحد.
create or replace function public.admin_audit_recent(p_limit int default 40)
returns table (at timestamptz, actor uuid, actor_name text,
               action text, target uuid, target_name text, detail jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.at, a.actor,
         coalesce(pa.nickname, pa.username, left(a.actor::text, 8)),
         a.action, a.target,
         coalesce(pt.nickname, pt.username, left(a.target::text, 8)),
         a.detail
  from public.admin_audit a
  left join public.profiles pa on pa.id = a.actor
  left join public.profiles pt on pt.id = a.target
  where public.am_admin()
  order by a.at desc
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$$;
revoke all on function public.admin_audit_recent(int) from public, anon;
grant execute on function public.admin_audit_recent(int) to authenticated;

-- ============ ٢) أرقامُ الشريط — أربعةُ طوابيرَ وواجبُ اليوم ============
-- `testers_missing` = **من له حسابٌ ولم يدخل اليومَ** (يومُ الرياض، ١٨٢) —
-- وهو الرقمُ الذي يُراسَل صاحبُه، فيظهر في الشريط لا في صفحته وحدَها.
create or replace function public.admin_nav_counts()
returns jsonb
language sql stable security definer set search_path = public, auth, pg_temp as $$
  with tu as (
    select u.id from public.play_testers t
    join auth.users u on lower(u.email) = t.email and u.deleted_at is null
  )
  select case when not public.am_admin() then null else jsonb_build_object(
    'partners',  (select count(*) from public.partner_applications where status = 'pending'),
    'verify',    (select count(*) from public.verification_requests where status = 'pending'),
    'payouts',   (select count(*) from public.payout_requests where status = 'pending'),
    'suspended', (select count(*) from public.profiles where suspended_at is not null),
    'testers_missing', (select count(*) from tu where not exists (
       select 1 from public.user_active_days d
       where d.user_id = tu.id and d.day = public.loopz_today()))
  ) end;
$$;
revoke all on function public.admin_nav_counts() from public, anon;
grant execute on function public.admin_nav_counts() to authenticated;

-- ============ فحوصٌ بعد التشغيل ============
--   select count(*) from pg_policies where schemaname='public';   -- بلا تغيير
--   select public.admin_nav_counts();                             -- jsonb لا null (بحساب المدير)
--   select count(*) from public.admin_audit_recent(5);            -- ≤ ٥ صفوف
--   select proname, proacl from pg_proc
--    where proname in ('admin_audit_recent','admin_nav_counts');  -- بلا anon
