-- ============================================================
--  ٩٩ — global_room_pins · **تثبيتٌ إداريٌّ يراه الجميع** (D-314)
--  تُشغَّل بعد ratings_backdrop.sql (98)
--
--  الميزةُ الثانية المؤجَّلة من D-301 («التثبيتُ لك أنت وحدك، والتثبيتُ
--  الإداريُّ ميزةٌ ثانية بحارسٍ ثانٍ») — وأذن أحمد («نفّذ كل شي»).
--
--  ================= من هو «الإدارة»؟ =================
--
--  **`is_admin` عمودٌ جديدٌ في `profiles`** — لا `is_system`:
--  حسابُ Loopz النظاميُّ محجوزٌ في القاعدة **ولا أحدَ يدخل به**
--  (D-252)، **وحارسٌ لا يحمله بابٌ حيٌّ ليس حارساً بل قفلٌ ضائع
--  مفتاحُه.** ويُضبط لحسابَي أحمد بالبريد — **والدالّةُ تقبل
--  الاثنين** (`is_admin or is_system`) فلو دخل يومٌ بحساب النظام
--  عمل الزرُّ أيضاً.
--
--  ================= ولا سياسةَ قراءةٍ خامسة =================
--
--  الجدولُ RLS بلا سياساتٍ إطلاقاً — **بابا القراءة والكتابة دالّتا
--  `definer`** (نمطُ ٩٤): سياسةُ قراءةٍ عامّة كانت ستكسر ثابتَ
--  «أربع سياسات مفتوحة» (D-013) لأجل صفوفٍ تُعدّ على أصابع اليد.
--
--  ⚠️ وفيها قراءةٌ من `auth.users` (بريدُ أحمد → معرّفه) — قراءةٌ
--  لا كتابة، وبإذن البند الصريح.
--
--  آمنةٌ للإعادة.
-- ============================================================

begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles
   set is_admin = true
 where id in (
   select id from auth.users
    where email in ('alharbiahmed3bd@gmail.com', 'mccicc2@gmail.com')
 );

create table if not exists public.title_room_global_pins (
  tmdb_id    integer     not null,
  media_type text        not null check (media_type in ('tv', 'movie')),
  created_at timestamptz not null default now(),
  primary key (tmdb_id, media_type)
);

alter table public.title_room_global_pins enable row level security;

--  ============ القراءة — للجميع المسجَّلين ============
create or replace function public.global_room_pins()
returns table (tmdb_id integer, media_type text)
language sql
stable
security definer
set search_path = public
as $$
  select g.tmdb_id, g.media_type
  from public.title_room_global_pins g
  where auth.uid() is not null;
$$;

revoke all on function public.global_room_pins() from public;
grant execute on function public.global_room_pins() to authenticated;

--  ============ «هل أنا إدارة؟» — سؤالُ زرٍّ واحد ============
create or replace function public.am_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (coalesce(p.is_admin, false) or coalesce(p.is_system, false))
  );
$$;

revoke all on function public.am_admin() from public;
grant execute on function public.am_admin() to authenticated;

--  ============ الكتابة — بحارسٍ في جسم الدالّة (D-011) ============
create or replace function public.set_global_room_pin(p_tmdb integer, p_media text, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (coalesce(p.is_admin, false) or coalesce(p.is_system, false))
  ) then
    raise exception 'forbidden';
  end if;
  if p_media not in ('tv', 'movie') then
    raise exception 'bad media type';
  end if;
  if p_on then
    insert into public.title_room_global_pins (tmdb_id, media_type)
    values (p_tmdb, p_media)
    on conflict do nothing;
  else
    delete from public.title_room_global_pins
    where tmdb_id = p_tmdb and media_type = p_media;
  end if;
end;
$$;

revoke all on function public.set_global_room_pin(integer, text, boolean) from public;
grant execute on function public.set_global_room_pin(integer, text, boolean) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — صفٌّ واحدٌ مجمّع (D-247)
-- ============================================================
-- select
--   (select count(*)::int from information_schema.columns
--      where table_schema='public' and table_name='profiles'
--        and column_name='is_admin')                                       as col,
--   (select count(*)::int from public.profiles where is_admin)             as admins,
--   (select count(*)::int from information_schema.tables
--      where table_schema='public' and table_name='title_room_global_pins') as tbl,
--   (select count(*)::int from pg_proc
--      where proname in ('global_room_pins','am_admin','set_global_room_pin')) as fns,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and tablename='title_room_global_pins')   as pin_policies,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                          as open_policies;
--
--  **المتوقَّع:** `col=1 | admins>=1 | tbl=1 | fns=3 | pin_policies=0 |
--  open_policies=4`. **ولو عاد `admins=0` فالبريدان ليسا بريدَ دخول
--  التطبيق — يُسأل أحمد ولا يُخمَّن.**
