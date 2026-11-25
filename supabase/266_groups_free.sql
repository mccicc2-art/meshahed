-- 266 — إنشاءُ القروبات للجميع (T547، أحمد ٢٥ نوفمبر: «خل كل شيء مجاني .. ما عدا الربط يكمل ب اشتراك»)
--
-- كان `dm_group_create` يرفض غيرَ المشترك بـ`plus required` (هجرتا ٢٠٥ و٢١٢). الخادمُ صار يسأل `hasPerks` (`groupsCore`)
-- فيعرض «إنشاء قروب» للجميع — وهذه الدالّةُ آخرُ حارس، فتُعاد بحرفها كما هي في الإنتاج **بلا شرط الخطّة** وحده.
-- ما سواه كما كان: ١–١٥ عضواً غيرَ المنشئ، `dm_group_can_add` لكلِّ عضو، ومسارُ الصورة تحت معرّف المنشئ.
-- لا جدولَ يتغيّر ولا صلاحية — `create or replace` بالتوقيع نفسِه فالمنحُ القائم يبقى.

create or replace function public.dm_group_create(p_name text, p_members uuid[], p_photo text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  g uuid;
  ids uuid[];
  x uuid;
begin
  if me is null then raise exception 'not signed in' using errcode = '42501'; end if;
  select coalesce(array_agg(distinct u), '{}') into ids from unnest(coalesce(p_members, '{}')) u where u is not null and u <> me;
  if cardinality(ids) < 1 or cardinality(ids) > 15 then
    raise exception 'members out of range' using errcode = '22023';
  end if;
  foreach x in array ids loop
    if not public.dm_group_can_add(me, x) then
      raise exception 'cannot add member' using errcode = '42501', hint = 'member';
    end if;
  end loop;
  if p_photo is not null and p_photo !~ ('^' || me::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$') then
    raise exception 'bad photo' using errcode = '22023';
  end if;
  insert into public.dm_groups (name, photo_path, created_by) values (btrim(p_name), p_photo, me) returning id into g;
  insert into public.dm_group_members (group_id, user_id, role) values (g, me, 'owner');
  insert into public.dm_group_members (group_id, user_id, role) select g, u, 'member' from unnest(ids) u;
  insert into public.dm_group_messages (group_id, sender_id, kind, sys) values (g, me, 'system', 'created');
  return g;
end;
$$;
