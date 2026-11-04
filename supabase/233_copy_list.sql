-- ============================================================
--  Loopz — نسخُ قائمةِ غيرك لتعدّلها (233)
--  شغّله في Supabase → SQL Editor — **قبل** نشر رقاقة «انسخها لقوائمي».
--
--  ⚖️ **النسخُ فعلٌ ثانٍ بجانب الحفظ، لا بدلَه** (أحمد ٤ نوفمبر ٢٠٢٦، البند ١ من ستّة):
--  ♥ الحفظ مرجعٌ حيٌّ يتبع صاحبَه (هجرة ٣٨ — «مرجع حي لا نسخة» قرارُه هو)،
--  والنسخةُ قائمةٌ مستقلّةٌ يملكها الناسخ، **لا يمسّها تعديلُ الأصل بعد يوم نسخها.**
--
--  قراراتُه: ١أ الذكيّةُ تنسخ شرطَها فتبقى ذكيّة · ٢أ «من قائمة @فلان» برابطٍ للأصل ·
--  ٣أ صاحبُ الأصل يُبلَّغ · ٤أ النسخةُ تبدأ خاصّة · ٥ب قوائمُ لوبز لا تُنسخ (حفظٌ فقط) ·
--  ٦أ مجانيّةٌ للجميع.
-- ============================================================

-- ---------- ١) مصدرُ النسخة ----------
-- `on delete set null`: حذفُ الأصل لا يحذف نسخةَ أحد — النسخةُ ملكُ صاحبها، ويسقط سطرُ المصدر وحدَه.
alter table public.user_lists
  add column if not exists copied_from uuid references public.user_lists (id) on delete set null;

-- جرسُ «نسخ قائمتك» يبحث عن نسخ قوائمي — وفهرسٌ جزئيٌّ لأن أغلب القوائم ليست نسخاً
create index if not exists user_lists_copied_from_idx
  on public.user_lists (copied_from, created_at desc)
  where copied_from is not null;

-- ---------- ٢) حارسُ المصدر ----------
-- سياسةُ «own lists» تسمح لصاحب الصفّ بكتابة أيِّ عمودٍ فيه — فبلا حارس يكتب أحدٌ `copied_from`
-- لقائمةٍ لم ينسخها فيرنّ جرسُ صاحبها بنسخٍ لم يقع. **وحدٌّ في الواجهة وحدَها ليس حدّاً** (D-302):
--  • عند الإدراج: المصدرُ معلنٌ، وليس لي، وليس من قوائم لوبز (٥ب).
--  • عند التعديل: لا يُعاد توجيهُه أبداً — يُمحى فقط (وهذا ما يفعله `on delete set null`).
create or replace function public.user_lists_copied_from_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.copied_from is distinct from old.copied_from and new.copied_from is not null then
      new.copied_from := old.copied_from;
    end if;
    return new;
  end if;
  if new.copied_from is not null and not exists (
    select 1 from public.user_lists s
     where s.id = new.copied_from
       and s.is_public
       and s.user_id <> new.user_id
       and s.source_slug is null
  ) then
    raise exception 'copy_source_invalid' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists user_lists_copied_from_guard on public.user_lists;
create trigger user_lists_copied_from_guard
  before insert or update of copied_from on public.user_lists
  for each row execute function public.user_lists_copied_from_guard();

-- ---------- ٣) النسخُ نفسُه — عمليّةٌ واحدة ----------
-- `security invoker`: تجري بصلاحيّة الناسخ فتمرّ بسياسات RLS نفسِها — يقرأ ما يقرؤه أيُّ زائر
-- (المعلنةَ وأعمالَها) ويكتب في قوائمه وحدَها. **لا `security definer` لأن لا شيءَ هنا يحتاج أكثرَ من صلاحيّته.**
-- وعمليّةٌ واحدةٌ لأن قائمةً تُنشأ ثمّ تفشل أعمالُها تترك قائمةً فارغةً باسم الأصل.
create or replace function public.copy_list(p_src uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  s public.user_lists;
  v_id uuid;
  v_n integer;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;

  select * into s from public.user_lists where id = p_src;
  if not found or not s.is_public then
    raise exception 'list_not_found' using errcode = 'P0002';
  end if;
  if s.user_id = v_uid then
    raise exception 'list_copy_own' using errcode = '22023';
  end if;
  if s.source_slug is not null then
    raise exception 'list_copy_curated' using errcode = '22023';
  end if;

  -- نسختي الموجودة تُعاد ولا تُكرَّر: ضغطتان لا تصنعان قائمتين باسمٍ واحد، ولا جرسين لصاحب الأصل
  select id into v_id from public.user_lists
   where user_id = v_uid and copied_from = s.id
   order by created_at desc
   limit 1;
  if v_id is not null then
    return v_id;
  end if;

  -- سقفُ `createList` نفسُه (٥٠) — النسخُ بابٌ ثانٍ إلى الجدول نفسِه، فلا يتجاوز حدَّ البابِ الأوّل
  select count(*) into v_n from public.user_lists where user_id = v_uid;
  if v_n >= 50 then
    raise exception 'list_copy_too_many' using errcode = '22023';
  end if;

  insert into public.user_lists (
    user_id, name, subtitle, kind, is_public,
    cover_tmdb_id, cover_media_type, cover_backdrop,
    rule, rule_source, copied_from
  ) values (
    v_uid, s.name, s.subtitle,
    -- «المفضّلة» قائمةٌ واحدةٌ لكلِّ عضو (فهرسٌ فريد) — نسختُها قائمةٌ عاديّة لا مفضّلةٌ ثانية
    case when s.kind = 'favorites' then 'regular' else s.kind end,
    false,                                         -- ٤أ: تبدأ خاصّة
    s.cover_tmdb_id, s.cover_media_type, s.cover_backdrop,
    s.rule, s.rule_source,                         -- ١أ: الذكيّةُ تنسخ شرطَها
    s.id
  )
  returning id into v_id;

  -- الترتيبُ وتاريخُ الإضافة كما في الأصل: «مرتّبة» و«ترتيبُ المشاهدة» معناهما في ترتيبهما
  insert into public.user_list_items (list_id, tmdb_id, media_type, title, poster_path, sort_order, added_at)
  select v_id, i.tmdb_id, i.media_type, i.title, i.poster_path, i.sort_order, i.added_at
    from public.user_list_items i
   where i.list_id = s.id;

  return v_id;
end;
$$;

revoke all on function public.copy_list(uuid) from public, anon;
grant execute on function public.copy_list(uuid) to authenticated;

-- ---------- ٤) الجرس: «نسخ فلانٌ قائمتك» (٣أ) ----------
-- الدالّةُ كما هي على الإنتاج حرفاً (قُرئت ٤ نوفمبر) + فرعٌ واحدٌ أخير `list_copy`.
-- الأصلُ المعلنُ وحدَه يرنّ (كـ`like_list_review`)، والنسخةُ نفسُها خاصّةٌ فلا يظهر اسمُها — اسمُ قائمتي أنا.
create or replace function public.my_signals()
returns table(kind text, actor_id uuid, nickname text, username text, avatar_url text, hide_name boolean,
              tmdb_id integer, media_type text, title text, at timestamp with time zone, is_new boolean,
              list_id uuid, list_slug text)
language sql
stable security definer
set search_path to 'public'
as $function$
with me as (
  select auth.uid() as uid,
         (select p.notif_seen_at from public.profiles p where p.id = auth.uid()) as seen
),
sig as (
  select 'follow'::text as kind, f.follower_id as actor_id,
         null::integer as tmdb_id, null::text as media_type, null::text as title,
         f.created_at as at,
         null::uuid as list_id, null::text as list_slug
  from public.user_follows f, me
  where f.following_id = me.uid
    and f.created_at >= now() - interval '30 days'
  union all
  select 'request', r.requester_id, null, null, null, r.created_at, null, null
  from public.follow_requests r, me
  where r.target_id = me.uid
    and r.created_at >= now() - interval '30 days'
  union all
  select 'like_review', l.liker_id, l.tmdb_id, l.media_type, rt.title, l.created_at,
         null, null
  from public.review_likes l
  left join public.ratings rt
    on rt.user_id = l.review_user_id
   and rt.tmdb_id = l.tmdb_id
   and rt.media_type = l.media_type
  cross join me
  where l.review_user_id = me.uid
    and l.created_at >= now() - interval '30 days'
  union all
  select 'like_activity', l.liker_id, l.tmdb_id, l.media_type, fo.title, l.created_at,
         null, null
  from public.activity_likes l
  left join public.follows fo
    on fo.user_id = l.actor_id
   and fo.tmdb_id = l.tmdb_id
   and fo.media_type = l.media_type
  cross join me
  where l.actor_id = me.uid
    and l.created_at >= now() - interval '30 days'
  union all
  select 'reply', r.user_id, r.tmdb_id, r.media_type, rt.title, r.created_at,
         null, null
  from public.review_replies r
  left join public.ratings rt
    on rt.user_id = r.review_user_id
   and rt.tmdb_id = r.tmdb_id
   and rt.media_type = r.media_type
  cross join me
  where r.hidden = false
    and r.user_id <> me.uid
    and (
      r.review_user_id = me.uid
      or exists (
        select 1 from public.review_replies p
         where p.id = r.parent_id and p.user_id = me.uid
      )
    )
    and r.created_at >= now() - interval '30 days'
  union all
  select 'talk_reply', r.user_id, r.tmdb_id, r.media_type, r.title, r.created_at,
         null, null
  from public.title_posts r
  cross join me
  where r.hidden = false
    and r.user_id <> me.uid
    and exists (
      select 1 from public.title_posts p
       where p.id = r.parent_id and p.user_id = me.uid
    )
    and r.created_at >= now() - interval '30 days'
  union all
  select 'list_review', lr.user_id, null, null, ul.name, lr.updated_at,
         ul.id, ul.source_slug
  from public.list_reviews lr
  join public.user_lists ul on ul.id = lr.list_id
  cross join me
  where ul.user_id = me.uid
    and lr.user_id <> me.uid
    and coalesce(lr.hidden, false) = false
    and lr.updated_at >= now() - interval '30 days'
  union all
  select 'like_list_review', k.liker_id, null, null, ul.name, k.created_at,
         ul.id, ul.source_slug
  from public.list_review_likes k
  join public.user_lists ul on ul.id = k.list_id
  cross join me
  where k.review_user_id = me.uid
    and k.liker_id <> me.uid
    and ul.is_public
    and k.created_at >= now() - interval '30 days'
  union all
  select 'list_reply', p.user_id, null, null, ul.name, p.created_at,
         ul.id, ul.source_slug
  from public.list_review_replies p
  join public.user_lists ul on ul.id = p.list_id
  cross join me
  where p.user_id <> me.uid
    and coalesce(p.hidden, false) = false
    and ul.is_public
    and p.created_at >= now() - interval '30 days'
    and (
      p.review_user_id = me.uid
      or exists (
        select 1 from public.list_review_replies q
        where q.id = p.parent_id and q.user_id = me.uid
      )
    )
  union all
  -- 🆕 233 — نسخ أحدٌ قائمتي: الجرسُ يفتح قائمتي (الأصل) لا نسختَه الخاصّة
  select 'list_copy', c.user_id, null, null, ul.name, c.created_at,
         ul.id, ul.source_slug
  from public.user_lists c
  join public.user_lists ul on ul.id = c.copied_from
  cross join me
  where ul.user_id = me.uid
    and c.user_id <> me.uid
    and ul.is_public
    and c.created_at >= now() - interval '30 days'
)
select
  s.kind,
  s.actor_id,
  case when coalesce(pr.hide_name, false) then null else pr.nickname end,
  case when coalesce(pr.hide_name, false) then null else pr.username end,
  case when coalesce(pr.hide_name, false) then null else pr.avatar_url end,
  coalesce(pr.hide_name, false),
  s.tmdb_id, s.media_type, s.title, s.at,
  (me.seen is null or s.at > me.seen) as is_new,
  s.list_id, s.list_slug
from sig s
join public.profiles pr on pr.id = s.actor_id
cross join me
where not public.is_blocked(me.uid, s.actor_id)
order by s.at desc
limit 30;
$function$;

-- التحقّق بعد التشغيل:
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'user_lists' and column_name = 'copied_from';
select p.oid::regprocedure, p.prosecdef as definer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname in ('copy_list', 'my_signals', 'user_lists_copied_from_guard');
