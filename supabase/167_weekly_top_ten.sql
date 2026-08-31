-- ============================================================
-- 167 — الشارةُ لا تختفي، والمراتبُ عشرٌ لا ثلاث (D-838)
-- ============================================================
-- **حكمُ أحمد**: «الشارة لا تختفي، يمكن جنبها عدد المرات الي حصل
-- عليها رقم فقط · وإذا ضغط عليها تطلع قائمة بالأسابيع الي حقق فيها
-- مركز · لو مركز متأخر، أهم شي من التوب ١٠ فقط».
--
-- ⚖️ **وهذا يوسّع D-835 ولا ينقضها**: الجدولُ كان **سجلّاً** منذ يومه
-- الأوّل (صفٌّ لكلِّ أسبوعٍ ومرتبة) — **والذي كان يختفي هو القراءةُ لا
-- البيانات**: `weekly_top_now` تُرجع آخرَ أسبوعٍ وحدَه.
--
-- 🔑 **والجائزةُ لم تتغيّر**: **٣٠ · ١٤ · ٧ للأوائل الثلاثة بنصِّ
-- حكمه**، **و٤ → ١٠ تُسجَّل وتُعرض ولا تُصرف بها أيّام** (D-217:
-- **لا يُوعد بما لم يُقَل**). ولذلك `days = 0` لهم، **وتحديثُ المدّة
-- مشروطٌ بـ`t.days > 0`**:
-- ⚠️ **ولولا الشرطُ لكانت `make_interval(days => 0)` تكتب `plan='plus'`
-- لحسابٍ مجّانيٍّ وتنتهي مدّتُه في اللحظة نفسِها** — **اشتراكٌ يُمنح
-- ويُسحب في السطر الواحد.**
-- ============================================================

-- ============================================================
-- ١) المرتبةُ حتّى العاشرة
-- ============================================================
-- **والاسمُ اسمُ القيد التلقائيّ** (`<جدول>_<عمود>_check`) — يُسقط
-- ويُعاد، **ولا صفَّ قائماً يخالفه** (الجدولُ فارغٌ ولم يُصرف أسبوعٌ بعد).
alter table public.weekly_top drop constraint if exists weekly_top_rank_check;
alter table public.weekly_top
  add constraint weekly_top_rank_check check (rank between 1 and 10);

-- ============================================================
-- ٢) المنحُ — عشرةُ صفوفٍ، وثلاثةُ جوائز
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
  top10 as (
    select user_id, total,
           row_number() over (order by total desc, user_id) as rk
      from tally
     where total > 0
     limit 10
  )
  insert into public.weekly_top (week_start, rank, user_id, total, days)
  select w_start, rk::smallint, user_id, total,
         /* ٣٠ · ١٤ · ٧ بنصِّ حكمه — **وما بعد الثالث سجلٌّ لا جائزة** */
         case rk when 1 then 30 when 2 then 14 when 3 then 7 else 0 end
    from top10;

  get diagnostics n = row_count;

  update public.profiles p
     set plan = case when p.plan = 'free' then 'plus' else p.plan end,
         plus_until = case
           when p.plus_until is null and p.plan <> 'free' then null
           else greatest(coalesce(p.plus_until, now()), now())
                + make_interval(days => t.days)
         end
    from public.weekly_top t
   where t.week_start = w_start and t.user_id = p.id
     /* 🔴 **الشرطُ يحرس المراتبَ من الرابعة إلى العاشرة** (أعلاه) */
     and t.days > 0;

  return n;
end;
$$;

revoke all on function public.award_weekly_top() from public;
revoke execute on function public.award_weekly_top() from anon;
-- 🔴 **و`authenticated` أيضاً — ثغرةٌ من الهجرة ١٦٦ تُسدّ هنا.**
-- **درسُ D-824 لم يُطبَّق كاملاً يومَها**: Supabase تمنح `anon`
-- **و`authenticated`** تنفيذَ كلِّ دالّةٍ جديدةٍ بـ`alter default
-- privileges` — **و`revoke … from public` لا تمسّ أيّاً منهما**،
-- **فبقيت دالّةٌ تصرف أيّامَ اشتراكٍ قابلةً للنداء من أيِّ حسابٍ
-- مسجَّل** عبر PostgREST. **ولا تُستغلّ لأيّامٍ زائدة** (مفتاحُها
-- الأوّليُّ يمنع التكرار، والأسبوعُ منقضٍ) — **لكنّ دالّةَ منحٍ
-- مفتوحةً للعملاء عطلٌ يُسدّ لا يُبرَّر.**
revoke execute on function public.award_weekly_top() from authenticated;
grant execute on function public.award_weekly_top() to postgres, service_role;

-- ============================================================
-- ٣) القراءة — **سجلُّ حسابٍ واحدٍ كاملاً، لا أسبوعٌ واحدٌ لكلِّ الناس**
-- ============================================================
-- **وهي التي تجعل الشارةَ لا تختفي**: الشارةُ تُرسم من عدد الصفوف،
-- والورقةُ من الصفوف نفسِها.
-- ⚠️ **والسقفُ ستّون أسبوعاً** — **أكثرُ من سنةٍ من المراتب** —
-- **وقائمةٌ بلا سقفٍ تكبر مع عمر الحساب حتّى تصير ورقةً لا تُقرأ.**
-- ⚠️ **ومفتوحةٌ للزائر**: الشارةُ على صفحةٍ عامّة (D-627)، **ولا يخرج
-- منها إلا مرتبةٌ وتاريخُ أسبوع** — لا محتوى.
create or replace function public.weekly_top_of(uid uuid)
returns table (week_start date, rank smallint, total integer)
language sql
stable
security definer
set search_path = public
as $$
  select t.week_start, t.rank, t.total
    from public.weekly_top t
   where t.user_id = uid
   order by t.week_start desc
   limit 60;
$$;

revoke all on function public.weekly_top_of(uuid) from public;
grant execute on function public.weekly_top_of(uuid)
  to postgres, anon, authenticated, service_role;

-- ============================================================
-- فحصُ صحّةٍ بعد التنفيذ:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.weekly_top'::regclass;      -- 1..10
--   select proname, proacl from pg_proc
--    where proname in ('award_weekly_top','weekly_top_of');
--   select count(*) from pg_policies where schemaname='public'
--     and (qual='true' or qual is null) and cmd='SELECT';        -- ٥ كما هي
-- ============================================================
