-- ============================================================
--  Loopz — روابطُ المنصّات المباشرة (الهجرة ١٣٢ · D-608)
--  شغّله في Supabase → SQL Editor (الترتيب الكامل في README.md)
--
--  طلبُ أحمد: «الضغط على شعار المنصّة يؤدّي إلى العمل داخل المنصّة
--  نفسها، بدل تحويل المستخدم تلقائيًا إلى JustWatch».
--
--  ============ الشكلُ شكلُ `featured_lists` حرفاً (D-314) ============
--
--  **صفرُ سياسات** — القراءةُ العامّةُ بدالّة `definer` تُعيد الموثَّقَ
--  (`verified`) وحدَه، **والكتابةُ بدالّةٍ حارسُها `am_admin()` في جسمها
--  لا في الواجهة** (D-011/D-193). **والسياساتُ المفتوحةُ تبقى أربعاً.**
--
--  ⚠️ **والرابطُ https حصراً في القاعدة نفسِها** — قائمةُ النطاقات
--  الموثوقة لكلِّ منصّةٍ في التطبيق (`lib/providerLinks.ts`)، والقيدُ
--  هنا دفاعُ عمقٍ لا بديلُها.
--
--  ⚠️ **وجدولُ الأحداث بلا هويّة عمداً**: لا `user_id` ولا كوكي —
--  عدّاداتُ استخدامٍ لا تتبّعُ أشخاص.
-- ============================================================

begin;

create table if not exists public.provider_content_links (
  id              bigint generated always as identity primary key,
  tmdb_id         integer not null check (tmdb_id > 0),
  media_type      text    not null check (media_type in ('movie','tv')),
  -- معرّفُ المنصّة معرّفُ TMDB نفسُه — لا سجلَّ منصّاتٍ ثانٍ يُصان
  provider_id     integer not null check (provider_id > 0),
  country_code    text    not null check (country_code ~ '^[A-Z]{2}$'),
  destination_url text    not null check (
    destination_url like 'https://%' and length(destination_url) <= 600
  ),
  status          text    not null default 'pending'
                          check (status in ('verified','pending','disabled')),
  verified_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- عملٌ + نوعٌ + منصّةٌ + بلدٌ = صفٌّ واحد، والفهرسُ الفريدُ نفسُه
  -- يخدم استعلامَ الصفحة (يقود بـ tmdb_id, media_type)
  unique (tmdb_id, media_type, provider_id, country_code)
);

alter table public.provider_content_links enable row level security;

-- القارئُ العامّ: الموثَّقُ وحدَه، لعملٍ وبلدٍ بعينهما — نداءٌ واحدٌ
-- يعيد كلَّ منصّات الصفحة (لا N+1)
create or replace function public.provider_links_for(
  p_tmdb integer, p_media text, p_country text
)
returns table (provider_id integer, destination_url text)
language sql
stable
security definer
set search_path = public
as $$
  select l.provider_id, l.destination_url
  from public.provider_content_links l
  where l.tmdb_id = p_tmdb
    and l.media_type = p_media
    and l.country_code = upper(coalesce(p_country, 'SA'))
    and l.status = 'verified';
$$;

revoke all on function public.provider_links_for(integer, text, text) from public;
grant execute on function public.provider_links_for(integer, text, text) to anon, authenticated;

-- قارئُ الإدارة: كلُّ الحالات لعملٍ واحد — للوحة الروابط وحدها
create or replace function public.admin_provider_links(p_tmdb integer, p_media text)
returns table (
  provider_id integer, country_code text, destination_url text,
  status text, verified_at timestamptz, updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.am_admin() then
    raise exception 'forbidden';
  end if;
  return query
    select l.provider_id, l.country_code, l.destination_url,
           l.status, l.verified_at, l.updated_at
    from public.provider_content_links l
    where l.tmdb_id = p_tmdb and l.media_type = p_media
    order by l.country_code, l.provider_id;
end;
$$;

revoke all on function public.admin_provider_links(integer, text) from public;
grant execute on function public.admin_provider_links(integer, text) to authenticated;

-- كاتبُ الإدارة: إدراجٌ أو تحديثٌ على المفتاح الفريد — الحارسُ في الجسم
create or replace function public.admin_set_provider_link(
  p_tmdb integer, p_media text, p_provider integer,
  p_country text, p_url text, p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.am_admin() then
    raise exception 'forbidden';
  end if;
  if p_status not in ('verified','pending','disabled') then
    raise exception 'bad status';
  end if;

  insert into public.provider_content_links as l
    (tmdb_id, media_type, provider_id, country_code, destination_url, status, verified_at)
  values
    (p_tmdb, p_media, p_provider, upper(p_country), p_url, p_status,
     case when p_status = 'verified' then now() else null end)
  on conflict (tmdb_id, media_type, provider_id, country_code)
  do update set
    destination_url = excluded.destination_url,
    status          = excluded.status,
    verified_at     = case when excluded.status = 'verified' then now() else l.verified_at end,
    updated_at      = now();
end;
$$;

revoke all on function public.admin_set_provider_link(integer, text, integer, text, text, text) from public;
grant execute on function public.admin_set_provider_link(integer, text, integer, text, text, text) to authenticated;

-- ============ أحداثُ الاستخدام — أربعةُ أسماءٍ ولا شخص ============

create table if not exists public.provider_events (
  id           bigint generated always as identity primary key,
  event        text not null check (event in (
    'provider_open_direct','provider_open_search',
    'provider_open_justwatch','provider_link_missing'
  )),
  tmdb_id      integer not null,
  media_type   text not null check (media_type in ('movie','tv')),
  provider_id  integer not null,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  created_at   timestamptz not null default now()
);

alter table public.provider_events enable row level security;

create index if not exists provider_events_created_idx
  on public.provider_events (created_at);

-- المسجِّل: تحقّقٌ في الجسم، والصفُّ الفاسد يسقط صامتاً — تتبّعٌ لا
-- يُفشل ضغطةَ مستخدم
create or replace function public.log_provider_event(
  p_event text, p_tmdb integer, p_media text, p_provider integer, p_country text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.provider_events (event, tmdb_id, media_type, provider_id, country_code)
  select p_event, p_tmdb, p_media, p_provider, upper(p_country)
  where p_event in ('provider_open_direct','provider_open_search',
                    'provider_open_justwatch','provider_link_missing')
    and p_media in ('movie','tv')
    and p_tmdb between 1 and 100000000
    and p_provider between 1 and 1000000
    and p_country ~* '^[a-z]{2}$';
$$;

revoke all on function public.log_provider_event(text, integer, text, integer, text) from public;
grant execute on function public.log_provider_event(text, integer, text, integer, text) to anon, authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — صفٌّ واحدٌ مجمّع (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_tables
--      where tablename in ('provider_content_links','provider_events'))          as tbls,
--   (select count(*)::int from pg_policies
--      where tablename in ('provider_content_links','provider_events'))          as pol_here,
--   (select count(*)::int from pg_proc where proname in
--      ('provider_links_for','admin_provider_links',
--       'admin_set_provider_link','log_provider_event'))                          as fns,
--   (select count(*)::int from pg_policies where qual = 'true')                   as open_policies;
-- المتوقّع: tbls = 2 · pol_here = 0 · fns = 4 · open_policies = 4
