-- 138: تصفّح الضيف (D-631) — بلاغان من أحمد بلقطتين:
--   (١) «ما أقدر أشوف عدد المتابعين» — `getFollowStats` تقرأ جدول
--       `user_follows` مباشرةً وسياستُه لدور authenticated وحدَه.
--       **ولا يُفتح الجدولُ لـanon**: عدّادان يُعرضان علناً لا يبرّران
--       تعدادَ شبكةِ المتابعات كلِّها عبر REST — فدالّةُ definer تُرجع
--       الرقمين وحدَهما وتحترم `can_view_profile` (خصوصيّةُ الحساب).
--   (٢) «ما أقدر أقرأ التعليقات اللي على اللستة» — دالّتا ردود
--       المراجعات وعدّاداتها فيهما `auth.uid() is not null` (نفسُ علّة
--       الهجرة ١٣٥)، فيُرجعان صفراً للزائر. الشرطُ يسقط ويبقى ترشيحُ
--       الحظر لصاحب الجلسة وحدَه.
-- لا حذفَ ولا drop ولا تعديلَ بيانات.

-- ١) عدّادا المتابعة — رقمان فقط، بلا فتح الجدول
create or replace function public.follow_stats(target uuid)
 returns table(followers integer, following integer)
 language sql stable security definer
 set search_path to 'public'
as $function$
  select
    case when public.can_view_profile(target)
      then (select count(*)::int from public.user_follows uf where uf.following_id = target)
      else 0 end,
    case when public.can_view_profile(target)
      then (select count(*)::int from public.user_follows uf where uf.follower_id = target)
      else 0 end;
$function$;

revoke all on function public.follow_stats(uuid) from public;
grant execute on function public.follow_stats(uuid) to anon, authenticated;

-- ٢) ردودُ مراجعات القوائم — الزائرُ يقرؤها
create or replace function public.list_review_replies_of(p_list uuid)
 returns table(id uuid, review_user_id uuid, parent_id uuid, author_id uuid, nickname text, username text, avatar_url text, hide_name boolean, body text, created_at timestamp with time zone)
 language sql stable security definer
 set search_path to 'public'
as $function$
  select
    r.id,
    r.review_user_id,
    r.parent_id,
    r.user_id as author_id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false),
    r.body,
    r.created_at
  from public.list_review_replies r
  join public.profiles p on p.id = r.user_id
  join public.user_lists l on l.id = r.list_id
  where r.list_id = p_list
    and l.is_public
    and r.hidden = false
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = auth.uid() and b.blocked_id = r.user_id)
         or (b.blocker_id = r.user_id and b.blocked_id = auth.uid())
    )
  order by r.created_at asc
  limit 300;
$function$;

-- ٣) قلوبُ المراجعات وعدُّ ردودها — «قلبي» يبقى false للزائر بحقّ
create or replace function public.list_review_social(p_lists uuid[])
 returns table(list_id uuid, review_user_id uuid, likes integer, replies integer, liked_by_me boolean)
 language sql stable security definer
 set search_path to 'public'
as $function$
  select
    r.list_id,
    r.user_id as review_user_id,
    (select count(*)::int from public.list_review_likes k
      where k.list_id = r.list_id and k.review_user_id = r.user_id)      as likes,
    (select count(*)::int from public.list_review_replies p
      where p.list_id = r.list_id and p.review_user_id = r.user_id
        and p.hidden = false)                                            as replies,
    exists (
      select 1 from public.list_review_likes k
      where k.list_id = r.list_id and k.review_user_id = r.user_id
        and k.liker_id = auth.uid()
    )                                                                    as liked_by_me
  from public.list_reviews r
  join public.user_lists l on l.id = r.list_id
  where r.list_id = any (p_lists)
    and l.is_public
    and coalesce(r.hidden, false) = false
    and public.can_view_profile(r.user_id);
$function$;
