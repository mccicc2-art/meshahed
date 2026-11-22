-- ============================================================
--  ٢٦١ — for_you_v2 · **«تناسبك» يتجدّد ولا يكرّر** (T517)
--
--  بلاغُ أحمد (٢٢ نوفمبر ٢٠٢٦): «ليست فور يو فيه ثلاث مثبتينها، الباقي ليش ثابتة؟
--  فيها اثنين سبايدر مان … ليه ما تتجدد؟»، ثمّ «١أ» (البنودُ الثلاثة) و«المستخدم
--  الجديد برضوا لا تكرر عنده وممكن ترشح له من اذواق اشخاص تابعهم»، ثمّ «نفذ».
--
--  **ما قِيس قبل التغيير** (حسابُ أحمد، سبعةُ أيّام): ٢٦ قائمةً مرشّحةً فقط، وثلاثُ
--  قوائم سبايدر-مان بين الخمس الأولى كلَّ يوم. والأسباب أربعة:
--   ١. الدرجةُ تكافئ ما شاهده القارئ من القائمة لا ما بقي له: «spider-man» شاهد
--      ٧ من ٩ فكانت الأعلى، ولم يبقَ له فيها إلّا عملان.
--   ٢. لا منعَ لتكرار الموضوع.
--   ٣. عشوائيّةُ اليوم (×٠٫٥–١٫٥) أضعفُ من فروق الدرجة (≈×٣) فالأولى تبقى أولى.
--   ٤. وعند ١٢٢ من ١٦٨ حساباً مكتبةٌ أقلُّ من ١٠ أعمال: لا يكاد يجد قائمتين تطابقانه.
--
--  **والوصفةُ الجديدة**:
--   - **يسقط ما شاهد ٨٠٪ منه فأكثر**، والدرجةُ تُضرب في نسبة ما بقي.
--   - **ثلاثةُ مصادر بالترتيب** تملأ بِركةً من أربعين: ذوقُه هو · ثمّ من يتابعهم
--     (ما أنشؤوه أو حفظوه أو أعجبهم، وما يشبه مكتباتِهم) · ثمّ الأكثرُ حفظاً
--     وإعجاباً في لوبز — **فالحسابُ الفارغ يجد رفّاً من أوّل يوم**.
--   - **قائمةٌ واحدةٌ لكلِّ موضوع**: قائمتان تشتركان في ٤٠٪ من أصغرهما تبقى أعلاهما
--     وزناً. **وقوائمُ الأحداث (`…-road`) لا تُقصي غيرَها**: تُثبَّت في الكود على حدة،
--     و«طريقك إلى Doomsday» كانت تُخرج «عالم مارفل».
--   - **قرعةٌ موزونةٌ كلَّ يوم** (Efraimidis–Spirakis): مفتاحُ كلِّ قائمة
--     −ln(u)/الوزن، و`u` من md5(القائمة · القارئ · يوم الرياض) — ثابتٌ طولَ اليوم
--     ويتبدّل غداً. والوزنُ ٣/٢/١ للمصادر × (٠٫٥ + ٠٫٥ × الدرجة/أعلى درجةٍ في مصدرها).
--   - ولا يُقترح ما حفظه القارئ ولا ما أنشأه، ولا قائمةُ من بينهما حظرٌ في أيِّ اتّجاه،
--     ولا قائمةٌ خاصّة.
--
--  **والتوقيعُ والأعمدةُ كما هي** فلا يتغيّر في الكود شيء (`getForYouLists`)، و`create or
--  replace` يُبقي صلاحيّاتِ التنفيذ. و`saves` يحمل عددَ ما شاهده القارئ منها كما كان.
--
--  ⚠️ DDL على الإنتاج: يشغّلها أحمد بيده (19_Tools_And_Access §SQL). جُرّبت أوّلاً على
--  مشروع المعاينة، ومُحاكاتُها على الإنتاج قراءةً فقط قبل التشغيل.
-- ============================================================

create or replace function public.for_you_lists(p_limit integer default 12)
returns table(list_id uuid, name text, owner_id uuid, nickname text, username text, avatar_url text, hide_name boolean, saves integer, posters text[])
language sql
stable security definer
set search_path to 'public'
as $function$
  with me as (
    select auth.uid() as uid
  ),
  mine as (
    select f.tmdb_id, f.media_type, (f.added_at > now() - interval '14 days') as recent
    from public.follows f, me
    where me.uid is not null and f.user_id = me.uid
  ),
  /* ما يجوز عرضُه أصلاً: عامّةٌ، ليست له، لم يحفظها، ولا حظرَ بينه وبين صاحبها */
  eligible as (
    select l.id, l.source_slug
    from public.user_lists l, me
    where me.uid is not null
      and l.is_public
      and l.user_id <> me.uid
      and not exists (select 1 from public.list_saves s where s.user_id = me.uid and s.list_id = l.id)
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = me.uid and b.blocked_id = l.user_id)
           or (b.blocker_id = l.user_id and b.blocked_id = me.uid)
      )
  ),
  sized as (
    select e.id, e.source_slug, count(*)::int as size
    from eligible e
    join public.user_list_items i on i.list_id = e.id
    group by e.id, e.source_slug
    having count(*) >= 2
  ),
  seen as (
    select i.list_id, count(*)::int as matched, count(*) filter (where m.recent)::int as recent
    from public.user_list_items i
    join mine m on m.tmdb_id = i.tmdb_id and m.media_type = i.media_type
    group by i.list_id
  ),
  /* ١ — **ما شاهد ٨٠٪ منه فأكثر لا يُقترح**: لم يبقَ له فيه ما يكتشفه */
  base as (
    select z.id, z.source_slug, z.size, coalesce(s.matched, 0) as matched, coalesce(s.recent, 0) as recent
    from sized z
    left join seen s on s.list_id = z.id
    where coalesce(s.matched, 0)::numeric / z.size < 0.8
  ),
  /* المصدر الأوّل — ذوقُه: الدرجةُ القديمة مضروبةً في نسبة ما بقي */
  t1 as (
    select b.id, 1 as tier,
           ((b.matched + 2 * b.recent)::numeric / (b.size + 20)) * (1 - b.matched::numeric / b.size) as score
    from base b
    where b.matched >= 2
  ),
  /* المصدر الثاني — من يتابعهم: ما أنشؤوه (وزنُ ٢) أو حفظوه أو أعجبهم (١)، وما يشبه مكتباتِهم */
  fol as (
    select uf.following_id as uid
    from public.user_follows uf, me
    where uf.follower_id = me.uid
  ),
  touch as (
    select l.id as list_id, 2 as w, l.user_id as who from public.user_lists l join fol on fol.uid = l.user_id
    union all
    select s.list_id, 1, s.user_id from public.list_saves s join fol on fol.uid = s.user_id
    union all
    select k.list_id, 1, k.user_id from public.list_likes k join fol on fol.uid = k.user_id
  ),
  fol_lib as (
    select distinct f.tmdb_id, f.media_type
    from public.follows f join fol on fol.uid = f.user_id
  ),
  fol_match as (
    select i.list_id, count(*)::int as n
    from public.user_list_items i
    join fol_lib fl on fl.tmdb_id = i.tmdb_id and fl.media_type = i.media_type
    group by i.list_id
  ),
  t2 as (
    select b.id, 2 as tier,
           coalesce((select sum(t.w) from touch t where t.list_id = b.id), 0)::numeric
           + 3 * coalesce(fm.n, 0)::numeric / (b.size + 20) as score
    from base b
    left join fol_match fm on fm.list_id = b.id
    where not exists (select 1 from t1 where t1.id = b.id)
      and (exists (select 1 from touch t where t.list_id = b.id) or coalesce(fm.n, 0) >= 2)
  ),
  /* المصدر الثالث — الأكثرُ حفظاً وإعجاباً في لوبز، وقوائمُ لوبز نفسُها لا تغيب عنه */
  t3 as (
    select b.id, 3 as tier,
           ((select count(*) from public.list_saves s where s.list_id = b.id)
            + (select count(*) from public.list_likes k where k.list_id = b.id)
            + case when b.source_slug is not null then 1 else 0 end)::numeric as score
    from base b
    where not exists (select 1 from t1 where t1.id = b.id)
      and not exists (select 1 from t2 where t2.id = b.id)
      and b.size >= 3
  ),
  /* البِركة: أربعون بالترتيب — ذوقُه أوّلاً، ثمّ من يتابعهم، ثمّ الأكثر */
  ranked as (
    select x.*, row_number() over (order by x.tier, x.score desc, x.id) as pos
    from (select * from t1 union all select * from t2 union all select * from t3) x
  ),
  pool as (
    select r.id, r.tier, b.size, b.source_slug, b.matched,
           (case r.tier when 1 then 3 when 2 then 2 else 1 end)
           * (0.5 + 0.5 * r.score / nullif(max(r.score) over (partition by r.tier), 0)) as w
    from ranked r
    join base b on b.id = r.id
    where r.pos <= 40
  ),
  /* ٢ — **قائمةٌ واحدةٌ لكلِّ موضوع**: ٤٠٪ من أصغرهما مشتركٌ = تبقى الأثقل. قوائمُ الأحداث لا تُقصي */
  pool_items as (
    select p.id, i.tmdb_id, i.media_type
    from pool p
    join public.user_list_items i on i.list_id = p.id
  ),
  overlap as (
    select a.id as a, b.id as b, count(*)::int as n
    from pool_items a
    join pool_items b on b.tmdb_id = a.tmdb_id and b.media_type = a.media_type and b.id <> a.id
    group by a.id, b.id
  ),
  dropped as (
    select distinct o.a as id
    from overlap o
    join pool pa on pa.id = o.a
    join pool pb on pb.id = o.b
    where o.n >= 0.4 * least(pa.size, pb.size)
      and coalesce(pb.source_slug, '') not like '%-road'
      and (coalesce(pb.w, 0) > coalesce(pa.w, 0) or (coalesce(pb.w, 0) = coalesce(pa.w, 0) and pb.id > pa.id))
  ),
  /* ٣ — **قرعةُ اليوم الموزونة**: −ln(u)/الوزن، و`u` ثابتٌ للقارئ طولَ يوم الرياض */
  drawn as (
    select p.id, p.matched,
           -ln(((('x' || substr(md5(p.id::text || me.uid::text
                 || to_char(now() at time zone 'Asia/Riyadh', 'YYYY-MM-DD')), 1, 7))::bit(28)::int)::numeric + 1) / 268435457)
           / greatest(coalesce(p.w, 0.5), 0.01) as k
    from pool p, me
    where not exists (select 1 from dropped d where d.id = p.id)
  )
  select
    l.id,
    l.name,
    l.user_id,
    case when coalesce(pr.hide_name, false) then null else pr.nickname end,
    case when coalesce(pr.hide_name, false) then null else pr.username end,
    case when coalesce(pr.hide_name, false) then null else pr.avatar_url end,
    coalesce(pr.hide_name, false),
    d.matched,
    coalesce(
      (
        select array_agg(i.poster_path order by i.rowid)
        from (
          select i2.poster_path, row_number() over () as rowid
          from public.user_list_items i2
          where i2.list_id = l.id and i2.poster_path is not null
          limit 3
        ) i
      ),
      '{}'::text[]
    )
  from drawn d
  join public.user_lists l on l.id = d.id
  join public.profiles pr on pr.id = l.user_id
  order by d.k asc, l.id
  limit least(greatest(coalesce(p_limit, 12), 1), 30);
$function$;

-- ============================================================
--  فحصُ الصحّة بعد التشغيل (من جلسةٍ مسجَّلة لا من محرّر SQL — `auth.uid()` فارغٌ هناك):
--  «اكتشف ← القوائم ← تناسبك» يعرض قوائمَ مختلفةً عن أمس، ولا قائمتي سبايدر-مان معاً.
--  والتراجعُ: إعادةُ تشغيل تعريف الهجرة ٢٥٣ (`253_for_you_size_share.sql`).
-- ============================================================
