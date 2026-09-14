-- ============================================================
--  ١٩٠ — اللوحةُ تعرف من يملك مفتاحَها (D-963)
-- ============================================================
-- 🔴 **البند (د) من مراجعة ١٤ سبتمبر**: حارسُ اللوحة كلِّها
--    `am_admin()` = `is_admin` **أو** `is_system` — **وفي الإنتاج ثلاثُ
--    هويّاتٍ يفتح لها البابُ واللوحةُ تسمّي اثنتين**: `ahmed` و`khld`
--    (`is_admin`) و**`loopz` (`is_system`)**.
--
-- 🔴 **والصفُّ الثالثُ ليس غائباً عن الشاشة — بل يجلس في رأسها بلا شارة**:
--    `admin_users_search` ترتّب `order by u.created_at desc`، **و`created_at`
--    لحساب `loopz` فارغة**، والفارغُ في الترتيب التنازليّ يتصدّر. **فأوّلُ صفٍّ
--    في `/admin/users` صاحبُ صلاحيّةٍ كاملةٍ يُقرأ مستخدماً عاديّاً** —
--    والشارةُ تقرأ `is_admin` وحدَها، **وزرُّ «اجعله مديراً» معروضٌ عليه وهو
--    يملك اللوحةَ أصلاً.**
--
-- ⚠️ 🔑 **وتصحيحُ قياسٍ يُسجَّل باسمه** (درسُ D-928: «رقمٌ يُقرأ بدورٍ محدودٍ
--    ليس رقمَ الحقيقة»): قيل أوّلَ المراجعة إنّ `loopz` **بلا صفٍّ في
--    `auth.users`** — **وهو خطأ**، والمِجَسُّ كان `email is not null`.
--    **والقيدُ `profiles_id_fkey` يمنع ذلك أصلاً** (مُتحقَّقٌ ومُفعَّل).
--    **الحقيقةُ المقيسة**: الصفُّ موجودٌ **قشرةً فارغة** — بلا بريدٍ ولا
--    هاتفٍ ولا كلمةِ مرور، **وصفرُ `auth.identities`** وصفرُ جلسات.
--    **فالحكمُ لم يتغيّر (لا أحدَ يدخل به) والسببُ تغيّر** — **وسببٌ خاطئٌ
--    لحكمٍ صحيحٍ يسقط يومَ يتغيّر الواقع.**
--
-- 🔑 **ولذلك العمودُ `can_sign_in` لا `has_row`**: **وجودُ صفٍّ في
--    `auth.users` لا يعني شيئاً** (القيدُ يفرضه) — **والسؤالُ الحقيقيُّ: هل
--    يملك اعتماداً يدخل به؟** كلمةُ مرورٍ أو هويّةُ مزوّدٍ واحدةٌ على الأقلّ.
--    **يومَ تُربط هويّةُ Google بهذا الصفّ يصير `can_sign_in = true` وتقولها
--    الشاشةُ وحدَها بلا أن يسأل أحد.**
--
-- 🔑 **ودالّةٌ صغيرةٌ مخصوصةٌ لا توسيعُ `admin_overview`** (حجّةُ D-909
--    وD-923 نفسُها): تلك تقيس أحجامَ الجداول وتجمع أخطاءَ ثلاثين يوماً —
--    **ثمنُ لوحةٍ كاملةٍ لثلاثة صفوف.**
--
-- 🔴 **وشرطُ §١ مرآةُ جسم `am_admin()` حرفاً** — **من يغيّر تعريفَ «المدير»
--    هناك يغيّره هنا في الالتزام نفسِه، وإلا عادت الشاشةُ تكذب بصمتٍ من جديد.**

-- ═══ §١ — من يملك المفتاح ═══════════════════════════════════
-- ⚖️ **و`left join` لا `join`**: القيدُ اليومَ يضمن الصفَّ، **لكنّ شاشةً
--    بُنيت لتكشف من يفتح البابَ لا يجوز أن يسقط منها أحدٌ لو سقط القيد يوماً.**
-- ⚖️ **و`drop` قبلها وإن كانت جديدةً**: تشغيلٌ ثانٍ بعد تعديلِ عمودٍ يفشل
--    بـ«cannot change return type» — **وهجرةٌ لا تُعاد تشغيلُها بأمانٍ هجرةٌ
--    تُخاف** (وقع فعلاً في تجربة `loopz-preview`).
drop function if exists public.admin_keyholders();

create function public.admin_keyholders()
returns table(
  id                uuid,
  username          text,
  nickname          text,
  is_admin          boolean,
  is_system         boolean,
  can_sign_in       boolean,
  identities        integer,
  last_sign_in_at   timestamptz,
  suspended_at      timestamptz
)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select p.id, p.username, p.nickname,
         coalesce(p.is_admin, false),
         coalesce(p.is_system, false),
         (u.encrypted_password is not null
          or exists (select 1 from auth.identities i where i.user_id = p.id)),
         (select count(*)::int from auth.identities i where i.user_id = p.id),
         u.last_sign_in_at,
         p.suspended_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where public.am_admin()
    and (coalesce(p.is_admin, false) or coalesce(p.is_system, false))
  order by coalesce(p.is_admin, false) desc, p.username nulls last;
$$;

revoke all on function public.admin_keyholders() from public, anon;
grant execute on function public.admin_keyholders() to authenticated;

-- ═══ §٢ — والشارةُ تصدق في صفحة المستخدمين ══════════════════
-- ⚠️ **نوعُ الردِّ يتغيّر فلا `create or replace`** — `drop` ثمّ إنشاء.
-- ⚖️ **ولا نافذةَ عطلٍ هنا بخلاف ١٨٩**: التوقيعُ نفسُه (`text, int`)،
--    **والعمودُ الزائدُ يتجاهله القارئُ القديم** — فالشيفرةُ المنشورةُ تعمل
--    قبل نشر الجديدة وبعدها. **وجسمُ الدالّة لم يُمسّ إلا بعمودٍ واحد.**
drop function if exists public.admin_users_search(text, integer);

create or replace function public.admin_users_search(p_q text, lim integer default 25)
returns table(
  id uuid, username text, nickname text, avatar_url text,
  created_at timestamptz, last_sign_in_at timestamptz,
  plan text, is_admin boolean, is_system boolean,
  suspended_at timestamptz, suspended_reason text, email_masked text
)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select p.id, p.username, p.nickname, p.avatar_url,
         u.created_at, u.last_sign_in_at,
         p.plan, coalesce(p.is_admin, false), coalesce(p.is_system, false),
         p.suspended_at, p.suspended_reason,
         case when u.email is null then null
              else left(u.email, 2) || '***@' || split_part(u.email, '@', 2) end
  from public.profiles p
  join auth.users u on u.id = p.id
  where public.am_admin()
    and (
      coalesce(btrim(p_q), '') = ''
      or p.username ilike '%' || replace(replace(btrim(p_q), '%', '\%'), '_', '\_') || '%'
      or p.nickname ilike '%' || replace(replace(btrim(p_q), '%', '\%'), '_', '\_') || '%'
      or p.id::text = btrim(p_q)
    )
  order by (p.suspended_at is null), u.created_at desc
  limit least(greatest(coalesce(lim, 25), 1), 100);
$$;

revoke all on function public.admin_users_search(text, integer) from public, anon;
grant execute on function public.admin_users_search(text, integer) to authenticated;

-- ═══ §٣ — 🔴 ولا يُوقَف صاحبُ مفتاح ═════════════════════════
-- 🔴 **أخطرُ ما كشفته هذه الجولة، ولم تبلغه المراجعةُ نفسُها**:
--    `admin_suspend_user` يحرس `is_admin` **وحدَه** — **و`loopz` حسابُ نظامٍ
--    `is_admin = false`**، فالقاعدةُ تسمح بإيقافه، **والواجهةُ تعرض عليه
--    نموذجَ الإيقاف** (شرطُها `u.isAdmin` نفسُه)، **وهو أوّلُ صفٍّ في
--    `/admin/users`** لأنّ `created_at` فارغته تتصدّر التنازليَّ.
--
-- 📏 **والثمنُ مقيسٌ لا متخيَّل**: الإيقافُ يفعل ثلاثةَ أشياءَ دفعةً —
--    **`is_public = false` على ٤٨ قائمةً عامّةً يملكها `loopz`** ·
--    **`hidden = true` على ٥٦ منشوراً** · `banned_until = infinity` وحذفُ
--    رموز التجديد. **ضغطةٌ واحدةٌ بلا تأكيدٍ على أوّل صفٍّ في الصفحة تُطفئ
--    قوائمَ لوبز الرسميّةَ كلَّها** — **والإرجاعُ ليس فكَّ إيقاف**: فكُّ
--    الإيقاف لا يُعيد `is_public` (الدالّةُ تحفظ المعرّفات في `admin_audit`
--    ولا تردّها).
--
-- 🔑 **والعلاجُ أن يصير الشرطُ مرآةَ `am_admin()`**: **من يفتح اللوحةَ لا
--    يُوقَف من اللوحة** — `is_admin` **أو** `is_system`. **وبقيّةُ الجسم لم
--    تُمَسّ حرفاً** (نُسخت من `pg_proc` كما هي).
-- ⚖️ **والواجهةُ تخفي النموذجَ أيضاً — ومرآةٌ لا حارس**: الحكمُ هنا (D-011).
create or replace function public.admin_suspend_user(p_user uuid, p_reason text)
returns void
language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare v_posts uuid[]; v_lists uuid[];
begin
  if not public.am_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'cannot_suspend_self' using errcode = '22023';
  end if;
  -- 🆕 D-963 — **مرآةُ `am_admin()` حرفاً**: كان `is_admin` وحدَه.
  if coalesce((select coalesce(is_admin, false) or coalesce(is_system, false)
                 from public.profiles where id = p_user), false) then
    raise exception 'cannot_suspend_admin' using errcode = '22023';
  end if;
  if coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if (select suspended_at from public.profiles where id = p_user) is not null then
    raise exception 'already_suspended' using errcode = '22023';
  end if;

  update public.profiles
     set suspended_at = now(), suspended_reason = btrim(p_reason), suspended_by = auth.uid()
   where id = p_user;

  with flipped as (
    update public.title_posts set hidden = true
     where user_id = p_user and hidden = false returning id
  ) select coalesce(array_agg(id), '{}'::uuid[]) into v_posts from flipped;

  with flipped as (
    update public.user_lists set is_public = false
     where user_id = p_user and is_public = true returning id
  ) select coalesce(array_agg(id), '{}'::uuid[]) into v_lists from flipped;

  update auth.users set banned_until = 'infinity'::timestamptz where id = p_user;
  delete from auth.refresh_tokens where user_id = p_user::text;

  perform public.log_admin('suspend_user', p_user, jsonb_build_object(
    'reason', btrim(p_reason),
    'posts', to_jsonb(v_posts),
    'lists', to_jsonb(v_lists)));
end;
$$;

revoke all on function public.admin_suspend_user(uuid, text) from public, anon;
grant execute on function public.admin_suspend_user(uuid, text) to authenticated;

-- ═══ التحقُّق ═══════════════════════════════════════════════
-- select * from public.admin_keyholders();
--   المتوقَّع على الإنتاج: **ثلاثةُ صفوف** — `ahmed` و`khld`
--   (`is_admin` · `can_sign_in = true` · `identities = 2`)
--   و`loopz` (`is_system` · **`can_sign_in = false` · `identities = 0`**).
-- select username, is_admin, is_system from public.admin_users_search('', 100) limit 3;
--   المتوقَّع: **`loopz` أوّلُ صفّ** (`created_at` فارغة تتصدّر التنازليَّ)
--   **و`is_system = true` تصل القارئَ الآن** — وهي بعينها علّةُ §٢.
-- select public.admin_suspend_user('100b2000-0000-4000-8000-000000000001', 'test');
--   المتوقَّع: **`cannot_suspend_admin`** — وكان يمضي قبل §٣.
--   ⚠️ **ولا يُشغَّل هذا السطرُ إلا إن رُدَّ في معاملةٍ تُلغى.**
