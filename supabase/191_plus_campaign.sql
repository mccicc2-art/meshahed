-- ============================================================
--  191 — حملةُ Plus: من دخل خلال نافذةٍ زمنيّة يُمنح شهراً (D-1001)
--  ١٦ سبتمبر ٢٠٢٦ — قرارُ أحمد: «أيّ شخص يدخل لوبز خلال الشهر الحالي
--  أعطِه اشتراك شهر مجّاني»، وبخيارِه «قاعدةٌ دائمة في الكود» لا تشغيلاً
--  يدويّاً يتكرّر.
--
--  🔑 **في القاعدة لا في التطبيق**: المنحُ يقع عند تسجيل الدخول نفسِه
--  (`auth.users.last_sign_in_at`) فيشمل الويبَ والتطبيقَ معاً بلا نسخةٍ
--  ثانيةٍ من الشرط (D-920)، ويشمل من يدخل لأوّل مرّة ومن يعود.
--
--  🔑 **سجلٌّ يمنع التكرار**: `plus_campaign_grants` صفٌّ واحد لكلِّ
--  (مستخدم، حملة) — فالدخولُ عشر مرّات في الشهر منحةٌ واحدة.
--
--  ⚖️ **لا يُنقص أحداً**: من كان Plus أو شريكاً تُمدَّد مهلتُه من نهايتها
--  (`greatest(plus_until, now())`)، والشريكُ تبقى خطّتُه شريكاً.
-- ============================================================

create table if not exists public.plus_campaigns (
  slug        text primary key,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  -- طولُ المنحة بصيغة فاصلٍ زمنيّ («1 mon»)
  grant_span  interval    not null default '1 mon',
  note        text
);

create table if not exists public.plus_campaign_grants (
  user_id     uuid not null references auth.users(id) on delete cascade,
  slug        text not null references public.plus_campaigns(slug) on delete cascade,
  granted_at  timestamptz not null default now(),
  primary key (user_id, slug)
);

alter table public.plus_campaigns       enable row level security;
alter table public.plus_campaign_grants enable row level security;
-- لا سياسةَ قراءةٍ للعموم: الجداولُ إداريّةٌ تُقرأ بمفتاح الخدمة وحدَه.

create or replace function public.apply_plus_campaigns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  c record;
begin
  /* دخولٌ جديدٌ فقط — لا كلُّ تحديثٍ لصفّ المستخدم */
  if new.last_sign_in_at is null
     or (old.last_sign_in_at is not distinct from new.last_sign_in_at) then
    return new;
  end if;

  for c in
    select pc.slug, pc.grant_span
    from public.plus_campaigns pc
    where new.last_sign_in_at between pc.starts_at and pc.ends_at
      and not exists (
        select 1 from public.plus_campaign_grants g
        where g.user_id = new.id and g.slug = pc.slug
      )
  loop
    update public.profiles p
       set plan = case when p.plan = 'partner' then p.plan else 'plus' end,
           plus_until = greatest(coalesce(p.plus_until, now()), now()) + c.grant_span
     where p.id = new.id;

    insert into public.plus_campaign_grants (user_id, slug)
    values (new.id, c.slug)
    on conflict do nothing;
  end loop;

  return new;
end;
$$;

drop trigger if exists on_auth_user_signed_in on auth.users;
create trigger on_auth_user_signed_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.apply_plus_campaigns();

/* الحملةُ الأولى — سبتمبر ٢٠٢٦ بتوقيت السعوديّة (+03) */
insert into public.plus_campaigns (slug, starts_at, ends_at, grant_span, note)
values (
  'sept-2026',
  '2026-09-01T00:00:00+03',
  '2026-10-01T00:00:00+03',
  '1 mon',
  'من دخل لوبز خلال سبتمبر ٢٠٢٦ — بقرار أحمد ١٦ سبتمبر'
)
on conflict (slug) do nothing;

/* مُنح يدويّاً قبل الحملة (١٦ سبتمبر) — يُسجَّل كي لا يُمنح مرّتين */
insert into public.plus_campaign_grants (user_id, slug)
values ('0e5e8547-b580-412c-95c6-a2008c29114c', 'sept-2026')
on conflict do nothing;

/* من دخل هذا الشهر قبل هذه الهجرة يُمنح مرّةً واحدةً بأثرٍ رجعيّ */
with eligible as (
  select u.id
  from auth.users u
  join public.plus_campaigns c on c.slug = 'sept-2026'
  where u.last_sign_in_at between c.starts_at and c.ends_at
    and not exists (
      select 1 from public.plus_campaign_grants g
      where g.user_id = u.id and g.slug = 'sept-2026'
    )
),
upd as (
  update public.profiles p
     set plan = case when p.plan = 'partner' then p.plan else 'plus' end,
         plus_until = greatest(coalesce(p.plus_until, now()), now()) + interval '1 mon'
   where p.id in (select id from eligible)
  returning p.id
)
insert into public.plus_campaign_grants (user_id, slug)
select id, 'sept-2026' from upd
on conflict do nothing;
