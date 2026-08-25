-- 139: تصفّح الضيف (D-632، بحكم أحمد: «نعم يفتحها») — ورقتا
-- «متابِعون/متابَعون» تُفتحان للزائر أيضاً.
--
-- **والقاعدةُ كلُّها في دالّةٍ واحدة** لا في مِخلاق الواجهة (D-145):
-- القفلُ (`hide_follow_lists`، الهجرة ٤٣) · خصوصيّةُ الحساب
-- (`can_view_profile`) · الحظرُ في الاتجاهين · إخفاءُ الاسم — أربعُ
-- قواعدَ كانت موزّعةً بين فعلِ خادمٍ وسياسةِ جدول، **فتصير نصّاً واحداً
-- يقرؤه العضوُ والزائرُ سواء.** والجدولُ `user_follows` يبقى مغلقاً على
-- `anon` كما هو (الهجرة ١٣٨).
-- لا حذفَ ولا drop ولا تعديلَ بيانات.
--
-- ⚠️ **وهذه الصيغةُ استُبدلت في 139ب**: كانت `distinct on` بلا ترتيبٍ
-- نهائيّ فيصل الصفُّ اعتباطاً — والتالية ترتّب بالأحدث.
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
  )
  select distinct on (p.id)
    p.id,
    case when coalesce(p.hide_name, false) then null else p.nickname end,
    case when coalesce(p.hide_name, false) then null else p.username end,
    case when coalesce(p.hide_name, false) then null else p.avatar_url end,
    coalesce(p.hide_name, false)
  from edges e
  join public.profiles p on p.id = e.person_id
  where not exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = p.id)
       or (b.blocker_id = p.id and b.blocked_id = auth.uid())
  );
$function$;

revoke all on function public.follow_people(uuid, text) from public;
grant execute on function public.follow_people(uuid, text) to anon, authenticated;
