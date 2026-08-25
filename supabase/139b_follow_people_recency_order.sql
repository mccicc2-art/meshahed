-- 139ب: ترتيبُ الورقة بالأحدث (D-632) — الصيغةُ الأولى كانت
-- `distinct on` بلا ترتيبٍ نهائيّ فيصل الصفُّ اعتباطاً؛ والفعلُ القديم
-- كان يرتّب الحوافّ بالأحدث ثمّ يفقد الترتيب في `.in(ids)`.
-- **فالتجميعُ بأحدث حافّةٍ لكلِّ شخص، والترتيبُ عليها** — أحدثُ من
-- تابعك أوّلاً كما تقول الورقة. لا تغييرَ في أيّ قاعدة حراسة.
create or replace function public.follow_people(target uuid, dir text)
 returns table(id uuid, nickname text, username text, avatar_url text, hide_name boolean)
 language sql stable security definer
 set search_path to 'public'
as $function$
  with allowed as (
    select
      case
        when target = auth.uid() then true
        when coalesce((select hide_follow_lists from public.profiles where id = target), false) then false
        else public.can_view_profile(target)
      end as ok
  ),
  edges as (
    select
      case when dir = 'followers' then uf.follower_id else uf.following_id end as person_id,
      uf.created_at
    from public.user_follows uf, allowed a
    where a.ok
      and case when dir = 'followers' then uf.following_id else uf.follower_id end = target
    order by uf.created_at desc
    limit 200
  ),
  people as (
    select e.person_id, max(e.created_at) as at
    from edges e
    group by e.person_id
  )
  select
    p.id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false)
  from people d
  join public.profiles p on p.id = d.person_id
  where not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  )
  order by d.at desc;
$function$;
