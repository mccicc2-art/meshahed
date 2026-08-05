-- ============================================================
--  Meshahed — الطبقة الاجتماعية: إخفاء الاسم + زوّار الملف الشخصي
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  ملاحظة أمنية: دوال search_people و following_activity و title_reviews
--  و profile_view_count كانت هنا بنسخ قديمة تكشف الاسم المخفي وتقرأ
--  بسياسات مفتوحة — نسخها الوحيدة الآن في security.sql / security2.sql،
--  وحُذفت من هنا حتى لا يعيد تشغيلُ هذا الملف تعريفَها القديم.
-- ============================================================

-- ---------- خيار إخفاء الاسم في التقييمات ----------
alter table public.profiles
  add column if not exists hide_name boolean not null default false;

-- ---------- زوّار الملف الشخصي ----------
-- صف واحد لكل (صاحب الملف، الزائر، اليوم) — فالعدّاد «زوّار فريدون»
-- لا «عدد فتحات»، وإعادة تحميل الصفحة لا تضخّم الرقم.
create table if not exists public.profile_views (
  profile_id uuid not null references auth.users (id) on delete cascade,
  viewer_id  uuid not null references auth.users (id) on delete cascade,
  day        date not null default current_date,
  primary key (profile_id, viewer_id, day)
);

alter table public.profile_views enable row level security;

-- لا سياسة قراءة: الصفوف الخام (من زار من) سرّية، والعدد يخرج من دالة
-- definer في security.sql. التسجيل باسم الزائر نفسه فقط.
drop policy if exists "read view counts" on public.profile_views;

drop policy if exists "record own visit" on public.profile_views;
create policy "record own visit" on public.profile_views
  for insert to authenticated with check (auth.uid() = viewer_id);

create index if not exists profile_views_profile_idx
  on public.profile_views (profile_id);

-- تسجيل زيارة: يتجاهل زيارة الشخص لصفحته، ويتجاهل التكرار في نفس اليوم
create or replace function public.record_profile_view(target uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() = target then
    return;
  end if;
  insert into public.profile_views (profile_id, viewer_id)
  values (target, auth.uid())
  on conflict do nothing;
end;
$$;

revoke all on function public.record_profile_view(uuid) from public;
grant execute on function public.record_profile_view(uuid) to authenticated;
