-- ============================================================
-- 130 — نشاطُ صاحبِ ملفٍّ أزوره · D-586
--
-- **طلبُ أحمد بلقطتين**: «الاكتيفتي حطّ فيه كامل الاكتيفتي، نفس طريقة
-- العرض الي بالمكتبة» — **وهو سدادُ الدَّين المعلَن في D-438 §12**:
-- «النشاطُ في الملفّ العامّ تقييماتٌ لا كلُّ فعل».
--
-- **ولماذا دالّةٌ جديدة**: `getMyActivity` تقرأ جداولَ «صفوفِ صاحبها
-- وحدَه» بأربعة استعلاماتٍ RLS — **تصلح لصاحبها ولا تصلح لملفِّ غيره.**
-- **و`following_activity_v2` تجيب سؤالاً آخر** («ماذا فعل من أتابعهم؟»)
-- مجمَّعةً باليوم ومرشَّحةً بالمتابعة. **وهذا سؤالٌ ثالث**: «ماذا فعل
-- صاحبُ هذا الملفّ؟» — **حدثاً حدثاً كما تعرضه شاشةُ `/activity`.**
--
-- **إضافةٌ خالصة**: لا `drop`، لا تعديلَ بيانات، لا سياسةَ جديدة —
-- **والبوّابةُ `can_view_profile` وحدها** (نمطُ ١٢٩/٥٩ حرفاً).
--
-- **وأربعةُ فروعٍ في `union all` واحد** (نداءٌ واحدٌ للصفحة — D-205):
--   • حلقاتٌ مُشاهدة — **والاسمُ والملصقُ من `follows` صاحبِها**
--     (جدولا المشاهدة لا يخزّنان اسماً).
--   • أفلامٌ مُشاهدة — كذلك.
--   • تقييماتٌ وآراء — **غيرُ المحجوبة وحدَها** (`not hidden`، عتبةُ
--     البلاغات من ٢٤) — **والرأيُ علَمٌ لا نصّ**: النصُّ له بابُه
--     المحروسُ في تبويب «مراجعات»، **وهذه الشاشةُ لا تعرضه فلا تدفعه.**
--   • إضافاتٌ لقوائم — **المعلنةُ للزائر، وكلُّها لصاحبها**
--     (`l.is_public or p_user = auth.uid()`): **إضافةٌ لقائمةٍ خاصّةٍ
--     سرُّ صاحبها** — وهي قاعدةُ `read public lists` نفسُها.
--
-- **وسقفٌ لكلِّ فرعٍ (٢٠٠) لا للمجموع** — حجّةُ `getMyActivity` حرفاً:
-- **من أشّر مئةَ حلقةٍ أمس لا يبتلع تقييماتِه.**
--
-- rollback: drop function if exists public.profile_activity(uuid);
-- ============================================================

create or replace function public.profile_activity(p_user uuid)
returns table (
  kind text,
  happened_at timestamptz,
  media_type text,
  tmdb_id integer,
  season integer,
  episode integer,
  rating smallint,
  has_review boolean,
  title text,
  poster_path text,
  list_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    (
      select 'watch'::text, e.watched_at, 'tv'::text, e.show_tmdb_id,
             e.season_number, e.episode_number,
             null::smallint, false, f.title, f.poster_path, null::text
      from public.watched_episodes e
      left join public.follows f
        on f.user_id = p_user and f.media_type = 'tv' and f.tmdb_id = e.show_tmdb_id
      where e.user_id = p_user
        and (auth.uid() = p_user or public.can_view_profile(p_user))
      order by e.watched_at desc
      limit 200
    )
    union all
    (
      select 'watch', m.watched_at, 'movie', m.movie_tmdb_id,
             null, null, null::smallint, false, f.title, f.poster_path, null
      from public.watched_movies m
      left join public.follows f
        on f.user_id = p_user and f.media_type = 'movie' and f.tmdb_id = m.movie_tmdb_id
      where m.user_id = p_user
        and (auth.uid() = p_user or public.can_view_profile(p_user))
      order by m.watched_at desc
      limit 200
    )
    union all
    (
      select case when nullif(btrim(coalesce(r.review, '')), '') is null
                  then 'rate' else 'review' end,
             coalesce(r.updated_at, r.created_at), r.media_type, r.tmdb_id,
             null, null, r.rating, nullif(btrim(coalesce(r.review, '')), '') is not null,
             r.title, r.poster_path, null
      from public.ratings r
      where r.user_id = p_user
        and not coalesce(r.hidden, false)
        and (r.rating is not null or nullif(btrim(coalesce(r.review, '')), '') is not null)
        and (auth.uid() = p_user or public.can_view_profile(p_user))
      order by coalesce(r.updated_at, r.created_at) desc
      limit 200
    )
    union all
    (
      select 'list', i.added_at, i.media_type, i.tmdb_id,
             null, null, null::smallint, false, i.title, i.poster_path, l.name
      from public.user_list_items i
      join public.user_lists l on l.id = i.list_id
      where l.user_id = p_user
        and (l.is_public or p_user = auth.uid())
        and (auth.uid() = p_user or public.can_view_profile(p_user))
      order by i.added_at desc
      limit 200
    )
  ) u
  order by 2 desc
$$;
revoke all on function public.profile_activity(uuid) from public;
grant execute on function public.profile_activity(uuid) to authenticated;

-- ============================================================
--  التحقّق بعد التشغيل
-- ============================================================
-- select proname from pg_proc where proname = 'profile_activity';   -- صفٌّ واحد
-- select count(*) from public.profile_activity(auth.uid());          -- رقمٌ لا خطأ
-- set local role anon; select count(*) from public.profile_activity('<uuid>');
--   -- ↑ صفر/رفض: الدالّةُ غيرُ ممنوحةٍ لـanon أصلاً
--
-- ⚠️ السياسات المفتوحة تبقى **أربعاً**: لا جدولَ ولا سياسة.
-- select tablename, policyname from pg_policies
--   where schemaname='public' and qual='true';
