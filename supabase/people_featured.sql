-- ============================================================
--  ٨٥ — people_featured · «Featured Members» (D-270)
--  تُشغَّل بعد talk_spoiler.sql (84)
--
--  **طلبُ أحمد:** «ضِف بأوّل شي Featured Members»، **واختار محسوبين لا
--  مختارين بيده**: «الأكثر نشاطاً على المدى الطويل».
--
--  ================= ⚠️ وثمنٌ قِيل قبل الاختيار =================
--
--  **قيل له صراحةً إن هذا يكرّر وجوهَ «الأكثر مشاركة»** غالباً فيبدو
--  القسمان واحداً — **واختار.** **والقرارُ المرفوضُ يُقرأ بحجّته لا
--  بعنوانه** (D-224): حجّتُه أن الصدارةَ الطويلة شيءٌ آخر غير صدارةِ
--  أسبوع، **وهي كذلك فعلاً** — من تصدّر تسعين يوماً بنى عادةً، ومن
--  تصدّر سبتاً واحداً قد يكون مرّ.
--
--  ================= ولماذا دالّةٌ ثانية لا معاملٌ في الأولى =================
--
--  **`people_leaderboard` صارت أسبوعاً تقويميّاً يبدأ السبت** (D-265)،
--  **ولا طولَ فيها يُختار** — وقد أُسقط `p_days` عمداً يومَها.
--  **وإعادتُه لتخدم قسماً بمعنًى آخر تُرجع الكذبةَ التي أُسقطت**:
--  دالّةٌ اسمُها «لوحةُ الأسبوع» تُسأل عن تسعين يوماً.
--  **فنافذتان بمعنيين، دالّتان** — ولا تشترك الأقسامُ إلا حين تشترك
--  أسئلتُها (D-198 تُقرأ بحدّها في D-237).
--
--  **والشكلُ نفسُه بالضبط** (نفسُ الأعمدة العشرة) **كي يقرأها المكوّنُ
--  نفسُه**: `PeopleLeaderboard` بثلاثة أوضاع لا ثلاثةُ مكوّنات.
--  **و`prev_total` تعود صفراً** — لا «صاعدين» على مدى تسعين يوماً،
--  **والعمودُ يبقى ليبقى الشكلُ واحداً**، وهو أرخصُ من نوعٍ ثانٍ.
--
--  آمنةٌ للإعادة، ولا جدولَ ولا عمودَ ولا سياسةَ خامسة.
-- ============================================================

begin;

create or replace function public.people_featured(
  p_days  integer default 90,
  p_limit integer default 3
)
returns table (
  user_id     uuid,
  nickname    text,
  username    text,
  avatar_url  text,
  hide_name   boolean,
  posts       integer,
  reviews     integer,
  likes_in    integer,
  total       integer,
  prev_total  integer
)
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select now() - make_interval(days => least(greatest(coalesce(p_days, 90), 7), 365)) as t0
  ),
  --  **نفسُ حرّاس ٨١ حرفاً**: لا حسابَ نظامٍ ولا محظورَ ولا زائر
  people as (
    select p.id, p.nickname, p.username, p.avatar_url, coalesce(p.hide_name, false) as hide_name
    from public.profiles p
    where auth.uid() is not null
      and coalesce(p.is_system, false) = false
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
           or (b.blocker_id = p.id and b.blocked_id = auth.uid())
      )
  ),
  posts_now as (
    select r.user_id, count(*)::int c
    from public.title_posts r, bounds
    where r.kind is null and r.hidden = false and r.created_at >= bounds.t0
    group by r.user_id
  ),
  reviews_now as (
    select g.user_id, count(*)::int c
    from public.ratings g, bounds
    where g.review is not null and length(btrim(g.review)) > 0
      and g.updated_at >= bounds.t0
    group by g.user_id
  ),
  likes_now as (
    select l.review_user_id as user_id, count(*)::int c
    from public.review_likes l, bounds
    where l.created_at >= bounds.t0
    group by l.review_user_id
  )
  select
    pe.id,
    case when pe.hide_name then null else pe.nickname end,
    case when pe.hide_name then null else pe.username end,
    case when pe.hide_name then null else pe.avatar_url end,
    pe.hide_name,
    coalesce(pn.c, 0),
    coalesce(rn.c, 0),
    coalesce(ln.c, 0),
    coalesce(pn.c, 0) + coalesce(rn.c, 0) + coalesce(ln.c, 0),
    0
  from people pe
  left join posts_now   pn on pn.user_id = pe.id
  left join reviews_now rn on rn.user_id = pe.id
  left join likes_now   ln on ln.user_id = pe.id
  --  **ومن لا شيءَ له لا يُعرض**: صفرٌ في قسمٍ اسمُه «مميّزون» حشوٌ
  --  يفضح القسمَ نفسَه (D-181)
  where coalesce(pn.c,0) + coalesce(rn.c,0) + coalesce(ln.c,0) > 0
  order by (coalesce(pn.c,0) + coalesce(rn.c,0) + coalesce(ln.c,0)) desc,
           pe.id
  limit least(greatest(coalesce(p_limit, 3), 1), 20);
$$;

revoke all on function public.people_featured(integer, integer) from public;
grant execute on function public.people_featured(integer, integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname='people_featured')    as featured_overloads,
--   (select count(*)::int from pg_proc where proname in
--      ('people_leaderboard','people_top_review','people_watching',
--       'people_featured','people_to_follow'))                             as fns,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                          as open_policies;
--
--  **المتوقَّع:** `featured_overloads=1 | fns=5 | open_policies=4`.
--  ⚠️ **وتُشغَّل بدور `postgres` فتعود فارغةً** (`auth.uid()` فارغ) —
--  **وهذا صحيحٌ لا خطأ**، والحارسُ يعمل.
