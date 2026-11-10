-- 245 — لوحةُ الداعمين وسطرُ «داعم لوبز منذ» يحترمان الحسابَ الخاصّ (أحمد ١٠ نوفمبر: «أضف شرط الحساب الخاصّ للدالّتين العامّتين»)
--
-- لماذا: `gold_supporters` و`supporter_since` (الهجرة ٢٤٤) مفتوحتان للزائر، فكان صاحبُ الحساب الخاصّ يظهر باسمه وصورته
-- في لوحةٍ عامّةٍ لمن لا يتابعه — وهو اختار ألّا يراه إلا متابعوه. الشرطُ هو بوّابةُ الملفّ نفسُها (`can_view_profile`، الهجرة ١٧٩):
-- صاحبُ الحساب نفسُه، أو متابعٌ مقبول، أو من مُنح المكتبة — ولغيرهم لا يظهر في اللوحة ولا يُعاد سطرُه. الحسابُ العامّ كما كان.
-- `can_view_profile` لا تعيد NULL (١٧٩)، والزائرُ بلا جلسةٍ يرى العامّين وحدهم. لا عمودَ جديد ولا منحةَ جديدة.

create or replace function public.gold_supporters()
returns table (username text, nickname text, avatar_url text, avatar_pos smallint, since timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  -- المعرّفُ لا يخرج، و«منذ» بالشهر — اللوحةُ عامّةٌ (anon) ولا تعرض أكثرَ من ذلك
  select p.username, p.nickname, p.avatar_url, p.avatar_pos, date_trunc('month', public.gold_since(p.id)) as since
    from public.profiles p
   where p.gold_until > now()
     and public.gold_real(p.id)
     and p.suspended_at is null
     and not p.supporter_hidden
     and not coalesce(p.hide_name, false)
     and p.username is not null
     and public.can_view_profile(p.id)
   order by public.gold_since(p.id) asc nulls last, p.username asc
   limit 2000;
$$;

revoke all on function public.gold_supporters() from public;
grant execute on function public.gold_supporters() to anon, authenticated;

create or replace function public.supporter_since(p_user uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when p.gold_until > now() and public.gold_real(p.id) and p.suspended_at is null
                   and not p.supporter_hidden and not coalesce(p.hide_name, false)
                   and public.can_view_profile(p.id)
              then date_trunc('month', public.gold_since(p.id)) end
    from public.profiles p
   where p.id = p_user;
$$;

revoke all on function public.supporter_since(uuid) from public;
grant execute on function public.supporter_since(uuid) to anon, authenticated;
