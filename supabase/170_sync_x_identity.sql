-- ============================================================
-- 170 — القاعدةُ تشتقّ معرّفَ X بنفسها (🔴 D-839، إصلاحُ عطلٍ حيّ)
-- ============================================================
-- 🔴 **العطلُ كما وقع**: أحمد أعطى الصلاحيّةَ في X فنجح الربطُ فعلاً
-- (صفُّ الهويّة موجودٌ في `auth.identities`) — **ثمّ فشلت الكتابة**:
-- `permission denied for table profiles` (مقروءٌ من `runtime_errors`،
-- وهو السجلُّ الذي وُلد في D-668 لهذا بالضبط).
--
-- 📏 **والسببُ مقيس**: `authenticated` تملك UPDATE على **٢٦ عموداً
-- مسمّى** في `profiles` — **والعمودُ الجديدُ `x_verified_at` ليس منها**
-- (الهجرة ١٦٩ أنشأت العمودَ ولم تمنحه). 🔑 **ومنحُ العمود لا يجوز**:
-- **`socials` ممنوحةٌ للمستخدم أصلاً** — **فلو مُنح `x_verified_at`
-- لاستطاع أيُّ عضوٍ أن يكتب معرّفاً ويوقّت توثيقَه بنداءٍ مباشرٍ على
-- PostgREST** — **شارةُ توثيقٍ تُزوَّر في سطر.**
--
-- 🔑 **فالعلاجُ أن يشتقَّ الخادمُ المعرّفَ ولا يستقبله**: دالّةُ
-- `definer` تقرأ `auth.identities` بنفسها وتكتب — **والعميلُ لا يمرّر
-- شيئاً أصلاً**، **فلا مُدخَلَ يُزوَّر.** **وهي أمتنُ من الشيفرة التي
-- استبدلتها**: تلك كانت تقرأ الهويّةَ في العميل-الخادم ثمّ تكتب،
-- **وهذه تقرأ وتكتب في المعاملة نفسِها ولا شيءَ بينهما.**
--
-- 🔑 **ودالّةٌ واحدةٌ للاتّجاهين** (D-238): **وجدت الهويّةُ فتوثيق،
-- وغابت فمحو** — **ودالّتان لفعلٍ واحدٍ باتّجاهيه تفترقان.**
-- **فالربطُ يناديها بعد العودة، وفكُّ الربط يناديها بعد الفكّ.**
--
-- ⚠️ **والمصفاةُ مكرَّرةٌ هنا عمداً** (`^[A-Za-z0-9_]{1,15}$`): **هي
-- مصفاةُ `cleanHandle` نفسُها** — **وحارسٌ في الشيفرة وحدَها لا يحرس
-- دالّةً تُنادى مباشرةً** (D-177: الكاتبُ هو الحارس).
-- ============================================================

create or replace function public.sync_x_identity()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  h   text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;

  /* **المفتاحُ `x` هو OAuth 2.0** — و`twitter` هو المهجور (D-839) */
  select coalesce(
           i.identity_data->>'user_name',
           i.identity_data->>'preferred_username',
           i.identity_data->>'screen_name'
         )
    into h
    from auth.identities i
   where i.user_id = uid and i.provider = 'x'
   order by i.created_at
   limit 1;

  /* **ما لا يطابق مصفاةَ X ليس معرّفاً** — والغائبُ أصدقُ من الكاذب */
  if h is not null and h !~ '^[A-Za-z0-9_]{1,15}$' then
    h := null;
  end if;

  if h is null then
    update public.profiles p
       set socials       = coalesce(p.socials, '{}'::jsonb) - 'x',
           x_verified_at = null,
           updated_at    = now()
     where p.id = uid;
    return null;
  end if;

  update public.profiles p
     set socials       = coalesce(p.socials, '{}'::jsonb) || jsonb_build_object('x', h),
         x_verified_at = now(),
         updated_at    = now()
   where p.id = uid;

  return h;
end;
$$;

-- **ودرسُ D-824/D-838 مطبَّقاً من أوّل سطر**: Supabase تمنح `anon`
-- و`authenticated` تنفيذَ كلِّ دالّةٍ جديدة — **فيُلغى ما لا يلزم صراحةً.**
revoke all on function public.sync_x_identity() from public;
revoke execute on function public.sync_x_identity() from anon;
grant execute on function public.sync_x_identity() to authenticated, service_role, postgres;

-- ============================================================
-- فحصُ صحّةٍ بعد التنفيذ:
--   select proname, proacl from pg_proc where proname='sync_x_identity';
--     -- authenticated و service_role و postgres، وبلا anon
--   select count(*) from information_schema.column_privileges
--    where table_schema='public' and table_name='profiles'
--      and grantee='authenticated' and privilege_type='UPDATE';   -- ٢٦ كما هي
--   select count(*) from pg_policies where schemaname='public'
--     and (qual='true' or qual is null) and cmd='SELECT';         -- ٥ كما هي
-- ============================================================
