-- ============================================================
--  ٨٣ — people_page3 · اللوحةُ تُصفَّر كلَّ سبت (D-265)
--  تُشغَّل بعد people_page2.sql (82)
--
--  **طلبُ أحمد بنصّه: «خلها يتصفر كل سبت».**
--  **⚖️ وهذا نقضٌ صريحٌ لجوابه في D-264** («متدحرج: آخر ٧ أيام») —
--  **يُسجَّل ولا يُمحى** (قاعدةُ «الرفض جزء من القرار»).
--
--  ================= لماذا الأسبوعُ التقويميّ أصدق =================
--
--  **النافذةُ المتدحرجة تُجيب سؤالاً لم يسأله أحد**: «من كان الأنشط في
--  آخر ١٦٨ ساعة؟» — **ولا أحدَ يفكّر بالساعات.** والعنوانُ يقول «هذا
--  الأسبوع»، **وأسبوعٌ لا يبدأ ولا ينتهي ليس أسبوعاً.**
--  **وللفوز معنًى لأن له نهاية**: من تصدّر يوم الجمعة تصدّر أسبوعاً،
--  **ومن تصدّر نافذةً متدحرجة تصدّر لحظةً تزول عند منتصف الليل.**
--
--  ================= السبتُ لا الاثنين =================
--
--  `date_trunc('week', …)` في Postgres **تبدأ الاثنين** (ISO 8601).
--  **والحيلةُ إزاحةُ يومين ثم ردُّهما**: من أزاح الزمنَ يومين صار سبتُه
--  اثنيناً، فتُقصّ ثم تُعاد. **ولا دالّةَ مساعدة لهذا** — سطرٌ واحدٌ في
--  موضعٍ واحد.
--
--  ⚠️ **وبتوقيت الرياض لا UTC**: `now()` عند منتصف ليل السبت في الرياض
--  **ما تزال جمعةً في UTC بثلاث ساعات** — **فالتصفيرُ كان سيقع الساعة
--  الثالثة فجراً**. والمستخدمون هنا، **فالحدُّ حيث يعيشون** (D-216).
--
--  ================= والنافذةُ السابقة تُقصّ بالمثل =================
--
--  ⚠️ **وهذه أهمُّ سطرٍ في الملفّ.** «الصاعدون» يطرح النافذتين — **ولو
--  قُورن نصفُ أسبوعٍ جارٍ بأسبوعٍ كاملٍ ماضٍ لصار الفرقُ سالباً عند كلِّ
--  أحدٍ صباحَ السبت**، فيختفي القسمُ يومين من كلِّ سبعة **ويُقرأ عطلاً**
--  (D-181). **فالسابقةُ تُقصّ بمقدار ما مضى من الحالية بالضبط**:
--  سبتُ الظهر يُقارَن بسبتِ الأسبوع الماضي ظهراً. **مقارنةٌ بين متماثلين**
--  — وهي قاعدةُ D-216 نفسُها: **المقام من نفس القوم.**
--
--  ================= و`p_days` تسقط لأنها صارت تكذب =================
--
--  **المعاملُ كان يعني «طولَ النافذة»، ولم يعد للنافذة طولٌ يُختار** —
--  **ومعاملٌ يبقى بعد أن سقط معناه هو كيف تتراكم الفوضى** (D-257).
--  **وإسقاطُ معاملٍ توقيعٌ جديد** فتُحذف القديمةُ أوّلاً (D-037/D-264).
--
--  آمنةٌ للإعادة، ولا تُنشئ جدولاً ولا عموداً ولا سياسة.
-- ============================================================

begin;

drop function if exists public.people_leaderboard(integer, integer);

create or replace function public.people_leaderboard(p_limit integer default 20)
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
  with anchor as (
    select
      (
        date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '2 days')
        - interval '2 days'
      ) at time zone 'Asia/Riyadh' as t0
  ),
  bounds as (
    select
      t0,
      t0 - interval '7 days'                as t_prev,
      t0 - interval '7 days' + (now() - t0) as t_prev_end
    from anchor
  ),
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
  posts_prev as (
    select r.user_id, count(*)::int c
    from public.title_posts r, bounds
    where r.kind is null and r.hidden = false
      and r.created_at >= bounds.t_prev and r.created_at < bounds.t_prev_end
    group by r.user_id
  ),
  reviews_now as (
    select g.user_id, count(*)::int c
    from public.ratings g, bounds
    where g.review is not null and length(btrim(g.review)) > 0
      and g.updated_at >= bounds.t0
    group by g.user_id
  ),
  reviews_prev as (
    select g.user_id, count(*)::int c
    from public.ratings g, bounds
    where g.review is not null and length(btrim(g.review)) > 0
      and g.updated_at >= bounds.t_prev and g.updated_at < bounds.t_prev_end
    group by g.user_id
  ),
  likes_now as (
    select l.review_user_id as user_id, count(*)::int c
    from public.review_likes l, bounds
    where l.created_at >= bounds.t0
    group by l.review_user_id
  ),
  likes_prev as (
    select l.review_user_id as user_id, count(*)::int c
    from public.review_likes l, bounds
    where l.created_at >= bounds.t_prev and l.created_at < bounds.t_prev_end
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
    coalesce(pp.c, 0) + coalesce(rp.c, 0) + coalesce(lp.c, 0)
  from people pe
  left join posts_now    pn on pn.user_id = pe.id
  left join posts_prev   pp on pp.user_id = pe.id
  left join reviews_now  rn on rn.user_id = pe.id
  left join reviews_prev rp on rp.user_id = pe.id
  left join likes_now    ln on ln.user_id = pe.id
  left join likes_prev   lp on lp.user_id = pe.id
  where coalesce(pn.c,0) + coalesce(rn.c,0) + coalesce(ln.c,0)
      + coalesce(pp.c,0) + coalesce(rp.c,0) + coalesce(lp.c,0) > 0
  order by (coalesce(pn.c,0) + coalesce(rn.c,0) + coalesce(ln.c,0)) desc,
           (coalesce(pn.c,0) + coalesce(rn.c,0) + coalesce(ln.c,0))
         - (coalesce(pp.c,0) + coalesce(rp.c,0) + coalesce(lp.c,0)) desc
  limit least(greatest(coalesce(p_limit, 20), 1), 20);
$$;

revoke all on function public.people_leaderboard(integer) from public;
grant execute on function public.people_leaderboard(integer) to authenticated;

commit;

-- ============================================================
--  التحقّق بعد التشغيل — **صفٌّ واحدٌ مجمّع** (D-247)
-- ============================================================
-- select
--   (select count(*)::int from pg_proc where proname = 'people_leaderboard') as board_overloads,
--   (select count(*)::int from pg_proc where proname in
--      ('people_leaderboard','people_top_review','people_watching'))         as fns,
--   to_char(
--     (date_trunc('week', (now() at time zone 'Asia/Riyadh') + interval '2 days')
--      - interval '2 days'), 'YYYY-MM-DD Dy')                                as week_starts,
--   (select count(*)::int from pg_policies
--      where schemaname='public' and qual='true')                            as open_policies;
--
--  **المتوقَّع:** `board_overloads=1 | fns=3 | open_policies=4`
--  **و`week_starts` تاريخُ آخر سبتٍ مضى ومعه `Sat` حرفاً** — **وهو الفحصُ
--  الحقيقيّ هنا**: رقمٌ صحيحٌ بيومٍ خطأ يمرّ من كلِّ فحصٍ آخر.
--
--  ⚠️ **وتُشغَّل بدور `postgres` فتعود الصفوفُ فارغةً** (`auth.uid()` فارغ)
--  — **وهذا صحيحٌ لا خطأ**، والحارسُ يعمل.
