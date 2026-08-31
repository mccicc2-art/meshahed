-- ============================================================
-- 166 — أوائلُ الأسبوع الثلاثة، وجائزتُهم (D-835)
-- ============================================================
-- **حكمُ أحمد**: «أيقونة الأول والثاني والثالث في الناس، بحيث نشجّعهم
-- على النقاشات والتعليقات — ونعطي شهراً مجّاناً كلَّ أسبوع للأول،
-- والثاني ١٤ يوماً، والثالث ٧ أيّام. وتظهر أيقونة في نفس صفّ «عضو منذ».»
--
-- 🔑 **ولا مقياسَ ثانٍ للنشاط**: **`people_leaderboard` تعدّ منذ D-134
-- منشوراتِ الأسبوع + المراجعاتِ ذاتَ النصّ، وأسبوعُها يبدأ السبت
-- بتوقيت الرياض** — **وهذه تعدّ بالحدود نفسِها للأسبوع المنقضي**،
-- **ومقياسان للنشاط يفترقان عند أوّل تعديل** (D-145).
-- ⚠️ **والفرقُ الوحيدُ مقصود**: **لا ترشيحَ بالحظر هنا** — **الجائزةُ
-- حقيقةٌ في الجدول لا عرضٌ لقارئ**، **ولوحةٌ تختلف باختلاف من ينظر
-- إليها لا تصلح أن تُصرف بها أيّام.**
--
-- 🔑 **والجدولُ سجلٌّ لا حالة**: صفٌّ لكلِّ (أسبوع · مرتبة) — **فالماضي
-- يبقى مقروءاً، والجائزةُ تُمنح مرّةً واحدةً بمفتاحٍ أوّليٍّ يمنع
-- التكرار** (لا رايةَ في الشيفرة تُنسى).
--
-- ⚠️ **ولا سياسةَ قراءةٍ على الجدول**: **القراءةُ بدالّةِ definer**
-- (`weekly_top_now`) — **فالسياساتُ المفتوحةُ تبقى خمساً** كما هي في
-- الفحص الصحّيّ (`19` §٤).
-- ============================================================

create table if not exists public.weekly_top (
  week_start  date        not null,
  rank        smallint    not null check (rank between 1 and 3),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  total       integer     not null,
  days        integer     not null,
  awarded_at  timestamptz not null default now(),
  primary key (week_start, rank),
  unique (week_start, user_id)
);

alter table public.weekly_top enable row level security;
-- **بلا سياسةٍ عمداً**: لا قراءةَ مباشرةً ولا كتابةً من عميل.

-- ============================================================
-- ١) المنحُ — يُنادى يوميّاً ولا يعمل إلّا مرّةً في الأسبوع
-- ============================================================
create or replace function public.award_weekly_top()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  w_start date;
  w_end   timestamptz;
  w_begin timestamptz;
  n       integer := 0;
begin
  /* **بدايةُ الأسبوع الجاري** بحدود `people_leaderboard` نفسِها
     (السبت · الرياض)، **ثمّ نرجع أسبوعاً**: **الجائزةُ لأسبوعٍ انقضى
     لا لأسبوعٍ يجري** — **وسباقٌ يُصرف وهو قائمٌ يُصرف مرّتين.** */
  w_begin := (
    date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '2 days')
    - interval '2 days'
  ) at time zone 'Asia/Riyadh';
  w_end   := w_begin;
  w_begin := w_begin - interval '7 days';
  w_start := (w_begin at time zone 'Asia/Riyadh')::date;

  if exists (select 1 from public.weekly_top t where t.week_start = w_start) then
    return 0;
  end if;

  with posts_w as (
    select r.user_id, count(*)::int c
      from public.title_posts r
     where r.kind is null and r.hidden = false
       and r.created_at >= w_begin and r.created_at < w_end
     group by r.user_id
  ),
  reviews_w as (
    select g.user_id, count(*)::int c
      from public.ratings g
     where g.review is not null and length(btrim(g.review)) > 0
       and g.updated_at >= w_begin and g.updated_at < w_end
     group by g.user_id
  ),
  tally as (
    select p.id as user_id,
           (coalesce(pw.c, 0) + coalesce(rw.c, 0)) as total
      from public.profiles p
      left join posts_w   pw on pw.user_id = p.id
      left join reviews_w rw on rw.user_id = p.id
     where coalesce(p.is_system, false) = false
  ),
  top3 as (
    select user_id, total,
           row_number() over (order by total desc, user_id) as rk
      from tally
     where total > 0
     limit 3
  )
  insert into public.weekly_top (week_start, rank, user_id, total, days)
  select w_start, rk::smallint, user_id, total,
         /* ٣٠ · ١٤ · ٧ — **بنصِّ حكمه** */
         case rk when 1 then 30 when 2 then 14 else 7 end
    from top3;

  get diagnostics n = row_count;

  /* **والمدّةُ تُمدَّد بوصفة الإحالات نفسِها** (الهجرة ١٥٤):
     **من كان مشتركاً يُضاف إلى مدّته، ومن انتهت مدّتُه يبدأ من اليوم**
     — **وجمعُ أيّامٍ إلى ماضٍ يمنح صفراً.** */
  update public.profiles p
     set plan = case when p.plan = 'free' then 'plus' else p.plan end,
         plus_until = case
           when p.plus_until is null and p.plan <> 'free' then null
           else greatest(coalesce(p.plus_until, now()), now())
                + make_interval(days => t.days)
         end
    from public.weekly_top t
   where t.week_start = w_start and t.user_id = p.id;

  return n;
end;
$$;

revoke all on function public.award_weekly_top() from public;
revoke execute on function public.award_weekly_top() from anon;
grant execute on function public.award_weekly_top() to postgres, service_role;

-- ============================================================
-- ٢) القراءة — **آخرُ أسبوعٍ مُنح، وثلاثةُ صفوفٍ لا أكثر**
-- ⚠️ **ومفتوحةٌ للزائر**: الشارةُ تُرى على صفحةٍ عامّة (D-627).
-- ============================================================
create or replace function public.weekly_top_now()
returns table (user_id uuid, rank smallint, week_start date)
language sql
stable
security definer
set search_path = public
as $$
  select t.user_id, t.rank, t.week_start
    from public.weekly_top t
   where t.week_start = (select max(week_start) from public.weekly_top)
   order by t.rank;
$$;

revoke all on function public.weekly_top_now() from public;
grant execute on function public.weekly_top_now() to postgres, anon, authenticated, service_role;

-- ============================================================
-- فحصُ صحّةٍ بعد التنفيذ:
--   select * from public.weekly_top order by week_start desc, rank;
--   select count(*) from pg_policies where schemaname='public'
--     and (qual='true' or qual is null) and cmd='SELECT';        -- ٥ كما هي
--   select proname, proacl from pg_proc where proname in
--     ('award_weekly_top','weekly_top_now');   -- المنحُ بلا anon، والقراءةُ بها
-- ============================================================
